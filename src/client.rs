//! Client implementation for the `bore` service.

use std::sync::Arc;

use anyhow::{bail, Context, Result};
use tokio::{io::AsyncWriteExt, net::TcpStream, time::timeout};
use tracing::{error, info, info_span, warn, Instrument};
use uuid::Uuid;

use crate::auth::Authenticator;
use crate::shared::{ClientMessage, Delimited, ServerMessage, CONTROL_PORT, NETWORK_TIMEOUT};

/// State structure for the client.
pub struct Client {
    /// Control connection to the server.
    conn: Option<Delimited<TcpStream>>,

    /// Destination address of the server.
    to: String,

    // Local host that is forwarded.
    local_host: String,

    /// Local port that is forwarded.
    local_port: u16,

    /// Port that is publicly available on the remote.
    remote_port: u16,

    /// Optional API key for backend authentication.
    api_key: Option<String>,

    /// Optional secret used to authenticate clients (legacy).
    auth: Option<Authenticator>,
}

impl Client {
    /// Create a new client.
    ///
    /// The `secret` parameter can be either:
    /// - An API key (e.g., "sk_live_...") for backend authentication
    /// - A shared secret for legacy HMAC authentication (deprecated)
    pub async fn new(
        local_host: &str,
        local_port: u16,
        to: &str,
        port: u16,
        secret: Option<&str>,
    ) -> Result<Self> {
        let mut stream = Delimited::new(connect_with_timeout(to, CONTROL_PORT).await?);
        
        // Determine authentication mode based on secret format
        // The client supports two modes:
        // 1. API Key mode: secret starts with "sk_" - sent directly to backend for validation
        // 2. Legacy HMAC mode: any other secret - uses challenge-response protocol
        let is_api_key = secret.map(|s| s.starts_with("sk_")).unwrap_or(false);
        
        let (api_key, auth) = if is_api_key {
            // API Key authentication mode (recommended)
            // Protocol: Client sends Authenticate → Hello → Server responds with Hello
            if let Some(key) = secret {
                info!("Authenticating with API key");
                stream.send(ClientMessage::Authenticate(key.to_string())).await?;
                (Some(key.to_string()), None)
            } else {
                (None, None)
            }
        } else {
            // Legacy HMAC challenge-response authentication mode (deprecated)
            // Protocol: Client sends Hello → Server may send Challenge → Client responds
            let auth = secret.map(Authenticator::new);
            if let Some(auth) = &auth {
                warn!("Using legacy HMAC authentication (deprecated)");
                // Note: In legacy mode, we don't send Authenticate here.
                // The client sends Hello first, and the server may send Challenge.
            }
            (None, auth)
        };

        // Send Hello to request port
        stream.send(ClientMessage::Hello(port)).await?;
        
        // Handle server response - the protocol flow varies based on auth mode
        // API Key mode: Server sends Hello immediately (already authenticated)
        // Legacy mode: Server may send Challenge first, then Hello after auth
        let first_response = stream.recv_timeout().await?;
        
        let remote_port = match first_response {
            Some(ServerMessage::Challenge(_)) => {
                // Server requires legacy HMAC authentication
                // This happens when server has a shared secret configured
                if let Some(ref authenticator) = auth {
                    info!("Received challenge, performing HMAC handshake");
                    // Complete the challenge-response handshake
                    authenticator.client_handshake(&mut stream).await?;
                    
                    // After successful authentication, server sends Hello with assigned port
                    match stream.recv_timeout().await? {
                        Some(ServerMessage::Hello(remote_port)) => remote_port,
                        Some(ServerMessage::Error(message)) => bail!("server error: {message}"),
                        Some(_) => bail!("unexpected message after authentication"),
                        None => bail!("unexpected EOF after authentication"),
                    }
                } else {
                    // Server requires auth but client has no secret configured
                    bail!("server requires authentication, but no client secret was provided");
                }
            }
            Some(ServerMessage::Hello(remote_port)) => {
                // Server accepted connection and assigned port immediately
                // This is the normal flow for API key auth or no-auth mode
                remote_port
            }
            Some(ServerMessage::Error(message)) => bail!("server error: {message}"),
            Some(_) => bail!("unexpected initial non-hello message"),
            None => bail!("unexpected EOF"),
        };
        
        info!(remote_port, "connected to server");
        info!("listening at {to}:{remote_port}");
        println!("\n✓ Tunnel established!");
        println!("  Public URL: {to}:{remote_port}");
        println!("  Forwarding to: {local_host}:{local_port}\n");

        Ok(Client {
            conn: Some(stream),
            to: to.to_string(),
            local_host: local_host.to_string(),
            local_port,
            remote_port,
            api_key,
            auth,
        })
    }

    /// Returns the port publicly available on the remote.
    pub fn remote_port(&self) -> u16 {
        self.remote_port
    }

    /// Start the client, listening for new connections.
    pub async fn listen(mut self) -> Result<()> {
        let mut conn = self.conn.take().unwrap();
        let this = Arc::new(self);
        loop {
            match conn.recv().await? {
                Some(ServerMessage::Hello(_)) => warn!("unexpected hello"),
                Some(ServerMessage::Challenge(_)) => warn!("unexpected challenge"),
                Some(ServerMessage::Heartbeat) => (),
                Some(ServerMessage::Connection(id)) => {
                    let this = Arc::clone(&this);
                    tokio::spawn(
                        async move {
                            info!("new connection");
                            match this.handle_connection(id).await {
                                Ok(_) => info!("connection exited"),
                                Err(err) => warn!(%err, "connection exited with error"),
                            }
                        }
                        .instrument(info_span!("proxy", %id)),
                    );
                }
                Some(ServerMessage::Error(err)) => error!(%err, "server error"),
                None => return Ok(()),
            }
        }
    }

    async fn handle_connection(&self, id: Uuid) -> Result<()> {
        // Establish a new connection to the server for this tunnel session
        let mut remote_conn =
            Delimited::new(connect_with_timeout(&self.to[..], CONTROL_PORT).await?);
        
        // Authenticate if using API key or legacy auth
        if let Some(api_key) = &self.api_key {
            // API key mode: Server already validated us during initial connection
            // Accept messages don't require re-authentication
        } else if let Some(auth) = &self.auth {
            // Legacy mode: Each new connection requires HMAC handshake
            auth.client_handshake(&mut remote_conn).await?;
        }
        
        // Tell server we're accepting this specific connection ID
        remote_conn.send(ClientMessage::Accept(id)).await?;
        
        // Connect to the local service being forwarded
        let mut local_conn = connect_with_timeout(&self.local_host, self.local_port).await?;
        
        // Extract the underlying TCP stream from the framed codec
        // The codec may have buffered some data already received from the server
        let mut parts = remote_conn.into_parts();
        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");
        
        // Forward any buffered data to the local connection
        // In most cases this is empty, but if the server sent data immediately,
        // we need to forward it before starting bidirectional copy
        local_conn.write_all(&parts.read_buf).await?;
        
        // Begin bidirectional forwarding between local and remote connections
        // This continues until either side closes the connection
        tokio::io::copy_bidirectional(&mut local_conn, &mut parts.io).await?;
        Ok(())
    }
}

async fn connect_with_timeout(to: &str, port: u16) -> Result<TcpStream> {
    match timeout(NETWORK_TIMEOUT, TcpStream::connect((to, port))).await {
        Ok(res) => res,
        Err(err) => Err(err.into()),
    }
    .with_context(|| format!("could not connect to {to}:{port}"))
}

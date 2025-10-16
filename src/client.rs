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
        
        // Check if secret looks like an API key (starts with sk_)
        let is_api_key = secret.map(|s| s.starts_with("sk_")).unwrap_or(false);
        
        let (api_key, auth) = if is_api_key {
            // New mode: Send API key directly for backend validation
            if let Some(key) = secret {
                info!("Authenticating with API key");
                stream.send(ClientMessage::Authenticate(key.to_string())).await?;
                (Some(key.to_string()), None)
            } else {
                (None, None)
            }
        } else {
            // Legacy mode: Use HMAC challenge-response
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
        
        // Receive response - may be Hello or Challenge
        let first_response = stream.recv_timeout().await?;
        
        let remote_port = match first_response {
            Some(ServerMessage::Challenge(_)) => {
                // Server sent a challenge - we need to authenticate
                if let Some(ref authenticator) = auth {
                    info!("Received challenge, performing HMAC handshake");
                    authenticator.client_handshake(&mut stream).await?;
                    
                    // Now wait for the Hello message after successful auth
                    match stream.recv_timeout().await? {
                        Some(ServerMessage::Hello(remote_port)) => remote_port,
                        Some(ServerMessage::Error(message)) => bail!("server error: {message}"),
                        Some(_) => bail!("unexpected message after authentication"),
                        None => bail!("unexpected EOF after authentication"),
                    }
                } else {
                    bail!("server requires authentication, but no client secret was provided");
                }
            }
            Some(ServerMessage::Hello(remote_port)) => remote_port,
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
        let mut remote_conn =
            Delimited::new(connect_with_timeout(&self.to[..], CONTROL_PORT).await?);
        
        // Authenticate if using API key or legacy auth
        if let Some(api_key) = &self.api_key {
            // New mode: Send API key (but server won't check it again for Accept messages)
            // We just send Accept directly
        } else if let Some(auth) = &self.auth {
            // Legacy mode: Do handshake
            auth.client_handshake(&mut remote_conn).await?;
        }
        
        remote_conn.send(ClientMessage::Accept(id)).await?;
        let mut local_conn = connect_with_timeout(&self.local_host, self.local_port).await?;
        let mut parts = remote_conn.into_parts();
        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");
        local_conn.write_all(&parts.read_buf).await?; // mostly of the cases, this will be empty
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

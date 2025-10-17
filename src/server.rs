//! Server implementation for the `bore` service.

use std::net::{IpAddr, Ipv4Addr};
use std::{io, ops::RangeInclusive, sync::Arc, time::Duration};

use anyhow::Result;
use dashmap::DashMap;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};
use tracing::{info, info_span, warn, Instrument};
use uuid::Uuid;

use crate::auth::Authenticator;
use crate::backend::BackendClient;
use crate::shared::{ClientMessage, Delimited, ServerMessage, CONTROL_PORT};

/// State structure for the server.
pub struct Server {
    /// Range of TCP ports that can be forwarded.
    port_range: RangeInclusive<u16>,

    /// Optional secret used to authenticate clients (deprecated).
    auth: Option<Authenticator>,

    /// Backend API client for user authentication and usage tracking.
    backend: Arc<BackendClient>,

    /// Server ID for multi-server deployments.
    server_id: String,

    /// Concurrent map of IDs to incoming connections.
    conns: Arc<DashMap<Uuid, TcpStream>>,

    /// Concurrent map of user IDs to their active tunnel count.
    user_tunnels: Arc<DashMap<String, u32>>,

    /// IP address where the control server will bind to.
    bind_addr: IpAddr,

    /// IP address where tunnels will listen on.
    bind_tunnels: IpAddr,
}

impl Server {
    /// Create a new server with backend API integration.
    ///
    /// If `backend_url` is None, the server will fall back to using the
    /// optional `secret` for authentication (deprecated mode).
    pub fn new(
        port_range: RangeInclusive<u16>,
        secret: Option<&str>,
        backend_url: Option<String>,
        server_id: String,
    ) -> Self {
        assert!(!port_range.is_empty(), "must provide at least one port");

        let backend = BackendClient::new(backend_url.clone());

        if backend_url.is_some() {
            info!("Backend API enabled - using individual user authentication");
        } else if secret.is_some() {
            warn!("Running in legacy mode with shared secret (not recommended for production)");
        } else {
            warn!("Running without authentication - all connections allowed!");
        }

        Server {
            port_range,
            conns: Arc::new(DashMap::new()),
            user_tunnels: Arc::new(DashMap::new()),
            auth: secret.map(Authenticator::new),
            backend: Arc::new(backend),
            server_id,
            bind_addr: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            bind_tunnels: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
        }
    }

    /// Set the IP address where tunnels will listen on.
    pub fn set_bind_addr(&mut self, bind_addr: IpAddr) {
        self.bind_addr = bind_addr;
    }

    /// Set the IP address where the control server will bind to.
    pub fn set_bind_tunnels(&mut self, bind_tunnels: IpAddr) {
        self.bind_tunnels = bind_tunnels;
    }

    /// Start the server, listening for new connections.
    pub async fn listen(self) -> Result<()> {
        let this = Arc::new(self);
        let listener = TcpListener::bind((this.bind_addr, CONTROL_PORT)).await?;
        info!(addr = ?this.bind_addr, "server listening");

        loop {
            let (stream, addr) = listener.accept().await?;
            let this = Arc::clone(&this);
            tokio::spawn(
                async move {
                    info!("incoming connection");
                    if let Err(err) = this.handle_connection(stream).await {
                        warn!(%err, "connection exited with error");
                    } else {
                        info!("connection exited");
                    }
                }
                .instrument(info_span!("control", ?addr)),
            );
        }
    }

    async fn create_listener(&self, port: u16) -> Result<TcpListener, &'static str> {
        let try_bind = |port: u16| async move {
            TcpListener::bind((self.bind_tunnels, port))
                .await
                .map_err(|err| match err.kind() {
                    io::ErrorKind::AddrInUse => "port already in use",
                    io::ErrorKind::PermissionDenied => "permission denied",
                    _ => "failed to bind to port",
                })
        };
        if port > 0 {
            // Client requests a specific port number.
            if !self.port_range.contains(&port) {
                return Err("client port number not in allowed range");
            }
            try_bind(port).await
        } else {
            // Client requests any available port in range.
            //
            // We use a probabilistic approach: try binding to 150 random port numbers.
            // This value is derived from probability theory to ensure high success rates:
            //
            // To find a free port with probability at least 1-δ, when ε proportion of the
            // ports are currently available, it suffices to check approximately -2 ln(δ) / ε
            // independently and uniformly chosen ports (up to a second-order term in ε).
            //
            // With 150 attempts, we achieve:
            // - 99.999% success rate (δ=0.00001)
            // - When 85% of ports are available (ε=0.15)
            //
            // This approach is more efficient than sequential scanning and distributes
            // load evenly across the port range.
            for _ in 0..150 {
                // Generate a random port within the allowed range
                let port = fastrand::u16(self.port_range.clone());
                match try_bind(port).await {
                    Ok(listener) => return Ok(listener),
                    Err(_) => continue, // Port unavailable, try next random port
                }
            }
            Err("failed to find an available port")
        }
    }

    async fn handle_connection(&self, stream: TcpStream) -> Result<()> {
        let mut stream = Delimited::new(stream);
        
        // Authentication: Try backend API first, then fall back to legacy auth
        let user_id: String;
        let max_tunnels: u32;
        let requested_port: u16;

        // First, expect either Authenticate (with API key), Hello (legacy), or Accept (forwarding)
        let first_msg = stream.recv_timeout().await?;
        
        match first_msg {
            Some(ClientMessage::Accept(id)) => {
                // This is a forwarding connection (client accepting an incoming connection)
                // The flow: External client → Server stores stream → Notifies bore client →
                // Bore client sends Accept(id) → Server matches ID and forwards data
                info!(%id, "forwarding connection");
                match self.conns.remove(&id) {
                    Some((_, mut stream2)) => {
                        // stream = bore client connection (just received Accept message)
                        // stream2 = external client connection (waiting to be forwarded)
                        
                        // Extract underlying TCP stream from the framed codec
                        let mut parts = stream.into_parts();
                        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");
                        
                        // Forward any buffered data from bore client to external client
                        // Usually empty, but handles edge cases where data arrives before Accept
                        stream2.write_all(&parts.read_buf).await?;
                        
                        // Begin bidirectional forwarding: external client ↔ bore client ↔ local service
                        tokio::io::copy_bidirectional(&mut parts.io, &mut stream2).await?;
                    }
                    None => {
                        // Connection ID not found - likely timed out or already handled
                        warn!(%id, "missing connection")
                    },
                }
                return Ok(());
            }
            Some(ClientMessage::Authenticate(api_key)) => {
                // Backend API authentication with individual user API keys
                info!("Authenticating with backend API");
                
                let validation = match self.backend.validate_api_key(&api_key).await {
                    Ok(v) => v,
                    Err(err) => {
                        warn!(%err, "Failed to connect to backend API");
                        stream.send(ServerMessage::Error(
                            "Authentication service unavailable".to_string()
                        )).await?;
                        return Ok(());
                    }
                };

                if !validation.valid {
                    warn!("Invalid API key");
                    stream.send(ServerMessage::Error(
                        validation.message.unwrap_or_else(|| "Invalid API key".to_string())
                    )).await?;
                    return Ok(());
                }

                if !validation.usage_allowed {
                    warn!("Usage not allowed for user");
                    stream.send(ServerMessage::Error(
                        validation.message.unwrap_or_else(|| 
                            "Subscription expired or usage limit exceeded. Please visit the dashboard.".to_string()
                        )
                    )).await?;
                    return Ok(());
                }

                user_id = validation.user_id.expect("user_id should be present for valid key");
                max_tunnels = validation.max_concurrent_tunnels.unwrap_or(5);
                
                info!(
                    user_id = %user_id,
                    plan = ?validation.plan_type,
                    "User authenticated successfully"
                );

                // Check concurrent tunnel limit
                let current_tunnels = self.user_tunnels.get(&user_id).map(|v| *v).unwrap_or(0);
                if current_tunnels >= max_tunnels {
                    warn!(
                        user_id = %user_id,
                        current = current_tunnels,
                        max = max_tunnels,
                        "Concurrent tunnel limit reached"
                    );
                    stream.send(ServerMessage::Error(format!(
                        "Maximum concurrent tunnels ({}) reached. Please disconnect an existing tunnel or upgrade your plan.",
                        max_tunnels
                    ))).await?;
                    return Ok(());
                }

                // Now expect Hello message with port request
                match stream.recv_timeout().await? {
                    Some(ClientMessage::Hello(port)) => {
                        requested_port = port;
                    }
                    _ => {
                        warn!("Expected Hello message after authentication");
                        stream.send(ServerMessage::Error("Protocol error".to_string())).await?;
                        return Ok(());
                    }
                }
            }
            Some(ClientMessage::Hello(port)) => {
                // Legacy mode: using shared secret or no auth
                if let Some(auth) = &self.auth {
                    // Send challenge and validate
                    if let Err(err) = auth.server_handshake(&mut stream).await {
                        warn!(%err, "Legacy auth handshake failed");
                        stream.send(ServerMessage::Error(err.to_string())).await?;
                        return Ok(());
                    }
                }
                
                user_id = "legacy-user".to_string();
                max_tunnels = 999; // No limit in legacy mode
                requested_port = port;
                
                info!("Using legacy authentication mode");
            }
            _ => {
                warn!("Unexpected initial message");
                stream.send(ServerMessage::Error("Expected authentication or hello".to_string())).await?;
                return Ok(());
            }
        }

        // Create listener for the requested port
        match self.handle_tunnel_session(stream, user_id, requested_port, max_tunnels).await {
            Ok(_) => Ok(()),
            Err(err) => {
                warn!(%err, "Tunnel session error");
                Err(err)
            }
        }
    }

    async fn handle_tunnel_session(
        &self,
        mut stream: Delimited<TcpStream>,
        user_id: String,
        requested_port: u16,
        _max_tunnels: u32,
    ) -> Result<()> {
        // Create listener
        let listener = match self.create_listener(requested_port).await {
            Ok(listener) => listener,
            Err(err) => {
                stream.send(ServerMessage::Error(err.into())).await?;
                return Ok(());
            }
        };
        
        let host = listener.local_addr()?.ip();
        let public_port = listener.local_addr()?.port();
        
        info!(
            user_id = %user_id,
            public_port = public_port,
            "Tunnel session started"
        );

        // Increment user's tunnel count
        self.user_tunnels
            .entry(user_id.clone())
            .and_modify(|count| *count += 1)
            .or_insert(1);

        // Log tunnel start with backend
        let session_id = match self.backend.log_tunnel_start(
            &user_id,
            public_port,
            requested_port,
            &self.server_id,
        ).await {
            Ok(id) => id,
            Err(err) => {
                warn!(%err, "Failed to log tunnel start");
                format!("session-{}", Uuid::new_v4())
            }
        };

        // Send Hello with assigned port
        stream.send(ServerMessage::Hello(public_port)).await?;

        // Main tunnel loop
        let result = self.run_tunnel_loop(&mut stream, public_port, listener).await;

        // Cleanup: decrement tunnel count
        if let Some(mut count) = self.user_tunnels.get_mut(&user_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                drop(count);
                self.user_tunnels.remove(&user_id);
            }
        }

        // Log tunnel end
        if let Err(err) = self.backend.log_tunnel_end(&session_id, 0).await {
            warn!(%err, "Failed to log tunnel end");
        }

        info!(
            user_id = %user_id,
            public_port = public_port,
            session_id = %session_id,
            "Tunnel session ended"
        );

        result
    }

    async fn run_tunnel_loop(
        &self,
        stream: &mut Delimited<TcpStream>,
        port: u16,
        listener: TcpListener,
    ) -> Result<()> {
        loop {
            if stream.send(ServerMessage::Heartbeat).await.is_err() {
                // Assume that the TCP connection has been dropped.
                return Ok(());
            }
            
            // Poll for new connections with a timeout to allow heartbeat checks
            const TIMEOUT: Duration = Duration::from_millis(500);
            if let Ok(result) = timeout(TIMEOUT, listener.accept()).await {
                let (stream2, addr) = result?;
                info!(?addr, ?port, "new connection");

                // Generate unique ID for this connection to match client's Accept message
                let id = Uuid::new_v4();
                let conns = Arc::clone(&self.conns);

                // Store the external client connection temporarily
                conns.insert(id, stream2);
                
                // Spawn a cleanup task to prevent memory leaks from unaccepted connections
                // If the bore client doesn't send Accept(id) within 10 seconds, we remove
                // the stored connection. This handles cases where:
                // - The bore client crashes or disconnects
                // - Network issues prevent the Connection message from arriving
                // - The client rejects the connection for any reason
                tokio::spawn(async move {
                    sleep(Duration::from_secs(10)).await;
                    if conns.remove(&id).is_some() {
                        warn!(%id, "removed stale connection");
                    }
                });
                
                // Notify bore client of the new connection
                stream.send(ServerMessage::Connection(id)).await?;
            }
        }
    }
}

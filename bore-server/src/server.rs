//! Server implementation for the `bore` service.

use std::net::{IpAddr, Ipv4Addr};
use std::{io, ops::RangeInclusive, sync::Arc, time::Duration};

use anyhow::Result;
use dashmap::DashMap;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};
use tracing::{error, info, info_span, warn, Instrument};
use uuid::Uuid;

use bore_shared::{Authenticator, ClientMessage, Delimited, ServerMessage, CONTROL_PORT};

use crate::backend::BackendClient;

/// Timeout for polling new connections while allowing heartbeat checks.
const HEARTBEAT_POLL_TIMEOUT: Duration = Duration::from_millis(500);

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
        backend_api_key: Option<String>,
        server_id: String,
    ) -> Self {
        assert!(!port_range.is_empty(), "must provide at least one port");

        let backend = BackendClient::new(backend_url.clone(), backend_api_key.clone());

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
        let mut instance_id: Option<String> = None;

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
                    }
                }
                return Ok(());
            }
            Some(ClientMessage::Authenticate(api_key)) => {
                // SECURITY: Reject Authenticate when backend is disabled but legacy auth is configured.
                // In legacy mode, clients MUST use Hello → Challenge → Response flow.
                // Allowing Authenticate here would bypass HMAC validation since disabled backend
                // returns automatic success.
                if !self.backend.enabled && self.auth.is_some() {
                    warn!("Rejecting Authenticate message in legacy shared-secret mode");
                    stream
                        .send(ServerMessage::Error(
                            "Authentication method not supported. Use shared secret mode."
                                .to_string(),
                        ))
                        .await?;
                    return Ok(());
                }

                // Backend API authentication with individual user API keys
                info!("Authenticating with backend API");

                let validation = match self.backend.validate_api_key(&api_key).await {
                    Ok(v) => v,
                    Err(err) => {
                        warn!(%err, "Failed to connect to backend API");
                        stream
                            .send(ServerMessage::Error(
                                "Authentication service unavailable".to_string(),
                            ))
                            .await?;
                        return Ok(());
                    }
                };

                if !validation.valid {
                    warn!("Invalid API key");
                    stream
                        .send(ServerMessage::Error(
                            validation
                                .message
                                .unwrap_or_else(|| "Invalid API key".to_string()),
                        ))
                        .await?;
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

                // CRITICAL: Don't panic on missing user_id - handle gracefully to prevent DoS
                // Backend bugs (data migration, partial rollouts, etc.) should not crash the server
                let Some(validated_user_id) = validation.user_id else {
                    error!(
                        "Backend returned valid=true but missing user_id. This is a backend bug. \
                        Rejecting connection to prevent undefined behavior."
                    );
                    stream
                        .send(ServerMessage::Error(
                            "Authentication service returned invalid data. Please contact support."
                                .to_string(),
                        ))
                        .await?;
                    return Ok(());
                };

                user_id = validated_user_id;
                max_tunnels = validation.max_concurrent_tunnels.unwrap_or(5);

                instance_id = validation.instance_id.clone();

                info!(
                    user_id = %user_id,
                    instance_id = ?instance_id,
                    plan = ?validation.plan_type,
                    "User authenticated successfully"
                );

                // Note: Tunnel limit will be checked atomically in handle_tunnel_session

                // Now expect Hello message with port request
                match stream.recv_timeout().await? {
                    Some(ClientMessage::Hello(port)) => {
                        requested_port = port;
                    }
                    _ => {
                        warn!("Expected Hello message after authentication");
                        stream
                            .send(ServerMessage::Error("Protocol error".to_string()))
                            .await?;
                        return Ok(());
                    }
                }
            }
            Some(ClientMessage::Hello(port)) => {
                // Client sent Hello without Authenticate - check if this is allowed

                // If backend is enabled, reject unauthenticated Hello
                if self.backend.enabled && self.auth.is_none() {
                    warn!("Rejecting unauthenticated Hello - backend auth required");
                    stream
                        .send(ServerMessage::Error(
                            "Authentication required. Please provide a valid API key.".to_string(),
                        ))
                        .await?;
                    return Ok(());
                }

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
                stream
                    .send(ServerMessage::Error(
                        "Expected authentication or hello".to_string(),
                    ))
                    .await?;
                return Ok(());
            }
        }

        // Create listener for the requested port
        match self
            .handle_tunnel_session(stream, user_id, instance_id, requested_port, max_tunnels)
            .await
        {
            Ok(()) => Ok(()),
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
        instance_id: Option<String>,
        requested_port: u16,
        max_tunnels: u32,
    ) -> Result<()> {
        // Atomically check and increment concurrent tunnel limit using DashMap's entry API.
        // This prevents race conditions where multiple connections check the limit simultaneously
        // and could both bypass the limit before either increments the counter.
        //
        // The entry API provides atomic check-then-act semantics:
        // 1. Lock the entry for this user_id
        // 2. Check current count vs limit
        // 3. Increment if allowed
        // 4. Release lock
        // All happen atomically, preventing race conditions.
        use dashmap::mapref::entry::Entry;
        let limit_ok = match self.user_tunnels.entry(user_id.clone()) {
            Entry::Occupied(mut entry) => {
                // User already has active tunnels
                let current = *entry.get();
                if current >= max_tunnels {
                    // At or over limit - reject this tunnel
                    warn!(
                        user_id = %user_id,
                        current = current,
                        max = max_tunnels,
                        "Concurrent tunnel limit reached"
                    );
                    false
                } else {
                    // Under limit - atomically increment and allow
                    *entry.get_mut() += 1;
                    true
                }
            }
            Entry::Vacant(entry) => {
                // User's first tunnel
                if max_tunnels == 0 {
                    // Special case: zero tunnels allowed
                    warn!(user_id = %user_id, "Concurrent tunnel limit is 0");
                    false
                } else {
                    // Initialize counter to 1 and allow
                    entry.insert(1);
                    true
                }
            }
        };

        if !limit_ok {
            stream.send(ServerMessage::Error(format!(
                "Maximum concurrent tunnels ({max_tunnels}) reached. Please disconnect an existing tunnel or upgrade your plan."
            ))).await?;
            return Ok(());
        }

        // Create listener
        let listener = match self.create_listener(requested_port).await {
            Ok(listener) => listener,
            Err(err) => {
                // Decrement the count since we're not creating a tunnel
                if let Some(mut count) = self.user_tunnels.get_mut(&user_id) {
                    *count = count.saturating_sub(1);
                    if *count == 0 {
                        drop(count);
                        self.user_tunnels.remove(&user_id);
                    }
                }
                stream.send(ServerMessage::Error(err.into())).await?;
                return Ok(());
            }
        };

        let _host = listener.local_addr()?.ip();
        let public_port = listener.local_addr()?.port();

        info!(
            user_id = %user_id,
            public_port = public_port,
            "Tunnel session started"
        );

        // CRITICAL: Send Hello FIRST to prevent client timeout (3s), then log in background
        // Backend logging can take up to 5s, which exceeds client's NETWORK_TIMEOUT
        stream.send(ServerMessage::Hello(public_port)).await?;

        // Log tunnel start with backend (in background to not block)
        let backend_clone = Arc::clone(&self.backend);
        let user_id_clone = user_id.clone();
        let server_id_clone = self.server_id.clone();
        let session_id_handle = tokio::spawn(async move {
            match backend_clone
                .log_tunnel_start(
                    &user_id_clone,
                    public_port,
                    requested_port,
                    &server_id_clone,
                )
                .await
            {
                Ok(id) => id,
                Err(err) => {
                    warn!(%err, "Failed to log tunnel start");
                    format!("session-{}", Uuid::new_v4())
                }
            }
        });

        if let Some(instance_id) = instance_id.clone() {
            let backend = Arc::clone(&self.backend);
            tokio::spawn(async move {
                if let Err(err) = backend
                    .notify_tunnel_connected(&instance_id, Some(public_port), None)
                    .await
                {
                    warn!(
                        %err,
                        instance_id = %instance_id,
                        public_port = public_port,
                        "Failed to notify backend of tunnel connection"
                    );
                }
            });
        }

        // Main tunnel loop
        let result = self
            .run_tunnel_loop(&mut stream, public_port, listener)
            .await;

        if let Some(instance_id) = instance_id {
            let backend = Arc::clone(&self.backend);
            tokio::spawn(async move {
                if let Err(err) = backend.notify_tunnel_disconnected(&instance_id).await {
                    warn!(
                        %err,
                        instance_id = %instance_id,
                        "Failed to notify backend of tunnel disconnect"
                    );
                }
            });
        }

        // Cleanup: decrement tunnel count
        if let Some(mut count) = self.user_tunnels.get_mut(&user_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                drop(count);
                self.user_tunnels.remove(&user_id);
            }
        }

        // Get session_id from background task
        let session_id = match session_id_handle.await {
            Ok(id) => id,
            Err(err) => {
                warn!(%err, "Failed to await session_id task");
                format!("session-{}", Uuid::new_v4())
            }
        };

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
            if let Ok(result) = timeout(HEARTBEAT_POLL_TIMEOUT, listener.accept()).await {
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

/// Mock backend server for testing without external dependencies
use anyhow::Result;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// Mock backend server state
#[derive(Clone)]
#[allow(dead_code)]
pub struct MockBackend {
    users: Arc<Mutex<HashMap<String, User>>>,
    instances: Arc<Mutex<HashMap<String, Instance>>>,
    api_keys: Arc<Mutex<HashMap<String, String>>>, // api_key -> user_id
    tunnel_tokens: Arc<Mutex<HashMap<String, TunnelToken>>>,
    port: u16,
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct User {
    id: String,
    email: String,
    password_hash: String,
    api_key: String,
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct Instance {
    id: String,
    user_id: String,
    name: String,
    local_port: u16,
    remote_port: Option<u16>,
    status: String,
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct TunnelToken {
    token: String,
    instance_id: String,
    user_id: String,
    expires_at: SystemTime,
}

#[allow(dead_code)]
impl MockBackend {
    /// Create a new mock backend server
    pub fn new(port: u16) -> Self {
        Self {
            users: Arc::new(Mutex::new(HashMap::new())),
            instances: Arc::new(Mutex::new(HashMap::new())),
            api_keys: Arc::new(Mutex::new(HashMap::new())),
            tunnel_tokens: Arc::new(Mutex::new(HashMap::new())),
            port,
        }
    }

    /// Start the mock backend server
    pub async fn start(self) -> Result<()> {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", self.port)).await?;
        println!("Mock backend listening on 127.0.0.1:{}", self.port);

        loop {
            let (mut socket, _) = listener.accept().await?;
            let backend = self.clone();

            tokio::spawn(async move {
                let mut buffer = vec![0u8; 4096];

                match socket.read(&mut buffer).await {
                    Ok(n) if n > 0 => {
                        let request = String::from_utf8_lossy(&buffer[..n]);
                        let response = backend.handle_request(&request).await;
                        let _ = socket.write_all(response.as_bytes()).await;
                    }
                    _ => {}
                }
            });
        }
    }

    /// Handle HTTP requests
    async fn handle_request(&self, request: &str) -> String {
        let lines: Vec<&str> = request.lines().collect();
        if lines.is_empty() {
            return self.error_response(400, "Bad Request");
        }

        let request_line: Vec<&str> = lines[0].split_whitespace().collect();
        if request_line.len() < 2 {
            return self.error_response(400, "Bad Request");
        }

        let method = request_line[0];
        let path = request_line[1];

        // Extract body for POST/PUT requests
        let body = if let Some(pos) = request.find("\r\n\r\n") {
            &request[pos + 4..]
        } else {
            ""
        };

        // Route requests
        match (method, path) {
            ("GET", "/health") => self.health_check(),
            ("POST", path) if path.starts_with("/api/internal/validate-key") => {
                self.validate_api_key_internal(body)
            }
            ("POST", path) if path.starts_with("/api/v1/auth/validate") => {
                self.validate_api_key(body)
            }
            ("POST", path) if path.starts_with("/api/v1/auth/validate-tunnel-token") => {
                self.validate_tunnel_token(body)
            }
            _ => self.error_response(404, "Not Found"),
        }
    }

    fn health_check(&self) -> String {
        let body = json!({
            "status": "healthy",
            "service": "mock-backend"
        });
        self.json_response(200, &body)
    }

    fn validate_api_key_internal(&self, body: &str) -> String {
        // Parse the API key from request body (bore-server format)
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(api_key) = json["api_key"].as_str() {
                // Check if it's a tunnel token (starts with "tk_")
                if api_key.starts_with("tk_") {
                    let tokens = self.tunnel_tokens.lock().unwrap();
                    if let Some(tunnel_token) = tokens.get(api_key) {
                        // Check if token is expired
                        if std::time::SystemTime::now() < tunnel_token.expires_at {
                            let body = json!({
                                "valid": true,
                                "user_id": tunnel_token.user_id,
                                "email": "test@example.com",
                                "plan_type": "pro",
                                "max_concurrent_tunnels": 10,
                                "max_bandwidth_gb": 1000,
                                "usage_allowed": true,
                                "message": null,
                                "instance_id": tunnel_token.instance_id
                            });
                            return self.json_response(200, &body);
                        }
                    }
                } else {
                    // Regular API key validation
                    let api_keys = self.api_keys.lock().unwrap();
                    if let Some(user_id) = api_keys.get(api_key) {
                        let users = self.users.lock().unwrap();
                        if let Some(user) = users.get(user_id) {
                            let body = json!({
                                "valid": true,
                                "user_id": user.id,
                                "email": user.email,
                                "plan_type": "pro",
                                "max_concurrent_tunnels": 10,
                                "max_bandwidth_gb": 1000,
                                "usage_allowed": true,
                                "message": null,
                                "instance_id": null
                            });
                            return self.json_response(200, &body);
                        }
                    }
                }
            }
        }

        let body = json!({
            "valid": false,
            "user_id": null,
            "email": null,
            "plan_type": null,
            "max_concurrent_tunnels": null,
            "max_bandwidth_gb": null,
            "usage_allowed": false,
            "message": "Invalid API key",
            "instance_id": null
        });
        self.json_response(200, &body)
    }

    fn validate_api_key(&self, body: &str) -> String {
        // Parse the API key from request body
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(api_key) = json["api_key"].as_str() {
                let api_keys = self.api_keys.lock().unwrap();
                if let Some(user_id) = api_keys.get(api_key) {
                    let users = self.users.lock().unwrap();
                    if let Some(user) = users.get(user_id) {
                        let body = json!({
                            "valid": true,
                            "user_id": user.id,
                            "email": user.email,
                            "plan": "pro"
                        });
                        return self.json_response(200, &body);
                    }
                }
            }
        }

        let body = json!({
            "valid": false,
            "error": "Invalid API key"
        });
        self.json_response(401, &body)
    }

    fn validate_tunnel_token(&self, body: &str) -> String {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(token) = json["tunnel_token"].as_str() {
                let tokens = self.tunnel_tokens.lock().unwrap();
                if let Some(tunnel_token) = tokens.get(token) {
                    // Check if token is expired
                    if SystemTime::now() < tunnel_token.expires_at {
                        let body = json!({
                            "valid": true,
                            "instance_id": tunnel_token.instance_id,
                            "user_id": tunnel_token.user_id
                        });
                        return self.json_response(200, &body);
                    }
                }
            }
        }

        let body = json!({
            "valid": false,
            "error": "Invalid or expired tunnel token"
        });
        self.json_response(401, &body)
    }

    fn json_response(&self, status: u16, body: &serde_json::Value) -> String {
        let status_text = match status {
            200 => "OK",
            400 => "Bad Request",
            401 => "Unauthorized",
            404 => "Not Found",
            _ => "Unknown",
        };

        let body_str = serde_json::to_string(body).unwrap();
        format!(
            "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            status,
            status_text,
            body_str.len(),
            body_str
        )
    }

    fn error_response(&self, status: u16, message: &str) -> String {
        let body = json!({
            "error": message
        });
        self.json_response(status, &body)
    }

    /// Register a test user (for setup)
    pub fn register_user(&self, email: &str, password: &str) -> String {
        let user_id = uuid::Uuid::new_v4().to_string();
        let api_key = format!("sk_test_{}", uuid::Uuid::new_v4().simple());

        let user = User {
            id: user_id.clone(),
            email: email.to_string(),
            password_hash: password.to_string(), // In real impl, this would be hashed
            api_key: api_key.clone(),
        };

        self.users.lock().unwrap().insert(user_id.clone(), user);
        self.api_keys
            .lock()
            .unwrap()
            .insert(api_key.clone(), user_id);

        api_key
    }

    /// Create a tunnel token (for setup)
    pub fn create_tunnel_token(&self, instance_id: &str, user_id: &str, ttl_secs: u64) -> String {
        let token = format!("tk_test_{}", uuid::Uuid::new_v4().simple());
        let expires_at = SystemTime::now() + Duration::from_secs(ttl_secs);

        let tunnel_token = TunnelToken {
            token: token.clone(),
            instance_id: instance_id.to_string(),
            user_id: user_id.to_string(),
            expires_at,
        };

        self.tunnel_tokens
            .lock()
            .unwrap()
            .insert(token.clone(), tunnel_token);

        token
    }
}

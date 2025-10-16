//! Backend API client for user authentication and usage tracking.

use anyhow::{anyhow, Context, Error, Result};
use reqwest::{Client, Method, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::time::Duration;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

const RETRY_ATTEMPTS: usize = 3;
const RETRY_DELAY_MS: u64 = 300;

/// Request to validate an API key with the backend.
#[derive(Debug, Serialize)]
struct ValidateKeyRequest {
    api_key: String,
}

/// Response from the backend after validating an API key.
#[derive(Debug, Deserialize)]
pub struct ValidateKeyResponse {
    pub valid: bool,
    pub user_id: Option<String>,
    #[allow(dead_code)]
    pub email: Option<String>,
    pub plan_type: Option<String>,
    pub max_concurrent_tunnels: Option<u32>,
    #[allow(dead_code)]
    pub max_bandwidth_gb: Option<u64>,
    pub usage_allowed: bool,
    pub message: Option<String>,
    pub instance_id: Option<String>,
}

/// Request to start a tunnel session.
#[derive(Debug, Serialize)]
struct TunnelStartRequest {
    user_id: String,
    public_port: u16,
    local_port: u16,
    server_id: String,
}

/// Request to end a tunnel session.
#[derive(Debug, Serialize)]
struct TunnelEndRequest {
    session_id: String,
    bytes_transferred: u64,
}

/// Request to log bandwidth usage.
#[derive(Debug, Serialize)]
#[allow(dead_code)]
struct UsageLogRequest {
    user_id: String,
    session_id: String,
    bytes_in: u64,
    bytes_out: u64,
}

/// Backend API client for authentication and usage tracking.
pub struct BackendClient {
    http_client: Client,
    base_url: String,
    pub enabled: bool,
    api_key: Option<String>,
}

impl BackendClient {
    fn apply_internal_auth(&self, builder: RequestBuilder) -> RequestBuilder {
        if let Some(key) = &self.api_key {
            builder.header("x-internal-api-key", key)
        } else {
            builder
        }
    }

    fn request(&self, method: Method, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        let builder = self.http_client.request(method, url);
        self.apply_internal_auth(builder)
    }

    /// Create a new backend client.
    ///
    /// If `backend_url` is None, the client will be disabled and all operations
    /// will succeed without making actual API calls (fallback mode).
    pub fn new(backend_url: Option<String>, api_key: Option<String>) -> Self {
        let (base_url, enabled) = match backend_url {
            Some(url) => (url, true),
            None => (String::new(), false),
        };

        let http_client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        info!(
            enabled = enabled,
            base_url = %base_url,
            api_key_configured = api_key.is_some(),
            "Backend API client initialized"
        );

        Self {
            http_client,
            base_url,
            enabled,
            api_key,
        }
    }

    /// Validate an API key with the backend.
    ///
    /// Returns validation result with user information and permissions.
    pub async fn validate_api_key(&self, api_key: &str) -> Result<ValidateKeyResponse> {
        // If backend is disabled, allow all connections (fallback mode)
        if !self.enabled {
            debug!("Backend disabled, allowing connection without validation");
            return Ok(ValidateKeyResponse {
                valid: true,
                user_id: Some("local-user".to_string()),
                email: None,
                plan_type: Some("unlimited".to_string()),
                max_concurrent_tunnels: Some(999),
                max_bandwidth_gb: Some(999999),
                usage_allowed: true,
                message: Some("Backend validation disabled".to_string()),
                instance_id: None,
            });
        }

        debug!("Validating API key with backend");

        let response = self
            .request(Method::POST, "api/internal/validate-key")
            .json(&ValidateKeyRequest {
                api_key: api_key.to_string(),
            })
            .send()
            .await
            .context("Failed to connect to backend API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "Backend API returned error");
            return Ok(ValidateKeyResponse {
                valid: false,
                user_id: None,
                email: None,
                plan_type: None,
                max_concurrent_tunnels: None,
                max_bandwidth_gb: None,
                usage_allowed: false,
                message: Some(format!("Backend error: {}", status)),
                instance_id: None,
            });
        }

        let validation = response
            .json::<ValidateKeyResponse>()
            .await
            .context("Failed to parse backend response")?;

        info!(
            valid = validation.valid,
            user_id = ?validation.user_id,
            plan_type = ?validation.plan_type,
            "API key validation completed"
        );

        Ok(validation)
    }

    /// Log the start of a tunnel session.
    pub async fn log_tunnel_start(
        &self,
        user_id: &str,
        public_port: u16,
        local_port: u16,
        server_id: &str,
    ) -> Result<String> {
        if !self.enabled {
            return Ok(format!("session-{}", uuid::Uuid::new_v4()));
        }

        debug!(
            user_id = %user_id,
            public_port = public_port,
            local_port = local_port,
            "Logging tunnel start"
        );

        let response = self
            .request(Method::POST, "api/internal/tunnel/start")
            .json(&TunnelStartRequest {
                user_id: user_id.to_string(),
                public_port,
                local_port,
                server_id: server_id.to_string(),
            })
            .send()
            .await?;

        #[derive(Deserialize)]
        struct SessionResponse {
            session_id: String,
        }

        let session = response.json::<SessionResponse>().await?;
        Ok(session.session_id)
    }

    /// Log the end of a tunnel session.
    pub async fn log_tunnel_end(&self, session_id: &str, bytes_transferred: u64) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        debug!(
            session_id = %session_id,
            bytes_transferred = bytes_transferred,
            "Logging tunnel end"
        );

        self.request(Method::POST, "api/internal/tunnel/end")
            .json(&TunnelEndRequest {
                session_id: session_id.to_string(),
                bytes_transferred,
            })
            .send()
            .await?;

        Ok(())
    }

    async fn post_with_retry(&self, path: &str, body: Option<&Value>) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut last_error: Option<Error> = None;

        for attempt in 0..RETRY_ATTEMPTS {
            let mut request = self.request(Method::POST, path);
            if let Some(payload) = body {
                request = request.json(payload);
            }

            match request.send().await {
                Ok(response) if response.status().is_success() => return Ok(()),
                Ok(response) => {
                    let status = response.status();
                    let text = response.text().await.unwrap_or_default();
                    warn!(
                        attempt = attempt + 1,
                        path = %path,
                        status = %status,
                        "Backend returned error for internal POST"
                    );
                    last_error = Some(anyhow!("backend responded with status {status}: {text}"));
                }
                Err(err) => {
                    warn!(
                        attempt = attempt + 1,
                        path = %path,
                        error = %err,
                        "Failed to call backend internal POST"
                    );
                    last_error = Some(err.into());
                }
            }

            if attempt + 1 < RETRY_ATTEMPTS {
                let delay = Duration::from_millis(RETRY_DELAY_MS * (attempt as u64 + 1));
                sleep(delay).await;
            }
        }

        Err(last_error.unwrap_or_else(|| {
            anyhow!(
                "backend POST {} failed after {} attempts",
                path,
                RETRY_ATTEMPTS
            )
        }))
    }

    pub async fn notify_tunnel_connected(
        &self,
        instance_id: &str,
        remote_port: Option<u16>,
        public_url: Option<&str>,
    ) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut payload = Map::new();
        if let Some(port) = remote_port {
            payload.insert("remotePort".into(), json!(port));
        }
        if let Some(url) = public_url {
            payload.insert("publicUrl".into(), json!(url));
        }

        let body = if payload.is_empty() {
            None
        } else {
            Some(Value::Object(payload))
        };

        let path = format!("api/internal/instances/{}/tunnel-connected", instance_id);
        self.post_with_retry(&path, body.as_ref()).await
    }

    pub async fn notify_tunnel_disconnected(&self, instance_id: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let path = format!("api/internal/instances/{}/tunnel-disconnected", instance_id);
        self.post_with_retry(&path, None).await
    }

    /// Log bandwidth usage for a session.
    #[allow(dead_code)]
    pub async fn log_usage(
        &self,
        user_id: &str,
        session_id: &str,
        bytes_in: u64,
        bytes_out: u64,
    ) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        self.request(Method::POST, "api/internal/tunnel/usage")
            .json(&UsageLogRequest {
                user_id: user_id.to_string(),
                session_id: session_id.to_string(),
                bytes_in,
                bytes_out,
            })
            .send()
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    async fn capture_single_request(
        listener: TcpListener,
    ) -> (String, HashMap<String, String>, Value) {
        let (mut socket, _) = listener.accept().await.expect("failed to accept");

        let mut header_bytes = Vec::new();
        let mut buf = [0u8; 1];
        loop {
            socket
                .read_exact(&mut buf)
                .await
                .expect("failed to read header");
            header_bytes.push(buf[0]);
            if header_bytes.ends_with(b"\r\n\r\n") {
                break;
            }
        }

        let header_str = String::from_utf8(header_bytes).expect("invalid header bytes");
        let mut lines = header_str.split("\r\n");
        let request_line = lines.next().unwrap_or_default().to_string();
        let mut headers = HashMap::new();
        for line in lines {
            if line.is_empty() {
                break;
            }
            if let Some((name, value)) = line.split_once(':') {
                headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
            }
        }

        let content_length = headers
            .get("content-length")
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(0);

        let mut body_bytes = vec![0u8; content_length];
        if content_length > 0 {
            socket
                .read_exact(&mut body_bytes)
                .await
                .expect("failed to read body");
        }

        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .expect("failed to write response");

        let body_json = if content_length > 0 {
            serde_json::from_slice(&body_bytes).expect("invalid json body")
        } else {
            Value::Null
        };

        (request_line, headers, body_json)
    }

    #[tokio::test]
    #[ignore = "requires permission to bind local TCP sockets"]
    async fn notify_tunnel_connected_includes_remote_port() {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("failed to bind listener");
        let addr = listener.local_addr().unwrap();
        let backend_url = format!("http://{}", addr);

        let handle = tokio::spawn(capture_single_request(listener));

        let client = BackendClient::new(Some(backend_url), Some("internal-secret".to_string()));

        client
            .notify_tunnel_connected("inst_123", Some(5555), None)
            .await
            .expect("connected notification to succeed");

        let (request_line, headers, body) = handle.await.expect("capture task panicked");

        assert!(request_line.starts_with("POST /api/internal/instances/inst_123/tunnel-connected"));
        assert_eq!(
            headers.get("x-internal-api-key"),
            Some(&"internal-secret".to_string())
        );
        assert_eq!(body["remotePort"], json!(5555));
    }

    #[tokio::test]
    #[ignore = "requires permission to bind local TCP sockets"]
    async fn notify_tunnel_disconnected_hits_endpoint() {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("failed to bind listener");
        let addr = listener.local_addr().unwrap();
        let backend_url = format!("http://{}", addr);

        let handle = tokio::spawn(capture_single_request(listener));

        let client = BackendClient::new(Some(backend_url), Some("internal-secret".to_string()));

        client
            .notify_tunnel_disconnected("inst_123")
            .await
            .expect("disconnect notification to succeed");

        let (request_line, headers, _) = handle.await.expect("capture task panicked");

        assert!(
            request_line.starts_with("POST /api/internal/instances/inst_123/tunnel-disconnected")
        );
        assert_eq!(
            headers.get("x-internal-api-key"),
            Some(&"internal-secret".to_string())
        );
    }
}

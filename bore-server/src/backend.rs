//! Backend API client for user authentication and usage tracking.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info};

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
    enabled: bool,
}

impl BackendClient {
    /// Create a new backend client.
    ///
    /// If `backend_url` is None, the client will be disabled and all operations
    /// will succeed without making actual API calls (fallback mode).
    pub fn new(backend_url: Option<String>) -> Self {
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
            "Backend API client initialized"
        );

        Self {
            http_client,
            base_url,
            enabled,
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
            });
        }

        debug!("Validating API key with backend");

        let response = self
            .http_client
            .post(format!("{}/api/internal/validate-key", self.base_url))
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
            .http_client
            .post(format!("{}/api/internal/tunnel/start", self.base_url))
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

        self.http_client
            .post(format!("{}/api/internal/tunnel/end", self.base_url))
            .json(&TunnelEndRequest {
                session_id: session_id.to_string(),
                bytes_transferred,
            })
            .send()
            .await?;

        Ok(())
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

        self.http_client
            .post(format!("{}/api/internal/tunnel/usage", self.base_url))
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

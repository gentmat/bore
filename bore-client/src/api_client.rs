//! API client for communicating with the bore backend service.

use anyhow::{bail, Context, Result};
use reqwest::{Client as HttpClient, StatusCode};
use serde::{Deserialize, Serialize};

use crate::auth::Credentials;

/// Backend API client
pub struct ApiClient {
    client: HttpClient,
    base_url: String,
    auth_token: Option<String>,
}

/// Login request
#[derive(Debug, Serialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user_id: String,
}

/// Tunnel instance information
#[derive(Debug, Clone, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub local_port: u16,
    pub server_region: String,
    pub status: String,
    pub public_url: Option<String>,
}

/// List of instances response
#[derive(Debug, Deserialize)]
pub struct InstancesResponse {
    pub instances: Vec<Instance>,
}

/// Connection information for a tunnel
#[derive(Debug, Deserialize)]
pub struct ConnectionInfo {
    pub instance_id: String,
    pub tunnel_token: String,
    pub server_host: String,
    pub local_port: u16,
    pub remote_port: u16,
    pub ttl: u64,
}

impl ApiClient {
    /// Create a new API client
    pub fn new(base_url: String) -> Self {
        Self {
            client: HttpClient::new(),
            base_url,
            auth_token: None,
        }
    }

    /// Create an API client from stored credentials
    pub fn from_credentials(creds: &Credentials) -> Self {
        Self {
            client: HttpClient::new(),
            base_url: creds.api_endpoint.clone(),
            auth_token: Some(creds.auth_token.clone()),
        }
    }

    /// Login with email and password
    pub async fn login(&mut self, email: String, password: String) -> Result<LoginResponse> {
        let url = format!("{}/api/v1/auth/login", self.base_url);
        let request = LoginRequest { email, password };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("failed to send login request")?;

        match response.status() {
            StatusCode::OK => {
                let login_response: LoginResponse = response
                    .json()
                    .await
                    .context("failed to parse login response")?;
                self.auth_token = Some(login_response.token.clone());
                Ok(login_response)
            }
            StatusCode::UNAUTHORIZED => {
                bail!("invalid email or password")
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                bail!("login failed with status {}: {}", status, error_text)
            }
        }
    }

    /// List all instances for the authenticated user
    pub async fn list_instances(&self) -> Result<Vec<Instance>> {
        let token = self
            .auth_token
            .as_ref()
            .context("not authenticated. Please run 'bore login' first")?;

        let url = format!("{}/api/v1/instances", self.base_url);

        let response = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("failed to send request to list instances")?;

        match response.status() {
            StatusCode::OK => {
                let instances_response: InstancesResponse = response
                    .json()
                    .await
                    .context("failed to parse instances response")?;
                Ok(instances_response.instances)
            }
            StatusCode::UNAUTHORIZED => {
                bail!("authentication failed. Please run 'bore login' again")
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                bail!(
                    "failed to list instances with status {}: {}",
                    status,
                    error_text
                )
            }
        }
    }

    /// Get connection information for a specific instance
    pub async fn connect_instance(&self, instance_id: &str) -> Result<ConnectionInfo> {
        let token = self
            .auth_token
            .as_ref()
            .context("not authenticated. Please run 'bore login' first")?;

        let url = format!("{}/api/v1/instances/{}/connect", self.base_url, instance_id);

        let response = self
            .client
            .post(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("failed to request connection info")?;

        match response.status() {
            StatusCode::OK => {
                let connection_info: ConnectionInfo = response
                    .json()
                    .await
                    .context("failed to parse connection info")?;
                Ok(connection_info)
            }
            StatusCode::UNAUTHORIZED => {
                bail!("authentication failed. Please run 'bore login' again")
            }
            StatusCode::NOT_FOUND => {
                bail!("instance not found")
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                bail!(
                    "failed to get connection info with status {}: {}",
                    status,
                    error_text
                )
            }
        }
    }

    /// Find instance by name or ID
    pub async fn find_instance(&self, name_or_id: &str) -> Result<Instance> {
        let instances = self.list_instances().await?;

        // Try to find by ID first
        if let Some(instance) = instances.iter().find(|i| i.id == name_or_id) {
            return Ok(instance.clone());
        }

        // Try to find by name
        if let Some(instance) = instances.iter().find(|i| i.name == name_or_id) {
            return Ok(instance.clone());
        }

        bail!("instance '{}' not found", name_or_id)
    }

    /// Send heartbeat for an instance to indicate it's online
    pub async fn send_heartbeat(&self, instance_id: &str) -> Result<()> {
        let token = self.auth_token.as_ref().context("not authenticated")?;

        let url = format!(
            "{}/api/v1/instances/{}/heartbeat",
            self.base_url, instance_id
        );

        let response = self
            .client
            .post(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("failed to send heartbeat")?;

        if !response.status().is_success() {
            bail!("heartbeat failed with status {}", response.status());
        }

        Ok(())
    }

    /// Update connection metadata for an instance (status, public URL, remote port)
    pub async fn update_instance_connection(
        &self,
        instance_id: &str,
        status: Option<&str>,
        remote_port: Option<u16>,
        public_url: Option<&str>,
    ) -> Result<()> {
        let token = self
            .auth_token
            .as_ref()
            .context("not authenticated. Please run 'bore login' first")?;

        let mut payload = serde_json::Map::new();

        if let Some(status) = status {
            payload.insert(
                "status".to_string(),
                serde_json::Value::String(status.to_string()),
            );
        }

        if let Some(port) = remote_port {
            let port_value = serde_json::Value::Number(serde_json::Number::from(port as u64));
            payload.insert("remotePort".to_string(), port_value.clone());
            payload.insert("remote_port".to_string(), port_value);
        }

        if let Some(url) = public_url {
            payload.insert(
                "publicUrl".to_string(),
                serde_json::Value::String(url.to_string()),
            );
            payload.insert(
                "public_url".to_string(),
                serde_json::Value::String(url.to_string()),
            );
        }

        let url = format!(
            "{}/api/v1/instances/{}/connection",
            self.base_url, instance_id
        );

        self.client
            .patch(&url)
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await
            .context("failed to update instance connection state")?
            .error_for_status()
            .context("backend rejected connection update")?;

        Ok(())
    }

    /// Disconnect an instance and mark it offline
    pub async fn disconnect_instance(&self, instance_id: &str) -> Result<()> {
        let token = self
            .auth_token
            .as_ref()
            .context("not authenticated. Please run 'bore login' first")?;

        let url = format!(
            "{}/api/v1/instances/{}/disconnect",
            self.base_url, instance_id
        );

        let response = self
            .client
            .post(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("failed to send disconnect request")?;

        match response.status() {
            StatusCode::OK => Ok(()),
            StatusCode::UNAUTHORIZED => {
                bail!("authentication failed. Please run 'bore login' again")
            }
            StatusCode::NOT_FOUND => bail!("instance not found"),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                bail!(
                    "failed to disconnect instance with status {}: {}",
                    status,
                    error_text
                )
            }
        }
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    pub user_id: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TunnelInstanceResponse {
    pub id: String,
    pub name: String,
    pub local_port: u16,
    pub region: String,
    pub server_address: String,
    pub public_url: Option<String>,
    pub remote_port: Option<u16>,
    pub status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DependencyStatus {
    pub bore_installed: bool,
    pub bore_installed_now: bool,
    pub bore_error: Option<String>,
    pub code_server_installed: bool,
    pub code_server_installed_now: bool,
    pub code_server_error: Option<String>,
}

pub(crate) async fn send_disconnect_request(
    token: &str,
    instance_id: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    client
        .post(format!(
            "http://127.0.0.1:3000/api/user/instances/{}/disconnect",
            instance_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

pub(crate) async fn update_instance_connection(
    token: &str,
    instance_id: &str,
    status: Option<&str>,
    remote_port: Option<u16>,
    public_url: Option<&str>,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
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

    client
        .patch(format!(
            "http://127.0.0.1:3000/api/user/instances/{}/connection",
            instance_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

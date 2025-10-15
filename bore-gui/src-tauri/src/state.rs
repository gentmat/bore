use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::{
    sync::{oneshot, Mutex, RwLock},
    task::JoinHandle,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub user_id: String,
    pub token: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInstance {
    pub id: String,
    pub name: String,
    pub local_port: u16,
    pub region: String,
    pub server_address: String,
    pub public_url: Option<String>,
    pub remote_port: Option<u16>,
    pub status: TunnelStatus,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelStatus {
    Inactive,
    Starting,
    Active,
    Error,
}

#[derive(Default, Clone)]
pub struct AppState {
    pub credentials: Arc<RwLock<Option<Credentials>>>,
    pub tunnels: Arc<RwLock<HashMap<String, TunnelInstance>>>,
    pub tunnel_handles: Arc<RwLock<HashMap<String, TunnelHandleSet>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }
}

pub struct TunnelHandleSet {
    pub tunnel: JoinHandle<()>,
    pub heartbeat: Option<JoinHandle<()>>,
    pub heartbeat_shutdown: Option<Arc<Mutex<Option<oneshot::Sender<()>>>>>,
}

pub fn get_credentials_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let bore_dir = config_dir.join("bore");
    std::fs::create_dir_all(&bore_dir).ok();
    bore_dir.join("credentials.json")
}

pub fn load_credentials() -> Option<Credentials> {
    let path = get_credentials_path();
    if !path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn save_credentials(creds: &Credentials) -> anyhow::Result<()> {
    let path = get_credentials_path();
    let content = serde_json::to_string_pretty(creds)?;
    std::fs::write(path, content)?;
    Ok(())
}

pub fn delete_credentials() -> anyhow::Result<()> {
    let path = get_credentials_path();
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

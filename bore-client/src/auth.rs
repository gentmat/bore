//! Authentication and credential management for bore client.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// User credentials stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    /// API endpoint URL
    pub api_endpoint: String,
    /// JWT authentication token
    pub auth_token: String,
    /// User ID
    pub user_id: String,
}

impl Credentials {
    /// Create new credentials
    pub fn new(api_endpoint: String, auth_token: String, user_id: String) -> Self {
        Self {
            api_endpoint,
            auth_token,
            user_id,
        }
    }

    /// Get the credentials file path
    pub fn credentials_path() -> Result<PathBuf> {
        let home = dirs::home_dir().context("could not find home directory")?;
        let bore_dir = home.join(".bore");
        fs::create_dir_all(&bore_dir)?;
        Ok(bore_dir.join("credentials.json"))
    }

    /// Load credentials from disk
    pub fn load() -> Result<Self> {
        let path = Self::credentials_path()?;
        let content = fs::read_to_string(&path)
            .context("credentials file not found. Please run 'bore login' first")?;
        let creds: Credentials =
            serde_json::from_str(&content).context("failed to parse credentials file")?;
        Ok(creds)
    }

    /// Save credentials to disk
    pub fn save(&self) -> Result<()> {
        let path = Self::credentials_path()?;
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&path, content).context("failed to write credentials file")?;

        // Set file permissions to 600 (owner read/write only) on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&path, perms)?;
        }

        Ok(())
    }

    /// Delete credentials file
    pub fn delete() -> Result<()> {
        let path = Self::credentials_path()?;
        if path.exists() {
            fs::remove_file(&path).context("failed to delete credentials file")?;
        }
        Ok(())
    }

    /// Check if credentials exist
    pub fn exists() -> bool {
        Self::credentials_path()
            .map(|p| p.exists())
            .unwrap_or(false)
    }
}

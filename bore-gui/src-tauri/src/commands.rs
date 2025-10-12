use crate::state::{AppState, Credentials, TunnelInstance, TunnelStatus, delete_credentials, load_credentials, save_credentials};
use crate::tunnel_manager::{start_tunnel_connection, TunnelConfig};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::process::Command;
use std::net::TcpListener;

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
    pub status: String,
}

#[tauri::command]
pub async fn signup(
    state: State<'_, AppState>,
    name: String,
    email: String,
    password: String,
    api_endpoint: Option<String>,
) -> Result<LoginResponse, String> {
    // Default API endpoint
    let endpoint = api_endpoint.unwrap_or_else(|| "http://127.0.0.1:3000".to_string());
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Make signup request
    let response = client
        .post(format!("{}/api/auth/signup", endpoint))
        .json(&serde_json::json!({
            "name": name,
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to API: {}", e))?;

    if !response.status().is_success() {
        let json: serde_json::Value = response
            .json()
            .await
            .unwrap_or(serde_json::json!({"message": "Signup failed"}));
        
        return Ok(LoginResponse {
            success: false,
            message: json["message"].as_str().unwrap_or("Signup failed").to_string(),
            user_id: None,
            token: None,
        });
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let user_id = json["user_id"]
        .as_str()
        .ok_or("Missing user_id in response")?
        .to_string();
    let token = json["token"]
        .as_str()
        .ok_or("Missing token in response")?
        .to_string();

    // Save credentials
    let creds = Credentials {
        user_id: user_id.clone(),
        token: token.clone(),
        email: email.clone(),
    };

    save_credentials(&creds).map_err(|e| format!("Failed to save credentials: {}", e))?;

    // Update state
    let mut state_creds = state.credentials.write().await;
    *state_creds = Some(creds);

    Ok(LoginResponse {
        success: true,
        message: "Signup successful".to_string(),
        user_id: Some(user_id),
        token: Some(token),
    })
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    email: String,
    password: String,
    api_endpoint: Option<String>,
) -> Result<LoginResponse, String> {
    // Default API endpoint
    let endpoint = api_endpoint.unwrap_or_else(|| "http://127.0.0.1:3000".to_string());
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Make login request
    let response = client
        .post(format!("{}/api/auth/login", endpoint))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to API: {}", e))?;

    if !response.status().is_success() {
        return Ok(LoginResponse {
            success: false,
            message: "Invalid email or password".to_string(),
            user_id: None,
            token: None,
        });
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let user_id = json["userId"]
        .as_str()
        .ok_or("Missing userId in response")?
        .to_string();
    let token = json["token"]
        .as_str()
        .ok_or("Missing token in response")?
        .to_string();

    // Save credentials
    let creds = Credentials {
        user_id: user_id.clone(),
        token: token.clone(),
        email: email.clone(),
    };

    save_credentials(&creds).map_err(|e| format!("Failed to save credentials: {}", e))?;

    // Update state
    let mut state_creds = state.credentials.write().await;
    *state_creds = Some(creds);

    Ok(LoginResponse {
        success: true,
        message: "Login successful".to_string(),
        user_id: Some(user_id),
        token: Some(token),
    })
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<bool, String> {
    // Stop all tunnels
    let mut handles = state.tunnel_handles.write().await;
    for (_, handle) in handles.drain() {
        handle.abort();
    }

    // Clear credentials
    let mut creds = state.credentials.write().await;
    *creds = None;

    // Delete credentials file
    delete_credentials().map_err(|e| format!("Failed to delete credentials: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn check_auth(state: State<'_, AppState>) -> Result<Option<Credentials>, String> {
    // Try to load from file if not in memory
    let mut state_creds = state.credentials.write().await;
    if state_creds.is_none() {
        *state_creds = load_credentials();
    }

    Ok(state_creds.clone())
}

#[tauri::command]
pub async fn list_instances(state: State<'_, AppState>) -> Result<Vec<TunnelInstanceResponse>, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;

    // Make API request to get instances
    let client = reqwest::Client::new();
    let response = client
        .get("http://127.0.0.1:3000/api/instances")
        .header("Authorization", format!("Bearer {}", creds.token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch instances: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to fetch instances".to_string());
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let instances = json["instances"]
        .as_array()
        .ok_or("Invalid response format")?;

    let mut result = Vec::new();
    let tunnels = state.tunnels.read().await;

    for instance in instances {
        let id = instance["id"].as_str().unwrap_or("").to_string();
        let status = tunnels
            .get(&id)
            .map(|t| match t.status {
                TunnelStatus::Active => "active",
                TunnelStatus::Starting => "starting",
                TunnelStatus::Error => "error",
                TunnelStatus::Inactive => "inactive",
            })
            .unwrap_or("inactive");

        result.push(TunnelInstanceResponse {
            id: id.clone(),
            name: instance["name"].as_str().unwrap_or("").to_string(),
            local_port: instance["localPort"].as_u64().unwrap_or(0) as u16,
            region: instance["region"].as_str().unwrap_or("").to_string(),
            server_address: instance["serverAddress"].as_str().unwrap_or("").to_string(),
            public_url: instance["publicUrl"].as_str().map(|s| s.to_string()),
            status: status.to_string(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn start_tunnel(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;

    // Get instance details from API
    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://127.0.0.1:3000/api/instances/{}", instance_id))
        .header("Authorization", format!("Bearer {}", creds.token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch instance: {}", e))?;

    if !response.status().is_success() {
        return Err("Instance not found".to_string());
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let local_port = json["localPort"].as_u64().ok_or("Invalid local port")? as u16;
    let server_address = json["serverAddress"]
        .as_str()
        .ok_or("Invalid server address")?
        .to_string();

    // Update tunnel status
    let mut tunnels = state.tunnels.write().await;
    tunnels.insert(
        instance_id.clone(),
        TunnelInstance {
            id: instance_id.clone(),
            name: json["name"].as_str().unwrap_or("").to_string(),
            local_port,
            region: json["region"].as_str().unwrap_or("").to_string(),
            server_address: server_address.clone(),
            public_url: json["publicUrl"].as_str().map(|s| s.to_string()),
            status: TunnelStatus::Starting,
        },
    );

    // Start tunnel in background
    let config = TunnelConfig {
        instance_id: instance_id.clone(),
        local_port,
        server_address,
        secret: creds.token.clone(),
    };

    let state_clone = state.inner().clone();
    let instance_id_clone = instance_id.clone();

    let handle = tokio::spawn(async move {
        match start_tunnel_connection(config).await {
            Ok(_) => {
                // Update status to active
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Active;
                }
            }
            Err(e) => {
                tracing::error!("Tunnel error for {}: {}", instance_id_clone, e);
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Error;
                }
            }
        }
    });

    let mut handles = state.tunnel_handles.write().await;
    handles.insert(instance_id, handle);

    Ok(true)
}

#[tauri::command]
pub async fn stop_tunnel(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    // Stop the tunnel task
    let mut handles = state.tunnel_handles.write().await;
    if let Some(handle) = handles.remove(&instance_id) {
        handle.abort();
    }

    // Update status
    let mut tunnels = state.tunnels.write().await;
    tunnels.remove(&instance_id);

    Ok(true)
}

#[tauri::command]
pub async fn get_tunnel_status(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<String, String> {
    let tunnels = state.tunnels.read().await;
    let status = tunnels
        .get(&instance_id)
        .map(|t| match t.status {
            TunnelStatus::Active => "active",
            TunnelStatus::Starting => "starting",
            TunnelStatus::Error => "error",
            TunnelStatus::Inactive => "inactive",
        })
        .unwrap_or("inactive");

    Ok(status.to_string())
}

#[tauri::command]
pub async fn create_instance(
    state: State<'_, AppState>,
    name: String,
    local_port: u16,
    region: String,
) -> Result<String, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;

    // Create instance via API
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:3000/api/instances")
        .header("Authorization", format!("Bearer {}", creds.token))
        .json(&serde_json::json!({
            "name": name,
            "localPort": local_port,
            "region": region,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to create instance: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to create instance".to_string());
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let instance_id = json["id"]
        .as_str()
        .ok_or("Invalid response")?
        .to_string();

    Ok(instance_id)
}

#[tauri::command]
pub async fn delete_instance(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;

    // Stop tunnel if running
    stop_tunnel(state.clone(), instance_id.clone()).await?;

    // Delete instance via API
    let client = reqwest::Client::new();
    let response = client
        .delete(format!("http://127.0.0.1:3000/api/instances/{}", instance_id))
        .header("Authorization", format!("Bearer {}", creds.token))
        .send()
        .await
        .map_err(|e| format!("Failed to delete instance: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to delete instance".to_string());
    }

    Ok(true)
}

// Check if a port is available
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

// Find an available port starting from a given port
fn find_available_port(start_port: u16) -> Option<u16> {
    for port in start_port..65535 {
        if is_port_available(port) {
            return Some(port);
        }
    }
    None
}

#[tauri::command]
pub async fn check_code_server_installed() -> Result<bool, String> {
    // Check if code-server is installed
    let output = Command::new("code-server")
        .arg("--version")
        .output();
    
    Ok(output.is_ok())
}

#[tauri::command]
pub async fn install_code_server() -> Result<String, String> {
    tracing::info!("Starting code-server installation");
    
    // Use curl to download and install code-server
    let output = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://code-server.dev/install.sh | sh")
        .output()
        .map_err(|e| format!("Failed to execute install script: {}", e))?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", error));
    }
    
    Ok("code-server installed successfully".to_string())
}

#[tauri::command]
pub async fn find_available_port_command(start_port: Option<u16>) -> Result<u16, String> {
    let port = find_available_port(start_port.unwrap_or(8081))
        .ok_or("No available ports found")?;
    Ok(port)
}

#[tauri::command]
pub async fn start_code_server_instance(
    state: State<'_, AppState>,
    port: u16,
    instance_name: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;
    
    // Check if bore-client is installed and determine command name
    let bore_cmd = if Command::new("bore-client").arg("--version").output().is_ok() {
        "bore-client"
    } else if Command::new("bore").arg("--version").output().is_ok() {
        "bore"
    } else {
        return Err("bore client is not installed. Please install it with: cargo install --path bore-client".to_string());
    };
    
    tracing::info!("Using bore client: {}", bore_cmd);
    
    // Start code-server with project path
    let mut cmd = Command::new("code-server");
    cmd.arg("--bind-addr")
        .arg(format!("127.0.0.1:{}", port));
    
    // Add project path if provided
    if let Some(path) = &project_path {
        cmd.arg(path);
        tracing::info!("Starting code-server on port {} with project path: {}", port, path);
    } else {
        tracing::info!("Starting code-server on port {} without specific project path", port);
    }
    
    // Start code-server in background
    let _child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start code-server: {}", e))?;
    
    // Create instance in backend API
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:3000/api/instances")
        .header("Authorization", format!("Bearer {}", creds.token))
        .json(&serde_json::json!({
            "name": instance_name,
            "localPort": port,
            "region": "local",
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to create instance: {}", e))?;
    
    if !response.status().is_success() {
        return Err("Failed to create instance in backend".to_string());
    }
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let instance_id = json["id"]
        .as_str()
        .ok_or("Invalid response")?
        .to_string();
    
    // Start bore tunnel for this instance
    let config = TunnelConfig {
        instance_id: instance_id.clone(),
        local_port: port,
        server_address: "127.0.0.1:7835".to_string(), // Default bore server port
        secret: creds.token.clone(),
    };
    
    let instance_id_clone = instance_id.clone();
    
    let handle = tokio::spawn(async move {
        match start_tunnel_connection(config).await {
            Ok(_) => {
                tracing::info!("Tunnel started successfully for {}", instance_id_clone);
            }
            Err(e) => {
                tracing::error!("Tunnel error for {}: {}", instance_id_clone, e);
            }
        }
    });
    
    let mut handles = state.tunnel_handles.write().await;
    handles.insert(instance_id.clone(), handle);
    
    Ok(instance_id)
}

#[tauri::command]
pub async fn rename_instance(
    state: State<'_, AppState>,
    instance_id: String,
    new_name: String,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let creds = creds
        .as_ref()
        .ok_or("Not authenticated")?;

    // Rename instance via API
    let client = reqwest::Client::new();
    let response = client
        .patch(format!("http://127.0.0.1:3000/api/instances/{}", instance_id))
        .header("Authorization", format!("Bearer {}", creds.token))
        .json(&serde_json::json!({
            "name": new_name,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to rename instance: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to rename instance".to_string());
    }

    Ok(true)
}

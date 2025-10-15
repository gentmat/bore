use crate::state::{
    delete_credentials, load_credentials, save_credentials, AppState, Credentials, TunnelInstance,
    TunnelStatus,
};
use crate::tunnel_manager::{start_tunnel_connection, TunnelConfig};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    net::TcpListener,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager, State};

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

fn locate_bundled_bore_client(app_handle: &AppHandle) -> Option<PathBuf> {
    let resolver = app_handle.path_resolver();
    let mut candidates: Vec<PathBuf> = Vec::new();

    tracing::info!("Searching for bundled bore-client binary...");

    if let Some(path) = resolver.resolve_resource("bore-client") {
        tracing::info!("  Checking: {:?}", path);
        candidates.push(path);
    }
    if let Some(path) = resolver.resolve_resource("resources/bore-client") {
        tracing::info!("  Checking: {:?}", path);
        candidates.push(path);
    }
    if let Some(dir) = resolver.resource_dir() {
        tracing::info!("  Resource dir: {:?}", dir);
        let path1 = dir.join("bore-client");
        let path2 = dir.join("resources").join("bore-client");
        tracing::info!("  Checking: {:?}", path1);
        tracing::info!("  Checking: {:?}", path2);
        candidates.push(path1);
        candidates.push(path2);
    }

    if let Ok(exe_path) = env::current_exe() {
        tracing::info!("  Executable: {:?}", exe_path);
        if let Some(exe_dir) = exe_path.parent() {
            let relative_paths = [
                Path::new("bore-client"),
                Path::new("resources/bore-client"),
                Path::new("../resources/bore-client"),
                Path::new("../../resources/bore-client"),
                Path::new("../src-tauri/resources/bore-client"),
                Path::new("../../src-tauri/resources/bore-client"),
                Path::new("src-tauri/resources/bore-client"),
                Path::new("../target/release/bore"),
                Path::new("../../target/release/bore"),
                Path::new("../bore-client/target/release/bore"),
                Path::new("../../bore-client/target/release/bore"),
            ];
            for rel in relative_paths {
                let path = exe_dir.join(rel);
                tracing::debug!("  Checking: {:?}", path);
                candidates.push(path);
            }
        }
    }

    // During development, fall back to build-time manifest path.
    let dev_candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/bore-client"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("resources/bore-client"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("target/release/bore"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("bore-client/target/release/bore"),
    ];
    for path in &dev_candidates {
        tracing::debug!("  Checking: {:?}", path);
    }
    candidates.extend(dev_candidates);

    match candidates.into_iter().find(|p| p.exists()) {
        Some(path) => {
            tracing::info!("✅ Found bore-client at: {:?}", path);
            Some(path)
        }
        None => {
            tracing::error!("❌ No bore-client binary found in any candidate location");
            None
        }
    }
}

#[allow(dead_code)]
fn find_bore_client_binary() -> Option<PathBuf> {
    // Check if bore-client is in PATH
    if Command::new("bore-client").arg("--version").output().is_ok() {
        return Some(PathBuf::from("bore-client"));
    }
    
    // Check if bore is in PATH
    if Command::new("bore").arg("--version").output().is_ok() {
        return Some(PathBuf::from("bore"));
    }
    
    // Check in ~/.local/bin
    if let Some(home) = dirs::home_dir() {
        let local_bore = home.join(".local").join("bin").join("bore-client");
        if local_bore.exists() {
            return Some(local_bore);
        }
    }
    
    None
}

fn find_code_server_binary() -> Option<PathBuf> {
    // Check if code-server is in PATH
    if Command::new("code-server").arg("--version").output().is_ok() {
        return Some(PathBuf::from("code-server"));
    }
    
    // Check in ~/.local/bin
    if let Some(home) = dirs::home_dir() {
        let local_cs = home.join(".local").join("bin").join("code-server");
        if local_cs.exists() {
            return Some(local_cs);
        }
    }
    
    // Check /usr/local/bin
    let usr_local = PathBuf::from("/usr/local/bin/code-server");
    if usr_local.exists() {
        return Some(usr_local);
    }
    
    None
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
            message: json["message"]
                .as_str()
                .unwrap_or("Signup failed")
                .to_string(),
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
pub async fn list_instances(
    state: State<'_, AppState>,
) -> Result<Vec<TunnelInstanceResponse>, String> {
    let creds = state.credentials.read().await;
    let creds = creds.as_ref().ok_or("Not authenticated")?;

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

        let error_message = tunnels.get(&id).and_then(|t| t.error_message.clone());

        result.push(TunnelInstanceResponse {
            id: id.clone(),
            name: instance["name"].as_str().unwrap_or("").to_string(),
            local_port: instance["localPort"].as_u64().unwrap_or(0) as u16,
            region: instance["region"].as_str().unwrap_or("").to_string(),
            server_address: instance["serverAddress"].as_str().unwrap_or("").to_string(),
            public_url: instance["publicUrl"].as_str().map(|s| s.to_string()),
            status: status.to_string(),
            error_message,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn start_tunnel(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let creds = creds.as_ref().ok_or("Not authenticated")?;

    // Get instance details from API
    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "http://127.0.0.1:3000/api/instances/{}",
            instance_id
        ))
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

    // Update tunnel status to Starting
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
            error_message: None,
        },
    );
    drop(tunnels);

    // Emit status update event
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);

    // Start tunnel in background
    let config = TunnelConfig {
        instance_id: instance_id.clone(),
        local_port,
        server_address,
        secret: creds.token.clone(),
    };

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();
    let instance_id_clone = instance_id.clone();
    let token_clone = creds.token.clone();

    let handle = tokio::spawn(async move {
        // Start heartbeat task
        let instance_id_heartbeat = instance_id_clone.clone();
        let token_heartbeat = token_clone.clone();
        tokio::spawn(async move {
            let client = reqwest::Client::new();
            loop {
                // Send heartbeat every 10 seconds
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

                let _ = client
                    .post(format!(
                        "http://127.0.0.1:3000/api/instances/{}/heartbeat",
                        instance_id_heartbeat
                    ))
                    .header("Authorization", format!("Bearer {}", token_heartbeat))
                    .send()
                    .await;
            }
        });

        match start_tunnel_connection(config).await {
            Ok(_) => {
                // Update status to active
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Active;
                    tunnel.error_message = None;
                }
                drop(tunnels);
                // Emit status update event
                let _ = app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
                tracing::info!("Tunnel active for {}", instance_id_clone);
            }
            Err(e) => {
                let error_msg = format!("{}", e);
                tracing::error!("Tunnel error for {}: {}", instance_id_clone, error_msg);
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Error;
                    tunnel.error_message = Some(error_msg);
                }
                drop(tunnels);
                // Emit status update event
                let _ = app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
            }
        }
    });

    let mut handles = state.tunnel_handles.write().await;
    handles.insert(instance_id, handle);

    Ok(true)
}

#[tauri::command]
pub async fn stop_tunnel(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    tracing::info!("Stopping tunnel for instance: {}", instance_id);

    // Stop the tunnel task
    let mut handles = state.tunnel_handles.write().await;
    if let Some(handle) = handles.remove(&instance_id) {
        handle.abort();
        tracing::info!("Aborted tunnel task for {}", instance_id);
    }
    drop(handles);

    // Remove from tunnels map (status will default to inactive)
    let mut tunnels = state.tunnels.write().await;
    tunnels.remove(&instance_id);
    drop(tunnels);

    // Emit status update event
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);
    tracing::info!("Tunnel stopped for {}", instance_id);

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
    let creds = creds.as_ref().ok_or("Not authenticated")?;

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

    let instance_id = json["id"].as_str().ok_or("Invalid response")?.to_string();

    Ok(instance_id)
}

#[tauri::command]
pub async fn delete_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    tracing::info!("Deleting instance: {}", instance_id);
    
    let creds = state.credentials.read().await;
    let creds = creds.as_ref().ok_or("Not authenticated")?;

    // Stop tunnel if running (this will handle cleanup and emit events)
    tracing::info!("Stopping tunnel before deletion for instance: {}", instance_id);
    stop_tunnel(app_handle.clone(), state.clone(), instance_id.clone()).await?;

    // Delete instance via API
    let client = reqwest::Client::new();
    let response = client
        .delete(format!(
            "http://127.0.0.1:3000/api/instances/{}",
            instance_id
        ))
        .header("Authorization", format!("Bearer {}", creds.token))
        .send()
        .await
        .map_err(|e| format!("Failed to delete instance: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to delete instance".to_string());
    }

    tracing::info!("Instance {} deleted successfully", instance_id);
    
    // Emit final status update to refresh UI
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);

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
pub async fn check_bore_client_installed() -> Result<bool, String> {
    // Check if bore-client or bore is installed in PATH
    let bore_client_check = Command::new("bore-client")
        .arg("--version")
        .output()
        .is_ok();

    let bore_check = Command::new("bore").arg("--version").output().is_ok();

    if bore_client_check || bore_check {
        return Ok(true);
    }

    // Also check in ~/.local/bin directly
    if let Some(home) = dirs::home_dir() {
        let local_bore = home.join(".local").join("bin").join("bore-client");
        if local_bore.exists() {
            tracing::info!("Found bore-client in ~/.local/bin");
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn install_bore_client(app_handle: AppHandle) -> Result<String, String> {
    tracing::info!("Starting bore-client installation");

    // Resolve the bundled bore-client binary path using Tauri's path resolver
    let bundled_binary = locate_bundled_bore_client(&app_handle).ok_or_else(|| {
        "Bundled bore-client binary not found inside application resources. Please build bore-client first.".to_string()
    })?;

    tracing::info!("Found bundled bore-client at: {:?}", bundled_binary);

    // Install to ~/.local/bin
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let install_dir = home.join(".local").join("bin");
    fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Failed to create install directory: {}", e))?;

    let dest_path = install_dir.join("bore-client");

    // Copy binary
    fs::copy(&bundled_binary, &dest_path).map_err(|e| format!("Failed to copy binary: {}", e))?;

    // Make executable
    let mut perms = fs::metadata(&dest_path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?
        .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&dest_path, perms)
        .map_err(|e| format!("Failed to set permissions: {}", e))?;

    tracing::info!("bore-client installed to: {:?}", dest_path);

    // Verify installation
    let verify = Command::new(&dest_path).arg("--version").output();
    if verify.is_err() {
        return Err(format!(
            "Installation completed but binary verification failed. Please add {} to your PATH.",
            install_dir.display()
        ));
    }

    Ok(format!(
        "bore-client installed successfully to {}. Add {} to your PATH if not already present.",
        dest_path.display(),
        install_dir.display()
    ))
}

#[tauri::command]
pub async fn check_code_server_installed() -> Result<bool, String> {
    // Check if code-server is installed in PATH
    let output = Command::new("code-server").arg("--version").output();

    if output.is_ok() {
        return Ok(true);
    }

    // Check common installation locations
    if let Some(home) = dirs::home_dir() {
        let local_code_server = home.join(".local").join("bin").join("code-server");
        if local_code_server.exists() {
            tracing::info!("Found code-server in ~/.local/bin");
            return Ok(true);
        }
    }

    // Check /usr/local/bin
    if Path::new("/usr/local/bin/code-server").exists() {
        tracing::info!("Found code-server in /usr/local/bin");
        return Ok(true);
    }

    Ok(false)
}

#[tauri::command]
pub async fn install_code_server() -> Result<String, String> {
    tracing::info!("Starting code-server installation");

    // Try to install using the official script with --method standalone
    // This doesn't require sudo and installs to ~/.local/bin
    tracing::info!("Attempting standalone installation to ~/.local/bin...");
    let output = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone")
        .output()
        .map_err(|e| format!("Failed to execute install script: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        tracing::error!("Installation stderr: {}", error);
        tracing::error!("Installation stdout: {}", stdout);
        return Err(format!(
            "Installation failed. You may need to install manually with: curl -fsSL https://code-server.dev/install.sh | sh\n\nError: {}",
            error
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    tracing::info!("Installation output: {}", stdout);

    // Verify installation
    if check_code_server_installed().await.unwrap_or(false) {
        tracing::info!("code-server installed and verified successfully");
        Ok("code-server installed successfully. You may need to restart the application or add ~/.local/bin to your PATH.".to_string())
    } else {
        Err("code-server installation completed but binary not found. Please add ~/.local/bin to your PATH and restart the application.".to_string())
    }
}

#[tauri::command]
pub async fn find_available_port_command(start_port: Option<u16>) -> Result<u16, String> {
    let port = find_available_port(start_port.unwrap_or(8081)).ok_or("No available ports found")?;
    Ok(port)
}

#[tauri::command]
pub async fn ensure_dependencies(app_handle: AppHandle) -> Result<DependencyStatus, String> {
    let mut status = DependencyStatus {
        bore_installed: false,
        bore_installed_now: false,
        bore_error: None,
        code_server_installed: false,
        code_server_installed_now: false,
        code_server_error: None,
    };

    // Check and install bore-client
    tracing::info!("Checking bore-client installation...");
    match check_bore_client_installed().await {
        Ok(true) => {
            tracing::info!("bore-client is already installed");
            status.bore_installed = true;
        }
        Ok(false) => {
            tracing::info!("bore-client not found, attempting installation...");
            match install_bore_client(app_handle.clone()).await {
                Ok(msg) => {
                    tracing::info!("bore-client installation: {}", msg);
                    status.bore_installed_now = true;
                    match check_bore_client_installed().await {
                        Ok(installed) => {
                            status.bore_installed = installed;
                            if !installed {
                                status.bore_error = Some(
                                    "Installed but not detected. Please add ~/.local/bin to your PATH and restart.".to_string()
                                );
                            }
                        }
                        Err(e) => status.bore_error = Some(e),
                    }
                }
                Err(e) => {
                    tracing::error!("bore-client installation failed: {}", e);
                    status.bore_error = Some(e);
                }
            }
        }
        Err(e) => status.bore_error = Some(e),
    }

    // Check and install code-server
    tracing::info!("Checking code-server installation...");
    match check_code_server_installed().await {
        Ok(true) => {
            tracing::info!("code-server is already installed");
            status.code_server_installed = true;
        }
        Ok(false) => {
            tracing::info!("code-server not found, attempting installation...");
            match install_code_server().await {
                Ok(msg) => {
                    tracing::info!("code-server installation: {}", msg);
                    status.code_server_installed_now = true;
                    match check_code_server_installed().await {
                        Ok(installed) => {
                            status.code_server_installed = installed;
                            if !installed {
                                status.code_server_error = Some(
                                    "Installed but not detected. Please add ~/.local/bin to your PATH and restart.".to_string()
                                );
                            }
                        }
                        Err(e) => status.code_server_error = Some(e),
                    }
                }
                Err(e) => {
                    tracing::error!("code-server installation failed: {}", e);
                    status.code_server_error = Some(e);
                }
            }
        }
        Err(e) => status.code_server_error = Some(e),
    }

    Ok(status)
}

#[tauri::command]
pub async fn start_code_server_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    port: u16,
    instance_name: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let creds = state.credentials.read().await;
    let creds = creds.as_ref().ok_or("Not authenticated")?;

    // Check if bore-client is installed, if not, install it
    let bore_cmd = if Command::new("bore-client")
        .arg("--version")
        .output()
        .is_ok()
    {
        "bore-client"
    } else if Command::new("bore").arg("--version").output().is_ok() {
        "bore"
    } else {
        tracing::info!("bore-client not found, attempting to install...");
        match install_bore_client(app_handle.clone()).await {
            Ok(msg) => {
                tracing::info!("Installation successful: {}", msg);
                "bore-client"
            }
            Err(e) => return Err(format!("Automatic bore-client install failed: {}", e)),
        }
    };

    tracing::info!("Using bore client: {}", bore_cmd);

    // Check if code-server is installed, if not, install it
    if !check_code_server_installed().await.unwrap_or(false) {
        tracing::info!("code-server not found, attempting to install...");
        match install_code_server().await {
            Ok(msg) => {
                tracing::info!("Installation successful: {}", msg);
            }
            Err(e) => return Err(format!("Automatic code-server install failed: {}", e)),
        }
    }

    // Find the code-server binary
    let code_server_binary = find_code_server_binary()
        .ok_or("code-server not found. Please install it or add it to your PATH.")?;

    tracing::info!("Using code-server binary: {:?}", code_server_binary);

    // Start code-server with project path
    let mut cmd = Command::new(&code_server_binary);
    cmd.arg("--bind-addr").arg(format!("127.0.0.1:{}", port));

    // Add project path if provided
    if let Some(path) = &project_path {
        cmd.arg(path);
        tracing::info!(
            "Starting code-server on port {} with project path: {}",
            port,
            path
        );
    } else {
        tracing::info!(
            "Starting code-server on port {} without specific project path",
            port
        );
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

    let instance_id = json["id"].as_str().ok_or("Invalid response")?.to_string();

    tracing::info!("code-server instance created successfully with ID: {}", instance_id);
    tracing::info!("Auto-starting tunnel for code-server on port {}...", port);

    // Get server address from the created instance
    let server_address = json["serverAddress"]
        .as_str()
        .unwrap_or("127.0.0.1:7835")
        .to_string();

    // Update tunnel status to Starting
    let mut tunnels = state.tunnels.write().await;
    tunnels.insert(
        instance_id.clone(),
        TunnelInstance {
            id: instance_id.clone(),
            name: instance_name.clone(),
            local_port: port,
            region: "local".to_string(),
            server_address: server_address.clone(),
            public_url: json["publicUrl"].as_str().map(|s| s.to_string()),
            status: TunnelStatus::Starting,
            error_message: None,
        },
    );
    drop(tunnels);

    // Emit status update event
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);

    // Auto-start tunnel in background
    let config = TunnelConfig {
        instance_id: instance_id.clone(),
        local_port: port,
        server_address,
        secret: creds.token.clone(),
    };

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();
    let instance_id_clone = instance_id.clone();
    let token_clone = creds.token.clone();

    let handle = tokio::spawn(async move {
        // Start heartbeat task
        let instance_id_heartbeat = instance_id_clone.clone();
        let token_heartbeat = token_clone.clone();
        tokio::spawn(async move {
            let client = reqwest::Client::new();
            loop {
                // Send heartbeat every 10 seconds
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

                let _ = client
                    .post(format!(
                        "http://127.0.0.1:3000/api/instances/{}/heartbeat",
                        instance_id_heartbeat
                    ))
                    .header("Authorization", format!("Bearer {}", token_heartbeat))
                    .send()
                    .await;
            }
        });

        match start_tunnel_connection(config).await {
            Ok(_) => {
                // Update status to active
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Active;
                    tunnel.error_message = None;
                }
                drop(tunnels);
                // Emit status update event
                let _ = app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
                tracing::info!("Tunnel auto-started and active for {}", instance_id_clone);
            }
            Err(e) => {
                let error_msg = format!("{}", e);
                tracing::error!("Auto-start tunnel error for {}: {}", instance_id_clone, error_msg);
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Error;
                    tunnel.error_message = Some(error_msg);
                }
                drop(tunnels);
                // Emit status update event
                let _ = app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
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
    let creds = creds.as_ref().ok_or("Not authenticated")?;

    // Rename instance via API
    let client = reqwest::Client::new();
    let response = client
        .patch(format!(
            "http://127.0.0.1:3000/api/instances/{}",
            instance_id
        ))
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

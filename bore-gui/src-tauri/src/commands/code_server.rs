use crate::commands::dependencies::{check_code_server_installed, find_code_server_binary, install_bore_client, install_code_server};
use crate::commands::tunnels::start_tunnel;
use crate::state::{AppState, CodeServerInfo};
use std::process::Command;
use tauri::{AppHandle, State};

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
    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start code-server: {}", e))?;
    
    tracing::info!("code-server process started with PID: {:?}", child.id());

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

    // Store the code-server process handle
    let mut processes = state.code_server_processes.lock().await;
    processes.insert(instance_id.clone(), child);
    drop(processes);

    // Store code-server metadata for restart capability
    let mut metadata = state.code_server_metadata.write().await;
    metadata.insert(
        instance_id.clone(),
        CodeServerInfo {
            port,
            project_path: project_path.clone(),
        },
    );
    drop(metadata);

    tracing::info!("code-server instance created successfully with ID: {}", instance_id);
    tracing::info!("Auto-starting tunnel for code-server on port {}...", port);

    // Get server address from the created instance
    // Reuse the standard start_tunnel flow
    start_tunnel(app_handle.clone(), state.clone(), instance_id.clone())
        .await
        .map_err(|e| format!("Failed to auto-start tunnel: {}", e))?;

    Ok(instance_id)
}

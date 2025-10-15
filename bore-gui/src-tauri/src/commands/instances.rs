use crate::commands::tunnels::stop_tunnel;
use crate::commands::utils::TunnelInstanceResponse;
use crate::state::{AppState, TunnelStatus};
use std::net::TcpListener;
use tauri::{AppHandle, Manager, State};

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
        let remote_port = tunnels
            .get(&id)
            .and_then(|t| t.remote_port)
            .or_else(|| instance["remotePort"].as_u64().map(|v| v as u16))
            .or_else(|| instance["remote_port"].as_u64().map(|v| v as u16));

        result.push(TunnelInstanceResponse {
            id: id.clone(),
            name: instance["name"].as_str().unwrap_or("").to_string(),
            local_port: instance["localPort"].as_u64().unwrap_or(0) as u16,
            region: instance["region"].as_str().unwrap_or("").to_string(),
            server_address: instance["serverAddress"].as_str().unwrap_or("").to_string(),
            public_url: instance["publicUrl"].as_str().map(|s| s.to_string()),
            remote_port,
            status: status.to_string(),
            error_message,
        });
    }

    Ok(result)
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
    
    // Clean up code-server metadata
    let mut metadata = state.code_server_metadata.write().await;
    metadata.remove(&instance_id);
    drop(metadata);
    
    // Emit final status update to refresh UI
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);

    Ok(true)
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

// Check if a port is available
pub fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

// Find an available port starting from a given port
pub fn find_available_port(start_port: u16) -> Option<u16> {
    for port in start_port..65535 {
        if is_port_available(port) {
            return Some(port);
        }
    }
    None
}

#[tauri::command]
pub async fn find_available_port_command(start_port: u16) -> Result<u16, String> {
    find_available_port(start_port).ok_or_else(|| "No available port found".to_string())
}

use crate::commands::dependencies::find_code_server_binary;
use crate::commands::utils::{send_disconnect_request, update_instance_connection};
use crate::state::{AppState, TunnelHandleSet, TunnelInstance, TunnelStatus};
use crate::tunnel_manager::{start_tunnel_connection, TunnelConfig};
use bore_client::api_client::ConnectionInfo;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{oneshot, Mutex};

#[tauri::command]
pub async fn start_tunnel(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let creds = creds.as_ref().ok_or("Not authenticated")?;

    // Get instance details from API
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
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

    let instance_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let instance_name = instance_json["name"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let instance_region = instance_json["region"]
        .as_str()
        .unwrap_or("local")
        .to_string();

    // Request connection information (token, server host, etc.)
    let connect_response = client
        .post(format!(
            "http://127.0.0.1:3000/api/user/instances/{}/connect",
            instance_id
        ))
        .header("Authorization", format!("Bearer {}", creds.token))
        .send()
        .await
        .map_err(|e| format!("Failed to request connection: {}", e))?;

    if !connect_response.status().is_success() {
        let error_text = connect_response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to start tunnel".to_string());
        return Err(error_text);
    }

    let connection_info: ConnectionInfo = connect_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse connection info: {}", e))?;

    let local_port = connection_info.local_port;
    let server_host = connection_info.server_host.clone();
    let requested_remote_port = connection_info.remote_port;
    let tunnel_token = connection_info.tunnel_token.clone();

    // Check if this instance has code-server metadata and restart if needed
    let metadata = state.code_server_metadata.read().await;
    if let Some(cs_info) = metadata.get(&instance_id) {
        tracing::info!("Instance {} has code-server, checking if it needs to be restarted", instance_id);
        
        // Check if code-server process exists
        let processes = state.code_server_processes.lock().await;
        let needs_restart = !processes.contains_key(&instance_id);
        drop(processes);
        
        if needs_restart {
            tracing::info!("Restarting code-server for instance {} on port {}", instance_id, cs_info.port);
            
            // Find code-server binary
            if let Some(code_server_binary) = find_code_server_binary() {
                let mut cmd = Command::new(&code_server_binary);
                cmd.arg("--bind-addr").arg(format!("127.0.0.1:{}", cs_info.port));
                
                if let Some(path) = &cs_info.project_path {
                    cmd.arg(path);
                    tracing::info!("Restarting code-server with project path: {}", path);
                }
                
                match cmd.spawn() {
                    Ok(child) => {
                        tracing::info!("code-server restarted with PID: {:?}", child.id());
                        let mut processes = state.code_server_processes.lock().await;
                        processes.insert(instance_id.clone(), child);
                        drop(processes);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to restart code-server for {}: {}", instance_id, e);
                    }
                }
            } else {
                tracing::warn!("code-server binary not found, cannot restart for instance {}", instance_id);
            }
        } else {
            tracing::info!("code-server process already running for instance {}", instance_id);
        }
    }
    drop(metadata);

    // Update tunnel status to Starting
    let mut tunnels = state.tunnels.write().await;
    tunnels.insert(
        instance_id.clone(),
        TunnelInstance {
            id: instance_id.clone(),
            name: instance_name.clone(),
            local_port,
            region: instance_region.clone(),
            server_address: server_host.clone(),
            public_url: None,
            remote_port: None,
            status: TunnelStatus::Starting,
            error_message: None,
        },
    );
    drop(tunnels);

    // Emit status update event
    let _ = app_handle.emit_all("tunnel-status-changed", &instance_id);

    if let Err(err) = update_instance_connection(
        &creds.token,
        &instance_id,
        Some("starting"),
        None,
        None,
    )
    .await
    {
        tracing::debug!(
            "Failed to update backend connection state to starting for {}: {}",
            instance_id,
            err
        );
    }

    // Prepare heartbeat shutdown signal
    let (heartbeat_shutdown_sender, mut heartbeat_shutdown_rx) = oneshot::channel();
    let heartbeat_shutdown_signal = Arc::new(Mutex::new(Some(heartbeat_shutdown_sender)));

    // Prepare tunnel shutdown signal
    let (tunnel_shutdown_sender, tunnel_shutdown_rx) = oneshot::channel();
    let tunnel_shutdown_signal = Arc::new(Mutex::new(Some(tunnel_shutdown_sender)));

    // Start heartbeat loop for the instance
    let heartbeat_instance_id = instance_id.clone();
    let heartbeat_url = format!(
        "http://127.0.0.1:3000/api/instances/{}/heartbeat",
        heartbeat_instance_id
    );
    let heartbeat_auth_header = format!("Bearer {}", creds.token.clone());
    let heartbeat_local_port = local_port;
    let heartbeat_state = state.inner().clone();
    let heartbeat_handle = tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let mut interval =
            tokio::time::interval(tokio::time::Duration::from_secs(15));
        let mut last_activity = std::time::SystemTime::now();
        
        loop {
            tokio::select! {
                _ = &mut heartbeat_shutdown_rx => {
                    tracing::debug!("Heartbeat loop shutting down for {}", heartbeat_instance_id);
                    break;
                }
                _ = interval.tick() => {
                    // Check if code-server is responsive
                    let vscode_responsive = check_vscode_health(heartbeat_local_port).await;
                    
                    // Get system info
                    let cpu_usage = get_cpu_usage();
                    let memory_usage = get_memory_usage();
                    
                    // Check if there's an active code-server process
                    let has_code_server = {
                        let processes = heartbeat_state.code_server_processes.lock().await;
                        processes.contains_key(&heartbeat_instance_id)
                    };
                    
                    let payload = serde_json::json!({
                        "vscode_responsive": vscode_responsive,
                        "last_activity": last_activity.duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default().as_secs(),
                        "cpu_usage": cpu_usage,
                        "memory_usage": memory_usage,
                        "has_code_server": has_code_server,
                    });
                    
                    match client
                        .post(&heartbeat_url)
                        .header("Authorization", heartbeat_auth_header.clone())
                        .json(&payload)
                        .send()
                        .await
                    {
                        Ok(response) => {
                            if response.status().is_success() {
                                tracing::debug!("Heartbeat sent for {} (vscode: {})", 
                                    heartbeat_instance_id, vscode_responsive);
                                // Update last activity time on successful heartbeat
                                last_activity = std::time::SystemTime::now();
                            } else {
                                tracing::warn!("Heartbeat response error for {}: {}", 
                                    heartbeat_instance_id, response.status());
                            }
                        }
                        Err(err) => {
                            tracing::warn!(
                                "Failed to send heartbeat for {}: {}",
                                heartbeat_instance_id,
                                err
                            );
                        }
                    }
                }
            }
        }
    });

    // Setup signal to update UI/backend once tunnel is ready
    let (ready_tx, ready_rx) = oneshot::channel();
    let ready_state = state.inner().clone();
    let ready_instance_id = instance_id.clone();
    let ready_app_handle = app_handle.clone();
    let ready_token = creds.token.clone();
    let ready_server_host = server_host.clone();
    tokio::spawn(async move {
        match ready_rx.await {
            Ok(actual_port) => {
                let public_url = format!("{}:{}", ready_server_host, actual_port);
                {
                    let mut tunnels = ready_state.tunnels.write().await;
                    if let Some(tunnel) = tunnels.get_mut(&ready_instance_id) {
                        tunnel.status = TunnelStatus::Active;
                        tunnel.public_url = Some(public_url.clone());
                        tunnel.remote_port = Some(actual_port);
                        tunnel.error_message = None;
                    }
                }
                let _ = ready_app_handle.emit_all("tunnel-status-changed", &ready_instance_id);

                if let Err(err) = update_instance_connection(
                    &ready_token,
                    &ready_instance_id,
                    Some("active"),
                    Some(actual_port),
                    Some(&public_url),
                )
                .await
                {
                    tracing::warn!(
                        "Failed to update backend connection state for {}: {}",
                        ready_instance_id,
                        err
                    );
                }
            }
            Err(_) => {
                tracing::debug!(
                    "Tunnel ready signal dropped before completion for {}",
                    ready_instance_id
                );
            }
        }
    });

    // Start tunnel in background
    let config = TunnelConfig {
        instance_id: instance_id.clone(),
        local_host: "127.0.0.1".to_string(),
        local_port,
        server_host: server_host.clone(),
        remote_port: requested_remote_port,
        secret: Some(tunnel_token),
        ready_tx: Some(ready_tx),
        shutdown_rx: Some(tunnel_shutdown_rx),
    };

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();
    let instance_id_clone = instance_id.clone();
    let token_clone = creds.token.clone();
    let heartbeat_shutdown_clone = Arc::clone(&heartbeat_shutdown_signal);

    let handle = tokio::spawn(async move {
        let result = start_tunnel_connection(config).await;
        match &result {
            Ok(_) => {
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Inactive;
                    tunnel.error_message = None;
                    tunnel.public_url = None;
                    tunnel.remote_port = None;
                }
                drop(tunnels);
                let _ =
                    app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
                tracing::info!("Tunnel ended gracefully for {}", instance_id_clone);
            }
            Err(e) => {
                let error_msg = format!("{}", e);
                tracing::error!("Tunnel error for {}: {}", instance_id_clone, error_msg);
                let mut tunnels = state_clone.tunnels.write().await;
                if let Some(tunnel) = tunnels.get_mut(&instance_id_clone) {
                    tunnel.status = TunnelStatus::Error;
                    tunnel.error_message = Some(error_msg);
                    tunnel.public_url = None;
                    tunnel.remote_port = None;
                }
                drop(tunnels);
                let _ =
                    app_handle_clone.emit_all("tunnel-status-changed", &instance_id_clone);
            }
        }

        // Stop heartbeat loop gracefully
        if let Some(sender) = heartbeat_shutdown_clone.lock().await.take() {
            if sender.send(()).is_err() {
                tracing::debug!(
                    "Heartbeat loop already stopped for {}",
                    instance_id_clone
                );
            }
        }

        if let Err(err) = send_disconnect_request(&token_clone, &instance_id_clone).await {
            tracing::warn!(
                "Failed to disconnect instance {} after tunnel ended: {}",
                instance_id_clone,
                err
            );
        }
    });

    let mut handles = state.tunnel_handles.write().await;
    handles.insert(
        instance_id,
        TunnelHandleSet {
            tunnel: handle,
            heartbeat: Some(heartbeat_handle),
            heartbeat_shutdown: Some(heartbeat_shutdown_signal),
            tunnel_shutdown: Some(tunnel_shutdown_signal),
        },
    );

    Ok(true)
}

#[tauri::command]
pub async fn stop_tunnel(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<bool, String> {
    tracing::info!("Stopping tunnel for instance: {}", instance_id);

    // Stop the tunnel task gracefully
    let mut handles = state.tunnel_handles.write().await;
    if let Some(handle_set) = handles.remove(&instance_id) {
        // Send shutdown signal to tunnel
        if let Some(shutdown) = handle_set.tunnel_shutdown {
            if let Some(sender) = shutdown.lock().await.take() {
                tracing::info!("Sending graceful shutdown signal to tunnel for {}", instance_id);
                let _ = sender.send(());
            }
        }
        
        // Send shutdown signal to heartbeat
        if let Some(shutdown) = handle_set.heartbeat_shutdown {
            if let Some(sender) = shutdown.lock().await.take() {
                let _ = sender.send(());
            }
        }
        
        // Wait a moment for graceful shutdown, then force abort if needed
        drop(handles); // Release lock before waiting
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Force abort if still running (shouldn't be necessary with graceful shutdown)
        if !handle_set.tunnel.is_finished() {
            tracing::warn!("Tunnel task did not stop gracefully, forcing abort for {}", instance_id);
            handle_set.tunnel.abort();
        }
        if let Some(heartbeat) = handle_set.heartbeat {
            if !heartbeat.is_finished() {
                heartbeat.abort();
            }
        }
        
        tracing::info!("Tunnel stopped for {}", instance_id);
    } else {
        drop(handles);
    }

    // Remove from tunnels map (status will default to inactive)
    let mut tunnels = state.tunnels.write().await;
    tunnels.remove(&instance_id);
    drop(tunnels);

    // Kill code-server process if it exists
    let mut processes = state.code_server_processes.lock().await;
    if let Some(mut child) = processes.remove(&instance_id) {
        tracing::info!("Killing code-server process for instance: {}", instance_id);
        match child.kill() {
            Ok(_) => {
                tracing::info!("code-server process killed successfully for {}", instance_id);
                // Spawn async task to wait for process termination without blocking
                tokio::task::spawn_blocking(move || {
                    let _ = child.wait();
                });
            }
            Err(e) => {
                tracing::warn!("Failed to kill code-server process for {}: {}", instance_id, e);
            }
        }
    }
    drop(processes);

    // Notify backend that the instance is offline
    let token = {
        let creds_guard = state.credentials.read().await;
        creds_guard.as_ref().map(|c| c.token.clone())
    };

    if let Some(token) = token {
        if let Err(err) = send_disconnect_request(&token, &instance_id).await {
            tracing::warn!(
                "Failed to disconnect instance {} during stop: {}",
                instance_id,
                err
            );
        } else {
            tracing::info!("Disconnected instance {} from backend", instance_id);
        }
    } else {
        tracing::debug!(
            "No credentials available to disconnect instance {} during stop",
            instance_id
        );
    }

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
            TunnelStatus::Online => "online",
            TunnelStatus::Starting => "starting",
            TunnelStatus::Degraded => "degraded",
            TunnelStatus::Idle => "idle",
            TunnelStatus::Offline => "offline",
            TunnelStatus::Error => "error",
            TunnelStatus::Inactive => "inactive",
        })
        .unwrap_or("inactive");

    Ok(status.to_string())
}

// Helper function to check if code-server/VSCode is responsive
async fn check_vscode_health(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/healthz", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    
    match client.get(&url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => {
            // Fallback: try to connect to the port
            tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port))
                .await
                .is_ok()
        }
    }
}

// Helper function to get CPU usage percentage (cross-platform)
fn get_cpu_usage() -> f32 {
    use sysinfo::{System, RefreshKind, CpuRefreshKind};
    
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_cpu(CpuRefreshKind::everything())
    );
    
    // Need to refresh twice with a small delay for accurate CPU usage
    std::thread::sleep(std::time::Duration::from_millis(100));
    sys.refresh_cpu();
    
    // Return global CPU usage
    sys.global_cpu_info().cpu_usage()
}

// Helper function to get memory usage in MB (cross-platform)
fn get_memory_usage() -> u64 {
    use sysinfo::{System, RefreshKind, ProcessRefreshKind};
    
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything())
    );
    sys.refresh_processes();
    
    // Get current process memory usage
    if let Some(process) = sys.process(sysinfo::get_current_pid().ok()?) {
        return process.memory() / 1024 / 1024; // Convert bytes to MB
    }
    
    0
}

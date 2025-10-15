use crate::commands::utils::{send_disconnect_request, LoginResponse};
use crate::state::{delete_credentials, load_credentials, save_credentials, AppState, Credentials, TunnelHandleSet};
use tauri::State;

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
    // Capture auth token before clearing credentials
    let token = {
        let creds = state.credentials.read().await;
        creds.as_ref().map(|c| c.token.clone())
    };

    // Stop all tunnels
    let mut handles = state.tunnel_handles.write().await;
    let handle_entries: Vec<(String, TunnelHandleSet)> = handles.drain().collect();
    drop(handles);

    let instance_ids: Vec<String> = handle_entries.iter().map(|(id, _)| id.clone()).collect();

    for (instance_id, handle_set) in handle_entries {
        tracing::info!("Stopping tunnel during logout: {}", instance_id);
        
        // Send graceful shutdown signals
        if let Some(shutdown) = handle_set.tunnel_shutdown {
            if let Some(sender) = shutdown.lock().await.take() {
                let _ = sender.send(());
            }
        }
        if let Some(shutdown) = handle_set.heartbeat_shutdown {
            if let Some(sender) = shutdown.lock().await.take() {
                let _ = sender.send(());
            }
        }
    }
    
    // Wait briefly for graceful shutdown
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Remove tunnel metadata
    let mut tunnels = state.tunnels.write().await;
    for id in &instance_ids {
        tunnels.remove(id);
    }
    drop(tunnels);

    // Kill all code-server processes
    let mut processes = state.code_server_processes.lock().await;
    for (instance_id, mut child) in processes.drain() {
        tracing::info!("Killing code-server process during logout for instance: {}", instance_id);
        if let Err(e) = child.kill() {
            tracing::warn!("Failed to kill code-server process for {}: {}", instance_id, e);
        } else {
            let _ = child.wait();
        }
    }
    drop(processes);

    // Clear code-server metadata
    let mut metadata = state.code_server_metadata.write().await;
    metadata.clear();
    drop(metadata);

    // Notify backend instances
    if let Some(token) = token {
        for id in &instance_ids {
            if let Err(err) = send_disconnect_request(&token, id).await {
                tracing::warn!(
                    "Failed to disconnect instance {} during logout: {}",
                    id,
                    err
                );
            }
        }
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

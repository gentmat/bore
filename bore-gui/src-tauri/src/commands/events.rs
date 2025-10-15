use crate::state::AppState;
use eventsource_client as es;
use eventsource_client::Client;
use futures::StreamExt;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

// Track SSE connection
static SSE_HANDLE: once_cell::sync::Lazy<Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(None)));

#[tauri::command]
pub async fn start_status_listener(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let creds = state.credentials.read().await;
    let token = creds
        .as_ref()
        .map(|c| c.token.clone())
        .ok_or("Not authenticated")?;
    drop(creds);

    // Stop existing listener if any
    stop_status_listener().await.ok();

    let url = format!("http://127.0.0.1:3000/api/events/status");
    
    tracing::info!("Starting SSE status listener at {}", url);

    let handle = tokio::spawn(async move {
        loop {
            let client = match Client::for_url(&url)
                .and_then(|c| c.header("Authorization", &format!("Bearer {}", token)))
                .map(|c| c.build())
            {
                Ok(client) => client,
                Err(err) => {
                    tracing::error!("Failed to create SSE client: {}", err);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    continue;
                }
            };

            let mut stream = client.stream();

            while let Some(event) = stream.next().await {
                match event {
                    Ok(es::SSE::Event(event)) => {
                        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&event.data) {
                            tracing::debug!("SSE event received: {:?}", data);
                            
                            if let Some(instance_id) = data.get("instanceId").and_then(|v| v.as_str()) {
                                // Emit Tauri event to trigger UI refresh
                                let _ = app_handle.emit_all("tunnel-status-changed", instance_id);
                            }
                        }
                    }
                    Ok(es::SSE::Comment(_)) => {
                        // Ignore comments
                    }
                    Err(err) => {
                        tracing::warn!("SSE error: {}", err);
                        break; // Exit inner loop to reconnect
                    }
                }
            }
            
            tracing::info!("SSE stream ended, reconnecting in 5 seconds...");
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    });

    let mut sse_handle = SSE_HANDLE.write().await;
    *sse_handle = Some(handle);

    Ok(true)
}

#[tauri::command]
pub async fn stop_status_listener() -> Result<bool, String> {
    let mut sse_handle = SSE_HANDLE.write().await;
    
    if let Some(handle) = sse_handle.take() {
        handle.abort();
        tracing::info!("SSE status listener stopped");
    }
    
    Ok(true)
}

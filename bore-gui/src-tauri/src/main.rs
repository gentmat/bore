// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;
mod tunnel_manager;

use commands::{
    check_auth, check_bore_client_installed, check_code_server_installed, create_instance,
    delete_instance, ensure_dependencies, find_available_port_command, get_tunnel_status,
    install_bore_client, install_code_server, list_instances, login, logout, rename_instance,
    signup, start_code_server_instance, start_status_listener, start_tunnel, stop_status_listener,
    stop_tunnel,
};
use state::{AppState, TunnelHandleSet};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};

fn main() {
    tracing_subscriber::fmt::init();

    // Create system tray
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    let app = tauri::Builder::default()
        .manage(AppState::new())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    // Cleanup tunnels before quitting
                    cleanup_tunnels(app);
                    app.exit(0);
                }
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            signup,
            login,
            logout,
            check_auth,
            list_instances,
            start_tunnel,
            stop_tunnel,
            get_tunnel_status,
            create_instance,
            delete_instance,
            rename_instance,
            check_bore_client_installed,
            install_bore_client,
            check_code_server_installed,
            install_code_server,
            find_available_port_command,
            ensure_dependencies,
            start_code_server_instance,
            start_status_listener,
            stop_status_listener,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        RunEvent::ExitRequested { api, .. } => {
            // Cleanup tunnels on exit
            cleanup_tunnels(app_handle);
            api.prevent_exit();
            // Give a moment for cleanup, then exit
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            // On main window close, just hide it instead of exiting
            if label == "main" {
                let window = app_handle.get_window("main").unwrap();
                window.hide().unwrap();
                api.prevent_close();
            }
        }
        _ => {}
    });
}

/// Cleanup all active tunnels before app shutdown
fn cleanup_tunnels(app_handle: &tauri::AppHandle) {
    tracing::info!("Cleaning up active tunnels before shutdown...");
    
    let state: tauri::State<AppState> = app_handle.state();
    
    // Use tokio runtime to run async cleanup
    tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(async {
            let token_opt = {
                let creds_guard = state.credentials.read().await;
                creds_guard.as_ref().map(|c| c.token.clone())
            };

            let mut handles_guard = state.tunnel_handles.write().await;
            let handle_entries: Vec<(String, TunnelHandleSet)> = handles_guard.drain().collect();
            drop(handles_guard);

            let instance_ids: Vec<String> = handle_entries.iter().map(|(id, _)| id.clone()).collect();

            for (instance_id, handle_set) in handle_entries {
                tracing::info!("Stopping tunnel for instance: {}", instance_id);
                
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

            let mut tunnels = state.tunnels.write().await;
            tunnels.clear();
            drop(tunnels);

            // Kill all code-server processes
            let mut processes = state.code_server_processes.lock().await;
            for (instance_id, mut child) in processes.drain() {
                tracing::info!("Killing code-server process during cleanup for instance: {}", instance_id);
                if let Err(e) = child.kill() {
                    tracing::warn!("Failed to kill code-server process for {}: {}", instance_id, e);
                } else {
                    let _ = child.wait();
                }
            }
            drop(processes);

            for instance_id in &instance_ids {
                let _ = app_handle.emit_all("tunnel-status-changed", instance_id);
            }

            if let Some(token) = token_opt {
                let auth_header = format!("Bearer {}", token);
                let client = reqwest::Client::new();

                for instance_id in instance_ids {
                    match client
                        .post(format!(
                            "http://127.0.0.1:3000/api/user/instances/{}/disconnect",
                            instance_id
                        ))
                        .header("Authorization", auth_header.clone())
                        .send()
                        .await
                    {
                        Ok(response) => {
                            if let Err(err) = response.error_for_status() {
                                tracing::warn!(
                                    "Failed to disconnect instance {} during cleanup: {}",
                                    instance_id,
                                    err
                                );
                            } else {
                                tracing::info!(
                                    "Disconnected instance {} during cleanup",
                                    instance_id
                                );
                            }
                        }
                        Err(err) => {
                            tracing::warn!(
                                "Failed to send disconnect request for {} during cleanup: {}",
                                instance_id,
                                err
                            );
                        }
                    }
                }
            }
        });
    
    tracing::info!("All tunnels stopped successfully");
}

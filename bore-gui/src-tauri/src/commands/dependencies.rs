use crate::commands::utils::DependencyStatus;
use std::{env, fs, os::unix::fs::PermissionsExt, path::{Path, PathBuf}, process::Command};
use tauri::AppHandle;

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
pub fn find_bore_client_binary() -> Option<PathBuf> {
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

pub fn find_code_server_binary() -> Option<PathBuf> {
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

use std::env;
use std::process::{Command, Stdio};

fn is_installed() -> bool {
    let status = Command::new("code-server")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) => s.success(),
        Err(_) => false,
    }
}

pub fn warn_if_missing() {
    if is_installed() {
        return;
    }

    eprintln!("code-server is not installed or not found in PATH.");

    if cfg!(target_os = "windows") {
        eprintln!("On Windows, code-server is typically installed via npm:");
        eprintln!("  1) Install Node.js 22.x from https://nodejs.org");
        eprintln!("  2) Install a C++ build toolchain (e.g. Visual Studio 2019 with C++ build tools)");
        eprintln!("  3) Run: npm install --global code-server");
    } else {
        eprintln!("On Linux/macOS, you can install code-server with:");
        eprintln!("  curl -fsSL https://code-server.dev/install.sh | sh");
    }

    eprintln!("For full documentation, see:");
    eprintln!("  https://coder.com/docs/code-server/install");
}

pub fn start_for_current_dir(port: u16) {
    if !is_installed() {
        warn_if_missing();
        return;
    }

    let cwd = match env::current_dir() {
        Ok(p) => p,
        Err(err) => {
            eprintln!("failed to determine current directory for code-server: {}", err);
            return;
        }
    };

    let bind_addr = format!("0.0.0.0:{}", port);

    let mut cmd = Command::new("code-server");
    cmd.arg(cwd)
        .arg("--bind-addr")
        .arg(&bind_addr)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .stdin(Stdio::null());

    match cmd.spawn() {
        Ok(_) => {
            eprintln!(
                "Started code-server for current directory on http://127.0.0.1:{}",
                port
            );
        }
        Err(err) => {
            eprintln!("failed to start code-server: {}", err);
        }
    }
}

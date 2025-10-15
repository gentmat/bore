# Automatic Installation Features

## Overview
bore-gui now automatically handles the installation of required dependencies:
- **bore-client**: Bundled with the application and auto-installed if not found
- **code-server**: Auto-installed from https://github.com/coder/code-server if not found

## Changes Made

### 1. Build System (`src-tauri/build.rs`)
- Compiles bore-client during build time (produces `bore` binary)
- Bundles the binary into `resources/bore-client`
- Ensures bore-client is always available with the application
- Note: The binary is compiled as `bore` but stored as `bore-client` for consistency

### 1b. Preparation Script (`prepare-build.sh`)
- Run before building to pre-compile bore binary
- Automatically called by `build-installers.sh`
- Can be run manually: `./prepare-build.sh`

### 2. Configuration (`src-tauri/tauri.conf.json`)
- Added `resources/bore-client` to bundle resources
- Binary is packaged with all distribution formats (deb, rpm, appimage)

### 3. Backend Commands (`src-tauri/src/commands.rs`)
Added new Tauri commands:
- `check_bore_client_installed()`: Checks if bore-client or bore is in PATH
- `install_bore_client()`: Installs bundled bore-client to `~/.local/bin`
- `check_code_server_installed()`: Checks if code-server is installed
- `install_code_server()`: 
  - Runs dry-run check first: `curl -fsSL https://code-server.dev/install.sh | sh -s -- --dry-run`
  - If successful, proceeds with actual installation
  - Uses official installation script from https://code-server.dev/install.sh

Updated `start_code_server_instance()`:
- Automatically checks for bore-client before starting
- Installs bore-client if missing
- Automatically checks for code-server before starting
- Installs code-server if missing
- Provides clear error messages if installation fails

### 4. Frontend (`src/components/CreateInstanceModal.tsx`)
- Updated UI to inform users about automatic installation
- Shows loading state during dependency installation

### 5. Command Registration (`src-tauri/src/main.rs`)
- Registered new commands: `check_bore_client_installed`, `install_bore_client`

## How It Works

### bore-client Installation
1. When starting a code-server instance, the app checks if `bore-client` or `bore` command exists
2. If not found, it copies the bundled binary from the application resources
3. Installs to `~/.local/bin/bore-client`
4. Sets executable permissions (755)
5. The command is then immediately available for use

### code-server Installation
1. When starting a code-server instance, the app checks if `code-server` command exists
2. If not found, it runs the official installation script with a dry-run check first
3. If dry-run succeeds, proceeds with actual installation
4. Uses the official script: `curl -fsSL https://code-server.dev/install.sh | sh`

## User Experience
- Users no longer need to manually install bore-client
- Users no longer need to manually install code-server
- First-time setup is fully automated
- Clear error messages if installation fails
- Installation happens transparently during instance creation

## Requirements
- For bore-client: Write access to `~/.local/bin` directory
- For code-server: System must support the official installation script (Linux/macOS)
- Internet connection for code-server installation

## Notes
- bore-client binary is platform-specific and compiled during build
- code-server installation requires curl and sh
- User can still manually install dependencies if preferred
- `~/.local/bin` should be in PATH for bore-client to work (common default on Linux)

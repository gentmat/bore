# How to Start Bore Components

This guide explains how to start the Bore server, core, and client components after installation.

## Prerequisites

Ensure you've completed the installation process:
```bash
./1_install_dependencies.sh
./2_setup_environment.sh
./3_start_services.sh
./4_verify_installation.sh
```

## Starting the Services

### 1. Start Backend Server (API)

The backend API server runs in Docker and provides the web interface and REST API.

```bash
# Navigate to backend directory
cd backend

# Start all services
sudo docker compose up -d

# Check status
sudo docker compose ps
```

**Expected URLs:**
- Backend API: http://localhost:3000
- Login Page: http://localhost:3000/login.html
- Dashboard: http://localhost:3000/dashboard.html

### 2. Start Core (Bore Server/Tunnel)

The bore server handles tunnel connections and runs alongside the backend.

```bash
# Start with tunnel profile
sudo docker compose --profile tunnel up -d

# Check if bore-server container is running
sudo docker compose ps bore-server
```

**Expected behavior:**
- Bore server listens on port 7835 for control connections
- Tunnel ports 1024-65535 are available for dynamic port allocation

### 3. Start Client

The bore CLI client can be built and used to create tunnels.

#### Build and Install Client
```bash
# Build the client
./9_build_client.sh

# Or manually:
cargo build --release -p bore-client
sudo cp target/release/bore /usr/local/bin/bore
```

#### Using the Client

**Basic tunnel usage:**
```bash
# Create a tunnel from local port 8080 to remote server
bore local 8080 --to localhost --port 7835

# Tunnel example: Make local web server accessible remotely
bore local 8080 --to your-server.com --port 7835
```

### 4. Start GUI (Optional)

The desktop GUI provides a visual interface for managing tunnels.

```bash
# Build the GUI
./10_build_gui.sh

# Run the GUI
bore-gui
```

**Expected output:**
- Desktop application window opens
- Visual tunnel management interface

## Service Management Commands

### Check Status
```bash
# All services
./4_verify_installation.sh

# Docker containers
sudo docker compose ps

# Individual service logs
./7_view_logs.sh
```

### Stop Services
```bash
# Stop all services
./5_stop_services.sh

# Stop specific services
sudo docker compose stop backend
sudo docker compose stop bore-server
```

### Restart Services
```bash
# Restart backend
sudo docker compose restart backend

# Restart with rebuild
sudo docker compose up -d --build
```

### View Logs
```bash
# All services
./7_view_logs.sh

# Specific service
sudo docker compose logs -f backend
sudo docker compose logs -f bore-server
```

## Troubleshooting

### Services Won't Start
1. Check Docker is running: `sudo systemctl status docker`
2. Verify environment setup: `cd backend && cat .env`
3. Check logs: `sudo docker compose logs`

### Client Connection Issues
1. Verify bore-server is running: `sudo docker compose ps bore-server`
2. Check firewall settings: `./8_configure_firewall.sh`
3. Test connectivity: `curl http://localhost:3000/health`

### Port Conflicts
1. Check what's using the port: `sudo netstat -tulpn | grep :3000`
2. Modify `.env` file to change ports
3. Restart services: `sudo docker compose up -d`

## Quick Start Summary

After installation, start everything with:
```bash
# Start backend and core services
sudo docker compose --profile tunnel up -d

# Verify everything is running
./4_verify_installation.sh

# Use the client
bore local 8080 --to localhost --port 7835
```

Access the web interface at http://localhost:3000
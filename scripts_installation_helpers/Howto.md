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

For creating tunnels, use the managed bore-client flow described in the
*How to use bore-client* section below (`bore signup`, `bore login`,
`bore list`, `bore start`).

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

## How to use bore-client

### Managed mode (recommended)

Managed mode uses the Bore backend API and web dashboard.

1. **Sign up (first time)**
```bash
bore signup --api-endpoint http://localhost:3000
```
If you set `BORE_API_ENDPOINT`, you can omit `--api-endpoint`.

2. **Login (existing account)**
```bash
bore login --api-endpoint http://localhost:3000
```
If you set `BORE_API_ENDPOINT`, you can omit `--api-endpoint`.

3. **List available tunnel instances**
```bash
bore list
```
This shows all instances associated with your account (created via the dashboard).

4. **Start a tunnel for an instance**
```bash
bore start <instance-name-or-id>
```
The client will:
- Connect to the Bore server
- Start forwarding the configured local port
- Keep the instance marked as active via heartbeats

Keep this process running. Use `Ctrl+C` to stop the tunnel.

5. **Logout (optional)**
```bash
bore logout
```

### Environment variables

The CLI respects this environment variable:

- `BORE_API_ENDPOINT`: Default API endpoint for `bore signup` and `bore login`

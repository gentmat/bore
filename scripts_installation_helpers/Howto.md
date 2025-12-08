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


To remove the backend server, run:
```bash
# Stop all containers
sudo docker stop $(sudo docker ps -aq)

# Remove all containers
sudo docker rm $(sudo docker ps -aq)

# Remove all images
sudo docker rmi $(sudo docker images -q)

# Remove all volumes
sudo docker volume rm $(sudo docker volume ls -q)

// check
sudo docker compose ps
sudo docker volume ls


cd backend

# Rebuild backend image with the new route + relaxed validation
docker compose build backend

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

3. **Create a managed tunnel instance**
```bash
bore create-instance <name> <local-port>
```
This registers an instance in your account. Make sure your app is listening on
`<local-port>` on this machine.

4. **List your tunnel instances**
```bash
bore list
```

5. **Start a tunnel for an instance**
```bash
bore start <instance-name-or-id>
```
The client will:
- Connect to the Bore server
- Start forwarding the configured local port
- Keep the instance marked as active via heartbeats

Keep this process running. Use `Ctrl+C` to stop the tunnel.

6. **Logout (optional)**
```bash
bore logout
```

### Environment variables

The CLI respects this environment variable:

- `BORE_API_ENDPOINT`: Default API endpoint for `bore signup` and `bore login`






client
cd /home/gentmat/CascadeProjects/bore
cargo build --release -p bore-client
sudo rm /usr/local/bin/bore
cargo install --path bore-client --force
export PATH="$HOME/.cargo/bin:$PATH"
source ~/.bashrc   # or ~/.zshrc
which bore
bore signup --api-endpoint http://localhost:3000
bore login --api-endpoint http://localhost:3000
# Example: app listens on localhost:3000
bore create-instance maroun_instance 3000
bore create-instance name port
bore logout
bore list
bore start <instance-name-or-id>
bore stop

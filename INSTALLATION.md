# Bore Installation Guide (Arch Linux + Docker)

## Prerequisites

### System Packages

```bash
sudo pacman -S docker docker-compose git base-devel
```

### Enable Docker

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Re-login or run: newgrp docker
```

---

## Quick Start (Docker - Recommended)

### 1. Clone Repository

```bash
git clone https://github.com/gentmat/bore.git
cd bore
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```bash
# Required - Generate secure values
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)
DB_PASSWORD=your_secure_password

# Optional - Auto-create admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure_admin_password
ADMIN_AUTO_CREATE=true

# Enable bore-server on same machine
ENABLE_MASTER_TUNNEL=true
COMPOSE_PROFILES=tunnel
```

### 3. Start Services

```bash
cd backend
docker compose up -d
```

### 4. Verify

```bash
docker compose ps
curl http://localhost:3000/health
```

---

## Service URLs

| Service | URL | Port |
|---------|-----|------|
| **Backend API** | http://localhost:3000 | 3000 |
| **Bore Server** | localhost | 7835 |
| **PostgreSQL** | localhost | 5432 |
| **Redis** | localhost | 6379 |

---

## With Monitoring (Optional)

### Enable Grafana + Prometheus

```bash
# In backend/.env
COMPOSE_PROFILES=tunnel,monitoring
```

```bash
docker compose --profile monitoring up -d
```

| Service | URL | Port |
|---------|-----|------|
| **Grafana** | http://localhost:3001 | 3001 |
| **Prometheus** | http://localhost:9090 | 9090 |

---

## Manual Build (No Docker)

### Install Dependencies

```bash
# Rust
sudo pacman -S rust

# Node.js
sudo pacman -S nodejs npm

# PostgreSQL
sudo pacman -S postgresql
sudo systemctl enable --now postgresql

# Redis (optional)
sudo pacman -S redis
sudo systemctl enable --now redis
```

### Setup PostgreSQL

```bash
sudo -u postgres createuser -P bore_user
sudo -u postgres createdb -O bore_user bore_db
```

### Build Rust Components

```bash
cd /path/to/bore
cargo build --release
```

Binaries located at:
- `target/release/bore-server`
- `target/release/bore` (client)

### Build Backend

```bash
cd backend
npm install
npm run build:all
npm run migrate:up
```

### Run Services

Terminal 1 - Backend:
```bash
cd backend
npm run start:prod
```

Terminal 2 - Bore Server:
```bash
./target/release/bore-server
```

---

## Bore Server Environment

Create `bore-server/.env`:

```bash
BORE_BACKEND_URL=http://127.0.0.1:3000
BORE_BACKEND_API_KEY=<same_as_backend_INTERNAL_API_KEY>
BORE_SERVER_ID=server1
BORE_MIN_PORT=1024
BORE_MAX_PORT=65535
```

---

## Create Admin User

### Option 1: Environment Variables (Docker)

Set in `backend/.env` before starting:
```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password
ADMIN_AUTO_CREATE=true
```

### Option 2: Manual Script

```bash
cd backend
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secure npm run create-admin
```

---

## Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 3000/tcp   # Backend API
sudo ufw allow 7835/tcp   # Bore Server control
sudo ufw allow 1024:65535/tcp  # Tunnel ports (adjust range as needed)
```

Or with iptables:
```bash
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7835 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 1024:65535 -j ACCEPT
```

---

## Systemd Services (Manual Install)

### bore-server.service

```bash
sudo tee /etc/systemd/system/bore-server.service << 'EOF'
[Unit]
Description=Bore Tunnel Server
After=network.target

[Service]
Type=simple
User=bore
WorkingDirectory=/opt/bore
ExecStart=/opt/bore/bore-server
EnvironmentFile=/opt/bore/bore-server/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### bore-backend.service

```bash
sudo tee /etc/systemd/system/bore-backend.service << 'EOF'
[Unit]
Description=Bore Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=bore
WorkingDirectory=/opt/bore/backend
ExecStart=/usr/bin/node dist/server.js
EnvironmentFile=/opt/bore/backend/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### Enable Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bore-server bore-backend
```

---

## Bore Client Installation

### Build from Source

```bash
cargo build --release -p bore-client
sudo cp target/release/bore /usr/local/bin/
```

### Usage

```bash
# Sign up (first time)
bore signup --api-endpoint http://localhost:3000

# Or login with an existing account
bore login --api-endpoint http://localhost:3000

# List your tunnel instances
bore list

# Start a managed tunnel instance
bore start <instance-name-or-id>
```

---

## Kubernetes Deployment

See `k8s/` directory for manifests.

```bash
# Development
./k8s/deploy.sh deploy -e development

# Production
./k8s/deploy.sh deploy -e production --push-images
```

---

## Troubleshooting

### Check Logs

```bash
# Docker
docker compose logs -f backend
docker compose logs -f bore-server

# Systemd
journalctl -u bore-backend -f
journalctl -u bore-server -f
```

### Reset Database

```bash
docker compose down -v
docker compose up -d
```

### Common Issues

- **Port 5432 in use**: Stop local PostgreSQL or change `DB_PORT`
- **Permission denied**: Ensure user is in `docker` group
- **Migration failed**: Check PostgreSQL is running and accessible

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Token signing key |
| `INTERNAL_API_KEY` | Yes | - | Backend ↔ bore-server auth |
| `DB_HOST` | No | localhost | PostgreSQL host |
| `DB_PORT` | No | 5432 | PostgreSQL port |
| `DB_NAME` | No | bore_db | Database name |
| `DB_USER` | No | postgres | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `REDIS_ENABLED` | No | false | Enable Redis |
| `REDIS_HOST` | No | localhost | Redis host |
| `BORE_SERVER_HOST` | No | 127.0.0.1 | Bore server address |
| `BORE_SERVER_PORT` | No | 7835 | Bore server port |
| `ENABLE_MASTER_TUNNEL` | No | true | Run bore-server locally |
| `MAX_TUNNELS_PER_SERVER` | No | 100 | Tunnel limit |

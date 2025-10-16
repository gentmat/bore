# Bore - TCP Tunnel Solution

A modern, scalable TCP tunneling solution with a comprehensive management platform. Bore allows you to expose local services to the internet through secure tunnels, with built-in authentication, capacity management, and multi-server orchestration.

## 🚀 Features

- **Secure TCP Tunneling** - Expose local services through authenticated tunnels
- **Multi-Server Architecture** - Coordinate multiple bore-servers for high availability
- **User Management** - JWT-based authentication with role-based access control
- **Capacity Management** - Intelligent load balancing and resource allocation
- **Desktop GUI** - Cross-platform desktop application (Linux, macOS, Windows)
- **Web Dashboard** - Modern React-based management interface
- **REST API** - Complete API for automation and integration
- **Real-Time Monitoring** - Live tunnel status and metrics
- **Production Ready** - Supports 1,000+ concurrent users with horizontal scaling

## 📦 Components

### 1. **bore-client** (Rust)
Command-line client for creating tunnels from your local machine to bore-servers.

### 2. **bore-server** (Rust)
Lightweight tunnel server that handles client connections and port forwarding.

### 3. **backend** (TypeScript/Node.js)
Central coordinator API that manages authentication, instance lifecycle, and multi-server orchestration.

### 4. **bore-gui** (Tauri + React)
Cross-platform desktop application for managing tunnels with a beautiful UI.

## 🎯 Quick Start

### Option 1: Docker (Recommended)

The easiest way to get started:

```bash
cd backend

# Setup environment (first time)
cp .env.example .env
nano .env  # Configure your settings

# Start everything
./start.sh

# Access the dashboard
# Open http://localhost:3000/dashboard
```

**Testing Mode** (bore-server on master):
```bash
# In .env: ENABLE_MASTER_TUNNEL=true
./start.sh  # Starts: Backend + Database + Redis + bore-server
```

**Production Mode** (coordinator only):
```bash
# In .env: ENABLE_MASTER_TUNNEL=false
./start.sh  # Starts: Backend + Database + Redis
# Deploy bore-servers separately on VPS instances
```

### Option 2: Manual Setup

**Prerequisites:**
- Rust (latest stable)
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

**Build Rust Components:**
```bash
cargo build --release --workspace
cargo install --path bore-client
cargo install --path bore-server
```

**Setup Backend:**
```bash
cd backend
npm install
cp .env.example .env
nano .env  # Configure database and secrets
npm run migrate:up
npm start
```

**Run bore-server:**
```bash
bore-server --bind-addr 127.0.0.1 \
            --bind-tunnels 127.0.0.1 \
            --backend-url http://127.0.0.1:3000
```

## 📱 Desktop GUI

Build and install the cross-platform desktop application:

```bash
cd bore-gui

# Install dependencies
npm install

# Development mode
npm run tauri dev

# Build for production
npm run tauri build

# Build installers (AppImage, DEB, etc.)
./build-installers.sh
```

The GUI provides:
- One-click tunnel management
- Real-time status updates
- System tray integration
- Cross-platform support (Linux, macOS, Windows)

## 🔧 Usage Examples

### Creating a Tunnel with bore-client

```bash
# Forward local port 8080 with authentication
bore 8080 --to 127.0.0.1 --secret sk_tok_your_token

# Specify custom local host
bore 3000 --to bore.example.com --local-host 192.168.1.100

# Use environment variables
export BORE_SECRET=sk_tok_your_token
bore 8080 --to bore.example.com
```

### API Usage

```bash
# Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Create a tunnel instance
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-web-app",
    "local_port": 8080,
    "server_id": "server-1"
  }'
```

## 🏗️ Architecture

```
┌──────────────┐
│   Clients    │
│ (bore-client)│
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│   Bore Servers      │
│ (Multiple Regions)  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Backend API        │
│  (Coordinator)      │
└──────┬──────────────┘
       │
       ├─► PostgreSQL (State)
       ├─► Redis (Caching)
       └─► Web Dashboard
```

**Key Features:**
- **Horizontal Scaling**: Add more bore-servers as demand grows
- **Load Balancing**: Intelligent server selection based on capacity
- **High Availability**: Redis-backed distributed state
- **Monitoring**: Prometheus/Grafana integration ready

## 🛠️ Configuration

### Environment Variables

**Backend (.env):**
```bash
# Server
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=your-strong-secret
INTERNAL_API_KEY=your-internal-key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=your-password

# Redis (for scaling)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Capacity
MAX_TUNNELS_PER_SERVER=100
TOTAL_SYSTEM_CAPACITY=500
RESERVED_CAPACITY_PERCENT=20

# Bore Server
BORE_SERVER_HOST=127.0.0.1
BORE_SERVER_PORT=7835

# Optional: Master tunnel for testing
ENABLE_MASTER_TUNNEL=false
```

### Database Migrations

```bash
cd backend

# Create new migration
npm run migrate:create add-feature

# Apply migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

## 📊 Monitoring

The backend exposes metrics for monitoring:

- **/health** - Health check endpoint
- **/metrics** - Prometheus metrics
- **/api/v1/admin/stats** - System statistics

Integrate with Prometheus and Grafana for comprehensive monitoring.

## 🔒 Security

- **JWT Authentication**: Secure token-based authentication
- **API Key Management**: Per-user API keys for bore-client
- **Rate Limiting**: Protection against abuse
- **CORS**: Configurable cross-origin restrictions
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **Circuit Breaker**: Automatic failover for unhealthy servers

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration

# Load testing
node tests/load-test.js --users 100 --duration 60

# Rust tests
cargo test --workspace
```

## 📚 Documentation

- **API Documentation**: `backend/docs/openapi.yaml` - OpenAPI 3.0 specification
- **Deployment Guide**: See `DEPLOYMENT.md` for production deployment
- **Development Guide**: See `DEVELOPMENT.md` for contributing

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - See LICENSE file for details.

## 🙏 Credits

Built with:
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [Tokio](https://tokio.rs/) - Async runtime for Rust
- [Node.js](https://nodejs.org/) - Backend runtime
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [React](https://react.dev/) - UI framework
- [Tauri](https://tauri.app/) - Desktop app framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Caching and state

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/bore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/bore/discussions)
- **Email**: support@yourdomain.com

---

Made with ❤️ for developers who need secure tunneling

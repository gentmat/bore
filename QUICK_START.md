# 🚀 Quick Start Guide - Bore Tunnel Management

Get up and running in 5 minutes!

## 🎯 Prerequisites

- **Node.js** 16+ (for backend)
- **Rust** 1.70+ (for Tauri GUI)
- **PostgreSQL** 12+ (for database)

## 📦 Option 1: Docker (Easiest)

### Start Everything with Docker Compose
```bash
cd backend

# Start backend + database
docker-compose up -d

# With monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up -d

# View logs
docker-compose logs -f backend
```

**Access:**
- Backend: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Metrics: http://localhost:3000/metrics
- Prometheus: http://localhost:9090 (with monitoring profile)
- Grafana: http://localhost:3001 (with monitoring profile)

### Stop
```bash
docker-compose down
```

---

## 💻 Option 2: Manual Setup

### Step 1: Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Setup database & configure
chmod +x setup.sh
./setup.sh

# OR manually:
cp .env.example .env
# Edit .env with your database credentials
createdb bore_db

# Start server
npm run dev
```

### Step 2: Setup Tauri GUI

```bash
cd bore-gui

# Install frontend dependencies
npm install

# Install Tauri dependencies
cd src-tauri
cargo build

# Run in development mode
cargo tauri dev
```

### Step 3: Setup Bore Server (Optional - for tunnels)

```bash
cd bore-server

# Build
cargo build --release

# Run
BACKEND_URL=http://localhost:3000 \
INTERNAL_API_KEY=d3f08e6d4c9a4f0fb7e5c2a1bd98f4ce \
./target/release/bore server
```

---

## ✅ Verify Installation

### 1. Backend Health Check
```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy","uptime":...}
```

### 2. Create Account
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@bore.com",
    "password": "test123"
  }'
```

### 3. Access Dashboard
Open browser: http://localhost:3000/dashboard

### 4. Check Metrics
```bash
curl http://localhost:3000/metrics
# Should see Prometheus metrics
```

---

## 🔧 Configuration

### Environment Variables (.env)

**Required:**
```env
DB_HOST=localhost
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=your-password
JWT_SECRET=your-secret-key
```

**Optional:**
```env
# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SENDGRID_API_KEY=your-api-key
ALERT_EMAIL_TO=admin@bore.com

# Bore Server
BORE_SERVER_HOST=127.0.0.1
BORE_SERVER_PORT=7835
INTERNAL_API_KEY=your-api-key
```

---

## 📊 Enable Monitoring

### With Docker
```bash
docker-compose --profile monitoring up -d
```

### Manual Setup

**1. Start Prometheus:**
```bash
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

**2. Start Grafana:**
```bash
docker run -d \
  -p 3001:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana
```

**3. Configure Grafana:**
- Login: http://localhost:3001 (admin/admin)
- Add Prometheus data source: http://host.docker.internal:9090
- Import dashboard with queries from README.md

---

## 🎮 First Usage

### 1. Sign Up
Visit http://localhost:3000/dashboard and create an account

### 2. Create Instance
Click "Create New Instance"
- Name: My Dev Server
- Local Port: 8000 (or your app's port)
- Region: us-east

### 3. Start Tunnel (via Tauri GUI)
- Open Tauri app
- Select your instance
- Click "Connect"
- Tunnel establishes instantly!

### 4. Watch Real-time Updates
Status changes appear in <1 second:
- Starting → Active → Online
- Disconnect shows immediately

---

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# Check credentials
psql -U postgres -d bore_db

# Reset database
dropdb bore_db
createdb bore_db
```

### Backend Won't Start
```bash
# Check logs
npm run dev

# Common issues:
# 1. Port 3000 already in use
#    Change PORT in .env
# 2. Database doesn't exist
#    Run: createdb bore_db
# 3. Missing dependencies
#    Run: npm install
```

### GUI Build Fails
```bash
# Update Rust
rustup update

# Clean build
cd bore-gui/src-tauri
cargo clean
cargo build
```

### Metrics Not Showing
```bash
# Check endpoint
curl http://localhost:3000/metrics

# If empty, instances may not be active
# Create and connect to an instance first
```

### Alerts Not Sending
```bash
# Check .env configuration
cat .env | grep SLACK
cat .env | grep SENDGRID

# Test Slack webhook manually
curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"Test alert"}'
```

---

## 📚 Next Steps

1. **Read Full Documentation**
   - `backend/README.md` - Complete backend guide
   - `ENHANCEMENT_COMPLETE.md` - All features explained
   - `IMPLEMENTATION_VALIDATION.md` - Verification checklist

2. **Setup Monitoring**
   - Configure Grafana dashboards
   - Set up Slack alerts
   - Create email templates

3. **Deploy to Production**
   - Use Docker Compose
   - Setup HTTPS with nginx
   - Configure backups
   - Set up CI/CD

4. **Customize**
   - Add custom metrics
   - Create custom alerts
   - Extend API endpoints
   - Add new features

---

## 🆘 Get Help

**Check Logs:**
```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

**Database Console:**
```bash
# Via Docker
docker-compose exec postgres psql -U postgres bore_db

# Manual
psql -U postgres bore_db
```

**Common Commands:**
```bash
# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# View running services
docker-compose ps

# Stop all services
docker-compose down

# Remove all data (CAUTION!)
docker-compose down -v
```

---

## ✅ Success Checklist

- [ ] Backend running on http://localhost:3000
- [ ] Health check responds: `curl http://localhost:3000/health`
- [ ] Metrics available: `curl http://localhost:3000/metrics`
- [ ] Database connected (no errors in logs)
- [ ] Can create account via API or dashboard
- [ ] Tauri GUI builds and runs
- [ ] Can create instance via GUI
- [ ] Can connect to instance (tunnel starts)
- [ ] Status updates appear in <1 second
- [ ] Prometheus scraping metrics (if enabled)
- [ ] Grafana shows data (if enabled)
- [ ] Slack alerts working (if configured)

---

**🎉 You're all set! Start building amazing things with Bore!**

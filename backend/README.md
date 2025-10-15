# Bore Backend - Professional Tunnel Management System

A feature-rich backend server for managing bore tunnels with real-time status updates, health monitoring, alerting, and metrics.

## 🚀 Features

### Core Features
- ✅ **User Authentication** - JWT-based auth with admin roles
- ✅ **Instance Management** - Create, delete, rename, and monitor tunnel instances
- ✅ **Real-time Updates** - SSE + WebSocket for instant status notifications
- ✅ **Database Persistence** - PostgreSQL for reliable data storage
- ✅ **Health Monitoring** - Three-tier status detection (tunnel/heartbeat/VSCode)
- ✅ **Alerting System** - Email (SendGrid) and Slack notifications
- ✅ **Metrics Export** - Prometheus-compatible metrics for Grafana
- ✅ **Admin Dashboard** - System-wide statistics and monitoring

### Status System
- 🟢 **Online** - Everything working
- 🟢 **Active** - Tunnel connected
- 🟡 **Starting** - Connecting...
- 🟠 **Degraded** - VSCode not responding
- 🔵 **Idle** - No activity >30 min
- 🔴 **Offline** - Tunnel disconnected
- 🔴 **Error** - Error state

## 📋 Requirements

- **Node.js** 16+ 
- **PostgreSQL** 12+
- **Redis** (optional, for scaling)

## 🔧 Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup PostgreSQL
```bash
# Create database
createdb bore_db

# Database schema is created automatically on first run
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 File Structure

```
backend/
├── server-new.js           # Main server (230 lines)
├── database.js             # PostgreSQL layer
├── auth-middleware.js      # JWT & admin auth
├── alerting.js             # Email/Slack alerts
├── metrics.js              # Prometheus metrics
├── websocket.js            # WebSocket handler
├── routes/
│   ├── auth-routes.js      # /api/auth/*
│   ├── instance-routes.js  # /api/instances/*
│   ├── admin-routes.js     # /api/admin/*
│   └── internal-routes.js  # /api/internal/* (bore-server)
└── public/                 # Static HTML files
```

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup       - Create account
POST   /api/auth/login        - Login
GET    /api/auth/me           - Get current user
POST   /api/auth/claim-plan   - Claim plan (trial/pro)
```

### Instances (User)
```
GET    /api/instances                      - List instances
POST   /api/instances                      - Create instance
DELETE /api/instances/:id                  - Delete instance
PATCH  /api/instances/:id                  - Rename instance
POST   /api/instances/:id/heartbeat        - Send heartbeat + health metrics
POST   /api/instances/:id/connect          - Get tunnel token
POST   /api/instances/:id/disconnect       - Disconnect
GET    /api/instances/:id/status-history   - Get status timeline
GET    /api/instances/:id/health           - Get health metrics
```

### Admin (Requires Admin Role)
```
GET    /api/admin/instances   - All instances with metrics
GET    /api/admin/stats       - System statistics
GET    /api/admin/alerts      - Alert history
POST   /api/admin/users/:id/make-admin  - Make user admin
```

### Internal (Bore-Server Only)
```
POST   /api/internal/validate-key                    - Validate tunnel token
POST   /api/internal/instances/:id/tunnel-connected  - Tunnel connected
POST   /api/internal/instances/:id/tunnel-disconnected - Tunnel disconnected
```

### Real-time & Monitoring
```
GET    /api/events/status     - SSE stream (real-time status)
WS     /socket.io/            - WebSocket (alternative to SSE)
GET    /metrics               - Prometheus metrics
GET    /health                - Health check
```

## 📊 Prometheus Metrics

Available at `/metrics`:

```
# Counters
bore_tunnel_connections_total
bore_tunnel_disconnections_total
bore_heartbeats_total
bore_sse_connections_total
bore_api_requests_total

# Gauges
bore_active_tunnels
bore_active_instances
bore_active_sse_connections
bore_instances_by_status{status="online|offline|degraded|idle"}

# Histograms
bore_heartbeat_response_time_seconds
bore_api_response_time_seconds
```

## 🔔 Alerting

Configure alerts in `.env`:

**Slack:**
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Email (SendGrid):**
```env
SENDGRID_API_KEY=your-api-key
ALERT_EMAIL_FROM=alerts@bore.com
ALERT_EMAIL_TO=admin@bore.com
```

### Alert Types
- **Instance Offline** - Tunnel disconnected
- **Instance Degraded** - VSCode frozen
- **Instance Idle** - No activity >30 min
- **Instance Recovered** - Back online
- **High Error Rate** - Multiple errors

Alerts have a 5-minute cooldown to prevent spam.

## 🗄️ Database Schema

### Tables
- `users` - User accounts with admin flags
- `instances` - Tunnel instances
- `status_history` - Status change timeline
- `health_metrics` - VSCode health data
- `tunnel_tokens` - Active tunnel tokens
- `alert_history` - Sent alerts log

## 🔄 Migration from Old server.js

1. **Backup your data** (if using in-memory storage)
2. **Install PostgreSQL** and create database
3. **Update imports:**
   ```bash
   mv server.js server-old.js
   mv server-new.js server.js
   ```
4. **Install new deps:**
   ```bash
   npm install pg socket.io
   ```
5. **Seed initial data** (if migrating)

## 🎯 Grafana Dashboard Setup

1. **Add Prometheus data source** pointing to your backend
2. **Import dashboard** with queries:
   ```promql
   # Active tunnels
   bore_active_tunnels
   
   # Status distribution
   sum by (status) (bore_instances_by_status)
   
   # Uptime rate
   rate(bore_tunnel_connections_total[5m])
   ```

## 🚦 Health Monitoring

### Three-Tier Detection Logic

**Tier 1: Tunnel Connected** (bore-server push)
- Authoritative source
- Instant notification via internal API

**Tier 2: Heartbeat Staleness** (>30s)
- Fallback if bore-server notifications fail
- Detects client crashes

**Tier 3: VSCode Health** 
- Checks code-server responsiveness
- Detects application freezes

**Tier 4: Activity Tracking**
- Idle detection (>30 min)
- Hibernation suggestions

## 🔒 Security

- JWT tokens expire after 7 days
- Tunnel tokens expire after 1 hour
- Admin endpoints require admin role
- Internal endpoints require API key
- Passwords hashed with bcrypt (10 rounds)
- CORS configured (update for production)

## 🐳 Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bore_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_NAME: bore_db
      DB_USER: postgres
      DB_PASSWORD: postgres
    depends_on:
      - postgres

volumes:
  postgres-data:
```

## 📈 Performance

- **Status Update Lag:** <1 second (via SSE/WebSocket)
- **Heartbeat Interval:** 15 seconds
- **Heartbeat Timeout:** 30 seconds
- **Database Connection Pool:** 20 connections
- **Metrics History:** Last 1000 samples

## 🧪 Testing

```bash
# Start test server
npm run dev

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/metrics

# Create user
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@bore.com","password":"test123"}'
```

## 📝 License

MIT

## 🤝 Contributing

1. Keep files under 400 lines
2. Follow existing code style
3. Add tests for new features
4. Update documentation

## 🆘 Troubleshooting

**Database connection failed:**
```bash
# Check PostgreSQL is running
pg_isready

# Check credentials in .env
psql -U postgres -d bore_db
```

**Metrics not updating:**
- Database queries might be slow
- Check PostgreSQL indexes
- Consider Redis caching

**Alerts not sending:**
- Check Slack webhook URL
- Verify SendGrid API key
- Check alert cooldown (5 min)

**WebSocket disconnections:**
- Check firewall rules
- Verify JWT token expiry
- Check client-side reconnection logic

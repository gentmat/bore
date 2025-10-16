# High-Scale Production Deployment Guide

**Date**: October 16, 2025  
**Status**: ✅ Production Ready  
**Target**: 1,000+ concurrent users, multi-server deployment

This guide covers deploying Bore for high-scale production use with horizontal scaling, load balancing, and high availability.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Database Configuration](#database-configuration)
5. [Redis Setup](#redis-setup)
6. [Backend Deployment](#backend-deployment)
7. [Bore-Server Deployment](#bore-server-deployment)
8. [Load Balancer Configuration](#load-balancer-configuration)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Testing & Validation](#testing--validation)
11. [Scaling Guidelines](#scaling-guidelines)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Scale Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  CDN /  │
                    │  WAF    │
                    └────┬────┘
                         │
                    ┌────▼────────────┐
                    │ Load Balancer   │
                    │   (nginx/HAProxy)│
                    └────┬────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────▼────┐    ┌───▼─────┐   ┌───▼─────┐
     │Backend  │    │Backend  │   │Backend  │
     │Instance │    │Instance │   │Instance │
     │   #1    │    │   #2    │   │   #3    │
     └────┬────┘    └────┬────┘   └────┬────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────▼────┐    ┌───▼─────┐   ┌───▼─────┐
     │  Redis  │    │PostgreSQL│   │Prometheus│
     │ Cluster │    │ Primary │   │Grafana  │
     └─────────┘    └────┬────┘   └─────────┘
                         │
                    ┌────▼────┐
                    │PostgreSQL│
                    │ Replica │
                    └─────────┘

     ┌──────────────────────────────────────┐
     │    Bore-Server Instances             │
     │  ┌─────────┐  ┌─────────┐           │
     │  │Server#1 │  │Server#2 │  ...      │
     │  └─────────┘  └─────────┘           │
     └──────────────────────────────────────┘
```

### Components

- **Backend API**: 3+ instances for high availability
- **PostgreSQL**: Primary + read replicas
- **Redis**: Cluster for distributed state
- **Bore-Servers**: Multiple instances across regions
- **Load Balancer**: nginx or HAProxy
- **Monitoring**: Prometheus + Grafana

---

## Prerequisites

### Hardware Requirements

**Backend Instances** (minimum per instance):
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- Network: 1 Gbps

**Database Server**:
- CPU: 8 cores
- RAM: 16 GB
- Storage: 500 GB SSD (IOPS optimized)
- Network: 10 Gbps

**Redis Cluster**:
- CPU: 2 cores per node
- RAM: 8 GB per node
- Network: 1 Gbps

**Bore-Server Instances** (per server):
- CPU: 4 cores
- RAM: 4 GB
- Network: 1-10 Gbps (depends on expected traffic)

### Software Requirements

- **OS**: Ubuntu 22.04 LTS or similar
- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 7.x or higher
- **nginx**: 1.22.x or higher
- **Docker**: 24.x (optional)

---

## Infrastructure Setup

### 1. Server Provisioning

**Recommended Cloud Setup**:

```bash
# Backend cluster (3 instances minimum)
3x c5.xlarge (AWS) or n2-standard-4 (GCP)

# Database server
1x r5.2xlarge (AWS) or n2-highmem-8 (GCP)

# Redis cluster (3 nodes)
3x r5.large (AWS) or n2-highmem-2 (GCP)

# Bore-server instances (start with 2-5)
2-5x c5.xlarge (AWS) or n2-standard-4 (GCP)
```

### 2. Network Configuration

```bash
# Security Groups / Firewall Rules

# Load Balancer
- Allow: 80 (HTTP), 443 (HTTPS) from 0.0.0.0/0
- Allow: 7835 (Bore tunnels) from 0.0.0.0/0

# Backend Instances
- Allow: 3000 from Load Balancer security group
- Allow: 5432 from Backend to Database
- Allow: 6379 from Backend to Redis
- Deny: All other inbound traffic

# Database
- Allow: 5432 from Backend security group
- Deny: All other inbound traffic

# Redis
- Allow: 6379 from Backend security group
- Deny: All other inbound traffic
```

---

## Database Configuration

### 1. PostgreSQL Setup

```bash
# Install PostgreSQL 14
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14

# Configure for production
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Production PostgreSQL Config**:

```conf
# Connection Settings
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 2GB
max_wal_size = 8GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2

# Logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000  # Log queries > 1 second
log_connections = on
log_disconnections = on
```

### 2. Create Database & User

```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE bore_db;
CREATE USER bore_user WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bore_db TO bore_user;

-- Switch to bore_db
\c bore_db

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO bore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bore_user;
```

### 3. Run Migrations

```bash
cd backend
npm install
npm run migrate:up
```

### 4. Setup Read Replicas (Optional)

For read-heavy workloads, set up PostgreSQL streaming replication:

```bash
# On replica server
# Configure streaming replication following PostgreSQL docs
# Update backend to use read replicas for read-only queries
```

---

## Redis Setup

### 1. Redis Cluster Installation

```bash
# Install Redis
sudo apt install -y redis-server

# Configure for production
sudo nano /etc/redis/redis.conf
```

**Production Redis Config**:

```conf
# Network
bind 0.0.0.0
protected-mode yes
requirepass CHANGE_ME_STRONG_REDIS_PASSWORD
port 6379

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"

# Memory
maxmemory 6gb
maxmemory-policy allkeys-lru

# Cluster mode (if using cluster)
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
```

### 2. Test Redis Connection

```bash
redis-cli -h REDIS_HOST -p 6379 -a YOUR_PASSWORD
> PING
PONG
```

---

## Backend Deployment

### 1. Environment Configuration

Copy this to each backend instance's `.env`:

```bash
# CRITICAL: Production settings
NODE_ENV=production

# Server
PORT=3000

# SECURITY: Generate strong secrets
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)

# Database (use primary for writes, replicas for reads)
DB_HOST=your-postgres-primary.example.com
DB_PORT=5432
DB_NAME=bore_db
DB_USER=bore_user
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD

# Redis (CRITICAL for horizontal scaling)
REDIS_ENABLED=true
REDIS_HOST=your-redis-cluster.example.com
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD

# Capacity Management
MAX_TUNNELS_PER_SERVER=100
MAX_BANDWIDTH_PER_TUNNEL=100
TOTAL_SYSTEM_CAPACITY=500  # 5 bore-servers * 100 tunnels
RESERVED_CAPACITY_PERCENT=20

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Bore Server
BORE_SERVER_HOST=bore.yourdomain.com
BORE_SERVER_PORT=7835

# Alerting (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Deploy Backend Instances

```bash
# On each backend instance

# Clone repository
git clone https://github.com/yourusername/bore.git
cd bore/backend

# Install dependencies
npm ci --production

# Run migrations (only on one instance)
npm run migrate:up

# Start with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name bore-backend -i max

# Setup PM2 startup
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### 3. Register Bore-Servers

**Each bore-server needs to register with the backend**. This happens automatically when bore-servers start with backend integration enabled.

Manually register via API:

```bash
curl -X POST https://api.yourdomain.com/api/v1/admin/servers \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "server-us-east-1",
    "host": "bore1.yourdomain.com",
    "port": 7835,
    "location": "us-east-1",
    "maxBandwidthMbps": 1000,
    "maxConcurrentTunnels": 100
  }'
```

---

## Bore-Server Deployment

### 1. Build Bore-Server

```bash
# On build machine
cd bore-server
cargo build --release

# Binary will be in: target/release/bore-server
```

### 2. Deploy to Server Instances

```bash
# Copy binary to each bore-server instance
scp target/release/bore-server user@bore-server-1.example.com:/usr/local/bin/

# SSH to bore-server instance
ssh user@bore-server-1.example.com

# Make executable
sudo chmod +x /usr/local/bin/bore-server

# Create systemd service
sudo nano /etc/systemd/system/bore-server.service
```

**Systemd Service**:

```ini
[Unit]
Description=Bore Server
After=network.target

[Service]
Type=simple
User=bore
Group=bore
WorkingDirectory=/var/lib/bore
ExecStart=/usr/local/bin/bore-server \
    --backend-url https://api.yourdomain.com \
    --backend-api-key YOUR_INTERNAL_API_KEY \
    --server-id server-us-east-1 \
    --port-range 10000:20000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/bore

[Install]
WantedBy=multi-user.target
```

```bash
# Create user and directory
sudo useradd -r -s /bin/false bore
sudo mkdir -p /var/lib/bore
sudo chown bore:bore /var/lib/bore

# Start service
sudo systemctl daemon-reload
sudo systemctl enable bore-server
sudo systemctl start bore-server

# Check status
sudo systemctl status bore-server
sudo journalctl -u bore-server -f
```

---

## Load Balancer Configuration

### nginx Configuration

```nginx
# /etc/nginx/sites-available/bore-backend

upstream bore_backend {
    least_conn;  # Load balance based on connections
    
    server backend1.internal:3000 max_fails=3 fail_timeout=30s;
    server backend2.internal:3000 max_fails=3 fail_timeout=30s;
    server backend3.internal:3000 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
    limit_req zone=api_limit burst=50 nodelay;

    # Client settings
    client_max_body_size 10M;
    client_body_timeout 12s;
    client_header_timeout 12s;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # API Routes
    location / {
        proxy_pass http://bore_backend;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://bore_backend/health;
        access_log off;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://bore_backend/socket.io/;
    }

    # Server-Sent Events
    location /api/v1/events/ {
        proxy_pass http://bore_backend/api/v1/events/;
        proxy_buffering off;
        proxy_cache off;
    }
}

# Bore-Server Proxy (for centralized domain)
upstream bore_servers {
    least_conn;
    
    server bore-server-1.internal:7835;
    server bore-server-2.internal:7835;
    server bore-server-3.internal:7835;
}

server {
    listen 7835;
    server_name bore.yourdomain.com;

    location / {
        proxy_pass http://bore_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Monitoring & Alerting

### 1. Prometheus Configuration

```yaml
# /etc/prometheus/prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'bore-backend'
    static_configs:
      - targets:
        - 'backend1.internal:3000'
        - 'backend2.internal:3000'
        - 'backend3.internal:3000'
    metrics_path: '/metrics'

  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres.internal:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis.internal:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['loadbalancer.internal:9113']

alerting:
  alertmanagers:
    - static_configs:
      - targets: ['localhost:9093']

rule_files:
  - 'alerts.yml'
```

### 2. Alert Rules

```yaml
# /etc/prometheus/alerts.yml

groups:
  - name: bore_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/second"

      - alert: HighCapacityUtilization
        expr: bore_capacity_utilization_percent > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "System capacity at {{ $value }}%"
          description: "Consider adding more servers"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count > 180
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage at {{ $value }}%"
```

### 3. Grafana Dashboard

Import these dashboards:
- Node Exporter Full (ID: 1860)
- PostgreSQL Database (ID: 9628)
- Redis (ID: 11835)
- nginx (ID: 12708)

Custom Bore metrics dashboard JSON available in `/monitoring/grafana-dashboard.json`

---

## Testing & Validation

### 1. Pre-Deployment Checklist

```bash
# Environment variables
✓ All secrets are strong and unique
✓ REDIS_ENABLED=true
✓ Database connection string is correct
✓ CORS origins configured for production domain

# Database
✓ Migrations ran successfully
✓ Connection pooling configured (max_connections)
✓ Indexes created (check with \di in psql)
✓ Backup strategy in place

# Security
✓ Firewall rules configured
✓ SSL certificates installed
✓ Rate limiting enabled
✓ INTERNAL_API_KEY matches bore-server

# Monitoring
✓ Prometheus scraping all targets
✓ Grafana dashboards configured
✓ Alert rules tested
✓ Slack/email alerts working
```

### 2. Load Testing

```bash
# Run load test
cd backend
node tests/load-test.js \
  --users 100 \
  --duration 300 \
  --target https://api.yourdomain.com

# Expected results for production:
# - Success rate: > 99%
# - P95 response time: < 500ms
# - P99 response time: < 1000ms
# - No errors or timeouts
```

### 3. Integration Testing

```bash
# Run integration tests
npm test -- tests/instance-lifecycle.test.js

# All tests should pass
```

---

## Scaling Guidelines

### When to Scale

**Add Backend Instances** when:
- CPU usage > 70% sustained
- Response times > 500ms (P95)
- Connection pool saturation

**Add Bore-Server Instances** when:
- Capacity utilization > 75%
- Bandwidth utilization > 80%
- Users reporting connection issues

**Upgrade Database** when:
- CPU usage > 70% sustained
- Disk I/O wait > 20%
- Query response times degrading

### Scaling Procedure

```bash
# 1. Provision new server
# 2. Deploy application
# 3. Update load balancer
# 4. Monitor for 24 hours
# 5. Adjust capacity limits

# Update total capacity after adding servers
# Example: Added 2 bore-servers, each with 100 capacity
TOTAL_SYSTEM_CAPACITY=700  # Was 500, now 700
```

---

## Troubleshooting

### Common Issues

**Issue**: "Circuit breaker open" errors
```bash
# Check bore-server connectivity
curl -I http://bore-server-1.internal:7835

# Check circuit breaker stats
curl https://api.yourdomain.com/api/v1/admin/circuit-breaker/stats

# Reset circuit breaker if needed
curl -X POST https://api.yourdomain.com/api/v1/admin/circuit-breaker/reset
```

**Issue**: Redis connection failures
```bash
# Test Redis
redis-cli -h REDIS_HOST -a PASSWORD PING

# Check backend logs
pm2 logs bore-backend | grep -i redis

# Fallback: Temporarily disable Redis
REDIS_ENABLED=false pm2 restart bore-backend
```

**Issue**: Database connection pool exhausted
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';
```

**Issue**: High memory usage
```bash
# Check Node.js heap
pm2 monit

# Restart instances one at a time
pm2 restart bore-backend --update-env
```

---

## Maintenance

### Daily
- Monitor dashboards for anomalies
- Check error logs
- Verify backup completion

### Weekly
- Review capacity trends
- Update dependencies (security patches)
- Analyze slow queries

### Monthly
- Load test after changes
- Review and optimize database indexes
- Capacity planning review
- Security audit

---

## Performance Benchmarks

**Expected Performance** (3 backend + 5 bore-server setup):

| Metric | Target | Excellent |
|--------|--------|-----------|
| API Response Time (P95) | < 500ms | < 200ms |
| API Response Time (P99) | < 1000ms | < 500ms |
| Concurrent Users | 1,000+ | 5,000+ |
| Requests/Second | 500+ | 2,000+ |
| Uptime | 99.5% | 99.9% |
| Error Rate | < 1% | < 0.1% |

---

## Success Criteria

✅ **Production Ready** when:

1. All components deployed and healthy
2. Load testing shows acceptable performance
3. Monitoring and alerts configured
4. Backup/restore tested
5. Incident response plan documented
6. 24-hour burn-in completed
7. Disaster recovery plan tested

---

**Last Updated**: October 16, 2025  
**Maintained By**: DevOps Team  
**Support**: support@yourdomain.com

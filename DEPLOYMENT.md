# Production Deployment Guide

Complete guide for deploying Bore in production environments, from small-scale to enterprise deployments supporting 1,000+ concurrent users.

## 📋 Table of Contents

1. [Deployment Options](#deployment-options)
2. [Small-Scale Deployment](#small-scale-deployment)
3. [High-Scale Deployment](#high-scale-deployment)
4. [Database Setup](#database-setup)
5. [Redis Configuration](#redis-configuration)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

---

## Deployment Options

### Single-Server (Small Scale)
- **Users**: Up to 100 concurrent
- **Components**: All-in-one Docker setup
- **Hardware**: 4 CPU cores, 8GB RAM
- **Use Case**: Personal projects, small teams

### Multi-Server (High Scale)
- **Users**: 1,000+ concurrent
- **Components**: Distributed architecture
- **Hardware**: Multiple servers with load balancing
- **Use Case**: Production services, enterprise

---

## Small-Scale Deployment

### Quick Setup with Docker

**Prerequisites:**
- Docker 24+ and Docker Compose
- 4 CPU cores, 8GB RAM
- Ubuntu 22.04 LTS or similar

**1. Clone and Configure:**
```bash
cd bore/backend
cp .env.example .env
```

**2. Edit .env file:**
```bash
# CRITICAL SETTINGS
NODE_ENV=production
PORT=3000

# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Redis
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# Capacity
MAX_TUNNELS_PER_SERVER=50
TOTAL_SYSTEM_CAPACITY=50

# Testing mode (includes bore-server)
ENABLE_MASTER_TUNNEL=true

# Production domain
ALLOWED_ORIGINS=https://yourdomain.com
BORE_SERVER_HOST=bore.yourdomain.com
BORE_SERVER_PORT=7835
```

**3. Start Services:**
```bash
# With bore-server included (testing/single-server)
docker-compose --profile with-tunnel up -d

# Without bore-server (production coordinator only)
docker-compose up -d
```

**4. Verify Deployment:**
```bash
# Check services
docker-compose ps

# View logs
docker-compose logs -f

# Test API
curl http://localhost:3000/health

# Access dashboard
# Open http://localhost:3000/dashboard
```

**5. Setup SSL (Required for Production):**
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d bore.yourdomain.com -d api.yourdomain.com

# Setup nginx reverse proxy
sudo apt install nginx
```

**nginx Configuration:**
```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## High-Scale Deployment

### Architecture Overview

```
                    ┌─────────────┐
                    │   CDN/WAF   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Load Balancer│
                    │  (nginx)    │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼────┐      ┌───▼─────┐     ┌───▼─────┐
     │Backend  │      │Backend  │     │Backend  │
     │Instance │      │Instance │     │Instance │
     │   #1    │      │   #2    │     │   #3    │
     └────┬────┘      └────┬────┘     └────┬────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼────┐      ┌───▼─────┐     ┌───▼─────┐
     │  Redis  │      │PostgreSQL│    │Monitoring│
     │ Cluster │      │ Primary  │    │Prometheus│
     └─────────┘      └────┬─────┘    └──────────┘
                           │
                      ┌────▼─────┐
                      │PostgreSQL│
                      │ Replica  │
                      └──────────┘

     ┌──────────────────────────────────────┐
     │    Bore-Server Instances             │
     │  ┌─────────┐  ┌─────────┐  ┌──────┐ │
     │  │Server#1 │  │Server#2 │  │...   │ │
     │  └─────────┘  └─────────┘  └──────┘ │
     └──────────────────────────────────────┘
```

### Hardware Requirements

**Backend Instances** (per instance):
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- Network: 1 Gbps
- Quantity: 3+ instances

**Database Server:**
- CPU: 8 cores
- RAM: 16 GB
- Storage: 500 GB SSD (IOPS optimized)
- Network: 10 Gbps

**Redis Cluster:**
- CPU: 2 cores per node
- RAM: 8 GB per node
- Network: 1 Gbps
- Quantity: 3 nodes

**Bore-Server Instances:**
- CPU: 4 cores
- RAM: 4 GB
- Network: 1-10 Gbps
- Quantity: 2-5+ servers

### Infrastructure Setup

**1. Provision Servers:**
```bash
# Recommended Cloud Instance Types

# AWS
Backend: 3x c5.xlarge
Database: 1x r5.2xlarge
Redis: 3x r5.large
Bore-servers: 2-5x c5.xlarge

# GCP
Backend: 3x n2-standard-4
Database: 1x n2-highmem-8
Redis: 3x n2-highmem-2
Bore-servers: 2-5x n2-standard-4
```

**2. Network Configuration:**
```bash
# Security Groups / Firewall Rules

# Load Balancer
- Allow: 80, 443 (HTTP/HTTPS) from 0.0.0.0/0
- Allow: 7835 (Bore tunnels) from 0.0.0.0/0

# Backend Instances
- Allow: 3000 from Load Balancer
- Allow: 5432 to Database
- Allow: 6379 to Redis
- Deny: All other inbound

# Database
- Allow: 5432 from Backend security group only
- Deny: All other inbound

# Redis
- Allow: 6379 from Backend security group only
- Deny: All other inbound
```

**3. Deploy Backend Instances:**
```bash
# On each backend server
git clone https://github.com/yourusername/bore.git
cd bore/backend

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm ci --production

# Configure environment
cp .env.example .env
nano .env  # Use production settings

# Run migrations (only on first instance)
npm run migrate:up

# Install PM2 for process management
npm install -g pm2

# Start application
pm2 start server.js --name bore-backend -i max

# Setup auto-restart
pm2 startup
pm2 save
```

**4. Deploy Bore-Server Instances:**
```bash
# Build on build machine
cd bore-server
cargo build --release

# Copy binary to servers
scp target/release/bore-server user@bore-server-1.example.com:/usr/local/bin/

# Create systemd service on bore-server
sudo nano /etc/systemd/system/bore-server.service
```

**Systemd Service File:**
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

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/bore

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl daemon-reload
sudo systemctl enable bore-server
sudo systemctl start bore-server
sudo systemctl status bore-server
```

**5. Configure Load Balancer:**
```nginx
# /etc/nginx/nginx.conf

upstream bore_backend {
    least_conn;
    
    server backend1.internal:3000 max_fails=3 fail_timeout=30s;
    server backend2.internal:3000 max_fails=3 fail_timeout=30s;
    server backend3.internal:3000 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req zone=api burst=50 nodelay;

    location / {
        proxy_pass http://bore_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /health {
        proxy_pass http://bore_backend/health;
        access_log off;
    }
}
```

---

## Database Setup

### PostgreSQL Production Configuration

```bash
# Install PostgreSQL 14
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14

# Edit configuration
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Production Settings:**
```conf
# Connections
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 10MB

# WAL
wal_buffers = 16MB
min_wal_size = 2GB
max_wal_size = 8GB
checkpoint_completion_target = 0.9

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4

# Logging
logging_collector = on
log_directory = 'log'
log_min_duration_statement = 1000  # Log queries > 1 second
log_connections = on
log_disconnections = on
```

**Create Database:**
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE bore_db;
CREATE USER bore_user WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bore_db TO bore_user;

\c bore_db
GRANT ALL ON SCHEMA public TO bore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bore_user;
```

---

## Redis Configuration

### Production Redis Setup

```bash
# Install Redis
sudo apt install -y redis-server

# Configure for production
sudo nano /etc/redis/redis.conf
```

**Production Settings:**
```conf
# Network
bind 0.0.0.0
protected-mode yes
requirepass YOUR_STRONG_REDIS_PASSWORD
port 6379

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes

# Memory
maxmemory 6gb
maxmemory-policy allkeys-lru

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
```

```bash
# Restart Redis
sudo systemctl restart redis-server

# Test connection
redis-cli -h localhost -a YOUR_PASSWORD
PING
```

---

## Security Hardening

### Environment Security Checklist

- [ ] Strong JWT_SECRET (32+ characters, random)
- [ ] Strong INTERNAL_API_KEY (32+ characters, random)
- [ ] Strong database passwords
- [ ] Strong Redis password
- [ ] NODE_ENV=production
- [ ] ALLOWED_ORIGINS configured for production domains only
- [ ] SSL/TLS certificates installed and auto-renewing
- [ ] Firewall rules configured (UFW/iptables)
- [ ] SSH key-only authentication
- [ ] Fail2ban installed and configured
- [ ] Regular security updates enabled

### Firewall Configuration (UFW)

```bash
# Install UFW
sudo apt install ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if custom)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow bore tunnel port
sudo ufw allow 7835/tcp

# Enable firewall
sudo ufw enable
```

---

## Monitoring & Alerting

### Prometheus Configuration

```yaml
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s

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
```

### Key Metrics to Monitor

- **Response Time**: P95 < 500ms, P99 < 1000ms
- **Error Rate**: < 1%
- **CPU Usage**: < 70% sustained
- **Memory Usage**: < 80%
- **Database Connections**: < 80% of max_connections
- **Redis Memory**: < 90% of maxmemory
- **Capacity Utilization**: < 85%

### Alert Rules

```yaml
# /etc/prometheus/alerts.yml
groups:
  - name: bore_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: HighCapacity
        expr: bore_capacity_utilization_percent > 85
        for: 5m
        annotations:
          summary: "System capacity at {{ $value }}%"

      - alert: DatabaseConnectionPoolHigh
        expr: pg_stat_activity_count > 180
        for: 2m
        annotations:
          summary: "Database connection pool nearly exhausted"
```

---

## Backup & Recovery

### Database Backups

```bash
# Automated daily backup script
#!/bin/bash
BACKUP_DIR="/var/backups/bore"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U bore_user bore_db | \
  gzip > $BACKUP_DIR/bore_db_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "bore_db_*.sql.gz" -mtime +30 -delete
```

**Setup Cron:**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-bore.sh
```

### Restore from Backup

```bash
# Restore database
gunzip -c /var/backups/bore/bore_db_20250101_020000.sql.gz | \
  psql -h localhost -U bore_user bore_db
```

---

## Troubleshooting

### Common Issues

**Issue: Circuit breaker open errors**
```bash
# Check bore-server connectivity
curl -I http://bore-server-1.internal:7835

# Reset circuit breaker
curl -X POST https://api.yourdomain.com/api/v1/admin/circuit-breaker/reset \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Issue: Database connection pool exhausted**
```sql
-- Check active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
  AND state_change < NOW() - INTERVAL '10 minutes';
```

**Issue: Redis connection failures**
```bash
# Test Redis
redis-cli -h REDIS_HOST -a PASSWORD PING

# Check backend logs
pm2 logs bore-backend | grep -i redis

# Temporary fallback (disable Redis)
pm2 set REDIS_ENABLED false
pm2 restart bore-backend
```

**Issue: High memory usage**
```bash
# Check Node.js heap
pm2 monit

# Restart instances (zero-downtime)
pm2 reload bore-backend
```

### Performance Optimization

**When to Scale:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU > 70% | Sustained 5+ min | Add backend instances |
| Response Time P95 > 500ms | Sustained | Add backend instances |
| Capacity > 75% | Any time | Add bore-servers |
| Database CPU > 70% | Sustained | Upgrade database |

**Scaling Procedure:**
1. Provision new server
2. Deploy application/service
3. Update load balancer configuration
4. Monitor for 24 hours
5. Adjust capacity settings

---

## Maintenance Checklist

### Daily
- Monitor dashboards for anomalies
- Check error logs
- Verify backup completion

### Weekly
- Review capacity trends
- Update dependencies (security patches)
- Analyze slow queries
- Review disk space

### Monthly
- Load testing after major changes
- Database index optimization
- Capacity planning review
- Security audit
- Update SSL certificates (if manual)

---

## Performance Benchmarks

**Expected Performance (3 backend + 5 bore-server setup):**

| Metric | Target | Excellent |
|--------|--------|-----------|
| API Response Time (P95) | < 500ms | < 200ms |
| API Response Time (P99) | < 1000ms | < 500ms |
| Concurrent Users | 1,000+ | 5,000+ |
| Requests/Second | 500+ | 2,000+ |
| Uptime | 99.5% | 99.9% |
| Error Rate | < 1% | < 0.1% |

---

**Last Updated**: January 2025  
**Support**: support@yourdomain.com

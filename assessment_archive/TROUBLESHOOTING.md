# Troubleshooting Guide

Common issues and solutions for the Bore TCP Tunnel system.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Connection Problems](#connection-problems)
3. [Authentication Errors](#authentication-errors)
4. [Performance Issues](#performance-issues)
5. [Database Problems](#database-problems)
6. [Redis Issues](#redis-issues)
7. [Docker Issues](#docker-issues)
8. [Client-Server Communication](#client-server-communication)
9. [Debugging Tips](#debugging-tips)

---

## Installation Issues

### Rust Build Fails

**Problem**: `cargo build` fails with compilation errors

**Solutions**:
```bash
# Update Rust to latest stable
rustup update stable

# Clear cargo cache and rebuild
cargo clean
cargo build --release

# Check Rust version (should be 1.70+)
rustc --version
```

### Node.js Dependencies Fail to Install

**Problem**: `npm install` fails in backend directory

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Use specific Node version (18+)
nvm use 18
npm install
```

### Missing System Dependencies

**Problem**: Build fails with missing libraries

**Debian/Ubuntu**:
```bash
sudo apt install -y build-essential pkg-config libssl-dev libpq-dev
```

**macOS**:
```bash
brew install postgresql openssl pkg-config
```

**Arch Linux**:
```bash
sudo pacman -S base-devel openssl postgresql-libs
```

---

## Connection Problems

### Client Cannot Connect to Server

**Problem**: `bore-client` fails with "could not connect to server"

**Check**:
1. **Server is running**:
   ```bash
   # Check if bore-server is running
   ps aux | grep bore-server
   
   # Check port 7835
   netstat -tuln | grep 7835
   ```

2. **Firewall allows connection**:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 7835/tcp
   
   # CentOS/RHEL
   sudo firewall-cmd --add-port=7835/tcp --permanent
   sudo firewall-cmd --reload
   ```

3. **Correct server address**:
   ```bash
   # Test connectivity
   telnet your-server.com 7835
   # or
   nc -zv your-server.com 7835
   ```

### Tunnel Disconnects Frequently

**Problem**: Tunnel connection drops after a few minutes

**Solutions**:

1. **Check network stability**:
   ```bash
   # Ping server continuously
   ping -c 100 your-server.com
   ```

2. **Increase heartbeat timeout** (server-side):
   ```bash
   # In backend .env
   HEARTBEAT_TIMEOUT=60000  # 60 seconds instead of 30
   ```

3. **Check for NAT timeout**:
   - Some routers timeout idle connections
   - Solution: Keep-alive packets (already implemented in protocol)

4. **Review server logs**:
   ```bash
   # Backend logs
   cd backend && npm run dev  # Watch for errors
   
   # Bore-server logs (if using systemd)
   journalctl -u bore-server -f
   ```

### Port Already in Use

**Problem**: "port already in use" error

**Solutions**:
```bash
# Find process using port 7835
sudo lsof -i :7835
# or
sudo netstat -tulpn | grep 7835

# Kill the process
sudo kill -9 <PID>

# Or use different port
bore-server --bind-addr 0.0.0.0 --min-port 8000 --max-port 9000
```

---

## Authentication Errors

### Invalid API Key

**Problem**: `bore-client` returns "Invalid API key"

**Solutions**:

1. **Check API key format**:
   - Should start with `sk_tok_` or `sk_live_`
   - Get from dashboard: http://localhost:3000/dashboard

2. **Regenerate API key**:
   ```bash
   # Login to dashboard and regenerate
   # Or use CLI
   bore login --api-endpoint http://localhost:3000
   ```

3. **Verify backend connection**:
   ```bash
   # Check backend is running
   curl http://localhost:3000/health
   ```

### JWT Token Expired

**Problem**: "Token has expired" when calling API

**Solutions**:

1. **Re-login**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "yourpassword"}'
   ```

2. **Increase token TTL** (development only):
   ```bash
   # In backend .env
   JWT_EXPIRES_IN=30d  # Default is 7d
   ```

3. **Use refresh tokens** (if implemented):
   ```bash
   # Call refresh endpoint with refresh token
   curl -X POST http://localhost:3000/api/v1/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refresh_token": "your-refresh-token"}'
   ```

### Backend Returns "Authentication Required"

**Problem**: bore-server rejects connection even with API key

**Check**:

1. **Backend URL configured**:
   ```bash
   bore-server --backend-url http://localhost:3000 --backend-api-key your-internal-key
   ```

2. **Internal API key matches**:
   ```bash
   # In backend .env
   INTERNAL_API_KEY=your-internal-key
   ```

3. **Backend is reachable**:
   ```bash
   # From bore-server machine
   curl http://localhost:3000/health
   ```

---

## Performance Issues

### Slow Tunnel Throughput

**Problem**: Data transfer through tunnel is slow

**Solutions**:

1. **Check network bandwidth**:
   ```bash
   # Test with iperf
   iperf3 -c your-server.com -p 5201
   ```

2. **Monitor CPU usage**:
   ```bash
   # Check bore-server CPU
   top -p $(pgrep bore-server)
   ```

3. **Increase buffer sizes** (advanced):
   - Modify TCP buffer sizes in OS
   - Contact maintainers for custom build

4. **Use compression** (if available):
   - Check if compression feature is enabled
   - May reduce throughput for pre-compressed data

### High Memory Usage

**Problem**: bore-server or backend using too much RAM

**Solutions**:

1. **Check for memory leaks**:
   ```bash
   # Monitor memory over time
   watch -n 1 'ps aux | grep bore'
   ```

2. **Limit concurrent connections**:
   ```bash
   # In backend .env
   MAX_TUNNELS_PER_SERVER=50  # Reduce from 100
   ```

3. **Restart services periodically** (systemd):
   ```ini
   # /etc/systemd/system/bore-server.service
   [Service]
   RuntimeMaxSec=86400  # Restart after 24 hours
   ```

### Database Query Timeouts

**Problem**: Backend responds slowly or times out

**Solutions**:

1. **Add database indexes**:
   ```sql
   -- Check for slow queries
   SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
   
   -- Add indexes if needed
   CREATE INDEX idx_instances_user_id ON instances(user_id);
   CREATE INDEX idx_instances_status ON instances(status);
   ```

2. **Increase connection pool**:
   ```bash
   # In backend .env
   DB_POOL_SIZE=30  # Increase from 20
   ```

3. **Optimize queries**:
   ```bash
   # Enable query logging
   LOG_LEVEL=debug
   npm run dev  # Check logs for slow queries
   ```

---

## Database Problems

### Database Connection Failed

**Problem**: Backend cannot connect to PostgreSQL

**Solutions**:

1. **Check PostgreSQL is running**:
   ```bash
   sudo systemctl status postgresql
   # or
   pg_isready -h localhost -p 5432
   ```

2. **Verify credentials**:
   ```bash
   # Test connection manually
   psql -h localhost -U postgres -d bore_db
   ```

3. **Check firewall**:
   ```bash
   sudo ufw allow 5432/tcp
   ```

4. **Update pg_hba.conf**:
   ```bash
   # Add line to /etc/postgresql/14/main/pg_hba.conf
   host    bore_db         bore_user       127.0.0.1/32            md5
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

### Migration Failures

**Problem**: `npm run migrate:up` fails

**Solutions**:

1. **Check migration status**:
   ```bash
   cd backend
   npm run migrate
   ```

2. **Rollback and retry**:
   ```bash
   npm run migrate:down
   npm run migrate:up
   ```

3. **Manual fix** (if migration corrupted):
   ```bash
   # Connect to database
   psql -h localhost -U postgres -d bore_db
   
   # Check migrations table
   SELECT * FROM pgmigrations ORDER BY run_on DESC;
   
   # Manually mark migration as run (if safe)
   INSERT INTO pgmigrations (name, run_on) VALUES ('migration_name', NOW());
   ```

---

## Redis Issues

### Redis Connection Failed

**Problem**: Backend warns "Redis initialization failed"

**Solutions**:

1. **Check Redis is running**:
   ```bash
   sudo systemctl status redis
   # or
   redis-cli ping  # Should return PONG
   ```

2. **Test connection**:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

3. **Disable Redis** (fallback):
   ```bash
   # In backend .env
   REDIS_ENABLED=false
   ```
   
   **Note**: Without Redis, horizontal scaling won't work.

4. **Check Redis password**:
   ```bash
   # If Redis has password
   REDIS_PASSWORD=your-redis-password
   ```

### Redis Out of Memory

**Problem**: Redis fails with OOM error

**Solutions**:

1. **Check memory usage**:
   ```bash
   redis-cli INFO memory
   ```

2. **Increase maxmemory**:
   ```bash
   # In /etc/redis/redis.conf
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   
   sudo systemctl restart redis
   ```

3. **Clear old data**:
   ```bash
   redis-cli FLUSHDB  # WARNING: Deletes all data
   ```

---

## Docker Issues

### Docker Compose Fails to Start

**Problem**: `docker-compose up` fails

**Solutions**:

1. **Check Docker version**:
   ```bash
   docker --version  # Should be 20.10+
   docker-compose --version  # Should be 2.0+
   ```

2. **Rebuild images**:
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up
   ```

3. **Check logs**:
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f postgres
   docker-compose logs -f redis
   ```

4. **Check ports**:
   ```bash
   # Make sure ports aren't in use
   sudo lsof -i :3000  # Backend
   sudo lsof -i :5432  # PostgreSQL
   sudo lsof -i :6379  # Redis
   ```

### Container Keeps Restarting

**Problem**: Docker container exits immediately

**Solutions**:

1. **Check logs**:
   ```bash
   docker logs <container-id>
   ```

2. **Check environment variables**:
   ```bash
   docker-compose config  # Verify .env is loaded
   ```

3. **Run interactively**:
   ```bash
   docker-compose run --rm backend sh
   # Debug inside container
   ```

---

## Client-Server Communication

### "Protocol Error" Messages

**Problem**: Client or server shows protocol errors

**Solutions**:

1. **Version mismatch**:
   ```bash
   # Ensure client and server are same version
   bore --version
   bore-server --version
   ```

2. **Corrupted connection**:
   - Restart both client and server
   - Check for network packet corruption

3. **Update to latest**:
   ```bash
   cargo install --path bore-client --force
   cargo install --path bore-server --force
   ```

### Heartbeat Timeout

**Problem**: "Heartbeat timeout" in logs

**Solutions**:

1. **Network latency**:
   - Increase timeout on server
   - Check network quality

2. **Client behind firewall**:
   - Some firewalls drop long-lived TCP connections
   - Try different network or configure firewall

---

## Debugging Tips

### Enable Debug Logging

**Rust components**:
```bash
RUST_LOG=debug bore-server
RUST_LOG=trace bore 8080 --to server.com  # Very verbose
```

**Backend**:
```bash
LOG_LEVEL=debug npm run dev
```

### Inspect Network Traffic

```bash
# Monitor traffic on port 7835
sudo tcpdump -i any -n port 7835

# Or use Wireshark for detailed analysis
```

### Check System Resources

```bash
# CPU and memory
htop

# Disk I/O
iotop

# Network
iftop
```

### Database Queries

```bash
# Enable query logging in PostgreSQL
# Edit /etc/postgresql/14/main/postgresql.conf
log_statement = 'all'
log_duration = on

sudo systemctl restart postgresql
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health | jq

# Metrics
curl http://localhost:3000/metrics

# Test auth
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## Getting Help

If the above solutions don't help:

1. **Check GitHub Issues**: https://github.com/yourusername/bore/issues
2. **GitHub Discussions**: https://github.com/yourusername/bore/discussions
3. **Provide**:
   - Version numbers (`bore --version`, `npm --version`, etc.)
   - Operating system and version
   - Full error messages and logs
   - Steps to reproduce
   - Configuration (sanitize secrets!)

---

**Last Updated**: October 2025

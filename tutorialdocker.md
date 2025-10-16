# Docker Commands Tutorial - Bore Project

## 🎯 Quick Reference

### Starting & Stopping Services

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `docker compose up -d` | Creates + starts all containers | First time or after `down` |
| `docker compose down` | Stops + removes containers & networks | Complete cleanup |
| `docker compose stop` | Only stops containers (keeps them) | Temporary pause |
| `docker compose start` | Restarts stopped containers | Resume after `stop` |
| `docker compose restart` | Restarts without removing | Quick restart, config changes |

---

## 📦 Understanding `docker compose down`

### What It Does:
```bash
sudo docker compose down
```

✅ **Stops** containers  
✅ **Removes** containers  
✅ **Removes** networks  
❌ **Keeps** volumes (your data is safe!)  
❌ **Keeps** images (don't need to rebuild)

### What It DOESN'T Remove:
- **Volumes** - Your PostgreSQL database, Redis data
- **Images** - Built containers (no need to rebuild)
- **Source code** - Obviously stays

---

## 🔄 Daily Workflow Commands

### Option 1: Quick Restart (Recommended)
```bash
cd /home/maroun/Documents/bore/backend

# Restart all services quickly (~5 seconds)
sudo docker compose restart

# Or restart just one service
sudo docker compose restart backend
sudo docker compose restart bore-server
```

### Option 2: Stop & Start (Temporary Pause)
```bash
# Stop everything (keeps containers)
sudo docker compose stop

# Start again later
sudo docker compose start
```

### Option 3: Fresh Start (Complete Cleanup)
```bash
# Remove everything and start fresh (~30 seconds)
sudo docker compose down
sudo docker compose up -d
```

---

## 🎛️ Controlling bore-server with .env

### Enable bore-server (Default)
Edit `/home/maroun/Documents/bore/backend/.env`:
```bash
ENABLE_MASTER_TUNNEL=true
COMPOSE_PROFILES=tunnel
```

Then restart:
```bash
sudo docker compose restart
```

### Disable bore-server
Edit `/home/maroun/Documents/bore/backend/.env`:
```bash
ENABLE_MASTER_TUNNEL=false
COMPOSE_PROFILES=
# Or comment out: #COMPOSE_PROFILES=tunnel
```

Then restart:
```bash
sudo docker compose down
sudo docker compose up -d
```

---

## 📊 Monitoring Commands

### View Running Containers
```bash
sudo docker compose ps
```

Output:
```
NAME            SERVICE       STATUS      PORTS
================================================================
bore-backend    backend       ✅ Healthy  0.0.0.0:3000→3000
bore-postgres   postgres      ✅ Healthy  0.0.0.0:5432→5432  
bore-redis      redis         ✅ Healthy  0.0.0.0:6379→6379
bore-server     bore-server   ✅ Healthy  0.0.0.0:7835→7835
```

### View Logs
```bash
# All services
sudo docker compose logs -f

# Specific service
sudo docker compose logs -f backend
sudo docker compose logs -f bore-server
sudo docker compose logs -f postgres

# Last 50 lines
sudo docker compose logs --tail 50 backend
```

### Check Resource Usage
```bash
sudo docker stats
```

---

## 🔧 Troubleshooting Commands

### Rebuild After Code Changes
```bash
# Rebuild specific service
sudo docker compose up -d --build backend

# Rebuild all services
sudo docker compose up -d --build
```

### Force Recreate Containers
```bash
sudo docker compose up -d --force-recreate
```

### Clean Everything (INCLUDING DATA!)
```bash
# ⚠️ WARNING: This deletes your database!
sudo docker compose down --volumes

# Then start fresh
sudo docker compose up -d
```

### Remove Unused Docker Resources
```bash
# Remove stopped containers, unused networks, dangling images
sudo docker system prune

# Remove everything (be careful!)
sudo docker system prune -a --volumes
```

---

## 🏗️ Build & Deploy Workflow

### Development Workflow
```bash
# 1. Make code changes in your editor
# 2. Rebuild the affected service
sudo docker compose up -d --build backend

# 3. Check logs
sudo docker compose logs -f backend
```

### Testing bore-server Changes
```bash
# Rebuild bore-server (takes 3-5 minutes - Rust compilation)
sudo docker compose up -d --build bore-server

# Check if it started correctly
sudo docker compose logs bore-server --tail 50
```

---

## 🔒 Data Persistence

### Where Your Data Lives
```yaml
volumes:
  postgres-data:    # PostgreSQL database
  redis-data:       # Redis cache
  prometheus-data:  # Metrics (if monitoring enabled)
  grafana-data:     # Dashboards (if monitoring enabled)
```

### Backup Your Database
```bash
# Export PostgreSQL data
sudo docker exec bore-postgres pg_dump -U postgres bore_db > backup.sql

# Restore from backup
sudo docker exec -i bore-postgres psql -U postgres bore_db < backup.sql
```

### View Volume Data Location
```bash
sudo docker volume ls
sudo docker volume inspect backend_postgres-data
```

---

## 🚀 Starting Services

### Default Setup (Backend + Database + Redis + bore-server)
```bash
cd /home/maroun/Documents/bore/backend
sudo docker compose up -d
```

### With Monitoring (Prometheus + Grafana)
```bash
sudo docker compose --profile monitoring up -d
```

### Access Points After Starting
- **Backend API**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard.html
- **Health Check**: http://localhost:3000/health
- **Prometheus**: http://localhost:9090 (if monitoring enabled)
- **Grafana**: http://localhost:3001 (if monitoring enabled)

---

## 🐛 Common Issues

### Issue: Port Already in Use
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Issue: Container Won't Start
```bash
# Check logs for errors
sudo docker compose logs <service-name>

# Remove and recreate
sudo docker compose down
sudo docker compose up -d
```

### Issue: Database Connection Refused
```bash
# Wait for PostgreSQL to be ready
sudo docker compose logs postgres

# Should see: "database system is ready to accept connections"

# Or restart services
sudo docker compose restart postgres
sudo docker compose restart backend
```

### Issue: Changes Not Showing
```bash
# Rebuild the container
sudo docker compose up -d --build backend

# Or force recreate
sudo docker compose up -d --force-recreate backend
```

---

## 📝 Best Practices

### 1. Always Use `-d` for Detached Mode
```bash
# ✅ Good - runs in background
sudo docker compose up -d

# ❌ Avoid - locks your terminal
sudo docker compose up
```

### 2. Check Status After Changes
```bash
sudo docker compose ps
sudo docker compose logs -f backend --tail 20
```

### 3. Use Restart for Config Changes
```bash
# After editing .env
sudo docker compose restart
```

### 4. Use Down for Profile Changes
```bash
# After changing COMPOSE_PROFILES
sudo docker compose down
sudo docker compose up -d
```

### 5. Regular Cleanup
```bash
# Remove unused images once a week
sudo docker system prune
```

---

## 🎓 Advanced Usage

### Run Command Inside Container
```bash
# Open shell in backend container
sudo docker exec -it bore-backend sh

# Run Node.js command
sudo docker exec bore-backend node -v

# Run PostgreSQL command
sudo docker exec -it bore-postgres psql -U postgres bore_db
```

### Copy Files To/From Container
```bash
# Copy from container
sudo docker cp bore-backend:/app/logs/error.log ./

# Copy to container
sudo docker cp ./config.json bore-backend:/app/config.json
```

### Inspect Container
```bash
# View container details
sudo docker inspect bore-backend

# View container environment variables
sudo docker exec bore-backend env
```

---

## 📚 Summary

**For daily use:**
```bash
sudo docker compose restart        # Quick restart
sudo docker compose logs -f        # View logs
```

**For code changes:**
```bash
sudo docker compose up -d --build backend
```

**For .env changes:**
```bash
sudo docker compose restart        # Simple config changes
sudo docker compose down && sudo docker compose up -d  # Profile changes
```

**For troubleshooting:**
```bash
sudo docker compose ps             # Check status
sudo docker compose logs <service> # Check logs
```

---

## 🔗 Useful Links

- **Docker Compose Docs**: https://docs.docker.com/compose/
- **PostgreSQL in Docker**: https://hub.docker.com/_/postgres
- **Redis in Docker**: https://hub.docker.com/_/redis
- **Node.js Best Practices**: https://github.com/goldbergyoni/nodebestpractices

---

**Last Updated**: 2025-10-16

For main server 
cd ~/Documents/bore/backend
docker-compose up -d

# This starts:
# - backend (Port 3000)
# - postgres (Port 5432)
# - redis (Port 6379)
# - bore-server (Port 7835)


for the scaled pc 

#  These DON'T use docker-compose
# Just run bore-server container directly

docker run -d \
  --name bore-server \
  --restart always \
  -p 7835:7835 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  bore-server:latest

--------------------------------------------------------------


# 🐳 Docker Guide (For Beginners)

Complete beginner's guide to using Docker for your Bore tunnel system.

---

## 🤔 What is Docker?

**Simple explanation:**
- Docker = Like a USB stick for applications
- You package your app once → Run anywhere
- No "works on my machine" problems

**For you:**
- Backend (Node.js) → Docker container
- Database (PostgreSQL) → Docker container  
- bore-server (Rust) → Docker container
- Everything works the same on every computer

---

## 📦 What You Have

### Backend (Master Server - PC1)
```
docker-compose.yml  ← The blueprint
├── backend         ← Your API (Node.js)
├── postgres        ← Database
├── redis           ← For scaling
└── bore-server     ← Tunnel server #1
```

### Tunnel Servers (PC2, PC3, etc.)
```
Just bore-server in Docker
(One command to run)
```

---

## 🚀 Setting Up Master Server (PC1)

### Step 1: Install Docker

**Ubuntu/Debian:**
```bash
# Easy install script
curl -fsSL https://get.docker.com | sh

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and back in, then test
docker --version
```

**Should show:** `Docker version 24.x.x`

---

### Step 2: Get Your Code

```bash
# Clone your repository
cd ~
git clone https://github.com/yourusername/bore.git
cd bore/backend
```

**You should see:**
```
backend/
├── docker-compose.yml    ← Main config file
├── Dockerfile           ← Backend image config
├── .env.example         ← Example config
├── server-new.js        ← Your backend code
└── ...
```

---

### Step 3: Setup Environment File

**The .env file = Your secret settings**

```bash
# Copy the example
cp .env.example .env

# Edit it
nano .env
```

**Change these important settings:**

```env
# === REQUIRED: Change these! ===

# Database password (make it strong!)
DB_PASSWORD=MyStr0ngP@ssw0rd123

# Secret key for JWT tokens (random string)
JWT_SECRET=super-secret-random-key-change-me

# API key for bore-server (random string)
INTERNAL_API_KEY=d3f08e6d4c9a4f0fb7e5c2a1bd98f4ce

# === OPTIONAL: Change if needed ===

# Server settings
PORT=3000
DB_HOST=postgres  # Don't change (Docker name)
DB_NAME=bore_db
DB_USER=postgres

# Bore server
BORE_SERVER_HOST=192.168.1.100  # Your PC1 IP
BORE_SERVER_PORT=7835

# Redis
REDIS_HOST=redis  # Don't change (Docker name)
REDIS_PORT=6379

# === OPTIONAL: Alerts (can add later) ===

# Slack alerts (optional)
SLACK_WEBHOOK_URL=

# Email alerts (optional)  
SENDGRID_API_KEY=
ALERT_EMAIL_FROM=alerts@bore.com
ALERT_EMAIL_TO=admin@bore.com
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

---

### Step 4: Choose Your Mode

**IMPORTANT:** Decide if master should run bore-server

**Option A: Testing Mode (bore-server on master)**
```bash
# In .env file, set:
ENABLE_MASTER_TUNNEL=true

# Start everything
chmod +x start.sh
./start.sh

# Or manually:
docker-compose --profile with-tunnel up -d
```

**Option B: Production Mode (recommended)**
```bash
# In .env file, set:
ENABLE_MASTER_TUNNEL=false

# Start (no bore-server on master)
./start.sh

# Or manually:
docker-compose up -d
```

### Step 5: Start Everything

```bash
# Easy way (recommended)
chmod +x start.sh
./start.sh

# Manual way
docker-compose up -d  # Without bore-server
# OR
docker-compose --profile with-tunnel up -d  # With bore-server
```

**What happens:**
1. Downloads Docker images (first time only, ~5 minutes)
2. Creates database
3. Starts backend API
4. Starts bore-server (only if ENABLE_MASTER_TUNNEL=true)
4. Starts Redis
5. Starts bore-server

**You'll see:**
```
Creating bore-postgres ... done
Creating bore-redis    ... done
Creating bore-backend  ... done
Creating bore-server   ... done
```

---

### Step 5: Check Everything is Running

```bash
# See running containers
docker-compose ps
```

**Should show:**
```
       Name                     Status        Ports
-----------------------------------------------------------
bore-backend        Up 30 seconds   0.0.0.0:3000->3000/tcp
bore-postgres       Up 35 seconds   0.0.0.0:5432->5432/tcp
bore-redis          Up 35 seconds   0.0.0.0:6379->6379/tcp
bore-server         Up 30 seconds   0.0.0.0:7835->7835/tcp
```

**All should say "Up"** ✅

---

### Step 6: Check Database is Ready

**The database creates itself automatically!** ✨

All tables are created on first startup. Check:

```bash
# Connect to database
docker-compose exec postgres psql -U postgres bore_db

# List tables
\dt
```

**Should show:**
```
 users
 instances
 status_history
 health_metrics
 tunnel_tokens
 alert_history
 bore_servers
 waitlist
```

**Type:** `\q` to exit

**✅ Database is ready!** No manual setup needed.

---

### Step 7: Test Backend

```bash
# Check health
curl http://localhost:3000/health
```

**Should return:**
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": 1234567890
}
```

**✅ Backend is working!**

---

### Step 8: Create Admin Account

```bash
# Create your account
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "admin@yourdomain.com",
    "password": "your-secure-password"
  }'
```

**You'll get back:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123...",
    "email": "admin@yourdomain.com",
    ...
  }
}
```

**Save the token!** You'll need it.

---

### Step 9: Make Yourself Admin

```bash
# Make your account admin
docker-compose exec postgres psql -U postgres bore_db -c \
  "UPDATE users SET is_admin = TRUE WHERE email = 'admin@yourdomain.com';"
```

**Should show:** `UPDATE 1`

**✅ You're now admin!**

---

### Step 10: Access Dashboard

Open browser:
```
http://192.168.1.100:3000/dashboard
```

**You should see the dashboard!** 🎉

---

## 🖥️ Adding Tunnel Servers (PC2, PC3, etc.)

### On Each New Computer

**Step 1: Install Docker**
```bash
ssh user@192.168.1.10X
curl -fsSL https://get.docker.com | sh
```

**Step 2: Run bore-server**
```bash
docker run -d \
  --name bore-server \
  --restart always \
  -p 7835:7835 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e INTERNAL_API_KEY=d3f08e6d4c9a4f0fb7e5c2a1bd98f4ce \
  -e REDIS_HOST=192.168.1.100 \
  -e REDIS_PORT=6379 \
  -e SERVER_ID=server_$(hostname) \
  bore-server:latest
```

**Change:**
- `192.168.1.100` → Your master server IP
- `INTERNAL_API_KEY` → Same key from .env file

**Step 3: Check it's running**
```bash
docker ps
```

**Should show:**
```
CONTAINER ID   IMAGE              STATUS
abc123def      bore-server:latest Up 10 seconds
```

**✅ Tunnel server running!**

---

## 📝 Common Docker Commands

### View Running Containers
```bash
docker-compose ps          # See all containers
docker ps                  # Same but shorter
```

### View Logs
```bash
# All logs
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs postgres

# Follow logs (live)
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Restart Services
```bash
# Restart everything
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Stop Everything
```bash
docker-compose stop
```

### Start Everything
```bash
docker-compose start
```

### Stop and Remove (clean slate)
```bash
docker-compose down

# Also remove data (CAREFUL!)
docker-compose down -v
```

### Update Code
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

---

## 🗄️ Database Management

### Connect to Database
```bash
docker-compose exec postgres psql -U postgres bore_db
```

### Common SQL Commands
```sql
-- List all tables
\dt

-- See users
SELECT id, email, plan, is_admin FROM users;

-- See instances
SELECT id, name, status, tunnel_connected FROM instances;

-- See capacity
SELECT COUNT(*) FROM instances WHERE tunnel_connected = TRUE;

-- Exit
\q
```

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres bore_db > backup.sql

# Restore backup
cat backup.sql | docker-compose exec -T postgres psql -U postgres bore_db
```

---

## 🔧 Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose logs backend
```

**Common issues:**

**1. Port already in use**
```
Error: bind: address already in use
```

**Fix:** Change port in docker-compose.yml
```yaml
ports:
  - "3001:3000"  # Changed from 3000:3000
```

**2. Database connection failed**
```
Error: connect ECONNREFUSED postgres:5432
```

**Fix:** Wait 10-20 seconds for postgres to start
```bash
docker-compose restart backend
```

**3. Environment variable missing**
```
Error: JWT_SECRET is not defined
```

**Fix:** Check .env file exists and has correct values

---

### Reset Everything

**If things are broken, nuclear option:**

```bash
# Stop and remove everything
docker-compose down -v

# Remove all Docker data
docker system prune -a

# Start fresh
cp .env.example .env
# Edit .env
docker-compose up -d
```

---

### Check Resource Usage

```bash
# See CPU/Memory usage
docker stats

# Clean up unused stuff
docker system prune
```

---

## 📊 Monitoring

### Check if Services are Healthy

```bash
# Health check endpoint
curl http://localhost:3000/health

# Metrics (Prometheus format)
curl http://localhost:3000/metrics

# Database status
docker-compose exec postgres pg_isready
```

### Auto-restart on Crash

**Already configured!**

In docker-compose.yml:
```yaml
restart: unless-stopped
```

This means:
- If container crashes → Auto-restart
- If server reboots → Auto-start containers

---

## 🔄 Updating Your System

### Update Backend Code

```bash
# Pull latest code
cd ~/bore/backend
git pull

# Rebuild and restart
docker-compose up -d --build
```

### Update Environment Variables

```bash
# Edit .env
nano .env

# Restart to apply changes
docker-compose restart
```

### Update Docker Images

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d
```

---

## 🌐 Accessing from Other Computers

### From Your Network (Local)
```
http://192.168.1.100:3000/dashboard
```

### From Internet (Port Forward)

**1. Get your public IP:**
```bash
curl ifconfig.me
```

**2. Setup port forwarding on router:**
- Forward port 3000 → 192.168.1.100:3000
- Forward port 7835 → 192.168.1.100:7835

**3. Access from anywhere:**
```
http://YOUR_PUBLIC_IP:3000/dashboard
```

**⚠️ Security:** Use HTTPS in production (add nginx with SSL)

---

## 📁 File Structure Explained

```
backend/
├── docker-compose.yml        ← Orchestrates all containers
│   ├── backend service       ← Your API
│   ├── postgres service      ← Database
│   ├── redis service         ← Cache/queue
│   └── bore-server service   ← Tunnel server
│
├── Dockerfile               ← How to build backend image
├── .env                     ← Your secrets (DON'T commit!)
├── .env.example             ← Template for .env
│
├── server-new.js            ← Main backend code
├── database.js              ← Database functions
├── routes/                  ← API endpoints
└── ...
```

---

## 🔐 Security Best Practices

### 1. Change Default Passwords

**In .env:**
```env
# DON'T use these!
DB_PASSWORD=postgres  ❌

# Use these instead!
DB_PASSWORD=MyStr0ng!P@ssw0rd2024  ✅
JWT_SECRET=random-64-char-string-here  ✅
```

### 2. Don't Commit .env

**Already setup in .gitignore:**
```
.env  ← This file is ignored by git
```

### 3. Firewall Rules

```bash
# Allow only specific ports
sudo ufw allow 22    # SSH
sudo ufw allow 3000  # Backend
sudo ufw allow 7835  # bore-server
sudo ufw enable
```

---

## ✅ Quick Reference

### Master Server (PC1) - Full Stack

**Start:**
```bash
cd ~/bore/backend
docker-compose up -d
```

**Stop:**
```bash
docker-compose stop
```

**Logs:**
```bash
docker-compose logs -f
```

**Update:**
```bash
git pull
docker-compose up -d --build
```

---

### Tunnel Server (PC2+) - Just bore-server

**Start:**
```bash
docker run -d \
  --name bore-server \
  --restart always \
  -p 7835:7835 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e INTERNAL_API_KEY=your-key \
  bore-server:latest
```

**Stop:**
```bash
docker stop bore-server
```

**Logs:**
```bash
docker logs -f bore-server
```

**Remove:**
```bash
docker rm -f bore-server
```

---

## 🎯 Checklist: Is Everything Working?

Run these checks:

```bash
# 1. Containers running?
docker-compose ps
# All should be "Up"

# 2. Backend healthy?
curl http://localhost:3000/health
# Should return {"status":"healthy"}

# 3. Database working?
docker-compose exec postgres psql -U postgres bore_db -c "SELECT 1;"
# Should return "1"

# 4. Can create user?
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}'
# Should return token

# 5. Dashboard loads?
# Open: http://192.168.1.100:3000/dashboard
# Should see interface
```

**All ✅? You're ready!** 🎉

---

## 🆘 Still Stuck?

### Check Logs
```bash
# See what's failing
docker-compose logs backend
docker-compose logs postgres
```

### Restart Everything
```bash
docker-compose restart
```

### Complete Reset
```bash
# CAUTION: Deletes all data!
docker-compose down -v
docker-compose up -d
```

### Get Help
```bash
# Check Docker is working
docker --version
docker-compose --version

# Check port conflicts
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 7835
```

---

## 🎓 Summary

**What Docker does for you:**
- ✅ Automatic database setup (no manual SQL)
- ✅ Consistent environment (works same everywhere)
- ✅ Easy updates (git pull + rebuild)
- ✅ Auto-restart on crash
- ✅ Clean uninstall (docker-compose down)

**Your workflow:**
1. Edit .env file (once)
2. Run `docker-compose up -d` (once)
3. System runs forever
4. To add server: Run 1 command on new PC
5. Done!

**No complex setup. No manual database config. Just works!** ✨

---

**Ready to deploy? Check out:** `SIMPLE_SCALING.md` for the full deployment walkthrough!

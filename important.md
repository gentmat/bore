# 🚀 How to Run Bore

## ✅ DOCKER WAY (Recommended - Easy!)

### Master Server Setup

```bash
cd ~/Documents/bore/backend

# Setup environment (first time only)
cp .env.example .env
nano .env  # Change these:
  # DB_PASSWORD=your-password
  # JWT_SECRET=your-secret
  # INTERNAL_API_KEY=your-key
  # ENABLE_MASTER_TUNNEL=true  (for testing) or false (for production)
```

### Mode 1: TESTING (bore-server on master)
```bash
# In .env: ENABLE_MASTER_TUNNEL=true

# Start everything (including bore-server on master)
./start.sh
# OR manually:
docker-compose --profile with-tunnel up -d

# Starts: Backend + DB + Redis + bore-server
# Good for: Testing, single machine, learning
```

### Mode 2: PRODUCTION (coordinator only)
```bash
# In .env: ENABLE_MASTER_TUNNEL=false

# Start master (without bore-server)
./start.sh
# OR manually:
docker-compose up -d

# Starts: Backend + DB + Redis only
# bore-server runs on separate VPS
# Good for: Production, scaling, reliability
```

### Common Commands
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Restart
docker-compose restart
```

**Access:** http://localhost:3000/dashboard

---

## ⚙️ MANUAL WAY (For Development/Testing)

### If you want to run without Docker:

**Build once:**
```bash
cd ~/Documents/bore
cargo build --release --workspace
cargo install --path bore-client
cargo install --path bore-server

# For fish shell
set -Ux fish_user_paths $HOME/.cargo/bin $fish_user_paths
```

**Run bore-server:**
```bash
bore-server --bind-addr 127.0.0.1 \
            --bind-tunnels 127.0.0.1 \
            --backend-url http://127.0.0.1:3000
```

**Run backend (separate terminal):**
```bash
cd ~/Documents/bore/backend
node server.js
```

**Run code-server (separate terminal):**
```bash
code-server
```

---

## 🎯 Which Should You Use?

**Use Docker if:**
- ✅ You want it to "just work"
- ✅ You're deploying to production
- ✅ You want auto-restart on crash
- ✅ You don't want to manage processes

**Use Manual if:**
- 🔧 You're actively developing bore-server code
- 🔧 You need to debug Rust code
- 🔧 You want to see logs in separate windows

---

## 💡 Pro Tip

**For production (your home datacenter):** Always use Docker!

**For development (coding new features):** Use manual mode.

---------------------------------------------------------------
Client
bore 8080 --to 127.0.0.1 --secret sk_tok_57d0e5example
---------------------------------------------------------------



bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000


-------------------------
to install appimage and deb ...
cd bore-gui  
./build-installers.sh 

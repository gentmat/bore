# 🔄 Master Tunnel Toggle

Control whether bore-server runs on master or separately.

---

## 🎯 Quick Setup

### 1. Edit .env
```bash
nano .env

# Set this:
ENABLE_MASTER_TUNNEL=true   # For testing
# or
ENABLE_MASTER_TUNNEL=false  # For production
```

### 2. Start
```bash
chmod +x start.sh
./start.sh
```

**Done!** Script automatically detects the mode.

---

## 📊 Modes Explained

### Testing Mode (true)
**When to use:**
- ✅ Learning the system
- ✅ Local development
- ✅ Single machine testing
- ✅ Don't want to manage multiple VPS

**What runs on master:**
```
Master Server:
├── Backend API
├── PostgreSQL
├── Redis
└── bore-server (handles tunnels too!)

Cost: 1 VPS (€3.79-10/mo)
```

**Pros:**
- Simple setup
- All-in-one
- Cheap to start

**Cons:**
- Master affected by tunnel load
- Limited to ~100 users
- Single point of failure

---

### Production Mode (false)
**When to use:**
- ✅ Production deployment
- ✅ Scaling beyond 100 users
- ✅ Want stability
- ✅ Serious about reliability

**What runs on master:**
```
Master Server:
├── Backend API
├── PostgreSQL
└── Redis
(No bore-server!)

Separate VPS:
└── bore-server #1
└── bore-server #2
└── bore-server #3
...

Cost: Master + N × tunnel VPS
Example: €3.79 + (10 × €3.79) = €41.69/mo
```

**Pros:**
- Master stable and fast
- Scales to millions
- Isolated failures
- Professional architecture

**Cons:**
- More servers to manage
- Slightly higher cost

---

## 🚀 Usage Examples

### Testing Mode
```bash
# .env
ENABLE_MASTER_TUNNEL=true

# Start
./start.sh

# Result:
# ✅ Backend running on :3000
# ✅ bore-server running on :7835
# ✅ Can test tunnels immediately!
```

### Production Mode
```bash
# .env
ENABLE_MASTER_TUNNEL=false

# Start master
./start.sh

# Deploy tunnel servers separately
ssh vps1
docker run -d bore-server ...

ssh vps2
docker run -d bore-server ...

# Result:
# ✅ Master lightweight and stable
# ✅ Tunnel servers handle all traffic
# ✅ Scales to thousands of users
```

---

## 🔧 Manual Control

### Without start.sh script:

**Testing mode:**
```bash
docker-compose --profile with-tunnel up -d
```

**Production mode:**
```bash
docker-compose up -d
```

---

## 📈 Scaling Path

### Phase 1: Start Testing
```
ENABLE_MASTER_TUNNEL=true
1 VPS, all-in-one
Good for 0-100 users
```

### Phase 2: Grow
```
ENABLE_MASTER_TUNNEL=true
Upgrade to bigger VPS (CX31)
Good for 100-200 users
```

### Phase 3: Production
```
ENABLE_MASTER_TUNNEL=false
Master: CX11 (coordinator only)
Add separate bore-server VPS
Good for 200+ users
Scales infinitely!
```

---

## ✅ Recommendations

**If you're:**
- 🎓 Just learning → `ENABLE_MASTER_TUNNEL=true`
- 🧪 Testing locally → `ENABLE_MASTER_TUNNEL=true`
- 🏠 Home server with <100 users → `ENABLE_MASTER_TUNNEL=true`
- 🚀 Serious deployment → `ENABLE_MASTER_TUNNEL=false`
- 📈 Growing past 100 users → `ENABLE_MASTER_TUNNEL=false`
- 💰 Want max profit margins → `ENABLE_MASTER_TUNNEL=false`

**Default:** `false` (production mode recommended)

---

## 🐛 Troubleshooting

### bore-server not starting in testing mode?

**Check:**
```bash
# Is the profile active?
docker-compose --profile with-tunnel ps

# Should show bore-server running
```

### Want to switch modes?

```bash
# Stop everything
docker-compose down

# Change .env
nano .env
# Toggle ENABLE_MASTER_TUNNEL

# Restart
./start.sh
```

---

## 💡 Pro Tips

1. **Start with testing mode** to learn
2. **Switch to production mode** when you get 50+ users
3. **Use start.sh** - it's easier than manual commands
4. **Check mode before deploying** - don't accidentally run tunnel in production!

---

**TL;DR:**
- `true` = Easy, all-in-one, testing
- `false` = Professional, scalable, production

Choose based on your needs! 🎯

# 🚀 Simple Scaling Guide (For Beginners)

Dead simple explanation of how your tunnel system scales and what YOU need to do.

---

## 🎯 How It Works Now

### The Problem
- Each physical computer = 1 Gbps internet
- 1 Gbps = ~100 users max
- More users = need more computers

### The Solution
Your system now has **automatic protection**:

```
User #1-100:   ✅ "Welcome! Tunnel created"
User #101:     ⛔ "We're full! You're #1 in waitlist"
User #102:     ⛔ "You're #2 in waitlist"
...
```

**You get alert:** "🚨 ADD NEW SERVER!"

You buy new computer → plug it in → run 1 command → **done!**

New capacity:
```
User #101-200: ✅ "Your turn! Tunnel created"
```

---

## 📊 Current Capacity

### Right Now (1 Computer)
```
Maximum users: 100
Current users: 0
Status: ✅ Lots of room
```

### When You Add More
```
1 computer  = 100 users
2 computers = 200 users
5 computers = 500 users
10 computers = 1,000 users
```

**Simple math:** Need 500 users? Buy 5 computers.

---

## 🔔 What Happens When Users Sign Up

### Scenario: You have 1 computer (100 capacity)

**Users 1-75:** Everything normal ✅
```
Dashboard shows: 75% capacity
No alerts
```

**User 76:** 🟡 WARNING ALERT
```
Email: "System at 75% - time to order new computer"
Dashboard: 🟡 Yellow warning
```

**Users 77-90:** 🟠 GETTING FULL
```
Dashboard: 🟠 Orange warning (90%)
Email: "🚨 URGENT: Order computer NOW!"
```

**Users 91-100:** ✅ Still working
```
But getting close to limit
```

**User 101:** ⛔ WAITLIST ACTIVATED
```
User sees: "We're at capacity! You're #1 in line"
You see: "🚨 CRITICAL: ADD SERVER!"
No new signups until you add capacity
```

---

## 🛒 What YOU Do When Alert Comes

### Step 1: Buy Computer (Same Day)
Go to local store:
- Any PC with network port
- Doesn't need to be fancy
- Used Dell/HP for €200-400 works great
- Take it home

**Time: 2 hours**

### Step 2: Connect to Network (5 minutes)
```
1. Plug ethernet cable
2. Turn on computer
3. Note the IP address (e.g., 192.168.1.105)
```

**Time: 5 minutes**

### Step 3: Install Docker (5 minutes)
```bash
# SSH into new computer
ssh youruser@192.168.1.105

# Install Docker (copy-paste this)
curl -fsSL https://get.docker.com | sh
```

**Time: 5 minutes**

### Step 4: Run bore-server (2 minutes)
```bash
# Copy-paste this (change IP to your master server)
docker run -d \
  --name bore-server \
  --restart always \
  -p 7835:7835 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e INTERNAL_API_KEY=your-secret-key \
  -e SERVER_ID=server_$(hostname) \
  bore-server:latest
```

**Time: 2 minutes**

### Step 5: Register Server (1 minute)
```bash
# From your laptop, register new server
curl -X POST http://192.168.1.100:3000/api/admin/servers/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.1.105",
    "port": 7835,
    "maxConcurrentTunnels": 100
  }'
```

**Time: 1 minute**

### Step 6: Done! ✅
```
New capacity: 200 users
Waitlist automatically processes
Users #101-200 get activated
```

**Total time: ~3 hours** (mostly buying computer)

---

## 📱 Monitoring Dashboard

### What You See Every Day

**Normal (Green):**
```
┌────────────────────────────┐
│  Bore System Dashboard     │
├────────────────────────────┤
│ Capacity: 45/100 (45%)    │
│ Status: ✅ Healthy         │
│ Servers: 1 active          │
│ Waitlist: 0 people         │
└────────────────────────────┘
```
**Action:** Nothing. Relax ☕

**Warning (Yellow - 75%):**
```
┌────────────────────────────┐
│  Bore System Dashboard     │
├────────────────────────────┤
│ Capacity: 76/100 (76%)    │
│ Status: 🟡 Getting Full    │
│ Servers: 1 active          │
│ Waitlist: 0 people         │
│                            │
│ ⚠️  Start looking for PC   │
└────────────────────────────┘
```
**Action:** Check local PC stores, have €500 ready

**Critical (Orange - 90%):**
```
┌────────────────────────────┐
│  Bore System Dashboard     │
├────────────────────────────┤
│ Capacity: 92/100 (92%)    │
│ Status: 🟠 CRITICAL        │
│ Servers: 1 active          │
│ Waitlist: 0 people         │
│                            │
│ 🚨 BUY COMPUTER NOW!       │
└────────────────────────────┘
```
**Action:** Buy PC TODAY

**Full (Red - 100%):**
```
┌────────────────────────────┐
│  Bore System Dashboard     │
├────────────────────────────┤
│ Capacity: 100/100 (100%)  │
│ Status: 🔴 AT CAPACITY     │
│ Servers: 1 active          │
│ Waitlist: 15 people        │
│                            │
│ 🚨 URGENT: Deploy server!  │
└────────────────────────────┘
```
**Action:** Deploy new server (3 hours)

---

## 💰 Cost & Profit

### Example Growth
```
Month 1:
- Users: 100
- Computers: 1 (yours)
- Cost: €0
- Revenue (20 paid): €100/mo
- Profit: €100/mo

Month 2:
- Users: 200
- Computers: 2
- Cost: €300 one-time
- Revenue (40 paid): €200/mo
- Profit: -€100 first month, then €200/mo

Month 3:
- Users: 500
- Computers: 5
- Cost: €900 more (total €1200)
- Revenue (100 paid): €500/mo
- Profit: €500/mo (paid back hardware in 3 months)

Month 6:
- Users: 1000
- Computers: 10
- All hardware paid off
- Revenue: €1000/mo
- Profit: €1000/mo pure profit! 🎉
```

**Key:** Users PAY for the hardware that serves them!

---

## 🎮 How to Deploy First Server (Master)

### Your Main Computer (PC1)

**Step 1: Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
```

**Step 2: Clone Your Code**
```bash
cd ~
git clone https://github.com/yourusername/bore.git
cd bore/backend
```

**Step 3: Configure**
```bash
# Copy example env file
cp .env.example .env

# Edit it (use nano or vim)
nano .env
```

**Edit these lines:**
```env
DB_PASSWORD=your-strong-password
JWT_SECRET=your-random-secret-key
INTERNAL_API_KEY=your-api-key
```

**Step 4: Start Everything**
```bash
# Start backend + database + Redis
docker-compose up -d

# Check it's running
docker-compose ps
```

**Should see:**
```
bore-backend    running   0.0.0.0:3000->3000
bore-postgres   running   0.0.0.0:5432->5432
bore-redis      running   0.0.0.0:6379->6379
```

**Step 5: Create Your Admin Account**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@bore.com",
    "password": "your-password"
  }'
```

Save the token you get back!

**Step 6: Make Yourself Admin**
```bash
# Get your user ID from signup response, then:
docker-compose exec postgres psql -U postgres bore_db -c \
  "UPDATE users SET is_admin = TRUE WHERE email = 'admin@bore.com';"
```

**Step 7: Open Dashboard**
```
http://192.168.1.100:3000/dashboard
```

**Done!** ✅

---

## 🖥️ How to Add More Servers (PC2, PC3, etc.)

**For each new computer:**

### Quick Version (Copy-Paste)
```bash
# 1. SSH to new computer
ssh user@192.168.1.10X

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Run bore-server (CHANGE THE IPs!)
docker run -d \
  --name bore-server \
  --restart always \
  -p 7835:7835 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e INTERNAL_API_KEY=your-api-key \
  -e SERVER_ID=server_10X \
  bore-server:latest

# 4. Register (run from your laptop)
curl -X POST http://192.168.1.100:3000/api/admin/servers/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.1.10X",
    "port": 7835,
    "maxConcurrentTunnels": 100
  }'
```

**Capacity updated automatically!**

---

## ✅ Daily Checklist

**Every Morning:**
1. Open dashboard: `http://192.168.1.100:3000/dashboard`
2. Check capacity percentage
3. If <75%: ✅ Do nothing
4. If 75-90%: 🟡 Start looking for PC
5. If >90%: 🟠 Buy PC today

**That's it!**

---

## 🆘 Troubleshooting

### "Dashboard won't load"
```bash
# Check if backend is running
docker-compose ps

# If stopped, restart
docker-compose up -d

# Check logs
docker-compose logs backend
```

### "New server not showing up"
```bash
# Check if bore-server is running on new PC
ssh user@192.168.1.10X
docker ps

# Check backend logs
docker-compose logs backend | grep -i server
```

### "Capacity not increasing"
```bash
# Check server registration
curl http://192.168.1.100:3000/api/admin/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should show multiple servers
```

### "Waitlist not clearing"
The system automatically processes waitlist when:
- New server is added
- Existing users disconnect

Give it 5-10 minutes after adding server.

---

## 📞 Emergency Contacts

**Keep these handy:**
- Local PC store phone: _______________
- Internet provider: _______________
- Backup admin email: _______________

---

## 🎯 Summary

**How scaling works:**
1. System fills up → Waitlist activates
2. You get alert → Buy computer
3. Plug in → Run 1 command → Done
4. Capacity doubles → Waitlist clears

**Your job:**
- Check dashboard daily (30 seconds)
- When 75%: Order computer
- Deploy in 3 hours
- Repeat

**That's it!** You're now running a scalable home datacenter! 🏠🚀

---

## 📚 Next Steps

1. ✅ Deploy master server (PC1)
2. ✅ Test with 10 friends
3. ✅ Watch dashboard
4. ✅ When 75%: Buy PC2
5. ✅ Deploy PC2 (practice the 3-hour process)
6. ✅ Now you know how to scale!

**Read next:** `DOCKER_GUIDE.md` for Docker details

# Quick Start: High-Scale Deployment

**Ready to scale from 100 to 1,000+ users in 5 steps**

---

## 🚀 What's New

Your Bore system is now **production-ready for high scale** with:

✅ **Horizontal scaling** - Deploy multiple backend instances  
✅ **Distributed state** - Redis-backed server registry  
✅ **Real-time monitoring** - Fleet-wide capacity tracking  
✅ **Fault tolerance** - Circuit breaker pattern  
✅ **Load testing** - Comprehensive testing tools  

---

## 📦 Quick Setup

### 1. Single Instance (Current Setup - No Changes)

```bash
# Your current .env works as-is
REDIS_ENABLED=false
TOTAL_SYSTEM_CAPACITY=100

# Continue using as normal
npm start
```

**Capacity**: ~100-200 concurrent users

---

### 2. Enable High-Scale Mode (2-3 Minutes)

```bash
# Step 1: Install Redis (if not already)
# Ubuntu/Debian:
sudo apt install redis-server

# macOS:
brew install redis

# Start Redis
redis-server

# Step 2: Update .env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
TOTAL_SYSTEM_CAPACITY=500  # Adjust based on your servers

# Step 3: Restart backend
npm restart
```

**Capacity**: Now ready for multi-instance deployment

---

## 🔧 Environment Variables (Quick Reference)

### Essential for High Scale

```bash
# Redis (Required for multi-instance)
REDIS_ENABLED=true
REDIS_HOST=your-redis-server.com
REDIS_PORT=6379

# Capacity Management
TOTAL_SYSTEM_CAPACITY=500        # Total across all bore-servers
MAX_TUNNELS_PER_SERVER=100       # Per bore-server limit
RESERVED_CAPACITY_PERCENT=20     # Reserve for existing users
```

### Security (Already Configured)

```bash
JWT_SECRET=your-secret-here
INTERNAL_API_KEY=your-api-key-here
NODE_ENV=production
```

---

## 📊 Testing Your Setup

### 1. Health Check

```bash
curl http://localhost:3000/health

# Should return:
# {
#   "status": "healthy",
#   "checks": {
#     "database": { "status": "healthy" },
#     "redis": { "status": "healthy" }  # or "disabled"
#   }
# }
```

### 2. Run Integration Tests

```bash
cd backend
npm test

# Expected: All tests pass ✓
```

### 3. Load Test (Recommended)

```bash
# Test with 10 users for 60 seconds
node tests/load-test.js --users 10 --duration 60

# Success rate should be > 95%
# P95 response time should be < 500ms
```

---

## 📈 Scaling Examples

### Small Scale (500 users)
```bash
# 2-3 backend instances
# 2-3 bore-servers
# Redis: Single instance
# TOTAL_SYSTEM_CAPACITY=300
```

### Medium Scale (1,000 users)
```bash
# 3-5 backend instances
# 5-10 bore-servers
# Redis: Single instance or cluster
# TOTAL_SYSTEM_CAPACITY=1000
```

### Large Scale (5,000+ users)
```bash
# 10+ backend instances
# 20+ bore-servers (multi-region)
# Redis: Cluster (3+ nodes)
# TOTAL_SYSTEM_CAPACITY=2000+
```

---

## 🎯 Quick Commands

### Development

```bash
# Start with hot reload
npm run dev

# Run tests
npm test

# Type checking (if using TypeScript)
npm run type-check

# Load test
node tests/load-test.js --users 10 --duration 60
```

### Production

```bash
# Start with PM2
pm2 start server.js --name bore-backend -i max

# Monitor
pm2 monit

# Logs
pm2 logs bore-backend

# Restart
pm2 restart bore-backend
```

### Monitoring

```bash
# Health check
curl http://localhost:3000/health

# Metrics (Prometheus)
curl http://localhost:3000/metrics

# Fleet statistics (requires admin auth)
curl http://localhost:3000/api/v1/admin/fleet-stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📚 Full Documentation

- **`HIGH_SCALE_DEPLOYMENT.md`** - Complete deployment guide (infrastructure, monitoring, scaling)
- **`HIGH_SCALE_IMPROVEMENTS.md`** - Technical details of new features
- **`IMPROVEMENTS_APPLIED.md`** - Previous improvements (security, validation, etc.)
- **`.env.example`** - All configuration options explained

---

## ⚡ Performance Targets

| Metric | Single Instance | High Scale |
|--------|----------------|------------|
| Concurrent Users | 100-200 | 1,000-5,000+ |
| Backend Instances | 1 | 2-10+ |
| Bore-Servers | 1-2 | 5-20+ |
| Response Time (P95) | < 300ms | < 500ms |
| Success Rate | 99%+ | 99%+ |
| Redis Required | No | Yes |

---

## 🆘 Need Help?

### Check Health
```bash
# Is everything running?
curl http://localhost:3000/health
```

### Check Redis
```bash
# Is Redis connected?
redis-cli PING
# Should return: PONG
```

### Check Logs
```bash
# View recent logs
pm2 logs bore-backend --lines 100

# Or if running directly
npm start  # Check console output
```

### Common Issues

**Redis connection failed**
```bash
# Solution 1: Make sure Redis is running
redis-server

# Solution 2: Temporarily disable Redis
REDIS_ENABLED=false npm restart
```

**Capacity errors**
```bash
# Check current capacity
curl http://localhost:3000/api/v1/admin/fleet-stats

# Increase capacity in .env
TOTAL_SYSTEM_CAPACITY=1000  # Increase this
npm restart
```

---

## ✅ Production Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Load test successful (> 95% success rate)
- [ ] Health check returns 200
- [ ] Redis enabled (if multi-instance)
- [ ] Strong JWT_SECRET and INTERNAL_API_KEY
- [ ] CORS configured for your domain
- [ ] Database backups configured
- [ ] Monitoring dashboards set up
- [ ] SSL certificates installed
- [ ] Firewall rules configured

---

## 🚀 Deploy Now

**Single Instance** → Already running ✓

**Multi-Instance** → Follow these steps:
1. Set up Redis
2. Update `.env` with `REDIS_ENABLED=true`
3. Deploy multiple backend instances
4. Configure load balancer (see `HIGH_SCALE_DEPLOYMENT.md`)
5. Monitor and scale

---

**You're ready for production! 🎉**

See `HIGH_SCALE_DEPLOYMENT.md` for detailed infrastructure setup.

# Production Deployment Guide

Quick reference for deploying Bore backend to production with all security fixes.

## 🚀 Quick Setup (5 minutes)

### 1. Generate Secure Secrets

```bash
# Generate JWT secret (save this!)
openssl rand -base64 32

# Generate internal API key (save this!)
openssl rand -hex 32
```

### 2. Configure Environment

Create `.env` file in `backend/` directory:

```bash
# REQUIRED FOR PRODUCTION
NODE_ENV=production
JWT_SECRET=<paste-jwt-secret-here>
INTERNAL_API_KEY=<paste-internal-api-key-here>

# Your domain(s)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database (adjust as needed)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bore_db
DB_USER=bore_user
DB_PASSWORD=<your-secure-db-password>

# Server
PORT=3000
BORE_SERVER_HOST=your-bore-server-domain.com
BORE_SERVER_PORT=7835
```

### 3. Configure bore-server

The bore-server also needs the INTERNAL_API_KEY to communicate with backend:

```bash
# In bore-server environment or command line
INTERNAL_API_KEY=<same-key-as-backend>
BACKEND_URL=http://localhost:3000
```

### 4. Start Services

```bash
# Initialize database
cd backend
npm install
npm start

# In another terminal, start bore-server
cd bore-server
BACKEND_URL=http://localhost:3000 \
INTERNAL_API_KEY=<your-key> \
cargo run --release
```

### 5. Verify Security

```bash
# Test that secrets are required
unset JWT_SECRET
npm start
# Should fail with: "FATAL: JWT_SECRET environment variable is required"

# Test CORS
curl -H "Origin: https://evil.com" http://localhost:3000/health
# Should see CORS warning in logs
```

---

## 🔒 Security Hardening Checklist

- [ ] **Secrets**: Generated strong random secrets
- [ ] **Environment**: Set `NODE_ENV=production`
- [ ] **CORS**: Only allow trusted domains
- [ ] **Database**: Secure credentials, not default postgres/postgres
- [ ] **Firewall**: Only expose necessary ports
- [ ] **HTTPS**: Use SSL/TLS (nginx/caddy reverse proxy)
- [ ] **Backups**: Configure PostgreSQL backups
- [ ] **Monitoring**: Set up log aggregation (optional)

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Metrics (Prometheus format)
```bash
curl http://localhost:3000/metrics
```

### Logs
- **Production**: JSON format for log aggregation
- **Development**: Human-readable format

Pretty-print production logs:
```bash
npm start | jq
```

---

## 🐛 Common Issues

**"FATAL: JWT_SECRET required"**
```bash
# Solution: Set the environment variable
export JWT_SECRET=$(openssl rand -base64 32)
```

**CORS errors**
```bash
# Solution: Add your domain to ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**bore-server can't connect to backend**
```bash
# Solution: Ensure INTERNAL_API_KEY matches on both services
# Check bore-server logs for authentication errors
```

---

## 🔄 Updating

When pulling new changes:

```bash
cd backend
git pull
npm install  # In case of new dependencies
npm start
```

No database migrations needed for current fixes - all backward compatible.

---

## 📞 Support

- Check logs with request IDs for debugging
- All errors now include `requestId` field
- Use request ID to trace issues across logs

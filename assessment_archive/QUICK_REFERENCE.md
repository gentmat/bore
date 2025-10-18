# Quick Reference - New Features & Improvements

Quick access guide to all newly implemented features.

## 🚀 CI/CD Workflows

### Backend CI
**File**: `.github/workflows/backend-ci.yml`
```bash
# Triggers automatically on:
- Push to main (backend/** changes)
- Pull requests (backend/** changes)

# What it does:
✓ Runs ESLint
✓ Type checks TypeScript
✓ Runs database migrations
✓ Executes unit tests
✓ Executes integration tests
✓ Security audit (npm audit)
✓ Builds TypeScript
✓ Uploads coverage to Codecov
```

### Rust CI
**File**: `.github/workflows/ci.yml`
```bash
# Triggers automatically on:
- Push to main (Rust files)
- Pull requests (Rust files)

# What it does:
✓ Builds all Rust components
✓ Runs tests
✓ Checks formatting (rustfmt)
✓ Runs clippy linter
✓ Security audit (cargo audit)
✓ Checks outdated dependencies
✓ Uses caching for faster builds
```

### Docker Build & Publish
**File**: `.github/workflows/docker-publish.yml`
```bash
# Triggers on:
- Push to main
- Tags (v*)
- Pull requests
- Manual dispatch

# Builds images:
- bore-backend (Node.js)
- bore-client (Rust)
- bore-server (Rust)

# Publishes to: ghcr.io (GitHub Container Registry)
# Platforms: linux/amd64, linux/arm64
```

### Integration Tests
**File**: `.github/workflows/integration.yml`
```bash
# Triggers on:
- Push to main
- Pull requests
- Daily at 2 AM UTC
- Manual dispatch

# Full stack test:
✓ Starts PostgreSQL + Redis
✓ Builds Rust components
✓ Starts backend server
✓ Starts bore-server
✓ Runs integration tests
✓ Runs WebSocket tests
✓ E2E tunnel creation
```

## 🧪 Testing

### Run All Backend Tests
```bash
cd backend

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests with coverage
npm test

# WebSocket tests specifically
npm test websocket.test.ts
```

### Run Integration Tests (Rust)
```bash
# Start backend and services first
cd backend && docker-compose up -d

# Run integration tests
cargo test --test integration_test

# With verbose output
RUST_LOG=debug cargo test --test integration_test -- --nocapture
```

### Test Individual Components
```bash
# Backend only
cd backend && npm test

# Rust client only
cargo test -p bore-client

# Rust server only
cargo test -p bore-server

# E2E tests
cargo test --test e2e_test
```

## 🔍 Type Safety

### Database Type Mapping
**File**: `backend/database.ts`

**Before**:
```typescript
return formatDbRow(row) as unknown as T;  // Double cast
```

**After**:
```typescript
function mapRequiredRow<T extends Record<string, unknown>>(
  row: PlainObject | undefined,
  context: string
): T {
  if (!row) {
    throw new Error(`Expected database row for ${context} but query returned none.`);
  }
  const formatted = formatDbRow(row);
  return formatted as T;
}
```

**Usage**:
```typescript
const user = mapRequiredRow<UserRecord>(result.rows[0], 'getUserById');
const instance = mapOptionalRow<InstanceRecord>(result.rows[0]);
const instances = mapRows<InstanceRecord>(result.rows);
```

## 📚 Documentation

### Troubleshooting
**File**: `TROUBLESHOOTING.md`

Quick access by problem type:
```bash
# Installation issues
less TROUBLESHOOTING.md +/Installation

# Connection problems
less TROUBLESHOOTING.md +/Connection

# Authentication errors
less TROUBLESHOOTING.md +/Authentication

# Performance issues
less TROUBLESHOOTING.md +/Performance

# Database problems
less TROUBLESHOOTING.md +/Database

# Docker issues
less TROUBLESHOOTING.md +/Docker
```

### Summary of Changes
**File**: `IMPROVEMENTS_SUMMARY.md`

View complete list of all improvements and their impact.

## 🔧 Local Development

### Setup Complete Environment
```bash
# Install dependencies
cd backend && npm ci
cd .. && cargo build --workspace

# Start services
cd backend && docker-compose up -d

# Run migrations
cd backend && npm run migrate:up

# Start backend
cd backend && npm run dev

# Start bore-server (separate terminal)
cargo run -p bore-server -- \
  --backend-url http://localhost:3000 \
  --backend-api-key your-key
```

### Quick Checks
```bash
# Health check
curl http://localhost:3000/health | jq

# Metrics
curl http://localhost:3000/metrics

# API docs
open http://localhost:3000/api/v1/docs

# Database status
psql -h localhost -U postgres -d bore_db -c "SELECT COUNT(*) FROM users;"

# Redis status
redis-cli ping
```

## 🔌 API Versioning

### Current API Version
```bash
# All endpoints use /api/v1/ prefix
Current Version: v1 (Active)
Support: Full support with all features
```

### API Endpoint Structure
```bash
# ✅ Recommended - Explicit version
curl https://api.bore.com/api/v1/auth/login
curl https://api.bore.com/api/v1/instances

# ⚠️ Works but not recommended - Auto-redirects to v1
curl https://api.bore.com/api/auth/login
# → Redirects to /api/v1/auth/login (HTTP 308)
```

### Key Endpoints
```bash
# Authentication
POST /api/v1/auth/signup        # Register
POST /api/v1/auth/login         # Login
GET  /api/v1/auth/me            # Current user
POST /api/v1/auth/refresh       # Refresh token
POST /api/v1/auth/logout        # Logout

# Instance Management
GET    /api/v1/instances        # List instances
POST   /api/v1/instances        # Create instance
PATCH  /api/v1/instances/:id    # Update instance
DELETE /api/v1/instances/:id    # Delete instance
POST   /api/v1/instances/:id/connect    # Get tunnel token
POST   /api/v1/instances/:id/heartbeat  # Send heartbeat

# Monitoring
GET /health                     # Health check (no version prefix)
GET /metrics                    # Prometheus metrics (no version prefix)
```

### Check API Version Headers
```bash
# Check deprecation status
curl -I http://localhost:3000/api/v1/auth/login

# Look for these headers:
# X-API-Version: 1.0.0
# X-API-Deprecation: false
```

### Version Support Policy
```
- v1: Active (current production)
- Deprecation notice: 12 months minimum before sunset
- Breaking changes → new major version (v2)
- Non-breaking changes → same version
```

### OpenAPI Documentation
```bash
# View API documentation
open http://localhost:3000/api/v1/docs

# Download OpenAPI spec
curl http://localhost:3000/api/v1/openapi.yaml > openapi.yaml
```

**For detailed versioning strategy**: See [DEVELOPMENT.md#api-versioning-strategy](DEVELOPMENT.md#api-versioning-strategy)

## 🔐 Security

### Run Security Audits
```bash
# Backend (npm)
cd backend && npm audit

# Fix automatically (if possible)
cd backend && npm audit fix

# Rust (cargo)
cargo install cargo-audit
cargo audit

# Check outdated dependencies
cargo outdated
```

### Update Dependencies
```bash
# Update package-lock.json
cd backend && npm update

# Update Cargo.lock
cargo update

# Check for breaking changes before committing!
```

## 🐳 Docker

### Build Images Locally
```bash
# Backend
cd backend
docker build -t bore-backend:local .

# Test the image
docker run -p 3000:3000 --env-file .env bore-backend:local

# Check logs
docker logs -f <container-id>
```

### Docker Compose
```bash
# Start all services
cd backend && docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes (clean slate)
docker-compose down -v
```

### Pull Published Images
```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/owner/bore-backend:latest
docker pull ghcr.io/owner/bore-client:latest
docker pull ghcr.io/owner/bore-server:latest

# Run
docker run -p 3000:3000 ghcr.io/owner/bore-backend:latest
```

## 📊 Monitoring

### View CI Status
```bash
# GitHub CLI
gh run list --workflow=backend-ci.yml
gh run list --workflow=ci.yml
gh run list --workflow=integration.yml

# Watch specific run
gh run watch <run-id>

# View logs
gh run view <run-id> --log
```

### Metrics Endpoint
```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# Filter for specific metric
curl http://localhost:3000/metrics | grep api_requests

# Health with dependencies
curl http://localhost:3000/health | jq
```

## 🐛 Debugging

### Enable Debug Logging
```bash
# Backend
LOG_LEVEL=debug npm run dev

# Rust client
RUST_LOG=debug bore 8080 --to server.com

# Rust server
RUST_LOG=debug bore-server

# Very verbose (trace level)
RUST_LOG=trace bore-server
```

### Inspect Database
```bash
# Connect to database
psql -h localhost -U postgres -d bore_db

# View tables
\dt

# View specific data
SELECT * FROM users LIMIT 5;
SELECT * FROM instances WHERE user_id = '<id>';
SELECT * FROM status_history ORDER BY timestamp DESC LIMIT 10;

# Check query performance
EXPLAIN ANALYZE SELECT * FROM instances WHERE status = 'active';
```

### Network Debugging
```bash
# Monitor port 7835 (bore-server control port)
sudo tcpdump -i any -n port 7835

# Check connections
sudo netstat -anp | grep 7835

# Test connectivity
telnet localhost 7835
nc -zv localhost 7835

# DNS resolution
dig your-server.com
nslookup your-server.com
```

## 📦 Dependency Management

### Check Versions
```bash
# Backend
cd backend && npm outdated

# Rust
cargo outdated

# System tools
node --version  # Should be 18+
npm --version
rustc --version
cargo --version
psql --version  # Should be 14+
redis-cli --version  # Should be 7+
```

### Update Process
```bash
# 1. Update dependencies
cd backend && npm update
cargo update

# 2. Run tests
npm test
cargo test

# 3. Check for issues
npm audit
cargo audit

# 4. Commit if all passes
git add Cargo.lock backend/package-lock.json
git commit -m "chore: update dependencies"
```

## 🎯 Common Tasks

### Add New Test
```bash
# Backend test
cat > backend/tests/my-feature.test.ts << 'EOF'
import request from 'supertest';
import { app } from '../server';

describe('My Feature', () => {
  test('should work correctly', async () => {
    const response = await request(app).get('/api/v1/my-feature');
    expect(response.status).toBe(200);
  });
});
EOF

# Run it
cd backend && npm test my-feature.test.ts
```

### Add New CI Step
```yaml
# Edit .github/workflows/backend-ci.yml
- name: My Custom Step
  working-directory: backend
  run: npm run my-custom-script
```

### View Coverage Report
```bash
# Generate coverage
cd backend && npm test

# Open HTML report
open backend/coverage/lcov-report/index.html

# View summary
cat backend/coverage/coverage-summary.json | jq
```

## 💡 Tips & Tricks

### Fast Iteration
```bash
# Use watch mode for tests
cd backend && npm test -- --watch

# Use nodemon for auto-restart
cd backend && npm run dev  # Already configured

# Rust fast compile (debug build)
cargo build  # Much faster than --release
```

### Parallel Testing
```bash
# Backend (default behavior with Jest)
cd backend && npm test

# Rust (parallel by default)
cargo test

# Rust single-threaded (for debugging)
cargo test -- --test-threads=1
```

### Clean Slate
```bash
# Clean all build artifacts
cargo clean
cd backend && rm -rf node_modules dist coverage
cd .. && rm -rf target

# Rebuild everything
cargo build --workspace
cd backend && npm ci && npm run build
```

---

**Last Updated**: October 2025  
**For Full Details**: See `IMPROVEMENTS_SUMMARY.md` and `TROUBLESHOOTING.md`

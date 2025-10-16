# Bore Backend - Quick Start Guide

Get up and running with the Bore backend in minutes.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+
- Redis (optional, for horizontal scaling)

## Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

Key settings:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=your-password

# Security
JWT_SECRET=your-secret-key-change-in-production
INTERNAL_API_KEY=your-internal-key

# Redis (optional)
REDIS_ENABLED=false
```

### 3. Setup Database

```bash
# Create database
createdb bore_db

# Run migrations (NEW preferred method)
npm run migrate:up

# Or use the helper script
./scripts/run-migrations.sh
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server starts at: **http://localhost:3000**

## Verify Installation

### Check Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "disabled" }
  }
}
```

### View API Documentation

Open in browser: **http://localhost:3000/api/v1/docs**

### Run Tests

```bash
# Unit tests
npm run test:unit

# Setup test database
./scripts/setup-test-db.sh

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## Common Tasks

### Create a User

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

### Create an Instance

```bash
# Login first to get token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!"}' \
  | jq -r '.token')

# Create instance
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Instance",
    "localPort": 8080,
    "region": "us-east-1"
  }'
```

### Database Operations

```bash
# Check migration status
npm run migrate

# Apply migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create add-new-feature
```

## Development Workflow

### 1. Make Changes

Edit files in your favorite editor.

### 2. Test Changes

```bash
# Run tests
npm run test:watch

# Manual testing with curl or Postman
```

### 3. Check Code Quality

```bash
# Type checking (if using TypeScript)
npm run type-check

# Linting
npm run lint
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
git push
```

## Project Structure

```
backend/
├── config.js              # Configuration management
├── database.js            # Database connection and helpers
├── server.js              # Main server file
├── routes/                # API route handlers
│   ├── auth-routes.js
│   ├── instance-routes.js
│   ├── admin-routes.js
│   └── internal-routes.js
├── middleware/            # Express middleware
├── utils/                 # Utility functions
├── services/              # Business logic services
├── migrations/            # Database migrations
├── tests/                 # Test files
│   ├── e2e/              # End-to-end tests
│   └── *.test.js         # Unit tests
└── scripts/              # Helper scripts
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout user

### Instances
- `GET /api/v1/instances` - List user instances
- `POST /api/v1/instances` - Create instance
- `GET /api/v1/instances/:id` - Get instance details
- `POST /api/v1/instances/:id/start` - Start instance
- `POST /api/v1/instances/:id/stop` - Stop instance
- `DELETE /api/v1/instances/:id` - Delete instance

### Admin
- `GET /api/v1/admin/users` - List all users (admin only)
- `GET /api/v1/admin/instances` - List all instances (admin only)

### Internal
- `POST /api/v1/internal/heartbeat/:id` - Instance heartbeat

### Documentation
- `GET /api/v1/docs` - Interactive API documentation

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Test connection
psql -U postgres -c "SELECT 1"
```

### Migrations Out of Sync

```bash
# Check status
npm run migrate

# If needed, reset (⚠️ loses data)
psql -U postgres -c "DROP DATABASE bore_db"
createdb bore_db
npm run migrate:up
```

### Tests Failing

```bash
# Clean test database
./scripts/teardown-test-db.sh
./scripts/setup-test-db.sh

# Run tests again
npm run test:e2e
```

## Next Steps

- **Read the docs**: Check `IMPLEMENTATION_SUMMARY.md` for features
- **Explore API**: Visit http://localhost:3000/api/v1/docs
- **Write tests**: Add tests in `tests/` directory
- **Create migrations**: Use `npm run migrate:create`
- **Deploy**: See deployment guides in `docs/`

## Getting Help

- **Documentation**: Check `*.md` files in backend directory
- **API Docs**: http://localhost:3000/api/v1/docs
- **Issues**: File issues on GitHub
- **Tests**: Run `npm test` to see examples

## Quick Reference

```bash
# Development
npm run dev              # Start with auto-reload
npm run test:watch       # Tests in watch mode

# Database
npm run migrate:up       # Apply migrations
npm run migrate:down     # Rollback migration
npm run migrate:create   # Create new migration

# Testing
npm run test:unit        # Unit tests only
npm run test:e2e         # E2E tests only
npm run test:all         # All tests

# Production
npm start                # Start server
npm run build            # Build (if using TypeScript)
```

---

**You're all set! 🚀**

Start developing with `npm run dev` and visit http://localhost:3000/api/v1/docs to explore the API.

# Migration System Quick Reference

## ✅ Yes, It Works Everywhere!

Your migration system now works correctly in:
- ✅ GitHub Actions CI
- ✅ `make docker-up` (local Docker)
- ✅ Fresh server deployments
- ✅ Local development

## 🚀 How It Works

### GitHub Actions CI
```yaml
# Automatically runs migrations with:
env:
  CI: true
  DB_HOST: localhost
  DB_PASSWORD: postgres
run: npm run migrate:up
```

### Docker Compose
```bash
# Automatically runs migrations on container startup via docker-entrypoint.sh
make docker-up
# No manual migration needed!
```

### Fresh Server
```bash
git clone <repo>
cd bore/backend
cp .env.example .env
cd ..
make docker-up
# Everything works automatically!
```

## 🔧 Key Files Changed

1. **backend/database.config.ts**
   - Added `stringEnv()` helper
   - Changed to `module.exports`
   - Handles CI and non-CI environments

2. **backend/migrations/**
   - Renamed: `add_banned_column.sql` → `1729080001000_add_banned_column.sql`
   - Proper timestamp ordering

3. **backend/Dockerfile**
   - Added entrypoint script
   - Runs migrations automatically

4. **backend/docker-entrypoint.sh** (NEW)
   - Waits for PostgreSQL
   - Runs migrations
   - Starts application

5. **backend/package.json**
   - Changed `-c` to `-f` flag

## 📝 Migration Commands

```bash
# Run pending migrations
npm run migrate:up

# Create new migration
npm run migrate:create my-migration-name

# Rollback last migration
npm run migrate:down

# Mark existing schema as migrated (one-time)
bash scripts/mark-migrations-complete.sh

# Reset database (⚠️ deletes all data)
bash scripts/reset-database.sh
```

## 🎯 What Was Fixed

| Issue | Fix |
|-------|-----|
| "client password must be a string" | Added `stringEnv()` helper + `module.exports` |
| "relation 'users' does not exist" | Added timestamp prefix to migration file |
| "relation 'users' already exists" | Created `mark-migrations-complete.sh` script |
| Docker doesn't run migrations | Added `docker-entrypoint.sh` |
| CI uses wrong config | Added CI detection in `database.config.ts` |

## 🔍 Verify It Works

```bash
# Check migrations in Docker
docker exec bore-backend npm run migrate:up

# Check migration status
docker exec bore-backend node -e "const {Pool} = require('pg'); const pool = new Pool({host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD}); pool.query('SELECT * FROM pgmigrations').then(r => console.log(r.rows));"
```

## 🎉 Bottom Line

**Yes, it will work when you move the project to another server!**

Just run `make docker-up` and everything is handled automatically:
- ✅ Database migrations run on startup
- ✅ Environment variables loaded from `.env`
- ✅ No manual steps required
- ✅ Idempotent (safe to restart)

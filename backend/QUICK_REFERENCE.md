# 🚀 Quick Reference Card

One-page reference for all commands and features.

---

## ⚡ Super Quick Start

```bash
npm run setup        # Does EVERYTHING automatically
npm run dev          # Start developing
```

Open: http://localhost:3000/api/v1/docs

**That's it!** 🎉

---

## 📋 Common Commands

### Development
```bash
npm run dev          # Start with auto-reload
npm start            # Production mode
npm run lint         # Check code style
```

### Testing
```bash
npm run test:unit    # Unit tests only
npm run test:e2e     # E2E tests (self-contained!)
npm run test:all     # Everything
npm run test:watch   # Watch mode
```

### Database
```bash
npm run migrate:up       # Apply migrations
npm run migrate:down     # Rollback last
npm run migrate:create   # Create new migration
npm run seed:test        # Seed test data
npm run seed:clear       # Clear test data
```

### Utilities
```bash
npm run setup                  # Complete setup
npm run benchmark:migrations   # Performance check
./scripts/verify-setup.sh      # Verify installation
```

---

## 🎯 Common Tasks

### First Time Setup
```bash
git clone <repo> && cd backend
npm run setup
npm run dev
```

### Add Database Table
```bash
npm run migrate:create add-my-table
# Edit migrations/[timestamp]_add-my-table.js
npm run migrate:up
```

### Run Tests
```bash
npm run test:all  # Everything
# Or individually:
npm run test:unit
npm run test:e2e
```

### Check Performance
```bash
npm run benchmark:migrations
```

---

## 📁 Important Files

```
backend/
├── server.js                 # Main server
├── database.js               # Database layer
├── config.js                 # Configuration
├── package.json              # Dependencies & scripts
├── migrations/               # Database migrations
│   ├── 1729080000000_initial-schema.js
│   └── example-typescript.ts
├── routes/                   # API routes
│   ├── auth-routes.js
│   ├── instance-routes.js
│   └── internal-routes.js
├── tests/
│   ├── e2e/                  # E2E tests (self-contained)
│   └── fixtures/             # Test data seeding
└── scripts/
    ├── setup-everything.sh   # One-command setup
    ├── verify-setup.sh       # Verification
    └── benchmark-migrations.js
```

---

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=your-password

# Security
JWT_SECRET=your-secret-key
INTERNAL_API_KEY=your-internal-key

# Redis (optional)
REDIS_ENABLED=false
```

---

## 🧪 Testing Workflow

```bash
# Setup test DB (one time)
npm run setup

# Seed test data
npm run seed:test

# Run tests (self-contained, no manual server!)
npm run test:e2e

# Clear test data
npm run seed:clear
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `QUICKSTART.md` | 2-minute getting started |
| `README_UPDATES.md` | What's new |
| `IMPLEMENTATION_SUMMARY.md` | Complete feature guide |
| `10_OUT_OF_10_IMPROVEMENTS.md` | Latest improvements |
| `FEATURE_STATUS.md` | Status of all features |
| `CHANGES.md` | Detailed changelog |
| `QUICK_REFERENCE.md` | This file |

---

## 🆘 Troubleshooting

### Server won't start
```bash
./scripts/verify-setup.sh
```

### Tests failing
```bash
npm run setup  # Re-run setup
```

### Database issues
```bash
npm run migrate:up  # Apply migrations
```

### Port already in use
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 🎯 CI/CD

```yaml
- name: Setup
  run: npm run setup

- name: Test
  run: npm run test:all

- name: Benchmark
  run: npm run benchmark:migrations
```

---

## 🌟 Features

- ✅ Database migrations (version-controlled schema)
- ✅ Self-contained E2E tests (no manual server)
- ✅ One-command setup (automatic everything)
- ✅ Test data seeding (consistent fixtures)
- ✅ Performance benchmarks (migration timing)
- ✅ TypeScript examples (migration guide)
- ✅ Mandatory API docs (always available)
- ✅ Comprehensive documentation

---

## 📊 Quick Health Check

```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy"}

curl http://localhost:3000/api/v1/docs/
# Should return: HTML (Swagger UI)

npm run test:all
# Should pass all tests
```

---

## 🎓 Learning Path

1. **Day 1:** `QUICKSTART.md` → Run `npm run setup`
2. **Day 2:** `README_UPDATES.md` → Understand features
3. **Week 1:** `IMPLEMENTATION_SUMMARY.md` → Deep dive
4. **Ongoing:** Use this `QUICK_REFERENCE.md` daily

---

## 💡 Pro Tips

```bash
# Use watch mode for development
npm run test:watch

# Check what changed
git diff --stat

# Benchmark before deploying
npm run benchmark:migrations

# Verify setup after updates
./scripts/verify-setup.sh

# Seed data for manual testing
npm run seed:test
```

---

## 🚨 Common Gotchas

1. **Forgot to run setup?** → `npm run setup`
2. **Tests need server?** → No! Tests are self-contained now
3. **Migration syntax?** → See `migrations/example-typescript.ts`
4. **Need test data?** → `npm run seed:test`
5. **How fast are migrations?** → `npm run benchmark:migrations`

---

## 📞 Quick Help

| Problem | Solution |
|---------|----------|
| Dependencies missing | `npm install` |
| Database not setup | `npm run migrate:up` |
| Tests failing | `npm run setup` |
| Port in use | `lsof -i :3000 && kill -9 <PID>` |
| Need test data | `npm run seed:test` |
| Check setup | `./scripts/verify-setup.sh` |

---

## 🎉 TL;DR

```bash
# Everything you need:
npm run setup        # Setup
npm run dev          # Develop
npm run test:all     # Test
npm run benchmark:migrations  # Benchmark

# That's it! 🚀
```

---

**Keep this card handy for daily development!** 📋

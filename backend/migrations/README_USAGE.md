# Database Migration Usage Guide

This guide shows practical examples of how to use migrations for common database changes.

## Quick Start

### 1. Run Existing Migrations
```bash
# Apply all pending migrations
npm run migrate:up

# Check migration status
npm run migrate
```

### 2. Create a New Migration
```bash
# Create a new migration file
npm run migrate:create add-user-preferences
```

This creates a file like: `migrations/1729080123456_add-user-preferences.js`

## Common Migration Patterns

### Adding a Column

```javascript
exports.up = (pgm) => {
  pgm.addColumn('users', {
    phone: { type: 'varchar(20)' },
    timezone: { type: 'varchar(50)', default: "'UTC'" }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', ['phone', 'timezone']);
};
```

### Creating a New Table

```javascript
exports.up = (pgm) => {
  pgm.createTable('api_keys', {
    id: 'id',
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    key_hash: { type: 'varchar(255)', notNull: true },
    name: { type: 'varchar(100)', notNull: true },
    last_used: { type: 'timestamp' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('api_keys', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('api_keys');
};
```

### Modifying a Column

```javascript
exports.up = (pgm) => {
  // Change email column max length
  pgm.alterColumn('users', 'email', {
    type: 'varchar(320)', // Updated RFC 5321 max
    notNull: true
  });
};

exports.down = (pgm) => {
  pgm.alterColumn('users', 'email', {
    type: 'varchar(255)',
    notNull: true
  });
};
```

### Adding an Index

```javascript
exports.up = (pgm) => {
  pgm.createIndex('instances', ['user_id', 'created_at'], {
    name: 'idx_instances_user_created',
    method: 'btree'
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('instances', ['user_id', 'created_at'], {
    name: 'idx_instances_user_created'
  });
};
```

### Data Migration

```javascript
exports.up = async (pgm) => {
  // Add new column with default
  pgm.addColumn('instances', {
    is_active: { type: 'boolean', default: false }
  });

  // Update existing data
  pgm.sql(`
    UPDATE instances 
    SET is_active = true 
    WHERE status = 'active'
  `);

  // Make column NOT NULL after data migration
  pgm.alterColumn('instances', 'is_active', {
    notNull: true
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('instances', 'is_active');
};
```

### Renaming a Column

```javascript
exports.up = (pgm) => {
  pgm.renameColumn('instances', 'server_host', 'bore_server_host');
};

exports.down = (pgm) => {
  pgm.renameColumn('instances', 'bore_server_host', 'server_host');
};
```

## Production Deployment Workflow

### Step 1: Test Locally
```bash
# Apply migration to local dev database
npm run migrate:up

# Verify it works
npm test

# Rollback to test down migration
npm run migrate:down

# Reapply
npm run migrate:up
```

### Step 2: Deploy to Staging
```bash
# SSH into staging server
ssh staging-server

# Pull latest code
git pull origin main

# Run migrations
npm run migrate:up

# Verify application works
curl http://localhost:3000/health
```

### Step 3: Deploy to Production
```bash
# ALWAYS backup database first!
pg_dump -U postgres bore_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migrations
npm run migrate:up

# Monitor logs
pm2 logs bore-backend

# If issues occur, rollback
npm run migrate:down
```

## Best Practices

### ✅ DO

1. **Always provide both up and down**
   - Every migration must be reversible
   - Test both directions

2. **One logical change per migration**
   - Keep migrations focused
   - Easier to debug and rollback

3. **Use transactions for data changes**
   - Migrations run in transactions by default
   - Use `pgm.noTransaction()` only if necessary

4. **Test with production-like data**
   - Import production data snapshot
   - Test migration performance

5. **Document complex migrations**
   - Add comments explaining the "why"
   - Include ticket/issue numbers

### ❌ DON'T

1. **Never modify existing migrations**
   - Once deployed, treat as immutable
   - Create new migration to fix issues

2. **Don't use application code**
   - Keep migrations pure SQL/pgm operations
   - Don't import application models

3. **Avoid long-running migrations**
   - Large data changes should be batched
   - Consider background jobs for huge datasets

4. **Don't forget indexes**
   - Add indexes in same migration as new columns
   - Consider existing data size

## Troubleshooting

### Migration Failed Mid-Run

```bash
# Check what happened
npm run migrate

# If needed, manually mark as complete/incomplete
psql -d bore_db
SELECT * FROM pgmigrations ORDER BY run_on DESC;

# Remove failed migration record
DELETE FROM pgmigrations WHERE name = 'failed-migration-name';

# Fix the migration file and retry
npm run migrate:up
```

### Database Out of Sync

```bash
# Check migration status
npm run migrate

# Compare with actual schema
psql -d bore_db -c "\dt"  # List tables
psql -d bore_db -c "\d+ table_name"  # Describe table

# If needed, manually sync or start fresh
```

### Performance Issues

```bash
# Add EXPLAIN to understand query plans
exports.up = (pgm) => {
  pgm.sql('EXPLAIN ANALYZE SELECT * FROM large_table');
  
  // Your migration
};
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Database Migrations
  run: |
    npm run migrate:up
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Verify Migration
  run: |
    npm run test:integration
```

### Docker Example

```dockerfile
# In your Dockerfile
RUN npm run migrate:up

# Or in docker-compose.yml
services:
  backend:
    command: sh -c "npm run migrate:up && npm start"
```

## Reference

- [node-pg-migrate docs](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Migration best practices](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)

# Database Migrations

This directory contains database migration files for schema versioning and management.

## Overview

We use `node-pg-migrate` to manage database schema changes. Migrations ensure that database changes are version-controlled, reversible, and can be applied consistently across environments.

## Usage

### Creating a New Migration

```bash
npm run migrate:create <migration-name>
```

Example:
```bash
npm run migrate:create add-user-preferences-table
```

This will create a new migration file in the `migrations/` directory with a timestamp prefix.

### Running Migrations

Apply all pending migrations:
```bash
npm run migrate:up
```

Apply specific number of migrations:
```bash
npm run migrate:up 2  # Apply next 2 migrations
```

### Rolling Back Migrations

Rollback the last migration:
```bash
npm run migrate:down
```

Rollback specific number of migrations:
```bash
npm run migrate:down 2  # Rollback last 2 migrations
```

## Migration File Structure

Each migration file exports two functions:

```javascript
exports.up = (pgm) => {
  // Schema changes to apply
  pgm.createTable('example', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
};

exports.down = (pgm) => {
  // Reverse the changes (for rollback)
  pgm.dropTable('example');
};
```

## Environment Configuration

Set the `DATABASE_URL` environment variable or use individual database connection variables in `.env`:

```bash
# Option 1: Connection string
DATABASE_URL=postgres://user:password@localhost:5432/bore_db

# Option 2: Individual variables (used by config.js)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bore_db
DB_USER=postgres
DB_PASSWORD=your-password
```

## Best Practices

1. **Always provide both `up` and `down` functions** - Ensure migrations are reversible
2. **One logical change per migration** - Keep migrations focused and atomic
3. **Test migrations** - Test both up and down migrations in development
4. **Never modify existing migrations** - Create a new migration to fix issues
5. **Run migrations in CI/CD** - Automate migration execution in deployment pipelines
6. **Back up before production migrations** - Always backup production database before running migrations

## Migration Tracking

Migrations are tracked in the `pgmigrations` table, which stores:
- Migration ID
- Migration name
- Applied timestamp

## Existing Schema

The current schema is managed by `database.js`. Future schema changes should be made through migrations for better version control.

## Common Commands

```bash
# Create a new migration
npm run migrate:create add-new-column

# Apply all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Get migration status
npm run migrate

# Apply migrations in production
NODE_ENV=production npm run migrate:up
```

## Example Migrations

### Adding a Column
```javascript
exports.up = (pgm) => {
  pgm.addColumn('users', {
    phone: { type: 'varchar(20)', notNull: false }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'phone');
};
```

### Creating an Index
```javascript
exports.up = (pgm) => {
  pgm.createIndex('instances', 'user_id', { name: 'idx_instances_user' });
};

exports.down = (pgm) => {
  pgm.dropIndex('instances', 'user_id', { name: 'idx_instances_user' });
};
```

### Modifying a Column
```javascript
exports.up = (pgm) => {
  pgm.alterColumn('users', 'email', {
    type: 'varchar(320)',  // Updated max email length
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

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message
2. Fix the migration file
3. Rollback if needed: `npm run migrate:down`
4. Reapply after fixing: `npm run migrate:up`

### Out of Sync
If your database is out of sync with migrations:
1. Check migration status: `npm run migrate`
2. Compare with `pgmigrations` table
3. Manually adjust if necessary (last resort)

## Resources

- [node-pg-migrate Documentation](https://github.com/salsita/node-pg-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

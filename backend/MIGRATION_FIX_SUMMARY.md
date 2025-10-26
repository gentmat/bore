# Migration Fix Summary

## Issues Fixed

### 1. Migration Ordering Issue
**Problem**: `add_banned_column.sql` lacked a timestamp prefix, causing it to run before `1729080000000_initial-schema.ts`, resulting in "relation 'users' does not exist" error.

**Fix**: Renamed `add_banned_column.sql` → `1729080001000_add_banned_column.sql`

### 2. Database Configuration Loading
**Problem**: `node-pg-migrate` couldn't load the TypeScript config file properly, causing "client password must be a string" errors.

**Fixes Applied**:
- Changed from ES module export (`export =`) to CommonJS (`module.exports`)
- Added `stringEnv()` helper to ensure all DB config values are properly typed as strings
- Changed npm scripts to use `-f` flag instead of `-c` for config file
- Removed unused `MigrationConfig` interface that was causing TypeScript compilation errors

### 3. Legacy Schema Conflict
**Problem**: Database had tables from legacy initialization code, conflicting with migrations.

**Solution**: Created `scripts/mark-migrations-complete.sh` to mark existing schema as migrated without re-running migrations.

## Files Modified

1. **backend/migrations/add_banned_column.sql** → **backend/migrations/1729080001000_add_banned_column.sql**
   - Renamed to include timestamp prefix for proper ordering

2. **backend/database.config.ts**
   - Added `stringEnv()` helper function
   - Updated all config value assignments to use `stringEnv()`
   - Changed from `export =` to `module.exports`
   - Removed unused `MigrationConfig` interface

3. **backend/package.json**
   - Updated migration scripts to use `-f` flag instead of `-c`

## New Scripts Created

1. **backend/scripts/mark-migrations-complete.sh**
   - Marks existing migrations as complete without re-running them
   - Useful when database schema is already up to date

2. **backend/scripts/reset-database.sh**
   - Drops all tables and re-runs migrations from scratch
   - ⚠️ WARNING: Deletes all data!

## Current Status

✅ All migrations are now working correctly
✅ `npm run migrate:up` runs successfully
✅ Migration tracking is properly configured

## Migration Files

1. `1729080000000_initial-schema.ts` - Creates all core tables
2. `1729080001000_add_banned_column.sql` - Adds `is_banned` column and `audit_logs` table

## Usage

```bash
# Run pending migrations
npm run migrate:up

# Create a new migration
npm run migrate:create <migration-name>

# Rollback last migration
npm run migrate:down

# Mark existing schema as migrated (one-time use)
bash scripts/mark-migrations-complete.sh

# Reset database (⚠️ deletes all data)
bash scripts/reset-database.sh
```

## Technical Details

### Why the password error occurred:
- `node-pg-migrate` loads config files using CommonJS `require()`
- TypeScript's `export =` syntax wasn't being properly transpiled for CommonJS consumption
- The pg library requires password to be a string type, but undefined values were being passed

### Why migration ordering matters:
- Migrations run in alphanumeric order by filename
- Without timestamp prefix, `add_banned_column` sorted before `1729080000000_initial-schema`
- This caused it to try adding a column to a table that didn't exist yet

/**
 * Example TypeScript Migration
 * Demonstrates how to write migrations in TypeScript
 * 
 * To use TypeScript migrations:
 * 1. Install ts-node: npm install --save-dev ts-node
 * 2. Create migrations with .ts extension
 * 3. Run migrations with: node-pg-migrate up -t ts-node/register
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Add API keys table for programmatic access
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create api_keys table with TypeScript type safety
  pgm.createTable('api_keys', {
    id: 'id',
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    key_name: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Human-readable name for the API key',
    },
    key_hash: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Hashed API key (never store plain text)',
    },
    key_prefix: {
      type: 'varchar(10)',
      notNull: true,
      comment: 'First few characters for identification',
    },
    scopes: {
      type: 'text[]',
      notNull: true,
      default: '{}',
      comment: 'Permissions granted to this key',
    },
    last_used_at: {
      type: 'timestamp',
      comment: 'Last time this key was used',
    },
    expires_at: {
      type: 'timestamp',
      comment: 'Optional expiration date',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create indexes for performance
  pgm.createIndex('api_keys', 'user_id', {
    name: 'idx_api_keys_user',
  });

  pgm.createIndex('api_keys', 'key_hash', {
    name: 'idx_api_keys_hash',
    unique: true,
  });

  pgm.createIndex('api_keys', ['user_id', 'is_active'], {
    name: 'idx_api_keys_user_active',
  });

  // Add comment to table
  pgm.sql(`
    COMMENT ON TABLE api_keys IS 
    'API keys for programmatic access to the Bore API';
  `);

  // Create function to update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger to auto-update updated_at
  pgm.sql(`
    CREATE TRIGGER api_keys_updated_at_trigger
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();
  `);

  // eslint-disable-next-line no-console
  console.log('✅ API keys table created with TypeScript migration');
}

/**
 * Rollback: Remove API keys table
 */
export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop trigger first
  pgm.sql('DROP TRIGGER IF EXISTS api_keys_updated_at_trigger ON api_keys;');

  // Drop function
  pgm.sql('DROP FUNCTION IF EXISTS update_api_keys_updated_at();');

  // Drop table (indexes are automatically dropped)
  pgm.dropTable('api_keys');

  // eslint-disable-next-line no-console
  console.log('✅ API keys table removed');
}

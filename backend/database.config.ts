/**
 * node-pg-migrate configuration
 * Configuration for database migrations
 */

// Only load dotenv in non-CI environments
if (!process.env.CI) {
  import('dotenv').then(dotenv => {
    dotenv.config();
  });
}

interface MigrationConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  dir: string;
  migrationsTable: string;
  checkOrder: boolean;
  ignorePattern: string;
  'migration-file-language': string;
  timestamp: boolean;
}

const migrationConfig: MigrationConfig = {
  // Database connection settings
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bore_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  
  // Migration settings
  dir: 'migrations',
  migrationsTable: 'pgmigrations',
  checkOrder: true,
  ignorePattern: '.*\\.map$|README\\.md',
  
  // Create migration files with TypeScript
  'migration-file-language': 'ts',
  
  // Timestamp format
  timestamp: true,
};

export = migrationConfig;

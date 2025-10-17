/**
 * node-pg-migrate configuration
 * Configuration for database migrations
 */

import dotenv from 'dotenv';
dotenv.config();

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
  // In CI/CD, prioritize CI environment variables over .env file
  host: process.env.CI ? 'localhost' : (process.env.DB_HOST || 'localhost'),
  port: parseInt(process.env.CI ? '5432' : (process.env.DB_PORT || '5432'), 10),
  database: process.env.CI ? 'bore_test' : (process.env.DB_NAME || 'bore_db'),
  user: process.env.CI ? 'postgres' : (process.env.DB_USER || 'postgres'),
  password: process.env.CI ? 'postgres' : (process.env.DB_PASSWORD || 'postgres'),
  
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

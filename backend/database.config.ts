/**
 * node-pg-migrate configuration
 * Configuration for database migrations
 */

import dotenv from 'dotenv';

// Only load dotenv in non-CI environments
if (!process.env.CI) {
  dotenv.config();
}


const stringEnv = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return fallback;
};

// Parse DATABASE_URL if available, otherwise use individual variables
// In CI environments, completely ignore DATABASE_URL and only use explicit variables
const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  // In CI, ALWAYS use explicit environment variables and completely ignore DATABASE_URL
  if (isCI) {
    // eslint-disable-next-line no-console
    console.log('🔧 CI Environment: Using explicit DB_* variables, ignoring DATABASE_URL');
    const config = {
      host: stringEnv(process.env.DB_HOST, 'localhost'),
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: stringEnv(process.env.DB_NAME, 'bore_db'),
      user: stringEnv(process.env.DB_USER, 'postgres'),
      password: stringEnv(process.env.DB_PASSWORD, 'postgres'),
    };
    // eslint-disable-next-line no-console
    console.log('🔧 CI DB Config:', { ...config, password: '***' });
    return config;
  }

  // In non-CI, use DATABASE_URL if available
  if (databaseUrl) {
    // eslint-disable-next-line no-console
    console.log('🔧 Non-CI Environment: Using DATABASE_URL');
    // Parse DATABASE_URL: postgresql://user:password@host:port/database
    const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
      return {
        host: stringEnv(match[3], 'localhost'),
        port: parseInt(match[4] || '5432', 10),
        database: stringEnv(match[5], 'bore_db'),
        user: stringEnv(match[1], 'postgres'),
        password: stringEnv(match[2], 'postgres'),
      };
    }
  }

  // Fallback to individual environment variables
  // eslint-disable-next-line no-console
  console.log('🔧 Fallback: Using individual DB_* variables');
  return {
    host: stringEnv(process.env.DB_HOST, 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: stringEnv(process.env.DB_NAME, 'bore_db'),
    user: stringEnv(process.env.DB_USER, 'postgres'),
    password: stringEnv(process.env.DB_PASSWORD, 'postgres'),
  };
};

const dbConfig = getDatabaseConfig();

const migrationConfig = {
  // Database connection settings
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  
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

module.exports = migrationConfig;

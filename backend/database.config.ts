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
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bore_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
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
        host: match[3] || 'localhost',
        port: parseInt(match[4] || '5432', 10),
        database: match[5] || 'bore_db',
        user: match[1] || 'postgres',
        password: match[2] || 'postgres',
      };
    }
  }

  // Fallback to individual environment variables
  // eslint-disable-next-line no-console
  console.log('🔧 Fallback: Using individual DB_* variables');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'bore_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
};

const dbConfig = getDatabaseConfig();

const migrationConfig: MigrationConfig = {
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

export = migrationConfig;

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
// In CI environments, prioritize individual environment variables over DATABASE_URL
const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;
  const isCI = process.env.CI === 'true';

  // Debug logging for CI environments
  if (isCI) {
    console.log('CI Environment Detected:');
    console.log('DATABASE_URL:', databaseUrl);
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_PORT:', process.env.DB_PORT);
  }

  // In CI, always use explicit environment variables and ignore DATABASE_URL completely
  if (isCI) {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bore_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

    if (isCI) {
      console.log('Final CI Config:', config);
    }

    return config;
  }

  // In non-CI, use DATABASE_URL if available
  if (databaseUrl) {
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

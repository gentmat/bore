/**
 * node-pg-migrate configuration
 * Configuration for database migrations
 */

require('dotenv').config();

module.exports = {
  // Database connection settings
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'bore_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  
  // Migration settings
  dir: 'migrations',
  migrationsTable: 'pgmigrations',
  checkOrder: true,
  ignorePattern: '.*\\.map$|README\\.md',
  
  // Create migration files with JS
  'migration-file-language': 'js',
  
  // Timestamp format
  timestamp: true,
};

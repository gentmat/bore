/**
 * E2E Test Setup
 * Global setup for end-to-end tests
 */

import { Pool } from 'pg';
import config from '../../config';

// Test database pool
let testDb: Pool | null = null;

/**
 * Setup test database before all tests
 */
async function setupTestDatabase(): Promise<Pool> {
  const dbName = process.env.TEST_DB_NAME || 'bore_db_test';
  
  // Connect to postgres database to create test database
  const adminDb = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: 'postgres',
    user: config.database.user,
    password: config.database.password,
  });

  try {
    // Check if test database exists
    const result = await adminDb.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create test database
      await adminDb.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Created test database: ${dbName}`);
    } else {
      console.log(`ℹ️  Test database already exists: ${dbName}`);
    }
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  } finally {
    await adminDb.end();
  }

  // Connect to test database
  testDb = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: dbName,
    user: config.database.user,
    password: config.database.password,
  });

  console.log('✅ Test database connection established');
  return testDb;
}

/**
 * Cleanup test database after all tests
 */
async function cleanupTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.end();
    console.log('✅ Test database connection closed');
  }
}

/**
 * Clear all test data between tests
 */
async function clearTestData(): Promise<void> {
  if (!testDb) return;

  try {
    // Delete in correct order to respect foreign keys
    await testDb.query('TRUNCATE TABLE refresh_tokens CASCADE');
    await testDb.query('TRUNCATE TABLE waitlist CASCADE');
    await testDb.query('TRUNCATE TABLE bore_servers CASCADE');
    await testDb.query('TRUNCATE TABLE alert_history CASCADE');
    await testDb.query('TRUNCATE TABLE tunnel_tokens CASCADE');
    await testDb.query('TRUNCATE TABLE health_metrics CASCADE');
    await testDb.query('TRUNCATE TABLE status_history CASCADE');
    await testDb.query('TRUNCATE TABLE instances CASCADE');
    await testDb.query('TRUNCATE TABLE users CASCADE');
    
    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('❌ Failed to clear test data:', error);
    throw error;
  }
}

export {
  setupTestDatabase,
  cleanupTestDatabase,
  clearTestData,
  testDb as getTestDb,
};

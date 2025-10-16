/**
 * Jest Global Teardown for E2E Tests
 * Stops server after all tests
 */

const { stopTestServer } = require('./test-server');
const { cleanupTestDatabase } = require('./setup');

module.exports = async () => {
  console.log('\n🧹 Cleaning up E2E test environment...\n');

  // Stop test server
  await stopTestServer();
  console.log('✅ Test server stopped');

  // Cleanup database connection
  await cleanupTestDatabase();
  console.log('✅ Database connections closed');

  console.log('\n✅ E2E test cleanup complete!\n');
};

/**
 * Jest Global Setup for E2E Tests
 * Starts server once before all tests
 */

const { startTestServer } = require('./test-server');
const { setupTestDatabase } = require('./setup');

module.exports = async () => {
  console.log('\n🔧 Setting up E2E test environment...\n');

  // Setup test database
  await setupTestDatabase();
  console.log('✅ Test database ready');

  // Start test server
  const { port } = await startTestServer(3001);
  console.log(`✅ Test server running on port ${port}`);

  // Store port in global for tests
  global.__TEST_PORT__ = port;

  console.log('\n✅ E2E test environment ready!\n');
};

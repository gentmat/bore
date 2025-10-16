/**
 * Jest After Environment Setup
 * Runs after environment is set up but before tests
 */

const { clearTestData } = require('./setup');

// Set test base URL from global
const TEST_PORT = global.__TEST_PORT__ || 3001;
global.TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// Clear test data before each test file
beforeAll(async () => {
  await clearTestData();
});

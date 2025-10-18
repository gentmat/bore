/**
 * Jest After Environment Setup
 * Runs after environment is set up but before tests
 */

import { clearTestData } from './setup';

// Set test base URL from global
const TEST_PORT = (global as Record<string, unknown>).__TEST_PORT__ || 3001;
(global as Record<string, unknown>).TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// Clear test data before each test file
beforeAll(async () => {
  await clearTestData();
});

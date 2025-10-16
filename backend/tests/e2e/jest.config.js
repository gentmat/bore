/**
 * Jest Configuration for E2E Tests
 * Configures test server lifecycle and environment
 */

module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.e2e.test.js'],
  globalSetup: './tests/e2e/jest.setup.js',
  globalTeardown: './tests/e2e/jest.teardown.js',
  setupFilesAfterEnv: ['./tests/e2e/jest.afterenv.js'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially for E2E
  forceExit: true,
  verbose: true,
};

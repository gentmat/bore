/**
 * Jest Configuration for E2E Tests
 * Configures test server lifecycle and environment
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.e2e.test.ts'],
  globalSetup: './tests/e2e/jest.setup.ts',
  globalTeardown: './tests/e2e/jest.teardown.ts',
  setupFilesAfterEnv: ['./tests/e2e/jest.afterenv.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially for E2E
  forceExit: true,
  verbose: true,
  preset: 'ts-jest',
};

export default config;

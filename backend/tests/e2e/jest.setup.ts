/**
 * Jest Global Setup for E2E Tests
 * Starts server once before all tests
 */

import { startTestServer } from './test-server';
import { setupTestDatabase } from './setup';

export default async (): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('\n🔧 Setting up E2E test environment...\n');

  // Setup test database
  await setupTestDatabase();
  // eslint-disable-next-line no-console
  console.log('✅ Test database ready');

  // Start test server
  const { port } = await startTestServer(3001);
  // eslint-disable-next-line no-console
  console.log(`✅ Test server running on port ${port}`);

  // Store port in global for tests
  (global as Record<string, unknown>).__TEST_PORT__ = port;

  // eslint-disable-next-line no-console
  console.log('\n✅ E2E test environment ready!\n');
};

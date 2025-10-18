/**
 * Jest Global Teardown for E2E Tests
 * Stops server after all tests
 */

import { stopTestServer } from './test-server';
import { cleanupTestDatabase } from './setup';

export default async (): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('\n🧹 Cleaning up E2E test environment...\n');

  // Stop test server
  await stopTestServer();
  // eslint-disable-next-line no-console
  console.log('✅ Test server stopped');

  // Cleanup database connection
  await cleanupTestDatabase();
  // eslint-disable-next-line no-console
  console.log('✅ Database connections closed');

  // eslint-disable-next-line no-console
  console.log('\n✅ E2E test cleanup complete!\n');
};

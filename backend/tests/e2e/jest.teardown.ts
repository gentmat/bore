/**
 * Jest Global Teardown for E2E Tests
 * Stops server after all tests
 */

import { stopTestServer } from './test-server';
import { cleanupTestDatabase } from './setup';

export default async (): Promise<void> => {
  console.log('\n🧹 Cleaning up E2E test environment...\n');

  // Stop test server
  await stopTestServer();
  console.log('✅ Test server stopped');

  // Cleanup database connection
  await cleanupTestDatabase();
  console.log('✅ Database connections closed');

  console.log('\n✅ E2E test cleanup complete!\n');
};

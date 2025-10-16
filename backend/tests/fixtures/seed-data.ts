/**
 * Test Seed Data Generator
 * Provides consistent test data
 */

import bcrypt from 'bcryptjs';

interface TestUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  plan: string;
  is_admin: boolean;
}

interface TestInstance {
  id: string;
  user_id: string;
  name: string;
  local_port: number;
  region: string;
  status: string;
}

interface TestServer {
  id: string;
  host: string;
  port: number;
  location: string;
  max_bandwidth_mbps: number;
  max_concurrent_tunnels: number;
  status: string;
}

function generateId(): string {
  return 'test-' + Math.random().toString(36).substring(2, 15);
}

async function generateTestUsers(): Promise<TestUser[]> {
  const hash = await bcrypt.hash('TestPassword123!', 10);
  return [
    {
      id: generateId(),
      email: 'user1@test.com',
      password_hash: hash,
      name: 'Test User One',
      plan: 'trial',
      is_admin: false,
    },
    {
      id: generateId(),
      email: 'user2@test.com',
      password_hash: hash,
      name: 'Test User Two',
      plan: 'pro',
      is_admin: false,
    },
    {
      id: generateId(),
      email: 'admin@test.com',
      password_hash: hash,
      name: 'Admin User',
      plan: 'enterprise',
      is_admin: true,
    },
  ];
}

function generateTestInstances(userId: string): TestInstance[] {
  return [
    {
      id: generateId(),
      user_id: userId,
      name: 'Dev Instance',
      local_port: 8080,
      region: 'us-east-1',
      status: 'inactive',
    },
    {
      id: generateId(),
      user_id: userId,
      name: 'Prod Instance',
      local_port: 3000,
      region: 'us-west-2',
      status: 'active',
    },
  ];
}

function generateTestServers(): TestServer[] {
  return [
    {
      id: generateId(),
      host: 'bore1.test.com',
      port: 7835,
      location: 'us-east-1',
      max_bandwidth_mbps: 1000,
      max_concurrent_tunnels: 100,
      status: 'active',
    },
    {
      id: generateId(),
      host: 'bore2.test.com',
      port: 7835,
      location: 'us-west-2',
      max_bandwidth_mbps: 1000,
      max_concurrent_tunnels: 100,
      status: 'active',
    },
  ];
}

export {
  generateTestUsers,
  generateTestInstances,
  generateTestServers,
  TestUser,
  TestInstance,
  TestServer
};

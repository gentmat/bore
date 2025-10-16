/**
 * Test Seed Data Generator
 * Provides consistent test data
 */

const bcrypt = require('bcryptjs');

function generateId() {
  return 'test-' + Math.random().toString(36).substring(2, 15);
}

async function generateTestUsers() {
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

function generateTestInstances(userId) {
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

function generateTestServers() {
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

module.exports = {
  generateTestUsers,
  generateTestInstances,
  generateTestServers,
};

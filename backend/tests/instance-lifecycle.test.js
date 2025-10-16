/**
 * Instance Lifecycle Integration Tests
 * Tests the complete flow: create → connect → heartbeat → disconnect
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { db } = require('../database');
const { generateToken } = require('../auth-middleware');
const instanceRoutes = require('../routes/instance-routes');

// Mock dependencies
jest.mock('../database');
jest.mock('../services/redis-service', () => ({
  client: {
    get: jest.fn(),
    setex: jest.fn(),
    delete: jest.fn()
  },
  heartbeats: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock('../server-registry', () => ({
  getBestServer: jest.fn().mockResolvedValue({
    id: 'server-1',
    host: 'bore.example.com',
    port: 7835,
    currentLoad: 10,
    maxConcurrentTunnels: 100,
    overallUtilization: 10
  }),
  getFleetStats: jest.fn().mockResolvedValue({
    serverCount: 1,
    totalCapacity: 100,
    totalLoad: 10,
    utilizationPercent: 10,
    servers: []
  })
}));

jest.mock('../config', () => ({
  boreServer: {
    host: 'bore.example.com',
    port: 7835
  },
  redis: {
    enabled: false
  },
  heartbeat: {
    timeout: 30000,
    idleTimeout: 1800
  },
  tokens: {
    tunnel: {
      expiresIn: 3600000
    }
  },
  capacity: {
    totalSystemCapacity: 100,
    reservedCapacityPercent: 20
  }
}));

// Create test app
function createTestApp() {
  const app = express();
  app.use(bodyParser.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    req.user = {
      user_id: 'user_test',
      email: 'test@example.com'
    };
    req.id = 'test-request-id';
    next();
  });
  
  app.use('/api/v1/instances', instanceRoutes.router);
  return app;
}

describe('Instance Lifecycle Integration Tests', () => {
  let app;
  const mockUser = {
    id: 'user_test',
    email: 'test@example.com',
    plan: 'pro',
    is_admin: false
  };

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    
    // Setup default mocks
    db.getUserById = jest.fn().mockResolvedValue(mockUser);
    db.query = jest.fn().mockResolvedValue({ rows: [{ count: 0, active: 0 }] });
  });

  describe('Complete Lifecycle: Create → Connect → Heartbeat → Disconnect', () => {
    it('should handle complete instance lifecycle successfully', async () => {
      const instanceId = 'inst_test_123';
      const mockInstance = {
        id: instanceId,
        user_id: 'user_test',
        name: 'Test Instance',
        local_port: 8080,
        region: 'us-east',
        server_host: 'bore.example.com',
        status: 'inactive',
        tunnel_connected: false,
        current_tunnel_token: null,
        created_at: new Date()
      };

      // STEP 1: Create instance
      db.createInstance = jest.fn().mockResolvedValue(mockInstance);
      
      const createResponse = await request(app)
        .post('/api/v1/instances')
        .send({
          name: 'Test Instance',
          local_port: 8080,
          region: 'us-east'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.id).toBe(instanceId);
      expect(createResponse.body.status).toBe('inactive');

      // STEP 2: Connect to instance
      db.getInstanceById = jest.fn().mockResolvedValue(mockInstance);
      db.saveTunnelToken = jest.fn().mockResolvedValue();
      db.deleteTunnelToken = jest.fn().mockResolvedValue();
      db.updateInstance = jest.fn().mockResolvedValue({
        ...mockInstance,
        current_tunnel_token: 'tunnel_token_123'
      });

      const connectResponse = await request(app)
        .post(`/api/v1/instances/${instanceId}/connect`);

      expect(connectResponse.status).toBe(200);
      expect(connectResponse.body).toHaveProperty('tunnel_token');
      expect(connectResponse.body).toHaveProperty('bore_server_host');
      expect(connectResponse.body.bore_server_host).toBe('bore.example.com');
      expect(connectResponse.body.bore_server_port).toBe(7835);

      // STEP 3: Send heartbeat
      const connectedInstance = {
        ...mockInstance,
        status: 'active',
        tunnel_connected: true
      };
      db.getInstanceById = jest.fn().mockResolvedValue(connectedInstance);
      db.saveHealthMetrics = jest.fn().mockResolvedValue();
      db.addStatusHistory = jest.fn().mockResolvedValue();
      db.getLatestHealthMetrics = jest.fn().mockResolvedValue({
        vscode_responsive: true,
        cpu_usage: 45.2,
        memory_usage: 2048576,
        has_code_server: true,
        last_activity: Math.floor(Date.now() / 1000) - 60
      });

      const heartbeatResponse = await request(app)
        .post(`/api/v1/instances/${instanceId}/heartbeat`)
        .send({
          vscode_responsive: true,
          cpu_usage: 45.2,
          memory_usage: 2048576,
          has_code_server: true,
          last_activity: Math.floor(Date.now() / 1000) - 60
        });

      expect(heartbeatResponse.status).toBe(200);
      expect(heartbeatResponse.body.success).toBe(true);
      expect(heartbeatResponse.body).toHaveProperty('status');

      // STEP 4: Disconnect instance
      db.getInstanceById = jest.fn().mockResolvedValue(connectedInstance);
      db.updateInstance = jest.fn().mockResolvedValue({
        ...mockInstance,
        status: 'inactive',
        tunnel_connected: false
      });

      const disconnectResponse = await request(app)
        .post(`/api/v1/instances/${instanceId}/disconnect`);

      expect(disconnectResponse.status).toBe(200);
      expect(disconnectResponse.body.success).toBe(true);

      // Verify tunnel token was deleted
      expect(db.deleteTunnelToken).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection to non-existent instance', async () => {
      db.getInstanceById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/instances/nonexistent_id/connect');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    });

    it('should handle heartbeat timeout scenario', async () => {
      const instanceId = 'inst_timeout_test';
      const mockInstance = {
        id: instanceId,
        user_id: 'user_test',
        name: 'Timeout Test',
        status: 'active',
        tunnel_connected: true
      };

      db.getInstanceById = jest.fn().mockResolvedValue(mockInstance);
      db.getLatestHealthMetrics = jest.fn().mockResolvedValue({
        vscode_responsive: false,
        has_code_server: true
      });
      db.updateInstance = jest.fn().mockResolvedValue();
      db.addStatusHistory = jest.fn().mockResolvedValue();
      db.saveHealthMetrics = jest.fn().mockResolvedValue();

      const response = await request(app)
        .post(`/api/v1/instances/${instanceId}/heartbeat`)
        .send({
          vscode_responsive: false,
          has_code_server: true
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.reason).toContain('VSCode');
    });

    it('should reject connection when user exceeds quota', async () => {
      // Mock user with 1 active tunnel (trial plan allows only 1)
      const trialUser = {
        ...mockUser,
        plan: 'trial'
      };
      
      db.getUserById = jest.fn().mockResolvedValue(trialUser);
      db.query = jest.fn().mockResolvedValue({ rows: [{ count: 1 }] }); // 1 active tunnel
      
      const mockInstance = {
        id: 'inst_new',
        user_id: 'user_test',
        name: 'New Instance',
        local_port: 8081,
        status: 'inactive'
      };
      
      db.createInstance = jest.fn().mockResolvedValue(mockInstance);

      const response = await request(app)
        .post('/api/v1/instances')
        .send({
          name: 'New Instance',
          local_port: 8081
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('quota_exceeded');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple heartbeats for same instance', async () => {
      const instanceId = 'inst_concurrent_test';
      const mockInstance = {
        id: instanceId,
        user_id: 'user_test',
        status: 'active',
        tunnel_connected: true
      };

      db.getInstanceById = jest.fn().mockResolvedValue(mockInstance);
      db.saveHealthMetrics = jest.fn().mockResolvedValue();
      db.getLatestHealthMetrics = jest.fn().mockResolvedValue({});

      // Send 3 heartbeats concurrently
      const heartbeats = await Promise.all([
        request(app).post(`/api/v1/instances/${instanceId}/heartbeat`).send({}),
        request(app).post(`/api/v1/instances/${instanceId}/heartbeat`).send({}),
        request(app).post(`/api/v1/instances/${instanceId}/heartbeat`).send({})
      ]);

      // All should succeed
      heartbeats.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should have saved metrics 3 times
      expect(db.saveHealthMetrics).toHaveBeenCalledTimes(3);
    });
  });

  describe('Status History', () => {
    it('should retrieve status history', async () => {
      const instanceId = 'inst_history_test';
      const mockInstance = {
        id: instanceId,
        user_id: 'user_test',
        status: 'active'
      };

      const mockHistory = [
        { id: 1, instance_id: instanceId, status: 'active', timestamp: new Date(), reason: 'Connected' },
        { id: 2, instance_id: instanceId, status: 'offline', timestamp: new Date(Date.now() - 3600000), reason: 'Disconnected' }
      ];

      db.getInstanceById = jest.fn().mockResolvedValue(mockInstance);
      db.getStatusHistory = jest.fn().mockResolvedValue(mockHistory);
      db.getLatestHealthMetrics = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .get(`/api/v1/instances/${instanceId}/status-history`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status_history');
      expect(response.body.status_history).toHaveLength(2);
      expect(response.body).toHaveProperty('uptime_data');
    });
  });
});

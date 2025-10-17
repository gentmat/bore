/**
 * Integration tests for API endpoints
 * Tests full request/response cycle with database
 */

import request from 'supertest';
import express, { Express } from 'express';
import { db, initializeDatabase } from '../../database';

// Import routes
import authRoutes from '../../routes/auth-routes';
import { router as instanceRoutes } from '../../routes/instance-routes';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/instances', instanceRoutes);
  return app;
}

describe('API Integration Tests', () => {
  let app: Express;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Initialize test database
    await initializeDatabase();
    app = createTestApp();
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('Authentication Flow', () => {
    it('should sign up a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Test User',
          email: `test_${Date.now()}@example.com`,
          password: 'password123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.plan).toBe('trial');

      testUser = response.body.user;
      authToken = response.body.token;
    });

    it('should reject duplicate email signup', async () => {
      await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Test User 2',
          email: testUser.email,
          password: 'password123'
        })
        .expect(409);
    });

    it('should login existing user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe(testUser.email);
    });

    it('should reject requests without token', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('Instance Management Flow', () => {
    let testInstance: any;

    it('should create a new instance', async () => {
      const response = await request(app)
        .post('/api/v1/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Instance',
          localPort: 3000,
          region: 'us-east'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Instance');
      expect(response.body.local_port).toBe(3000);
      expect(response.body.status).toBe('inactive');

      testInstance = response.body;
    });

    it('should list user instances', async () => {
      const response = await request(app)
        .get('/api/v1/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].id).toBe(testInstance.id);
    });

    it('should rename instance', async () => {
      const response = await request(app)
        .patch(`/api/v1/instances/${testInstance.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Renamed Instance'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.instance.name).toBe('Renamed Instance');
    });

    it('should reject invalid instance updates', async () => {
      await request(app)
        .patch(`/api/v1/instances/${testInstance.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '' // Empty name should fail
        })
        .expect(400);
    });

    it('should send heartbeat for instance', async () => {
      const response = await request(app)
        .post(`/api/v1/instances/${testInstance.id}/heartbeat`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vscode_responsive: true,
          cpu_usage: 25.5,
          memory_usage: 1024000,
          has_code_server: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
    });

    it('should get instance health metrics', async () => {
      const response = await request(app)
        .get(`/api/v1/instances/${testInstance.id}/health`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.instance_id).toBe(testInstance.id);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('last_heartbeat');
    });

    it('should get instance status history', async () => {
      const response = await request(app)
        .get(`/api/v1/instances/${testInstance.id}/status-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.instance_id).toBe(testInstance.id);
      expect(response.body).toHaveProperty('status_history');
      expect(response.body).toHaveProperty('uptime_data');
    });

    it('should reject access to other user instances', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Other User',
          email: `other_${Date.now()}@example.com`,
          password: 'password123'
        });

      const otherToken = otherUserResponse.body.token;

      // Try to access first user's instance
      await request(app)
        .get(`/api/v1/instances/${testInstance.id}/health`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      // Cleanup
      await db.query('DELETE FROM users WHERE id = $1', [otherUserResponse.body.user.id]);
    });

    it('should delete instance', async () => {
      const response = await request(app)
        .delete(`/api/v1/instances/${testInstance.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      await request(app)
        .get(`/api/v1/instances/${testInstance.id}/health`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Input Validation', () => {
    it('should validate signup input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'A', // Too short
          email: 'invalid-email',
          password: 'short'
        })
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toBeDefined();
    });

    it('should validate instance creation input', async () => {
      const response = await request(app)
        .post('/api/v1/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Empty name
          localPort: 99999, // Invalid port
        })
        .expect(400);

      expect(response.body.error).toBe('validation_error');
    });
  });

  describe('Token Refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });
      
      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken); // Token rotation
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);
    });

    it('should logout and revoke refresh token', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });

      const newRefreshToken = loginResponse.body.refreshToken;
      const newAuthToken = loginResponse.body.token;

      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          refreshToken: newRefreshToken
        })
        .expect(200);

      // Try to use revoked token
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: newRefreshToken
        })
        .expect(401);
    });
  });
});

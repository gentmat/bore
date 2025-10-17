/**
 * Auth Routes Tests
 * Tests for authentication endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import authRoutes from '../routes/auth-routes';

// Mock database
jest.mock('../database', () => ({
  db: {
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    getUserById: jest.fn(),
    updateUserPlan: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
  }
}));

// Mock refresh token service
jest.mock('../middleware/refresh-token', () => ({
  createRefreshToken: jest.fn().mockResolvedValue({
    token: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn().mockResolvedValue(true),
  revokeAllUserTokens: jest.fn().mockResolvedValue(true),
}));

// Mock auth middleware
jest.mock('../auth-middleware', () => ({
  generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
  authenticateJWT: jest.fn((req: any, _res: any, next: any) => {
    req.user = { user_id: 'user_123', email: 'test@example.com' };
    next();
  })
}));

// Mock config
jest.mock('../config', () => ({
  default: {
    plans: {
      trial: {
        duration: 24 * 60 * 60 * 1000 // 24 hours
      }
    }
  }
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db } = require('../database');

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(bodyParser.json());
  app.use('/api/v1/auth', authRoutes);
  return app;
}

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'trial'
      };

      db.getUserByEmail.mockResolvedValue(null); // User doesn't exist
      db.transaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockUser] }) // CREATE
            .mockResolvedValueOnce({ rows: [mockUser] }) // UPDATE
        };
        return callback(mockClient);
      });

      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return 409 if email already exists', async () => {
      db.getUserByEmail.mockResolvedValue({ id: 'existing_user' });

      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('conflict');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'T', // Too short
          email: 'invalid-email',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bcrypt = require('bcryptjs');
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: 'Test User',
        plan: 'pro'
      };

      db.getUserByEmail.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return 401 for invalid credentials', async () => {
      db.getUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('invalid_credentials');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'trial',
        is_admin: false
      };

      db.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { validateRefreshToken, revokeRefreshToken } = require('../middleware/refresh-token');
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      validateRefreshToken.mockResolvedValue({
        user_id: 'user_123',
        token: 'old-refresh-token'
      });
      db.getUserById.mockResolvedValue(mockUser);
      revokeRefreshToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'old-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(revokeRefreshToken).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should return 401 for invalid refresh token', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { validateRefreshToken } = require('../middleware/refresh-token');
      validateRefreshToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('unauthorized');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer mock-token')
        .send({
          refreshToken: 'refresh-token-to-revoke'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

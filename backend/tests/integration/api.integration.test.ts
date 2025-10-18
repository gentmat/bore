/**
 * Integration tests for API endpoints
 * Tests full request/response cycle with database
 */

import request from "supertest";
import express, { Express } from "express";
import { db, initializeDatabase } from "../../database";

// Import routes
import authRoutes from "../../routes/auth-routes";
import { router as instanceRoutes } from "../../routes/instance-routes";

// Mock rate limiters to prevent interference
jest.mock("../../middleware/rate-limiter", () => ({
  authLimiter: jest.fn((_req, _res, next) => next()),
  apiLimiter: jest.fn((_req, _res, next) => next()),
  tunnelLimiter: jest.fn((_req, _res, next) => next()),
  createInstanceLimiter: jest.fn((_req, _res, next) => next()),
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/instances", instanceRoutes);
  return app;
}

describe("API Integration Tests", () => {
  let app: Express;
  let testUser: { id: string; email: string } | null = null;
  let authToken: string;

  beforeAll(async () => {
    // Initialize test database
    await initializeDatabase();
    app = createTestApp();
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await db.query("DELETE FROM users WHERE id = $1", [testUser.id]);
    }
  });

  describe("Authentication Flow", () => {
    it("should sign up a new user", async () => {
      const timestamp = Date.now();
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "Test User",
          email: `test_${timestamp}@example.com`,
          password: "password123",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user.plan).toBe("trial");

      testUser = response.body.user;
      authToken = response.body.token;
    });

    it("should reject duplicate email signup", async () => {
      if (!testUser) {
        throw new Error("Test user not initialized");
      }

      const response = await request(app).post("/api/v1/auth/signup").send({
        name: "Test User 2",
        email: testUser.email,
        password: "password123",
      });

      expect(response.status).toBe(409);
    });

    it("should login existing user", async () => {
      if (!testUser) {
        throw new Error("Test user not initialized");
      }

      const response = await request(app).post("/api/v1/auth/login").send({
        email: testUser.email,
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.id).toBe(testUser.id);
    });

    it("should reject invalid credentials", async () => {
      if (!testUser) {
        throw new Error("Test user not initialized");
      }

      const response = await request(app).post("/api/v1/auth/login").send({
        email: testUser.email,
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
    });

    it("should get current user profile", async () => {
      if (!authToken) {
        throw new Error("Auth token not initialized");
      }

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      expect(response.body.id).toBe(testUser!.id);
      expect(response.body.email).toBe(testUser!.email);
    });

    it("should reject requests without token", async () => {
      await request(app).get("/api/v1/auth/me").expect(401);
    });
  });

  describe("Input Validation", () => {
    it("should validate signup input", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "A", // Too short
          email: "invalid-email",
          password: "short",
        })
        .expect(400);

      expect(response.body.error).toBe("validation_error");
      expect(response.body.details).toBeDefined();
    });

    it("should validate instance creation input", async () => {
      if (!authToken) {
        throw new Error("Auth token not initialized");
      }

      const response = await request(app)
        .post("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Instance",
          host: "", // Missing host
          localPort: 99999, // Invalid port
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("validation_error");
    });
  });

  describe("Token Refresh", () => {
    let refreshToken: string;

    beforeAll(async () => {
      if (!testUser) {
        throw new Error("Test user not initialized");
      }

      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: testUser.email,
        password: "password123",
      });

      expect(loginResponse.status).toBe(200);
      refreshToken = loginResponse.body.refreshToken;
    });

    it("should refresh token successfully", async () => {
      const response = await request(app).post("/api/v1/auth/refresh").send({
        refreshToken: refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.refreshToken).not.toBe(refreshToken); // Token rotation
    });

    it("should reject invalid refresh token", async () => {
      await request(app)
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken: "invalid-token",
        })
        .expect(401);
    });

    it("should logout and revoke refresh token", async () => {
      if (!testUser) {
        throw new Error("Test user not initialized");
      }

      // Login to get refresh token
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: testUser.email,
        password: "password123",
      });

      const newRefreshToken = loginResponse.body.refreshToken;
      const newAuthToken = loginResponse.body.token;

      // Logout
      await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${newAuthToken}`)
        .send({
          refreshToken: newRefreshToken,
        })
        .expect(200);

      // Try to use revoked token
      await request(app)
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken: newRefreshToken,
        })
        .expect(401);
    });
  });
});

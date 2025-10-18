/**
 * End-to-End Tests for Authentication Flow
 * Tests the complete authentication journey from signup to token refresh
 */

import request from "supertest";

// Use global test server URL
const baseURL: string =
  (global as Record<string, unknown>).TEST_BASE_URL as string || "http://localhost:3001";

interface TestUser {
  email: string;
  password: string;
  name: string;
}

const testUser: TestUser = {
  email: `test-e2e-${Date.now()}@example.com`,
  password: "SecurePass123!",
  name: "E2E Test User",
};
let authToken: string;
let refreshToken: string;

describe("Authentication E2E Flow", () => {
  describe("User Registration", () => {
    it("should successfully register a new user", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/signup")
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user).toHaveProperty("email", testUser.email);
      expect(response.body.user).not.toHaveProperty("password_hash");

      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it("should reject duplicate email registration", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/signup")
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should reject invalid email format", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/signup")
        .send({
          email: "invalid-email",
          password: "SecurePass123!",
          name: "Test User",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should reject weak passwords", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/signup")
        .send({
          email: "newuser@example.com",
          password: "123",
          name: "Test User",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("User Login", () => {
    it("should successfully login with correct credentials", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(testUser.email);

      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it("should reject incorrect password", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should reject non-existent user", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Password123!",
        })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Protected Routes", () => {
    it("should access protected route with valid token", async () => {
      const response = await request(baseURL)
        .get("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should reject access without token", async () => {
      await request(baseURL)
        .get("/api/v1/instances")
        .expect(401);
    });

    it("should reject access with invalid token", async () => {
      await request(baseURL)
        .get("/api/v1/instances")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });
  });

  describe("Token Refresh", () => {
    it("should refresh access token with valid refresh token", async () => {
      const response = await request(baseURL)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");

      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it("should reject invalid refresh token", async () => {
      await request(baseURL)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "invalid-refresh-token" })
        .expect(401);
    });

    it("should work with newly refreshed token", async () => {
      const response = await request(baseURL)
        .get("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("Logout", () => {
    it("should successfully logout and revoke refresh token", async () => {
      await request(baseURL)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ refreshToken })
        .expect(200);
    });

    it("should reject revoked refresh token", async () => {
      await request(baseURL)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(401);
    });
  });
});

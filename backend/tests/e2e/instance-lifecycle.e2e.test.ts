/**
 * End-to-End Tests for Instance Lifecycle
 * Tests the complete lifecycle: create, start, heartbeat, stop, delete
 */

import request from "supertest";
import { Pool } from "pg";
import config from "../../config";

const testDb = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: process.env.TEST_DB_NAME || "bore_db_test",
  user: config.database.user,
  password: config.database.password,
});

interface TestUser {
  email: string;
  password: string;
  name: string;
}

let authToken: string;
let instanceId: string;
const testUser: TestUser = {
  email: `test-instance-${Date.now()}@example.com`,
  password: "SecurePass123!",
  name: "Instance Test User",
};

describe("Instance Lifecycle E2E", () => {
  beforeAll(async () => {
    // Register and login test user
    const signupResponse = await request("http://localhost:3000")
      .post("/api/v1/auth/signup")
      .send(testUser);

    authToken = signupResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await testDb.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await testDb.end();
  });

  describe("Instance Creation", () => {
    it("should create a new instance", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "E2E Test Instance",
          localPort: 8080,
          region: "us-east-1",
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("E2E Test Instance");
      expect(response.body.status).toBe("inactive");

      instanceId = response.body.id;
    });

    it("should list created instance", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const instance = response.body.find((i: any) => i.id === instanceId);
      expect(instance).toBeDefined();
      expect(instance.name).toBe("E2E Test Instance");
    });

    it("should get instance by id", async () => {
      const response = await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(instanceId);
      expect(response.body.name).toBe("E2E Test Instance");
    });
  });

  describe("Instance Start", () => {
    it("should start the instance", async () => {
      const response = await request("http://localhost:3000")
        .post(`/api/v1/instances/${instanceId}/start`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toMatch(/starting|active/);
      expect(response.body).toHaveProperty("public_url");
    });

    it("should show active status after start", async () => {
      // Wait a bit for status to update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toMatch(/starting|active/);
    });
  });

  describe("Instance Heartbeat", () => {
    it("should accept heartbeat from instance", async () => {
      const response = await request("http://localhost:3000")
        .post(`/api/v1/internal/heartbeat/${instanceId}`)
        .set("x-internal-api-key", config.security.internalApiKey || "")
        .send({
          status: "active",
          metrics: {
            cpu_usage: 45.2,
            memory_usage: 512000000,
            vscode_responsive: true,
            has_code_server: true,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty("received", true);
    });

    it("should update instance status from heartbeat", async () => {
      const response = await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("active");
    });

    it("should retrieve health metrics", async () => {
      const response = await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}/metrics`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("vscode_responsive", true);
      expect(response.body).toHaveProperty("cpu_usage");
    });
  });

  describe("Instance Stop", () => {
    it("should stop the instance", async () => {
      const response = await request("http://localhost:3000")
        .post(`/api/v1/instances/${instanceId}/stop`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toMatch(/stopping|inactive/);
    });

    it("should show inactive status after stop", async () => {
      // Wait a bit for status to update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toMatch(/stopping|inactive/);
    });
  });

  describe("Instance Deletion", () => {
    it("should delete the instance", async () => {
      await request("http://localhost:3000")
        .delete(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
    });

    it("should not find deleted instance", async () => {
      await request("http://localhost:3000")
        .get(`/api/v1/instances/${instanceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should not list deleted instance", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const instance = response.body.find((i: any) => i.id === instanceId);
      expect(instance).toBeUndefined();
    });
  });
});

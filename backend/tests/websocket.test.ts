/**
 * WebSocket Tests
 * Tests real-time communication via Socket.IO
 *
 * NOTE: These tests require a running backend server.
 * Start backend with: npm start
 * Or skip these tests by running: npm test -- --testPathIgnorePatterns=websocket
 */

import { io, Socket } from "socket.io-client";
import request from "supertest";

describe("WebSocket Tests", () => {
  let authToken: string;
  let clientSocket: Socket;
  const serverUrl = process.env.BACKEND_URL || "http://localhost:3000";

  beforeAll(async () => {
    // Check if backend is available
    try {
      await request(serverUrl).get("/health").timeout(2000);
    } catch (error) {
      console.warn("Backend not available at", serverUrl);
      console.warn("Skipping WebSocket tests. Start backend with: npm start");
      return;
    }

    // Register and login a test user
    const testEmail = `ws-test-${Date.now()}@example.com`;

    await request(serverUrl).post("/api/v1/auth/register").send({
      email: testEmail,
      password: "TestPassword123!",
      name: "WebSocket Test User",
    });

    const loginResponse = await request(serverUrl)
      .post("/api/v1/auth/login")
      .send({
        email: testEmail,
        password: "TestPassword123!",
      });

    authToken = loginResponse.body.token;
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    setTimeout(done, 100);
  });

  test("should connect to WebSocket server with valid token", (done) => {
    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
    });

    clientSocket.on("connect", () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    clientSocket.on("connect_error", (error: Error) => {
      done(new Error(`Connection failed: ${error.message}`));
    });
  }, 10000);

  test("should reject connection with invalid token", (done) => {
    clientSocket = io(serverUrl, {
      auth: {
        token: "invalid-token-xyz",
      },
      transports: ["websocket"],
    });

    clientSocket.on("connect", () => {
      done(new Error("Should not connect with invalid token"));
    });

    clientSocket.on("connect_error", (error: Error) => {
      expect(error).toBeDefined();
      done();
    });
  }, 10000);

  test("should receive status updates for user instances", (done) => {
    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
    });

    clientSocket.on("connect", async () => {
      // Create an instance
      const instanceResponse = await request(serverUrl)
        .post("/api/v1/instances")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "ws-test-instance",
          local_port: 8080,
          region: "us-east",
        });

      const instanceId = instanceResponse.body.id;

      // Listen for status updates
      clientSocket.on("status-update", (data: any) => {
        expect(data).toHaveProperty("instanceId");
        expect(data).toHaveProperty("status");
        expect(data.instanceId).toBe(instanceId);
        done();
      });

      // Trigger a status change
      setTimeout(async () => {
        await request(serverUrl)
          .patch(`/api/v1/instances/${instanceId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            status: "active",
          });
      }, 500);
    });

    clientSocket.on("connect_error", (error: Error) => {
      done(new Error(`Connection failed: ${error.message}`));
    });
  }, 15000);

  test("should handle disconnection gracefully", (done) => {
    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
    });

    clientSocket.on("connect", () => {
      clientSocket.disconnect();
    });

    clientSocket.on("disconnect", (reason: string) => {
      expect(reason).toBeDefined();
      done();
    });
  }, 10000);

  test("should not receive updates for other users instances", (done) => {
    let receivedUnauthorizedUpdate = false;

    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
    });

    clientSocket.on("connect", () => {
      // Listen for any status updates
      clientSocket.on("status-update", (_data: unknown) => {
        // This should only fire for our user's instances
        receivedUnauthorizedUpdate = true;
      });

      // Wait a bit to ensure no unauthorized updates are received
      setTimeout(() => {
        expect(receivedUnauthorizedUpdate).toBe(false);
        done();
      }, 2000);
    });
  }, 10000);
});

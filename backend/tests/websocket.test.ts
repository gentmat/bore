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

// Mock rate limiters to prevent interference
jest.mock("../middleware/rate-limiter", () => ({
  authLimiter: jest.fn((_req, _res, next) => next()),
  apiLimiter: jest.fn((_req, _res, next) => next()),
  tunnelLimiter: jest.fn((_req, _res, next) => next()),
  createInstanceLimiter: jest.fn((_req, _res, next) => next()),
}));

// Increase timeout for WebSocket tests
jest.setTimeout(30000);

describe("WebSocket Tests", () => {
  let authToken: string;
  let clientSocket: Socket;
  const serverUrl = process.env.BACKEND_URL || "http://localhost:3000";
  let backendAvailable = false;

  beforeAll(async () => {
    // Check if backend is available
    try {
      const response = await request(serverUrl).get("/health").timeout(5000);
      backendAvailable = response.status === 200;
    } catch (error) {
      console.warn("Backend not available at", serverUrl);
      console.warn("Skipping WebSocket tests. Start backend with: npm start");
      backendAvailable = false;
    }

    if (!backendAvailable) {
      return;
    }

    // Register and login a test user
    const testEmail = `ws-test-${Date.now()}@example.com`;

    try {
      await request(serverUrl).post("/api/v1/auth/signup").send({
        name: "WebSocket Test User",
        email: testEmail,
        password: "TestPassword123!",
      });

      const loginResponse = await request(serverUrl)
        .post("/api/v1/auth/login")
        .send({
          email: testEmail,
          password: "TestPassword123!",
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.token;
      }
    } catch (error) {
      console.warn("Failed to create test user for WebSocket tests:", error);
      backendAvailable = false;
    }
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket.removeAllListeners();
    }
    setTimeout(done, 500);
  });

  test("should connect to WebSocket server with valid token", (done) => {
    if (!backendAvailable || !authToken) {
      done(new Error("Backend not available or no auth token"));
      return;
    }

    let connected = false;
    let errorOccurred = false;

    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
      timeout: 10000,
    });

    const timeout = setTimeout(() => {
      if (!connected && !errorOccurred) {
        done(new Error("Connection timeout"));
      }
    }, 15000);

    clientSocket.on("connect", () => {
      connected = true;
      expect(clientSocket.connected).toBe(true);
      clearTimeout(timeout);
      done();
    });

    clientSocket.on("connect_error", (error: Error) => {
      errorOccurred = true;
      clearTimeout(timeout);
      done(new Error(`Connection failed: ${error.message}`));
    });
  }, 20000);

  test("should reject connection with invalid token", (done) => {
    if (!backendAvailable) {
      done(new Error("Backend not available"));
      return;
    }

    let connected = false;
    let errorOccurred = false;

    clientSocket = io(serverUrl, {
      auth: {
        token: "invalid-token-xyz",
      },
      transports: ["websocket"],
      timeout: 10000,
    });

    const timeout = setTimeout(() => {
      if (!connected && !errorOccurred) {
        done(new Error("Test timeout - no response received"));
      }
    }, 15000);

    clientSocket.on("connect", () => {
      connected = true;
      clearTimeout(timeout);
      done(new Error("Expected connection to be rejected with invalid token"));
    });

    clientSocket.on("connect_error", (_error: Error) => {
      errorOccurred = true;
      clearTimeout(timeout);
      // Expected to fail with invalid token
      done();
    });
  }, 20000);

  test("should handle disconnection gracefully", (done) => {
    if (!backendAvailable || !authToken) {
      done(new Error("Backend not available or no auth token"));
      return;
    }

    clientSocket = io(serverUrl, {
      auth: {
        token: authToken,
      },
      transports: ["websocket"],
      timeout: 10000,
    });

    clientSocket.on("connect", () => {
      // Disconnect after successful connection
      setTimeout(() => {
        clientSocket.disconnect();
        done();
      }, 1000);
    });

    clientSocket.on("connect_error", (error: Error) => {
      done(new Error(`Connection failed: ${error.message}`));
    });
  }, 20000);
});

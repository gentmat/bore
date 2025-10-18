// Initialize tracing first (before any other imports)
import {
  initializeTracing,
  shutdownTracing,
  traceContextMiddleware,
} from "./tracing";
const tracingProvider = initializeTracing("bore-backend");

import express, { Request, Response, NextFunction, Application } from "express";
import http from "http";
import cors, { CorsOptions } from "cors";
import bodyParser from "body-parser";
import path from "path";
import config from "./config";

// Import utilities
import { logger } from "./utils/logger";
import { globalErrorHandler, notFoundHandler } from "./utils/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { httpLoggerMiddleware } from "./middleware/http-logger";

// Import modules
import { db, initializeDatabase } from "./database";
import { authenticateJWT } from "./auth-middleware";
import {
  metricsMiddleware,
  generatePrometheusMetrics,
  updateInstanceStatusCounts,
} from "./metrics";
import {
  initializeWebSocket,
  broadcastStatusChange as wsBroadcast,
} from "./websocket";
import { alerts } from "./alerting";
import redisService from "./services/redis-service";
import { cleanupExpiredTokens } from "./middleware/refresh-token";

// Import routes
import authRoutes from "./routes/auth-routes";
import {
  router as instanceRoutes,
  instanceHeartbeats,
} from "./routes/instance-routes";
import internalRoutes from "./routes/internal-routes";
import { swaggerUi, swaggerDocument, swaggerOptions } from "./swagger";

const app: Application = express();
const server = http.createServer(app);
const PORT = config.server.port;
const JWT_SECRET = config.security.jwtSecret;
const NODE_ENV = config.server.nodeEnv;

/**
 * SSE client type
 */
type SSEClient = Response;

// SSE clients tracking
const sseClients = new Map<string, Set<SSEClient>>(); // userId -> Set of response objects

// CORS Configuration - Environment-based whitelist
const ALLOWED_ORIGINS = config.cors.allowedOrigins;

const corsOptions: CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || NODE_ENV === "development") {
      callback(null, true);
    } else {
      logger.warn(`CORS: Blocked request from unauthorized origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-internal-api-key"],
};

// Middleware (order matters!)
app.use(requestIdMiddleware); // Must be first to track all requests
app.use(traceContextMiddleware); // Add trace context to requests
app.use(httpLoggerMiddleware); // Log all HTTP requests
app.use(cors(corsOptions));
// Request size limits for security (prevent DOS attacks)
app.use(
  bodyParser.json({
    limit: "10mb", // Maximum request body size
    strict: true, // Only accept arrays and objects
    type: "application/json",
  }),
);
app.use(
  bodyParser.urlencoded({
    limit: "10mb",
    extended: true,
    parameterLimit: 1000, // Limit number of parameters
  }),
);
app.use(express.static(path.join(__dirname, "public")));
app.use(metricsMiddleware); // Track all API requests

// Initialize WebSocket
initializeWebSocket(server, JWT_SECRET);

/**
 * Broadcast helper for both SSE and WebSocket
 */
function broadcastStatusChange(
  userId: string,
  instanceId: string,
  status: string,
): void {
  // SSE broadcast
  const clients = sseClients.get(userId);
  if (clients && clients.size > 0) {
    const data = JSON.stringify({ instanceId, status, timestamp: Date.now() });
    const message = `data: ${data}\n\n`;

    const deadClients: SSEClient[] = [];
    for (const client of clients) {
      try {
        client.write(message);
      } catch (err) {
        // Client disconnected - mark for removal
        logger.warn(`SSE write failed for user ${userId}, marking for cleanup`);
        deadClients.push(client);
      }
    }

    // Clean up dead clients
    deadClients.forEach((client) => {
      clients.delete(client);
    });

    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }

  // WebSocket broadcast
  wsBroadcast(userId, instanceId, status);
}

/**
 * Middleware to broadcast after certain routes
 */
function broadcastMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);

  res.json = function (data: unknown) {
    // Check if route signaled a broadcast
    if (res.locals.broadcast && res.locals.userId && res.locals.instanceId) {
      broadcastStatusChange(
        res.locals.userId,
        res.locals.instanceId,
        res.locals.status,
      );
    }

    if (res.locals.statusChanged) {
      // From heartbeat
      const instance = res.locals.instance;
      if (instance) {
        broadcastStatusChange(
          instance.userId,
          instance.id,
          res.locals.newStatus,
        );
      }
    }

    return originalJson(data);
  };

  next();
}

// API v1 Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/instances", broadcastMiddleware, instanceRoutes);
app.use("/api/v1/user/instances", broadcastMiddleware, instanceRoutes); // Alias
// Note: admin routes not yet migrated to TypeScript
// app.use('/api/v1/admin', adminRoutes);
app.use("/api/v1/internal", broadcastMiddleware, internalRoutes);

// Backward compatibility - redirect old API paths to v1
app.use("/api/auth*", (req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/v1/")) {
    const newPath = req.path.replace("/api/", "/api/v1/");
    return res.redirect(308, newPath); // 308 = Permanent Redirect (preserves method)
  }
  next();
});

app.use(
  "/api/instances*",
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/v1/")) {
      const newPath = req.path.replace("/api/", "/api/v1/");
      return res.redirect(308, newPath);
    }
    next();
  },
);

app.use("/api/admin*", (req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/v1/")) {
    const newPath = req.path.replace("/api/", "/api/v1/");
    return res.redirect(308, newPath);
  }
  next();
});

app.use("/api/internal*", (req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/v1/")) {
    const newPath = req.path.replace("/api/", "/api/v1/");
    return res.redirect(308, newPath);
  }
  next();
});

/**
 * SSE endpoint for real-time status updates (v1)
 */
app.get(
  "/api/v1/events/status",
  authenticateJWT,
  (req: Request, res: Response) => {
    const userId = (req as { user: { user_id: string } }).user.user_id;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Add client to map
    if (!sseClients.has(userId)) {
      sseClients.set(userId, new Set());
    }
    sseClients.get(userId)!.add(res);

    logger.info(
      `SSE client connected for user ${userId} (total: ${sseClients.get(userId)!.size})`,
    );

    // Send initial connection message
    res.write(
      `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`,
    );

    // Cleanup function
    const cleanup = () => {
      const clients = sseClients.get(userId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(userId);
        }
      }
      logger.info(
        `SSE client disconnected for user ${userId} (remaining: ${clients ? clients.size : 0})`,
      );
    };

    // Handle all disconnect scenarios
    req.on("close", cleanup);
    req.on("end", cleanup);
    res.on("error", (err: Error) => {
      logger.warn(`SSE error for user ${userId}: ${err.message}`);
      cleanup();
    });
    res.on("finish", cleanup);
  },
);

// API Documentation (Swagger) - MANDATORY
app.use("/api/v1/docs", swaggerUi.serve);
app.get("/api/v1/docs", swaggerUi.setup(swaggerDocument, swaggerOptions));
logger.info("📚 API Documentation available at /api/v1/docs");

/**
 * Prometheus metrics endpoint
 */
app.get("/metrics", (_req: Request, res: Response) => {
  // Update instance status counts
  db.getAllInstances()
    .then((instances) => {
      updateInstanceStatusCounts(instances);
      res.set("Content-Type", "text/plain");
      res.send(generatePrometheusMetrics());
    })
    .catch((error: Error) => {
      logger.error("Metrics error", error);
      res.status(500).send("# Error generating metrics\n");
    });
});

/**
 * Health check endpoint with dependency verification
 */
app.get("/health", async (_req: Request, res: Response) => {
  const health: {
    status: string;
    uptime: number;
    timestamp: number;
    checks: Record<string, unknown>;
  } = {
    status: "healthy",
    uptime: process.uptime(),
    timestamp: Date.now(),
    checks: {},
  };

  // Check database connectivity
  try {
    await db.query("SELECT 1");
    health.checks.database = { status: "healthy", message: "Connected" };
  } catch (error) {
    health.status = "degraded";
    health.checks.database = {
      status: "unhealthy",
      message: (error as Error).message,
      error: "Database connection failed",
    };
  }

  // Check Redis connectivity (if enabled)
  if (config.redis.enabled) {
    try {
      const redisHealthy = await redisService.healthCheck();
      health.checks.redis = {
        status: redisHealthy ? "healthy" : "unhealthy",
        message: redisHealthy ? "Connected" : "Connection failed",
      };
      if (!redisHealthy) {
        health.status = "degraded";
      }
    } catch (error) {
      health.status = "degraded";
      health.checks.redis = {
        status: "unhealthy",
        message: (error as Error).message,
        error: "Redis health check failed",
      };
    }
  } else {
    health.checks.redis = { status: "disabled", message: "Redis not enabled" };
  }

  // Overall status
  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Serve HTML pages
app.get("/login", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/signup", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/claim-trial", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "claim-trial.html"));
});

app.get("/dashboard", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/viewer", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "viewer.html"));
});

app.get("/", (_req: Request, res: Response) => {
  res.redirect("/signup");
});

// Error handlers (must be last!)
app.use(notFoundHandler); // Handle 404 for undefined routes
app.use(globalErrorHandler); // Handle all other errors

/**
 * Periodic heartbeat timeout check (Redis-aware)
 *
 * Performance optimization: Only checks instances that have active heartbeats
 * instead of querying all instances from the database. This scales better with
 * hundreds or thousands of instances.
 */
setInterval(async () => {
  try {
    const now = Date.now();

    // Get all heartbeats from Redis or fallback
    let heartbeatMap: Map<string, number>;
    if (config.redis.enabled) {
      heartbeatMap = await redisService.heartbeats.getAll();
    } else {
      heartbeatMap = instanceHeartbeats;
    }

    // Only check instances that have heartbeats (active instances)
    // This is much more efficient than querying ALL instances from the database
    for (const [instanceId, lastHeartbeat] of heartbeatMap.entries()) {
      if (now - lastHeartbeat > config.heartbeat.timeout) {
        // Heartbeat timed out - fetch instance details and mark offline
        const instance = await db.getInstanceById(instanceId);
        if (instance && instance.status !== "offline") {
          await db.updateInstance(instance.id, {
            status: "offline",
            status_reason: "Heartbeat timeout",
          });
          await db.addStatusHistory(
            instance.id,
            "offline",
            "Heartbeat timeout",
          );
          broadcastStatusChange(instance.userId, instance.id, "offline");

          // Send alert
          alerts.offline(instance.id, instance.name);
        }
      }
    }
  } catch (error) {
    logger.error("Heartbeat check error", error as Error);
  }
}, config.heartbeat.checkInterval);

/**
 * Periodic cleanup of expired refresh tokens
 */
setInterval(async () => {
  try {
    const deletedCount = await cleanupExpiredTokens();
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired refresh tokens`);
    }
  } catch (error) {
    logger.error("Token cleanup error", error as Error);
  }
}, config.tokenCleanup.interval);

/**
 * Initialize database, Redis, and start server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info("✅ Database initialized");

    // Initialize Redis (optional - won't fail if unavailable)
    if (config.redis.enabled) {
      try {
        await redisService.initializeRedis();
        logger.info("✅ Redis initialized - horizontal scaling enabled");
      } catch (error) {
        logger.warn(
          "⚠️  Redis initialization failed - falling back to in-memory state",
          { error: error as Error },
        );
        logger.warn("⚠️  Horizontal scaling will not work without Redis");
      }
    } else {
      logger.info(
        "ℹ️  Redis disabled - using in-memory state (single instance only)",
      );
    }

    // Start server
    server.listen(PORT, () => {
      logger.info("=".repeat(60));
      logger.info("🚀 Bore Backend Server Started");
      logger.info("=".repeat(60));
      logger.info(`📡 HTTP Server:      http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket Server: ws://localhost:${PORT}/socket.io/`);
      logger.info(`📊 Metrics:          http://localhost:${PORT}/metrics`);
      logger.info(`💚 Health Check:     http://localhost:${PORT}/health`);
      logger.info("=".repeat(60));
      logger.info(`📝 Sign Up:          http://localhost:${PORT}/signup`);
      logger.info(`📝 Login:            http://localhost:${PORT}/login`);
      logger.info(`📊 Dashboard:        http://localhost:${PORT}/dashboard`);
      logger.info("=".repeat(60));
      logger.info("📦 API Version:       v1 (at /api/v1/*)");
      logger.info("=".repeat(60));
      logger.info("✅ Server is ready!", {
        port: PORT,
        env: NODE_ENV,
        corsEnabled: true,
        redisEnabled: config.redis.enabled,
        allowedOrigins: ALLOWED_ORIGINS,
      });
      logger.info("=".repeat(60));
    });
  } catch (error) {
    logger.error("💥 Failed to initialize server", error as Error);
    process.exit(1);
  }
}

startServer();

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} signal received: closing server`);

  // Close HTTP server
  server.close(async () => {
    logger.info("HTTP server closed");

    // Close Redis connection
    if (config.redis.enabled) {
      await redisService.shutdown();
    }

    // Shutdown tracing
    await shutdownTracing(tracingProvider);

    logger.info("Server closed gracefully");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { app, server };

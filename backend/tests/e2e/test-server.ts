/**
 * Test Server Lifecycle Manager
 * Starts and stops the server programmatically for E2E tests
 */

import http from 'http';
import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initializeDatabase } from '../../database';
import { logger } from '../../utils/logger';
import authRoutes from '../../routes/auth-routes';
import { router as instanceRoutes } from '../../routes/instance-routes';
import internalRoutes from '../../routes/internal-routes';
import { swaggerUi, swaggerDocument, swaggerOptions } from '../../swagger';
import { globalErrorHandler, notFoundHandler } from '../../utils/error-handler';

let server: http.Server | null = null;
let app: Express | null = null;
let serverStarted = false;

interface ServerInfo {
  server: http.Server;
  app: Express;
  port: number;
}

/**
 * Start the server for E2E tests
 * @returns {Promise<ServerInfo>}
 */
async function startTestServer(port: number = 3001): Promise<ServerInfo> {
  if (serverStarted && server && app) {
    return { server, app, port };
  }

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = port.toString();
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'bore_db_test';
  
  // Suppress logs during tests
  logger.level = 'error';

  try {
    // Initialize database
    await initializeDatabase();

    // Create minimal app for testing
    app = express();
    
    // Middleware
    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    // Mount routes
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/instances', instanceRoutes);
    app.use('/api/v1/internal', internalRoutes);

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', test: true });
    });

    // API docs
    try {
      app.use('/api/v1/docs', swaggerUi.serve);
      app.get('/api/v1/docs', swaggerUi.setup(swaggerDocument, swaggerOptions));
    } catch (error) {
      // Swagger not critical for tests
    }

    // Error handlers
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    // Create HTTP server
    server = http.createServer(app);

    // Start listening
    await new Promise<void>((resolve, reject) => {
      server!.listen(port, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });

    serverStarted = true;
    logger.info(`Test server started on port ${port}`);

    return { server, app, port };
  } catch (error) {
    logger.error('Failed to start test server:', error);
    throw error;
  }
}

/**
 * Stop the test server
 * @returns {Promise<void>}
 */
async function stopTestServer(): Promise<void> {
  if (!serverStarted || !server) {
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    serverStarted = false;
    logger.info('Test server stopped');
  } catch (error) {
    logger.error('Failed to stop test server:', error);
    throw error;
  }
}

/**
 * Wait for server to be ready
 * @param {number} port 
 * @param {number} maxAttempts 
 * @returns {Promise<boolean>}
 */
async function waitForServer(port: number, maxAttempts: number = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return true;
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

export {
  startTestServer,
  stopTestServer,
  waitForServer,
};

/**
 * Test Server Lifecycle Manager
 * Starts and stops the server programmatically for E2E tests
 */

const http = require('http');
const { initializeDatabase } = require('../../database');
const { logger } = require('../../utils/logger');

let server;
let app;
let serverStarted = false;

/**
 * Start the server for E2E tests
 * @returns {Promise<{server, app, port}>}
 */
async function startTestServer(port = 3001) {
  if (serverStarted) {
    return { server, app, port };
  }

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = port;
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'bore_db_test';
  
  // Suppress logs during tests
  logger.level = 'error';

  try {
    // Initialize database
    await initializeDatabase();

    // Dynamically import app components
    const express = require('express');
    const cors = require('cors');
    const bodyParser = require('body-parser');
    
    // Create minimal app for testing
    app = express();
    
    // Middleware
    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    // Import routes
    const authRoutes = require('../../routes/auth-routes');
    const { router: instanceRoutes } = require('../../routes/instance-routes');
    const internalRoutes = require('../../routes/internal-routes');

    // Mount routes
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/instances', instanceRoutes);
    app.use('/api/v1/internal', internalRoutes);

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', test: true });
    });

    // API docs (if available)
    try {
      const { swaggerUi, swaggerDocument, swaggerOptions } = require('../../swagger');
      app.use('/api/v1/docs', swaggerUi.serve);
      app.get('/api/v1/docs', swaggerUi.setup(swaggerDocument, swaggerOptions));
    } catch (error) {
      // Swagger not critical for tests
    }

    // Error handlers
    const { globalErrorHandler, notFoundHandler } = require('../../utils/error-handler');
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    // Create HTTP server
    server = http.createServer(app);

    // Start listening
    await new Promise((resolve, reject) => {
      server.listen(port, (err) => {
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
async function stopTestServer() {
  if (!serverStarted || !server) {
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => {
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
async function waitForServer(port, maxAttempts = 30) {
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

module.exports = {
  startTestServer,
  stopTestServer,
  waitForServer,
};

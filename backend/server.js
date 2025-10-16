const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config');

// Import utilities
const { logger } = require('./utils/logger');
const { globalErrorHandler, notFoundHandler } = require('./utils/error-handler');
const { requestIdMiddleware } = require('./middleware/request-id');
const { httpLoggerMiddleware } = require('./middleware/http-logger');

// Import modules
const { db, initializeDatabase } = require('./database');
const { authenticateJWT } = require('./auth-middleware');
const { metricsMiddleware, generatePrometheusMetrics, updateInstanceStatusCounts } = require('./metrics');
const { initializeWebSocket, broadcastStatusChange: wsBroadcast } = require('./websocket');
const { alerts } = require('./alerting');

// Import routes
const authRoutes = require('./routes/auth-routes');
const { router: instanceRoutes } = require('./routes/instance-routes');
const adminRoutes = require('./routes/admin-routes');
const internalRoutes = require('./routes/internal-routes');

const app = express();
const server = http.createServer(app);
const PORT = config.server.port;
const JWT_SECRET = config.security.jwtSecret;
const NODE_ENV = config.server.nodeEnv;

// SSE clients tracking
const sseClients = new Map(); // userId -> Set of response objects

// CORS Configuration - Environment-based whitelist
const ALLOWED_ORIGINS = config.cors.allowedOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-api-key']
};

// Middleware (order matters!)
app.use(requestIdMiddleware); // Must be first to track all requests
app.use(httpLoggerMiddleware); // Log all HTTP requests
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(metricsMiddleware); // Track all API requests

// Initialize WebSocket
const io = initializeWebSocket(server, JWT_SECRET);

// Broadcast helper for both SSE and WebSocket
function broadcastStatusChange(userId, instanceId, status) {
  // SSE broadcast
  const clients = sseClients.get(userId);
  if (clients && clients.size > 0) {
    const data = JSON.stringify({ instanceId, status, timestamp: Date.now() });
    const message = `data: ${data}\n\n`;
    
    const deadClients = [];
    for (const client of clients) {
      try {
        client.write(message);
      } catch (err) {
        // Client disconnected - mark for removal
        console.warn(`SSE write failed for user ${userId}, marking for cleanup`);
        deadClients.push(client);
      }
    }
    
    // Clean up dead clients
    deadClients.forEach(client => {
      clients.delete(client);
    });
    
    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }
  
  // WebSocket broadcast
  wsBroadcast(userId, instanceId, status);
}

// Middleware to broadcast after certain routes
function broadcastMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Check if route signaled a broadcast
    if (res.locals.broadcast && res.locals.userId && res.locals.instanceId) {
      broadcastStatusChange(res.locals.userId, res.locals.instanceId, res.locals.status);
    }
    
    if (res.locals.statusChanged) {
      // From heartbeat
      const instance = res.locals.instance;
      if (instance) {
        broadcastStatusChange(instance.user_id, instance.id, res.locals.newStatus);
      }
    }
    
    return originalJson(data);
  };
  
  next();
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/instances', broadcastMiddleware, instanceRoutes);
app.use('/api/user/instances', broadcastMiddleware, instanceRoutes); // Alias
app.use('/api/admin', adminRoutes);
app.use('/api/internal', broadcastMiddleware, internalRoutes);

// SSE endpoint for real-time status updates
app.get('/api/events/status', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Add client to map
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
  
  console.log(`✅ SSE client connected for user ${userId} (total: ${sseClients.get(userId).size})`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  
  // Cleanup function
  const cleanup = () => {
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
    console.log(`🔌 SSE client disconnected for user ${userId} (remaining: ${clients ? clients.size : 0})`);
  };
  
  // Handle all disconnect scenarios
  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('error', (err) => {
    console.warn(`⚠️  SSE error for user ${userId}:`, err.message);
    cleanup();
  });
  res.on('finish', cleanup);
});

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  // Update instance status counts
  db.getAllInstances()
    .then(instances => {
      updateInstanceStatusCounts(instances);
      res.set('Content-Type', 'text/plain');
      res.send(generatePrometheusMetrics());
    })
    .catch(error => {
      console.error('Metrics error:', error);
      res.status(500).send('# Error generating metrics\n');
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Serve HTML pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/claim-trial', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'claim-trial.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.get('/', (req, res) => {
  res.redirect('/signup');
});

// Error handlers (must be last!)
app.use(notFoundHandler); // Handle 404 for undefined routes
app.use(globalErrorHandler); // Handle all other errors

// Periodic heartbeat timeout check
setInterval(async () => {
  try {
    const instances = await db.getAllInstances();
    const now = Date.now();
    const { instanceHeartbeats } = require('./routes/instance-routes');
    
    for (const instance of instances) {
      const lastHeartbeat = instanceHeartbeats.get(instance.id);
      if (lastHeartbeat && (now - lastHeartbeat) > config.heartbeat.timeout) {
        const oldStatus = instance.status;
        if (oldStatus !== 'offline') {
          await db.updateInstance(instance.id, { 
            status: 'offline',
            status_reason: 'Heartbeat timeout'
          });
          await db.addStatusHistory(instance.id, 'offline', 'Heartbeat timeout');
          broadcastStatusChange(instance.user_id, instance.id, 'offline');
          
          // Send alert
          alerts.offline(instance.id, instance.name);
        }
      }
    }
  } catch (error) {
    logger.error('Heartbeat check error', error);
  }
}, config.heartbeat.checkInterval);

// Initialize database and start server
initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      logger.info('='.repeat(60));
      logger.info('🚀 Bore Backend Server Started');
      logger.info('='.repeat(60));
      logger.info(`📡 HTTP Server:      http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket Server: ws://localhost:${PORT}/socket.io/`);
      logger.info(`📊 Metrics:          http://localhost:${PORT}/metrics`);
      logger.info(`💚 Health Check:     http://localhost:${PORT}/health`);
      logger.info('='.repeat(60));
      logger.info(`📝 Sign Up:          http://localhost:${PORT}/signup`);
      logger.info(`📝 Login:            http://localhost:${PORT}/login`);
      logger.info(`📊 Dashboard:        http://localhost:${PORT}/dashboard`);
      logger.info('='.repeat(60));
      logger.info('✅ Server is ready!', { 
        port: PORT, 
        env: NODE_ENV,
        corsEnabled: true,
        allowedOrigins: ALLOWED_ORIGINS 
      });
      logger.info('='.repeat(60));
    });
  })
  .catch(error => {
    logger.error('💥 Failed to initialize database', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing server');
  server.close(() => {
    logger.info('Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing server');
  server.close(() => {
    logger.info('Server closed gracefully');
    process.exit(0);
  });
});

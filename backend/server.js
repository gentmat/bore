const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

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
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// SSE clients tracking
const sseClients = new Map(); // userId -> Set of response objects

// Middleware
app.use(cors());
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
    
    for (const client of clients) {
      try {
        client.write(message);
      } catch (err) {
        // Client disconnected
      }
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
  
  console.log(`SSE client connected for user ${userId}`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  
  // Cleanup on disconnect
  req.on('close', () => {
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
    console.log(`SSE client disconnected for user ${userId}`);
  });
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

// Periodic heartbeat timeout check
setInterval(async () => {
  try {
    const instances = await db.getAllInstances();
    const now = Date.now();
    const { instanceHeartbeats } = require('./routes/instance-routes');
    
    for (const instance of instances) {
      const lastHeartbeat = instanceHeartbeats.get(instance.id);
      if (lastHeartbeat && (now - lastHeartbeat) > 30000) {
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
    console.error('Heartbeat check error:', error);
  }
}, 5000); // Every 5 seconds

// Initialize database and start server
initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('🚀 Bore Backend Server');
      console.log('='.repeat(60));
      console.log(`📡 HTTP Server:      http://localhost:${PORT}`);
      console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/socket.io/`);
      console.log(`📊 Metrics:          http://localhost:${PORT}/metrics`);
      console.log(`💚 Health Check:     http://localhost:${PORT}/health`);
      console.log('='.repeat(60));
      console.log(`📝 Sign Up:          http://localhost:${PORT}/signup`);
      console.log(`📝 Login:            http://localhost:${PORT}/login`);
      console.log(`📊 Dashboard:        http://localhost:${PORT}/dashboard`);
      console.log('='.repeat(60));
      console.log('✅ Server is ready!');
      console.log('='.repeat(60));
    });
  })
  .catch(error => {
    console.error('💥 Failed to initialize database:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

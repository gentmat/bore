const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const BORE_SERVER_HOST = process.env.BORE_SERVER_HOST || '127.0.0.1';
const BORE_SERVER_PORT = parseInt(process.env.BORE_SERVER_PORT || '7835', 10);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || null;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database (replace with real database in production)
const users = [
  {
    id: 'user_demo',
    email: 'demo@bore.com',
    password_hash: bcrypt.hashSync('demo123', 10),
    name: 'Demo User',
    plan: 'trial',
    plan_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
];

const userPlans = {}; // Store user plans

const instances = [];

// Track instance heartbeats for online/offline status
const instanceHeartbeats = new Map(); // instanceId -> lastHeartbeat timestamp
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds fallback

// Track instance health metrics
const instanceHealthMetrics = new Map(); // instanceId -> { vscode_responsive, last_activity, cpu_usage, memory_usage, has_code_server }

// Track instance status history
const instanceStatusHistory = new Map(); // instanceId -> [{timestamp, status, reason}]

// Track issued tunnel tokens so bore-server can authenticate
const tunnelTokens = new Map(); // token -> { instanceId, userId, expiresAt }

// SSE clients for real-time status updates
const sseClients = new Map(); // userId -> Set of response objects

const requireInternalApiKey = (req, res, next) => {
  if (!INTERNAL_API_KEY) {
    // No key configured – allow requests (useful for development environments)
    return next();
  }

  const provided = req.header('x-internal-api-key');
  if (!provided || provided !== INTERNAL_API_KEY) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid internal API key'
    });
  }

  next();
};

// Helper to broadcast status change to SSE clients
function broadcastStatusChange(userId, instanceId, status) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  
  const data = JSON.stringify({ instanceId, status, timestamp: Date.now() });
  const message = `data: ${data}\n\n`;
  
  for (const client of clients) {
    try {
      client.write(message);
    } catch (err) {
      // Client disconnected, will be cleaned up
    }
  }
}

// Periodically check for offline instances
setInterval(() => {
  const now = Date.now();
  for (const instance of instances) {
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    if (lastHeartbeat && (now - lastHeartbeat) > HEARTBEAT_TIMEOUT) {
      const oldStatus = instance.status;
      instance.status = 'offline';
      if (oldStatus !== 'offline') {
        broadcastStatusChange(instance.user_id, instance.id, 'offline');
      }
    }
  }
}, 5000); // Check every 5 seconds

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  // Check if user already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'user_exists', message: 'Email already registered' });
  }
  
  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'invalid_input', message: 'All fields are required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters' });
  }
  
  // Create new user
  const userId = 'user_' + Math.random().toString(36).substring(7);
  const password_hash = await bcrypt.hash(password, 10);
  
  const newUser = {
    id: userId,
    email,
    password_hash,
    name,
    plan: null,
    plan_expires: null,
    created_at: new Date().toISOString()
  };
  
  users.push(newUser);
  
  // Generate JWT
  const token = jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: '30d' });
  
  res.json({ token, user_id: userId, name });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
  }
  
  const token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  
  res.json({ token, user_id: user.id, name: user.name });
});

// Get all instances for authenticated user
app.get('/api/instances', authenticateJWT, (req, res) => {
  const userInstances = instances.filter(i => i.user_id === req.user.user_id);
  res.json({ instances: userInstances });
});

// Legacy endpoint for backward compatibility
app.get('/api/user/instances', authenticateJWT, (req, res) => {
  const userInstances = instances.filter(i => i.user_id === req.user.user_id);
  res.json({ instances: userInstances });
});

// Get single instance by ID
app.get('/api/instances/:id', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  res.json(instance);
});

// Create new instance
app.post('/api/instances', authenticateJWT, (req, res) => {
  const { name, localPort, region } = req.body;
  const userId = req.user.user_id;
  
  if (!name || !localPort) {
    return res.status(400).json({ error: 'invalid_input', message: 'Name and local port are required' });
  }
  
  const newInstance = {
    id: 'inst_' + Math.random().toString(36).substring(7),
    user_id: userId,
    name,
    localPort: localPort,
    local_port: localPort, // Support both camelCase and snake_case
    region: region || 'local',
    server_region: region || 'local',
    serverAddress: `${BORE_SERVER_HOST}:${BORE_SERVER_PORT}`,
    server_host: BORE_SERVER_HOST,
    status: 'inactive',
    publicUrl: null,
    public_url: null,
    remotePort: null,
    remote_port: null,
    currentTunnelToken: null,
    tunnelTokenExpiresAt: null
  };
  
  instances.push(newInstance);
  
  res.json(newInstance);
});

// Delete instance
app.delete('/api/instances/:id', authenticateJWT, (req, res) => {
  const instanceIndex = instances.findIndex(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (instanceIndex === -1) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  // Remove heartbeat tracking
  instanceHeartbeats.delete(req.params.id);
  
  instances.splice(instanceIndex, 1);
  
  res.json({ success: true });
});

// Rename instance
app.patch('/api/instances/:id', authenticateJWT, (req, res) => {
  const { name } = req.body;
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  if (!name) {
    return res.status(400).json({ error: 'invalid_input', message: 'Name is required' });
  }
  
  instance.name = name;
  
  res.json({ success: true, instance });
});

// Helper function to determine instance status based on three-tier logic
function determineInstanceStatus(instance) {
  const now = Date.now();
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  const healthMetrics = instanceHealthMetrics.get(instance.id) || {};
  
  // Tier 1: Check if tunnel is connected (authoritative from bore-server)
  if (instance.tunnel_connected === false || instance.status === 'offline') {
    return { status: 'offline', reason: 'Tunnel disconnected' };
  }
  
  // Tier 2: Check heartbeat staleness
  if (!lastHeartbeat || (now - lastHeartbeat) > HEARTBEAT_TIMEOUT) {
    return { status: 'offline', reason: 'Heartbeat timeout' };
  }
  
  // Tier 3: Check VSCode/code-server responsiveness
  if (healthMetrics.has_code_server && healthMetrics.vscode_responsive === false) {
    return { status: 'degraded', reason: 'VSCode not responding' };
  }
  
  // Tier 4: Check idle status (30 minutes = 1800 seconds)
  if (healthMetrics.last_activity && (now / 1000 - healthMetrics.last_activity) > 1800) {
    return { status: 'idle', reason: 'No activity for 30+ minutes' };
  }
  
  // Everything is working
  return { status: 'online', reason: 'All systems operational' };
}

// Helper to add status history entry
function addStatusHistory(instanceId, status, reason) {
  if (!instanceStatusHistory.has(instanceId)) {
    instanceStatusHistory.set(instanceId, []);
  }
  const history = instanceStatusHistory.get(instanceId);
  history.push({ timestamp: Date.now(), status, reason });
  // Keep only last 100 entries
  if (history.length > 100) {
    history.shift();
  }
}

// Instance heartbeat endpoint - clients call this to indicate they're online
app.post('/api/instances/:id/heartbeat', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  // Update heartbeat timestamp
  instanceHeartbeats.set(instance.id, Date.now());
  
  // Store health metrics from request body
  const { vscode_responsive, last_activity, cpu_usage, memory_usage, has_code_server } = req.body || {};
  if (vscode_responsive !== undefined) {
    instanceHealthMetrics.set(instance.id, {
      vscode_responsive,
      last_activity,
      cpu_usage,
      memory_usage,
      has_code_server,
      updated_at: Date.now()
    });
  }
  
  // Determine status using three-tier logic
  const oldStatus = instance.status;
  const { status, reason } = determineInstanceStatus(instance);
  instance.status = status;
  instance.status_reason = reason;
  
  // Broadcast status change if it changed
  if (oldStatus !== status) {
    addStatusHistory(instance.id, status, reason);
    broadcastStatusChange(instance.user_id, instance.id, status);
  }
  
  res.json({ success: true, status, reason });
});

app.post('/api/user/instances/:id/connect', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }

  if (instance.currentTunnelToken) {
    tunnelTokens.delete(instance.currentTunnelToken);
  }
  
  const tunnel_token = 'sk_tok_' + crypto.randomBytes(24).toString('hex');
  const remote_port = 0; // Let bore server assign port automatically

  // Reset instance connection metadata until the client reports readiness
  instance.status = 'starting';
  instance.public_url = null;
  instance.publicUrl = null;
  instance.remote_port = null;
  instance.remotePort = null;
  instance.serverAddress = `${BORE_SERVER_HOST}:${BORE_SERVER_PORT}`;
  instance.server_host = BORE_SERVER_HOST;
  instanceHeartbeats.set(instance.id, Date.now());
  instance.currentTunnelToken = tunnel_token;
  instance.tunnelTokenExpiresAt = Date.now() + 3600 * 1000;
  tunnelTokens.set(tunnel_token, {
    instanceId: instance.id,
    userId: instance.user_id,
    expiresAt: instance.tunnelTokenExpiresAt
  });
  
  res.json({
    instance_id: instance.id,
    tunnel_token,
    server_host: BORE_SERVER_HOST,
    local_port: instance.local_port,
    remote_port,
    ttl: 3600
  });
});

app.post('/api/user/instances/:id/disconnect', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  instance.status = 'offline';
  instance.public_url = null;
  instance.publicUrl = null;
  instance.remote_port = null;
  instance.remotePort = null;
  instanceHeartbeats.delete(instance.id);
  if (instance.currentTunnelToken) {
    tunnelTokens.delete(instance.currentTunnelToken);
    instance.currentTunnelToken = null;
    instance.tunnelTokenExpiresAt = null;
  }

  res.json({ success: true, instance });
});

app.patch('/api/user/instances/:id/connection', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);

  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }

  const { status, publicUrl, public_url, remotePort, remote_port } = req.body;

  if (typeof status === 'string') {
    instance.status = status;
    if (status === 'active') {
      instanceHeartbeats.set(instance.id, Date.now());
    }
  }

  if (publicUrl !== undefined || public_url !== undefined) {
    const urlValue = publicUrl ?? public_url;
    instance.publicUrl = urlValue;
    instance.public_url = urlValue;
  }

  if (remotePort !== undefined || remote_port !== undefined) {
    const portValue = remotePort ?? remote_port;
    instance.remotePort = portValue;
    instance.remote_port = portValue;
  }

  res.json({ success: true, instance });
});

app.post('/api/internal/validate-key', requireInternalApiKey, (req, res) => {
  const { api_key: apiKey } = req.body || {};

  if (!apiKey) {
    return res.status(400).json({
      valid: false,
      usage_allowed: false,
      message: 'api_key is required'
    });
  }

  const tokenInfo = tunnelTokens.get(apiKey);

  if (!tokenInfo) {
    return res.json({
      valid: false,
      usage_allowed: false,
      message: 'Unknown tunnel token'
    });
  }

  if (tokenInfo.expiresAt && tokenInfo.expiresAt < Date.now()) {
    tunnelTokens.delete(apiKey);
    return res.json({
      valid: false,
      usage_allowed: false,
      message: 'Tunnel token expired'
    });
  }

  const instance = instances.find(i => i.id === tokenInfo.instanceId);
  if (!instance) {
    tunnelTokens.delete(apiKey);
    return res.json({
      valid: false,
      usage_allowed: false,
      message: 'Instance not found'
    });
  }

  const user = users.find(u => u.id === tokenInfo.userId);
  const planType = user?.plan || 'trial';
  const maxConcurrent = planType === 'pro' ? 5 : 1;

  res.json({
    valid: true,
    usage_allowed: true,
    user_id: tokenInfo.userId,
    plan_type: planType,
    max_concurrent_tunnels: maxConcurrent,
    max_bandwidth_gb: 999,
    instance_id: instance.id,
    message: 'Token validated'
  });
});

app.post(
  '/api/internal/instances/:id/tunnel-connected',
  requireInternalApiKey,
  (req, res) => {
    const instance = instances.find(i => i.id === req.params.id);

    if (!instance) {
      return res
        .status(404)
        .json({ error: 'instance_not_found', message: 'Instance not found' });
    }

    instance.tunnel_connected = true;
    instance.status = 'active';
    instanceHeartbeats.set(instance.id, Date.now());

    const { remotePort, publicUrl } = req.body || {};
    if (remotePort !== undefined && remotePort !== null) {
      const effectiveHost = instance.server_host || BORE_SERVER_HOST;
      instance.remotePort = remotePort;
      instance.remote_port = remotePort;
      if (!publicUrl) {
        instance.publicUrl = `${effectiveHost}:${remotePort}`;
        instance.public_url = instance.publicUrl;
      }
    }

    if (publicUrl) {
      instance.publicUrl = publicUrl;
      instance.public_url = publicUrl;
    }

    // Add to status history
    addStatusHistory(instance.id, 'active', 'Tunnel connected from bore-server');

    // Broadcast real-time status update
    broadcastStatusChange(instance.user_id, instance.id, 'active');

    res.json({ success: true });
  }
);

app.post(
  '/api/internal/instances/:id/tunnel-disconnected',
  requireInternalApiKey,
  (req, res) => {
    const instance = instances.find(i => i.id === req.params.id);

    if (!instance) {
      return res
        .status(404)
        .json({ error: 'instance_not_found', message: 'Instance not found' });
    }

    instance.tunnel_connected = false;
    instance.status = 'offline';
    instance.publicUrl = null;
    instance.public_url = null;
    instance.remotePort = null;
    instance.remote_port = null;
    instanceHeartbeats.delete(instance.id);
    
    // Add to status history
    addStatusHistory(instance.id, 'offline', 'Tunnel disconnected from bore-server');
    if (instance.currentTunnelToken) {
      tunnelTokens.delete(instance.currentTunnelToken);
      instance.currentTunnelToken = null;
      instance.tunnelTokenExpiresAt = null;
    }

    // Broadcast real-time status update
    broadcastStatusChange(instance.user_id, instance.id, 'offline');

    res.json({ success: true });
  }
);

app.post('/api/user/claim-plan', authenticateJWT, (req, res) => {
  const { plan } = req.body;
  const userId = req.user.user_id;

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
  }
  
  // Check if user already has a plan
  if (user.plan && user.plan_expires && new Date(user.plan_expires) > new Date()) {
    return res.status(400).json({ error: 'plan_exists', message: 'You already have an active plan' });
  }
  
  let expiresAt;
  if (plan === 'trial') {
    // 24 hour trial
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (plan === 'pro') {
    // 30 day subscription
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  } else {
    return res.status(400).json({ error: 'invalid_plan', message: 'Invalid plan type' });
  }
  
  // Update user plan
  user.plan = plan;
  user.plan_expires = expiresAt.toISOString();
  
  res.json({
    success: true,
    plan,
    expires_at: expiresAt.toISOString(),
    message: `${plan === 'trial' ? 'Free trial' : 'Pro plan'} activated successfully`
  });
});

app.get('/api/user/profile', authenticateJWT, (req, res) => {
  const user = users.find(u => u.id === req.user.user_id);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
  }
  
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    plan_expires: user.plan_expires
  });
});

// SSE endpoint for real-time status updates
app.get('/api/events/status', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Add this client to the SSE clients map
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
  
  console.log(`SSE client connected for user ${userId}`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  
  // Clean up on disconnect
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

// ==================== ADMIN & MONITORING ENDPOINTS ====================

// Admin: Get all instances with health metrics (requires admin auth in production)
app.get('/api/admin/instances', authenticateJWT, (req, res) => {
  // In production, add admin role check here
  const allInstances = instances.map(instance => {
    const healthMetrics = instanceHealthMetrics.get(instance.id) || {};
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    const history = instanceStatusHistory.get(instance.id) || [];
    
    return {
      ...instance,
      health_metrics: healthMetrics,
      last_heartbeat: lastHeartbeat,
      heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null,
      status_history_count: history.length
    };
  });
  
  res.json({ instances: allInstances, total: allInstances.length });
});

// Admin: Get system statistics
app.get('/api/admin/stats', authenticateJWT, (req, res) => {
  const stats = {
    total_instances: instances.length,
    by_status: {
      online: instances.filter(i => i.status === 'online').length,
      active: instances.filter(i => i.status === 'active').length,
      offline: instances.filter(i => i.status === 'offline').length,
      degraded: instances.filter(i => i.status === 'degraded').length,
      idle: instances.filter(i => i.status === 'idle').length,
    },
    total_users: users.length,
    active_sse_connections: Array.from(sseClients.values()).reduce((sum, set) => sum + set.size, 0),
    active_tunnels: instances.filter(i => i.tunnel_connected).length,
  };
  
  res.json(stats);
});

// User: Get instance status history and timeline
app.get('/api/user/instances/:id/status-history', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  const history = instanceStatusHistory.get(instance.id) || [];
  const healthMetrics = instanceHealthMetrics.get(instance.id) || {};
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  
  res.json({
    instance_id: instance.id,
    current_status: instance.status,
    status_reason: instance.status_reason,
    health_metrics: healthMetrics,
    last_heartbeat: lastHeartbeat,
    heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null,
    status_history: history,
    uptime_data: calculateUptimeMetrics(history)
  });
});

// User: Get instance health metrics
app.get('/api/user/instances/:id/health', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  const healthMetrics = instanceHealthMetrics.get(instance.id) || {};
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  
  res.json({
    instance_id: instance.id,
    status: instance.status,
    status_reason: instance.status_reason,
    tunnel_connected: instance.tunnel_connected,
    vscode_responsive: healthMetrics.vscode_responsive,
    cpu_usage: healthMetrics.cpu_usage,
    memory_usage: healthMetrics.memory_usage,
    has_code_server: healthMetrics.has_code_server,
    last_heartbeat: lastHeartbeat,
    heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null,
    last_activity: healthMetrics.last_activity,
    metrics_updated_at: healthMetrics.updated_at
  });
});

// Helper function to calculate uptime metrics from history
function calculateUptimeMetrics(history) {
  if (history.length === 0) {
    return { uptime_percentage: 0, total_downtime_ms: 0, incident_count: 0 };
  }
  
  let totalTime = 0;
  let uptimeMs = 0;
  let incidentCount = 0;
  
  for (let i = 0; i < history.length; i++) {
    const current = history[i];
    const next = history[i + 1];
    
    if (next) {
      const duration = next.timestamp - current.timestamp;
      totalTime += duration;
      
      if (current.status === 'online' || current.status === 'active') {
        uptimeMs += duration;
      }
      
      if (current.status === 'offline' || current.status === 'degraded') {
        incidentCount++;
      }
    }
  }
  
  const uptimePercentage = totalTime > 0 ? (uptimeMs / totalTime) * 100 : 0;
  
  return {
    uptime_percentage: uptimePercentage.toFixed(2),
    total_downtime_ms: totalTime - uptimeMs,
    incident_count: incidentCount,
    history_span_ms: totalTime
  };
}

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

app.listen(PORT, () => {
  console.log(`🚀 Bore Backend Server running on http://localhost:${PORT}`);
  console.log(`📝 Sign Up: http://localhost:${PORT}/signup`);
  console.log(`📝 Login page: http://localhost:${PORT}/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`\n👤 Demo credentials: demo@bore.com / demo123`);
});

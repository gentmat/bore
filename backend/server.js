const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

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
const HEARTBEAT_TIMEOUT = 15000; // 15 seconds

// Periodically check for offline instances
setInterval(() => {
  const now = Date.now();
  for (const instance of instances) {
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    if (lastHeartbeat && (now - lastHeartbeat) > HEARTBEAT_TIMEOUT) {
      instance.status = 'offline';
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
    serverAddress: '127.0.0.1',
    status: 'inactive',
    publicUrl: null,
    public_url: null
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

// Instance heartbeat endpoint - clients call this to indicate they're online
app.post('/api/instances/:id/heartbeat', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  // Update heartbeat timestamp
  instanceHeartbeats.set(instance.id, Date.now());
  instance.status = 'online';
  
  res.json({ success: true });
});

app.post('/api/user/instances/:id/connect', authenticateJWT, (req, res) => {
  const instance = instances.find(i => i.id === req.params.id && i.user_id === req.user.user_id);
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found', message: 'Instance not found' });
  }
  
  const tunnel_token = 'temp_token_' + Math.random().toString(36).substring(7);
  const remote_port = 0; // Let bore server assign port automatically
  
  // Use actual bore server address (from environment or default to localhost)
  const boreServerHost = process.env.BORE_SERVER_HOST || '127.0.0.1';
  
  // Mark as online and update heartbeat
  instance.status = 'online';
  instanceHeartbeats.set(instance.id, Date.now());
  instance.public_url = `${boreServerHost}:${remote_port || 'auto'}`;
  
  res.json({
    instance_id: instance.id,
    tunnel_token,
    server_host: boreServerHost,
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
  instanceHeartbeats.delete(instance.id);
  
  res.json({ success: true, instance });
});

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

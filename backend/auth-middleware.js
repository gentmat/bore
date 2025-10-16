const jwt = require('jsonwebtoken');
const config = require('./config');
const { db } = require('./database');

// Security checks are now in config.js
const JWT_SECRET = config.security.jwtSecret;
const INTERNAL_API_KEY = config.security.internalApiKey;
const NODE_ENV = config.server.nodeEnv;

// Warn if using default values in development
if (NODE_ENV !== 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in development mode');
}

/**
 * Middleware to verify JWT token
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'No token provided' 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
}

/**
 * Middleware to verify user is admin
 */
async function requireAdmin(req, res, next) {
  try {
    const user = await db.getUserById(req.user.user_id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Admin access required'
      });
    }
    
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to verify admin status'
    });
  }
}

/**
 * Middleware to verify internal API key (for bore-server)
 */
function requireInternalApiKey(req, res, next) {
  // In development without key configured, allow for convenience
  // In production, the key is required (enforced at startup)
  if (!INTERNAL_API_KEY && NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: Internal API key not configured - allowing request in dev mode');
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
}

/**
 * Combined middleware: JWT + Admin
 */
const requireAdminAuth = [authenticateJWT, requireAdmin];

/**
 * Generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { 
      user_id: user.id, 
      email: user.email,
      is_admin: user.is_admin || false
    },
    JWT_SECRET,
    { expiresIn: config.tokens.jwt.expiresIn }
  );
}

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // Invalid token, but we don't fail - just continue without user
  }
  
  next();
}

module.exports = {
  authenticateJWT,
  requireAdmin,
  requireInternalApiKey,
  requireAdminAuth,
  generateToken,
  optionalAuth,
  JWT_SECRET,
};

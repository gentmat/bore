const jwt = require('jsonwebtoken');
const { db } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || null;

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
  if (!INTERNAL_API_KEY) {
    // No key configured – allow requests (useful for development)
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
    { expiresIn: '7d' }
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

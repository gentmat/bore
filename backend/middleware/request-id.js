/**
 * Request ID Middleware
 * Adds unique request ID for tracking and correlation across logs
 */

const crypto = require('crypto');

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Request ID middleware
 * Adds req.id and X-Request-ID header to every request
 */
function requestIdMiddleware(req, res, next) {
  // Use existing request ID from header if provided (for distributed tracing)
  // Otherwise generate a new one
  const requestId = req.get('X-Request-ID') || generateRequestId();
  
  // Attach to request object
  req.id = requestId;
  
  // Add to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

module.exports = {
  requestIdMiddleware,
  generateRequestId
};

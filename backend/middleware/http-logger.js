/**
 * HTTP Request/Response Logging Middleware
 */

const { logger } = require('../utils/logger');

/**
 * HTTP logger middleware
 * Logs all HTTP requests with timing information
 */
function httpLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Capture the original res.json and res.send to log response
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  res.json = function(body) {
    res.locals.responseBody = body;
    return originalJson(body);
  };
  
  res.send = function(body) {
    res.locals.responseBody = body;
    return originalSend(body);
  };
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' :
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.user_id
    });
  });
  
  next();
}

module.exports = { httpLoggerMiddleware };

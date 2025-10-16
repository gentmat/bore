/**
 * HTTP Request/Response Logging Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

type LogLevel = 'error' | 'warn' | 'info';

/**
 * HTTP logger middleware
 * Logs all HTTP requests with timing information
 */
function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
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
  
  res.json = function(body: any) {
    res.locals.responseBody = body;
    return originalJson(body);
  };
  
  res.send = function(body: any) {
    res.locals.responseBody = body;
    return originalSend(body);
  };
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level: LogLevel = res.statusCode >= 500 ? 'error' :
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.user_id
    };
    
    if (level === 'error') {
      logger.error('Request completed', logData);
    } else {
      logger[level]('Request completed', logData);
    }
  });
  
  next();
}

export { httpLoggerMiddleware };

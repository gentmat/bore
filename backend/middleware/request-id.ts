/**
 * Request ID Middleware
 * Adds unique request ID for tracking and correlation across logs
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Request ID middleware
 * Adds req.id and X-Request-ID header to every request
 */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header if provided (for distributed tracing)
  // Otherwise generate a new one
  const requestId = req.get('X-Request-ID') || generateRequestId();
  
  // Attach to request object
  req.id = requestId;
  
  // Add to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

export { requestIdMiddleware, generateRequestId };

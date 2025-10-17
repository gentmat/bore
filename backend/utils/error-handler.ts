/**
 * Standardized Error Response Utility
 * Provides consistent error formatting across all API endpoints
 */

/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface ErrorDetails {
  [key: string]: any;
}

interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: ErrorDetails | null;
  requestId?: string | null;
}

class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  details: ErrorDetails | null;
  timestamp: string;

  constructor(statusCode: number, errorCode: string, message: string, details: ErrorDetails | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard error response format
 */
function sendError(
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
  details: ErrorDetails | null = null,
  requestId: string | null = null
): Response {
  const errorResponse: ErrorResponse = {
    error: errorCode,
    message,
    timestamp: new Date().toISOString()
  };

  if (details) {
    errorResponse.details = details;
  }

  if (requestId) {
    errorResponse.requestId = requestId;
  }

  return res.status(statusCode).json(errorResponse);
}

/**
 * Predefined error response helpers
 */
const ErrorResponses = {
  // 400 - Bad Request
  badRequest: (
    res: Response,
    message: string = 'Invalid request data',
    details: ErrorDetails | null = null,
    requestId: string | null = null
  ): Response =>
    sendError(res, 400, 'bad_request', message, details, requestId),

  validationError: (
    res: Response,
    details: ErrorDetails,
    requestId: string | null = null
  ): Response =>
    sendError(res, 400, 'validation_error', 'Input validation failed', details, requestId),

  // 401 - Unauthorized
  unauthorized: (
    res: Response,
    message: string = 'Authentication required',
    requestId: string | null = null
  ): Response =>
    sendError(res, 401, 'unauthorized', message, null, requestId),

  invalidCredentials: (
    res: Response,
    requestId: string | null = null
  ): Response =>
    sendError(res, 401, 'invalid_credentials', 'Invalid email or password', null, requestId),

  invalidToken: (
    res: Response,
    requestId: string | null = null
  ): Response =>
    sendError(res, 401, 'invalid_token', 'Invalid or expired token', null, requestId),

  // 403 - Forbidden
  forbidden: (
    res: Response,
    message: string = 'Access denied',
    requestId: string | null = null
  ): Response =>
    sendError(res, 403, 'forbidden', message, null, requestId),

  // 404 - Not Found
  notFound: (
    res: Response,
    resource: string = 'Resource',
    requestId: string | null = null
  ): Response =>
    sendError(res, 404, 'not_found', `${resource} not found`, null, requestId),

  // 409 - Conflict
  conflict: (
    res: Response,
    message: string = 'Resource already exists',
    requestId: string | null = null
  ): Response =>
    sendError(res, 409, 'conflict', message, null, requestId),

  // 429 - Too Many Requests
  rateLimitExceeded: (
    res: Response,
    retryAfter: number | null = null,
    requestId: string | null = null
  ): Response => {
    const details = retryAfter ? { retryAfter } : null;
    return sendError(res, 429, 'rate_limit_exceeded', 'Too many requests', details, requestId);
  },

  // 500 - Internal Server Error
  internalError: (
    res: Response,
    message: string = 'An internal error occurred',
    requestId: string | null = null
  ): Response =>
    sendError(res, 500, 'internal_error', message, null, requestId),

  databaseError: (
    res: Response,
    requestId: string | null = null
  ): Response =>
    sendError(res, 500, 'database_error', 'Database operation failed', null, requestId),

  // 503 - Service Unavailable
  serviceUnavailable: (
    res: Response,
    message: string = 'Service temporarily unavailable',
    requestId: string | null = null
  ): Response =>
    sendError(res, 503, 'service_unavailable', message, null, requestId),
};

/**
 * Global error handler middleware
 * Place this at the end of all routes
 */
function globalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): Response {
  // Log error for debugging
  logger.error('Global Error Handler', err, {
    requestId: req.id,
    path: req.path,
    method: req.method
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.errorCode, err.message, err.details, req.id);
  }

  // Handle validation errors from Joi or similar
  if (err.name === 'ValidationError') {
    return ErrorResponses.validationError(res, err.details, req.id);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ErrorResponses.invalidToken(res, req.id);
  }

  if (err.name === 'TokenExpiredError') {
    return ErrorResponses.unauthorized(res, 'Token has expired', req.id);
  }

  // Default to 500 Internal Server Error
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const message = isDevelopment ? err.message : 'An unexpected error occurred';
  const details = isDevelopment ? { stack: err.stack } : null;

  return sendError(res, 500, 'internal_error', message, details, req.id);
}

/**
 * 404 Not Found handler for undefined routes
 */
function notFoundHandler(req: Request, res: Response): Response {
  return ErrorResponses.notFound(res, `Route ${req.method} ${req.path}`, req.id);
}

export {
  ApiError,
  sendError,
  ErrorResponses,
  globalErrorHandler,
  notFoundHandler,
  ErrorDetails,
  ErrorResponse
};

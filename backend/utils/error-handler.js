/**
 * Standardized Error Response Utility
 * Provides consistent error formatting across all API endpoints
 */

class ApiError extends Error {
  constructor(statusCode, errorCode, message, details = null) {
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
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Application-specific error code
 * @param {string} message - Human-readable error message
 * @param {Object|Array} [details] - Optional additional error details
 * @param {string} [requestId] - Optional request ID for tracking
 */
function sendError(res, statusCode, errorCode, message, details = null, requestId = null) {
  const errorResponse = {
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
  badRequest: (res, message = 'Invalid request data', details = null, requestId = null) =>
    sendError(res, 400, 'bad_request', message, details, requestId),

  validationError: (res, details, requestId = null) =>
    sendError(res, 400, 'validation_error', 'Input validation failed', details, requestId),

  // 401 - Unauthorized
  unauthorized: (res, message = 'Authentication required', requestId = null) =>
    sendError(res, 401, 'unauthorized', message, null, requestId),

  invalidCredentials: (res, requestId = null) =>
    sendError(res, 401, 'invalid_credentials', 'Invalid email or password', null, requestId),

  invalidToken: (res, requestId = null) =>
    sendError(res, 401, 'invalid_token', 'Invalid or expired token', null, requestId),

  // 403 - Forbidden
  forbidden: (res, message = 'Access denied', requestId = null) =>
    sendError(res, 403, 'forbidden', message, null, requestId),

  // 404 - Not Found
  notFound: (res, resource = 'Resource', requestId = null) =>
    sendError(res, 404, 'not_found', `${resource} not found`, null, requestId),

  // 409 - Conflict
  conflict: (res, message = 'Resource already exists', requestId = null) =>
    sendError(res, 409, 'conflict', message, null, requestId),

  // 429 - Too Many Requests
  rateLimitExceeded: (res, retryAfter = null, requestId = null) => {
    const details = retryAfter ? { retryAfter } : null;
    return sendError(res, 429, 'rate_limit_exceeded', 'Too many requests', details, requestId);
  },

  // 500 - Internal Server Error
  internalError: (res, message = 'An internal error occurred', requestId = null) =>
    sendError(res, 500, 'internal_error', message, null, requestId),

  databaseError: (res, requestId = null) =>
    sendError(res, 500, 'database_error', 'Database operation failed', null, requestId),

  // 503 - Service Unavailable
  serviceUnavailable: (res, message = 'Service temporarily unavailable', requestId = null) =>
    sendError(res, 503, 'service_unavailable', message, null, requestId),
};

/**
 * Global error handler middleware
 * Place this at the end of all routes
 */
function globalErrorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Global Error Handler:', {
    error: err.message,
    stack: err.stack,
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
function notFoundHandler(req, res) {
  return ErrorResponses.notFound(res, `Route ${req.method} ${req.path}`, req.id);
}

module.exports = {
  ApiError,
  sendError,
  ErrorResponses,
  globalErrorHandler,
  notFoundHandler
};

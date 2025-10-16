const Joi = require('joi');

/**
 * Validation Schemas
 * Comprehensive input validation for all API endpoints
 */
const schemas = {
  // Auth schemas
  signup: Joi.object({
    name: Joi.string().min(2).max(100).trim().required()
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Must be a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string().min(8).max(128).required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password cannot exceed 128 characters',
        'any.required': 'Password is required'
      })
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().required()
  }),

  // Instance schemas
  createInstance: Joi.object({
    name: Joi.string().min(1).max(255).trim().required()
      .messages({
        'string.min': 'Instance name is required',
        'string.max': 'Instance name cannot exceed 255 characters',
        'any.required': 'Instance name is required'
      }),
    localPort: Joi.number().integer().min(1).max(65535).required()
      .messages({
        'number.min': 'Port must be between 1 and 65535',
        'number.max': 'Port must be between 1 and 65535',
        'any.required': 'Local port is required'
      }),
    local_port: Joi.number().integer().min(1).max(65535).optional(), // Support both formats
    region: Joi.string().max(100).trim().optional().default('local'),
    server_host: Joi.string().max(255).trim().optional()
  }),

  renameInstance: Joi.object({
    name: Joi.string().min(1).max(255).trim().required()
  }),

  heartbeat: Joi.object({
    vscode_responsive: Joi.boolean().optional(),
    last_activity: Joi.number().optional(),
    cpu_usage: Joi.number().min(0).max(100).optional(),
    memory_usage: Joi.number().min(0).optional(),
    has_code_server: Joi.boolean().optional()
  }),

  connectionUpdate: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'starting', 'offline', 'degraded', 'idle').optional(),
    publicUrl: Joi.string().uri().optional().allow(null),
    public_url: Joi.string().uri().optional().allow(null),
    remotePort: Joi.number().integer().min(1).max(65535).optional().allow(null),
    remote_port: Joi.number().integer().min(1).max(65535).optional().allow(null)
  }),

  // Plan schemas
  claimPlan: Joi.object({
    plan: Joi.string().valid('trial', 'pro', 'enterprise').required()
  }),

  // Internal API schemas
  validateKey: Joi.object({
    api_key: Joi.string().required()
  }),

  tunnelConnected: Joi.object({
    remotePort: Joi.number().integer().min(1).max(65535).optional(),
    publicUrl: Joi.string().optional()
  })
};

/**
 * Validation Middleware Factory
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all errors, not just the first
      stripUnknown: true, // Remove unknown fields
      convert: true // Type coercion (e.g., "123" -> 123)
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input data',
        details: errors
      });
    }

    // Replace original data with validated & sanitized data
    req[source] = value;
    next();
  };
}

/**
 * Sanitize input to prevent XSS attacks
 * Comprehensive sanitization for untrusted user input
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitize(input) {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove event handlers (onclick, onerror, etc.)
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:text\/html/gi, '')
    // Encode special characters
    .replace(/[<>'"&]/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[char] || char;
    })
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize an object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

module.exports = {
  schemas,
  validate,
  sanitize,
  sanitizeObject
};

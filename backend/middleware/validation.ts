import Joi from "joi";
import { Request, Response, NextFunction } from "express";
import { normalizeRequestBody } from "../utils/naming-convention";

interface ValidationError {
  field: string;
  message: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  details: ValidationError[];
}

type RequestSource = "body" | "query" | "params";

/**
 * Validation Schemas
 * Comprehensive input validation for all API endpoints
 * Accepts both camelCase and snake_case, normalizes to snake_case for database
 */
const schemas = {
  // Auth schemas
  signup: Joi.object({
    name: Joi.string().min(2).max(100).trim().required().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
      "any.required": "Name is required",
    }),
    email: Joi.string().email().lowercase().trim().required().messages({
      "string.email": "Must be a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(8).max(128).required().messages({
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password cannot exceed 128 characters",
      "any.required": "Password is required",
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().required(),
  }),

  // Instance schemas - Accept both camelCase and snake_case
  createInstance: Joi.object({
    name: Joi.string().min(1).max(255).trim().required().messages({
      "string.min": "Instance name is required",
      "string.max": "Instance name cannot exceed 255 characters",
      "any.required": "Instance name is required",
    }),
    // Accept both localPort and local_port
    localPort: Joi.number().integer().min(1).max(65535).optional().messages({
      "number.min": "Port must be between 1 and 65535",
      "number.max": "Port must be between 1 and 65535",
    }),
    local_port: Joi.number().integer().min(1).max(65535).optional(),
    region: Joi.string().max(100).trim().optional().default("local"),
    // Accept both serverHost and server_host
    serverHost: Joi.string().max(255).trim().optional(),
    server_host: Joi.string().max(255).trim().optional(),
  }).custom((value, helpers) => {
    // Ensure at least one port field is provided
    if (!value.localPort && !value.local_port) {
      return helpers.error("any.required", {
        label: "localPort or local_port",
      });
    }
    return value;
  }),

  renameInstance: Joi.object({
    name: Joi.string().min(1).max(255).trim().required(),
  }),

  // Accept both camelCase and snake_case for health metrics
  heartbeat: Joi.object({
    vscodeResponsive: Joi.boolean().optional(),
    vscode_responsive: Joi.boolean().optional(),
    lastActivity: Joi.number().optional(),
    last_activity: Joi.number().optional(),
    cpuUsage: Joi.number().min(0).max(100).optional(),
    cpu_usage: Joi.number().min(0).max(100).optional(),
    memoryUsage: Joi.number().min(0).optional(),
    memory_usage: Joi.number().min(0).optional(),
    hasCodeServer: Joi.boolean().optional(),
    has_code_server: Joi.boolean().optional(),
  }),

  connectionUpdate: Joi.object({
    status: Joi.string()
      .valid("active", "inactive", "starting", "offline", "degraded", "idle")
      .optional(),
    publicUrl: Joi.string().uri().optional().allow(null),
    public_url: Joi.string().uri().optional().allow(null),
    remotePort: Joi.number().integer().min(1).max(65535).optional().allow(null),
    remote_port: Joi.number()
      .integer()
      .min(1)
      .max(65535)
      .optional()
      .allow(null),
  }),

  // Plan schemas
  claimPlan: Joi.object({
    plan: Joi.string().valid("trial", "pro", "enterprise").required(),
  }),

  // Internal API schemas
  validateKey: Joi.object({
    api_key: Joi.string().required(),
  }),

  tunnelConnected: Joi.object({
    remotePort: Joi.number().integer().min(1).max(65535).optional(),
    publicUrl: Joi.string().optional(),
  }),
};

/**
 * Validation Middleware Factory
 * @param schema - Joi schema to validate against
 * @param source - Request property to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
function validate(schema: Joi.Schema, source: RequestSource = "body") {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all errors, not just the first
      stripUnknown: true, // Remove unknown fields
      convert: true, // Type coercion (e.g., "123" -> 123)
    });

    if (error) {
      const errors: ValidationError[] = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      const errorResponse: ErrorResponse = {
        error: "validation_error",
        message: "Invalid input data",
        details: errors,
      };

      return res.status(400).json(errorResponse);
    }

    // Normalize naming convention (both camelCase and snake_case accepted, normalized to snake_case)
    const normalized = normalizeRequestBody(value);

    // Replace original data with validated, sanitized, and normalized data
    req[source] = normalized;

    // Also keep original for API compatibility
    (req as any)[`${source}Original`] = value;

    next();
  };
}

/**
 * Sanitize input to prevent XSS attacks
 * Comprehensive sanitization for untrusted user input
 * @param input - String to sanitize
 * @returns Sanitized string
 */
function sanitize(input: unknown): unknown {
  if (typeof input !== "string") {
    return input;
  }

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove style tags and content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Remove event handlers (onclick, onerror, etc.)
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\bon\w+\s*=\s*[^\s>]*/gi, "")
      // Remove javascript: protocol
      .replace(/javascript:/gi, "")
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, "")
      // Encode special characters
      .replace(/[<>'"&]/g, (char: string) => {
        const entities: Record<string, string> = {
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "&": "&amp;",
        };
        return entities[char] || char;
      })
      // Remove null bytes
      .replace(/\0/g, "")
      // Trim whitespace
      .trim()
  );
}

/**
 * Sanitize an object recursively
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) {
    return sanitize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

export {
  schemas,
  validate,
  sanitize,
  sanitizeObject,
  ValidationError,
  ErrorResponse,
  RequestSource,
};

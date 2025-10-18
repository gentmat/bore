import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Rate Limiting Configuration
 * Prevents brute force attacks and abuse
 */

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "too_many_requests",
    message: "Too many login attempts. Please try again in 15 minutes.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: "too_many_requests",
      message: "Too many attempts. Please try again later.",
      retryAfter: 60,
    });
  },
});

// Moderate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: "rate_limit_exceeded",
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for tunnel creation
const tunnelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 tunnel operations per 5 minutes
  message: {
    error: "tunnel_rate_limit",
    message:
      "Too many tunnel operations. Please wait before creating more tunnels.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Rate limit per user, fall back to IP with proper IPv6 handling
    if (req.user?.user_id) {
      return req.user.user_id;
    }
    // Use a simple IP-based fallback that doesn't trigger IPv6 validation
    return req.ip?.replace(/^::ffff:/, "") || "unknown";
  },
});

// Very strict limiter for instance creation
const createInstanceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 instance creations per hour
  message: {
    error: "creation_rate_limit",
    message: "Too many instances created. Please wait before creating more.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Rate limit per user, fall back to IP with proper IPv6 handling
    if (req.user?.user_id) {
      return req.user.user_id;
    }
    // Use a simple IP-based fallback that doesn't trigger IPv6 validation
    return req.ip?.replace(/^::ffff:/, "") || "unknown";
  },
});

export { authLimiter, apiLimiter, tunnelLimiter, createInstanceLimiter };

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import config from './config';
import { db } from './database';

// Security configuration
const JWT_SECRET = config.security.jwtSecret;
const INTERNAL_API_KEY = config.security.internalApiKey;
const NODE_ENV = config.server.nodeEnv;

// Warn if using default values in development
if (NODE_ENV !== 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in development mode');
}

/**
 * JWT Payload Interface
 */
interface JWTPayload {
  user_id: string;
  email: string;
  is_admin: boolean;
  plan?: string;
  iat: number;
  exp: number;
}

/**
 * User object attached to request
 */
interface AuthUser {
  user_id: string;
  email: string;
  plan?: string;
  is_admin?: boolean;
}

/**
 * Admin user with full details
 */
interface AdminUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Extended Request with user authentication
 */
interface AuthenticatedRequest extends Request {
  user: {
    user_id: string;
    email: string;
    plan: string;
    is_admin?: boolean;
  };
}

/**
 * Extended Request with admin authentication
 */
interface AdminRequest extends AuthenticatedRequest {
  adminUser: AdminUser;
}

/**
 * Middleware to verify JWT token
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ 
      error: 'unauthorized', 
      message: 'No token provided' 
    });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ 
      error: 'unauthorized', 
      message: 'No token provided' 
    });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      plan: decoded.plan || 'trial'
    };
    next();
  } catch (err) {
    res.status(401).json({ 
      error: 'unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
}

/**
 * Middleware to verify user is admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user?.user_id) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
      return;
    }
    
    const user = await db.getUserById(authReq.user.user_id);
    
    if (!user || !user.isAdmin) {
      res.status(403).json({
        error: 'forbidden',
        message: 'Admin access required'
      });
      return;
    }
    
    (req as AdminRequest).adminUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      is_admin: user.isAdmin,
      created_at: typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt,
      updated_at: typeof user.updatedAt === 'string' ? new Date(user.updatedAt) : user.updatedAt
    };
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to verify admin status'
    });
  }
}

/**
 * Middleware to verify internal API key (for bore-server)
 */
export function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  // In development without key configured, allow for convenience
  // In production, the key is required (enforced at startup)
  if (!INTERNAL_API_KEY && NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: Internal API key not configured - allowing request in dev mode');
    next();
    return;
  }
  
  const provided = req.header('x-internal-api-key');
  if (!provided || provided !== INTERNAL_API_KEY) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid internal API key'
    });
    return;
  }
  
  next();
}

/**
 * Combined middleware: JWT + Admin
 */
export const requireAdminAuth: RequestHandler[] = [authenticateJWT, requireAdmin];

/**
 * User object for token generation
 */
interface UserForToken {
  id: string;
  email: string;
  is_admin?: boolean | null;
}

/**
 * Generate JWT token
 */
export function generateToken(user: UserForToken): string {
  return jwt.sign(
    { 
      user_id: user.id, 
      email: user.email,
      is_admin: user.is_admin || false
    },
    JWT_SECRET,
    { expiresIn: config.tokens.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    next();
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    next();
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      plan: decoded.plan || 'trial'
    };
  } catch (err) {
    // Invalid token, but we don't fail - just continue without user
  }
  
  next();
}

// Export JWT_SECRET for backward compatibility
export { JWT_SECRET };

// Export types for use in other modules
export type { 
  JWTPayload, 
  AuthUser, 
  AdminUser, 
  AuthenticatedRequest, 
  AdminRequest,
  UserForToken
};

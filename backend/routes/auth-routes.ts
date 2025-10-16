import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import config from '../config';
import { db } from '../database';
import { generateToken, authenticateJWT } from '../auth-middleware';
import { schemas, validate } from '../middleware/validation';
import { authLimiter } from '../middleware/rate-limiter';
import { ErrorResponses } from '../utils/error-handler';
import { createRefreshToken, validateRefreshToken, revokeRefreshToken, revokeAllUserTokens } from '../middleware/refresh-token';
import { logger } from '../utils/logger';

const router: Router = express.Router();

/**
 * Authenticated request with user
 */
interface AuthRequest extends Request {
  user: {
    user_id: string;
    email: string;
    plan: string;
  };
  id?: string;
}


/**
 * Sign up new user
 * Creates user account and assigns trial plan atomically
 */
router.post('/signup', authLimiter, validate(schemas.signup), async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;
  
  try {
    // Check if user already exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      ErrorResponses.conflict(res, 'Email already registered', req.id);
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set plan expiry (24 hours from now for trial)
    const planExpires = new Date(Date.now() + config.plans.trial.duration);
    
    // Use transaction to ensure atomic user creation and plan assignment
    const user = await db.transaction(async (client: any) => {
      // Create user
      const result = await client.query(
        'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, email, passwordHash, name]
      );
      const newUser = result.rows[0];
      
      // Update user plan
      await client.query(
        'UPDATE users SET plan = $1, plan_expires = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['trial', planExpires, userId]
      );
      
      return { ...newUser, plan: 'trial', plan_expires: planExpires };
    });
    
    // Generate access token and refresh token
    const token = generateToken(user as any);
    const { token: refreshToken, expiresAt } = await createRefreshToken(
      user.id,
      req.get('user-agent') || 'unknown',
      req.ip || 'unknown'
    );
    
    res.status(201).json({
      token,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: 'trial',
        plan_expires: planExpires.toISOString()
      }
    });
  } catch (error) {
    logger.error('Signup error', error as Error);
    ErrorResponses.internalError(res, 'Signup failed', req.id);
  }
});

/**
 * Login existing user
 * Validates credentials and returns JWT token
 */
router.post('/login', authLimiter, validate(schemas.login), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  try {
    const user = await db.getUserByEmail(email);
    
    if (!user) {
      ErrorResponses.invalidCredentials(res, req.id);
      return;
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      ErrorResponses.invalidCredentials(res, req.id);
      return;
    }
    
    // Generate access token and refresh token
    const token = generateToken(user as any);
    const { token: refreshToken, expiresAt } = await createRefreshToken(
      user.id,
      req.get('user-agent') || 'unknown',
      req.ip || 'unknown'
    );
    
    res.json({
      token,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        plan_expires: user.planExpires
      }
    });
  } catch (error) {
    logger.error('Login error', error as Error);
    ErrorResponses.internalError(res, 'Login failed', req.id);
  }
});

/**
 * Get current user profile
 * Returns user information based on JWT token
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = await db.getUserById(authReq.user.user_id);
    
    if (!user) {
      ErrorResponses.notFound(res, 'User', authReq.id);
      return;
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      plan_expires: user.planExpires,
      is_admin: user.isAdmin
    });
  } catch (error) {
    logger.error('Get user error', error as Error);
    ErrorResponses.internalError(res, 'Failed to get user', (req as AuthRequest).id);
  }
});

/**
 * Claim or upgrade user plan
 * Updates user's subscription plan with new expiration date
 */
router.post('/claim-plan', authenticateJWT, validate(schemas.claimPlan), async (req: Request, res: Response): Promise<void> => {
  const { plan } = req.body;
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;
  
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      ErrorResponses.notFound(res, 'User', authReq.id);
      return;
    }
    
    // Set plan expiration based on plan type
    const planConfig = config.plans[plan as keyof typeof config.plans];
    
    if (!planConfig) {
      ErrorResponses.badRequest(res, 'Invalid plan type', null, authReq.id);
      return;
    }
    
    const expiresAt = new Date(Date.now() + planConfig.duration);
    
    await db.updateUserPlan(userId, plan, expiresAt);
    
    res.json({ 
      success: true, 
      plan, 
      expires_at: expiresAt.toISOString() 
    });
  } catch (error) {
    logger.error('Claim plan error', error as Error);
    ErrorResponses.internalError(res, 'Failed to claim plan', authReq.id);
  }
});

/**
 * Refresh access token using refresh token
 * Provides token rotation - old refresh token is revoked, new one issued
 */
router.post('/refresh', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    ErrorResponses.badRequest(res, 'Refresh token is required', null, req.id);
    return;
  }
  
  try {
    // Validate refresh token
    const tokenData = await validateRefreshToken(refreshToken);
    
    if (!tokenData) {
      ErrorResponses.unauthorized(res, 'Invalid or expired refresh token', req.id);
      return;
    }
    
    // Get user
    const user = await db.getUserById(tokenData.user_id);
    if (!user) {
      ErrorResponses.notFound(res, 'User', req.id);
      return;
    }
    
    // Revoke old refresh token (token rotation)
    await revokeRefreshToken(refreshToken);
    
    // Generate new tokens
    const newAccessToken = generateToken(user as any);
    const { token: newRefreshToken, expiresAt } = await createRefreshToken(
      user.id,
      req.get('user-agent') || 'unknown',
      req.ip || 'unknown'
    );
    
    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: expiresAt
    });
  } catch (error) {
    logger.error('Token refresh error', error as Error);
    ErrorResponses.internalError(res, 'Token refresh failed', req.id);
  }
});

/**
 * Logout - revoke refresh token
 */
router.post('/logout', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  
  try {
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', error as Error);
    ErrorResponses.internalError(res, 'Logout failed', (req as AuthRequest).id);
  }
});

/**
 * Logout from all devices - revoke all refresh tokens
 */
router.post('/logout-all', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    await revokeAllUserTokens(authReq.user.user_id);
    
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (error) {
    logger.error('Logout all error', error as Error);
    ErrorResponses.internalError(res, 'Logout all failed', (req as AuthRequest).id);
  }
});

export default router;

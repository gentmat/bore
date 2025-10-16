const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const config = require('../config');
const { db } = require('../database');
const { generateToken, authenticateJWT } = require('../auth-middleware');
const { schemas, validate } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rate-limiter');
const { ErrorResponses } = require('../utils/error-handler');

/**
 * Sign up new user
 * Creates user account and assigns trial plan atomically
 */
router.post('/signup', authLimiter, validate(schemas.signup), async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Check if user already exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return ErrorResponses.conflict(res, 'Email already registered', req.id);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set plan expiry (24 hours from now for trial)
    const planExpires = new Date(Date.now() + config.plans.trial.duration);
    
    // Use transaction to ensure atomic user creation and plan assignment
    const user = await db.transaction(async (client) => {
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
    
    // Generate token
    const token = generateToken(user);
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: 'trial',
        plan_expires: planExpires.toISOString()
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return ErrorResponses.internalError(res, 'Signup failed', req.id);
  }
});

/**
 * Login existing user
 * Validates credentials and returns JWT token
 */
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await db.getUserByEmail(email);
    
    if (!user) {
      return ErrorResponses.invalidCredentials(res, req.id);
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return ErrorResponses.invalidCredentials(res, req.id);
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        plan_expires: user.plan_expires
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return ErrorResponses.internalError(res, 'Login failed', req.id);
  }
});

/**
 * Get current user profile
 * Returns user information based on JWT token
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.user_id);
    
    if (!user) {
      return ErrorResponses.notFound(res, 'User', req.id);
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      plan_expires: user.plan_expires,
      is_admin: user.is_admin
    });
  } catch (error) {
    console.error('Get user error:', error);
    return ErrorResponses.internalError(res, 'Failed to get user', req.id);
  }
});

/**
 * Claim or upgrade user plan
 * Updates user's subscription plan with new expiration date
 */
router.post('/claim-plan', authenticateJWT, validate(schemas.claimPlan), async (req, res) => {
  const { plan } = req.body;
  const userId = req.user.user_id;
  
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return ErrorResponses.notFound(res, 'User', req.id);
    }
    
    // Set plan expiration based on plan type
    let expiresAt;
    const planConfig = config.plans[plan];
    
    if (!planConfig) {
      return ErrorResponses.badRequest(res, 'Invalid plan type', null, req.id);
    }
    
    expiresAt = new Date(Date.now() + planConfig.duration);
    
    await db.updateUserPlan(userId, plan, expiresAt);
    
    res.json({ 
      success: true, 
      plan, 
      expires_at: expiresAt.toISOString() 
    });
  } catch (error) {
    console.error('Claim plan error:', error);
    return ErrorResponses.internalError(res, 'Failed to claim plan', req.id);
  }
});

module.exports = router;

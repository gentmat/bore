const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { db } = require('../database');
const { generateToken, authenticateJWT } = require('../auth-middleware');

// Sign up
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Check if user already exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ 
        error: 'user_exists', 
        message: 'Email already registered' 
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set plan expiry (24 hours from now for trial)
    const planExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Create user
    const user = await db.createUser(userId, email, passwordHash, name);
    await db.updateUserPlan(userId, 'trial', planExpires);
    
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Signup failed' 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await db.getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'invalid_credentials', 
        message: 'Invalid email or password' 
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'invalid_credentials', 
        message: 'Invalid email or password' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Login failed' 
    });
  }
});

// Get current user
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.user_id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'User not found' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to get user' 
    });
  }
});

// Claim plan
router.post('/claim-plan', authenticateJWT, async (req, res) => {
  const { plan } = req.body;
  const userId = req.user.user_id;
  
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'User not found' 
      });
    }
    
    // Set plan expiration based on plan type
    let expiresAt;
    if (plan === 'trial') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    } else if (plan === 'pro') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else {
      return res.status(400).json({ 
        error: 'invalid_plan', 
        message: 'Invalid plan type' 
      });
    }
    
    await db.updateUserPlan(userId, plan, expiresAt);
    
    res.json({ 
      success: true, 
      plan, 
      expires_at: expiresAt.toISOString() 
    });
  } catch (error) {
    console.error('Claim plan error:', error);
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to claim plan' 
    });
  }
});

module.exports = router;

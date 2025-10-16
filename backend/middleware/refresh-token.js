/**
 * Refresh Token Service
 * Handles refresh token generation, validation, and rotation
 */

const crypto = require('crypto');
const { db } = require('../database');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * Generate a secure refresh token
 * @returns {string} Random refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Calculate refresh token expiration
 * @returns {Date} Expiration date (30 days from now)
 */
function getRefreshTokenExpiration() {
  const expirationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  return new Date(Date.now() + expirationMs);
}

/**
 * Create and store refresh token
 * @param {string} userId - User ID
 * @param {string} userAgent - User agent string
 * @param {string} ipAddress - IP address
 * @returns {Promise<Object>} Refresh token data
 */
async function createRefreshToken(userId, userAgent = null, ipAddress = null) {
  const token = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiration();
  
  try {
    await db.query(
      `INSERT INTO refresh_tokens (token, user_id, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, userId, userAgent, ipAddress, expiresAt]
    );
    
    logger.debug(`Created refresh token for user ${userId}`);
    
    return {
      token,
      expiresAt
    };
  } catch (error) {
    logger.error('Failed to create refresh token', error);
    throw error;
  }
}

/**
 * Validate refresh token
 * @param {string} token - Refresh token
 * @returns {Promise<Object|null>} Token data or null if invalid
 */
async function validateRefreshToken(token) {
  try {
    const result = await db.query(
      `SELECT * FROM refresh_tokens 
       WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to validate refresh token', error);
    return null;
  }
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<boolean>} Success status
 */
async function revokeRefreshToken(token) {
  try {
    await db.query(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token = $1',
      [token]
    );
    
    logger.debug('Revoked refresh token');
    return true;
  } catch (error) {
    logger.error('Failed to revoke refresh token', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function revokeAllUserTokens(userId) {
  try {
    await db.query(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE user_id = $1 AND revoked = FALSE',
      [userId]
    );
    
    logger.info(`Revoked all refresh tokens for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke user tokens', error);
    return false;
  }
}

/**
 * Clean up expired refresh tokens (run periodically)
 * @returns {Promise<number>} Number of tokens deleted
 */
async function cleanupExpiredTokens() {
  try {
    const result = await db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL \'7 days\')'
    );
    
    const deletedCount = result.rowCount;
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired refresh tokens`);
    }
    
    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', error);
    return 0;
  }
}

/**
 * Get all active refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active tokens
 */
async function getUserTokens(userId) {
  try {
    const result = await db.query(
      `SELECT token, user_agent, ip_address, created_at, expires_at 
       FROM refresh_tokens 
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Failed to get user tokens', error);
    return [];
  }
}

module.exports = {
  generateRefreshToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getUserTokens
};

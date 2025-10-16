/**
 * Refresh Token Service
 * Handles refresh token generation, validation, and rotation
 */

import crypto from 'crypto';
import { db } from '../database';
import { logger } from '../utils/logger';

interface RefreshTokenData {
  token: string;
  expiresAt: Date;
}

interface RefreshTokenRecord {
  token: string;
  user_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
  expires_at: Date;
  revoked: boolean;
  revoked_at: Date | null;
}

interface UserTokenInfo {
  token: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
  expires_at: Date;
}

/**
 * Generate a secure refresh token
 * @returns Random refresh token
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Calculate refresh token expiration
 * @returns Expiration date (30 days from now)
 */
function getRefreshTokenExpiration(): Date {
  const expirationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  return new Date(Date.now() + expirationMs);
}

/**
 * Create and store refresh token
 * @param userId - User ID
 * @param userAgent - User agent string
 * @param ipAddress - IP address
 * @returns Refresh token data
 */
async function createRefreshToken(
  userId: string,
  userAgent: string | null = null,
  ipAddress: string | null = null
): Promise<RefreshTokenData> {
  const token = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiration();
  
  try {
    await (db as any).query(
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
    logger.error('Failed to create refresh token', error as Error);
    throw error;
  }
}

/**
 * Validate refresh token
 * @param token - Refresh token
 * @returns Token data or null if invalid
 */
async function validateRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
  try {
    const result = await (db as any).query(
      `SELECT * FROM refresh_tokens 
       WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [token]
    ) as { rows: any[] };
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as RefreshTokenRecord;
  } catch (error) {
    logger.error('Failed to validate refresh token', error as Error);
    return null;
  }
}

/**
 * Revoke refresh token
 * @param token - Refresh token to revoke
 * @returns Success status
 */
async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    await (db as any).query(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token = $1',
      [token]
    );
    
    logger.debug('Revoked refresh token');
    return true;
  } catch (error) {
    logger.error('Failed to revoke refresh token', error as Error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 * @param userId - User ID
 * @returns Success status
 */
async function revokeAllUserTokens(userId: string): Promise<boolean> {
  try {
    await (db as any).query(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE user_id = $1 AND revoked = FALSE',
      [userId]
    );
    
    logger.info(`Revoked all refresh tokens for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke user tokens', error as Error);
    return false;
  }
}

/**
 * Clean up expired refresh tokens (run periodically)
 * @returns Number of tokens deleted
 */
async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await (db as any).query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL \'7 days\')'
    ) as { rowCount: number | null };
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired refresh tokens`);
    }
    
    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', error as Error);
    return 0;
  }
}

/**
 * Get all active refresh tokens for a user
 * @param userId - User ID
 * @returns Array of active tokens
 */
async function getUserTokens(userId: string): Promise<UserTokenInfo[]> {
  try {
    const result = await (db as any).query(
      `SELECT token, user_agent, ip_address, created_at, expires_at 
       FROM refresh_tokens 
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    ) as { rows: any[] };
    
    return result.rows as UserTokenInfo[];
  } catch (error) {
    logger.error('Failed to get user tokens', error as Error);
    return [];
  }
}

export {
  generateRefreshToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getUserTokens,
  RefreshTokenData,
  RefreshTokenRecord,
  UserTokenInfo
};

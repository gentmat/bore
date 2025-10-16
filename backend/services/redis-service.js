/**
 * Redis Service
 * Centralized Redis client for distributed state management
 * Enables horizontal scaling by moving in-memory state to Redis
 */

const redis = require('redis');
const config = require('../config');
const { logger } = require('../utils/logger');

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 * @returns {Promise<Object>} Redis client instance
 */
async function initializeRedis() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  // If Redis is disabled, return null (fall back to in-memory)
  if (!config.redis.enabled) {
    logger.warn('Redis is disabled - using in-memory state (not suitable for production scaling)');
    return null;
  }

  try {
    redisClient = redis.createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnect failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 50, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
      isConnected = false;
    });

    await redisClient.connect();
    logger.info('🔗 Redis initialized successfully');
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if not connected
 */
function getClient() {
  return isConnected ? redisClient : null;
}

/**
 * Scan Redis keys with pattern (production-safe alternative to KEYS)
 * @param {string} pattern - Key pattern to match (e.g., 'heartbeat:*')
 * @returns {Promise<Array<string>>} Array of matching keys
 */
async function scanKeys(pattern) {
  const client = getClient();
  if (!client) return [];
  
  try {
    const keys = [];
    let cursor = 0;
    
    do {
      const result = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    
    return keys;
  } catch (error) {
    logger.error(`Failed to scan keys with pattern ${pattern}`, error);
    return [];
  }
}

/**
 * Heartbeat operations
 */
const heartbeats = {
  /**
   * Set instance heartbeat timestamp
   * @param {string} instanceId - Instance ID
   * @param {number} timestamp - Timestamp in milliseconds
   * @param {number} ttl - Time to live in seconds (default: 60)
   */
  async set(instanceId, timestamp, ttl = 60) {
    const client = getClient();
    if (!client) return; // Fall back to in-memory if Redis unavailable
    
    try {
      const key = `heartbeat:${instanceId}`;
      await client.setEx(key, ttl, timestamp.toString());
    } catch (error) {
      logger.error(`Failed to set heartbeat for ${instanceId}`, error);
    }
  },

  /**
   * Get instance heartbeat timestamp
   * @param {string} instanceId - Instance ID
   * @returns {Promise<number|null>} Timestamp or null
   */
  async get(instanceId) {
    const client = getClient();
    if (!client) return null;
    
    try {
      const key = `heartbeat:${instanceId}`;
      const value = await client.get(key);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error(`Failed to get heartbeat for ${instanceId}`, error);
      return null;
    }
  },

  /**
   * Delete instance heartbeat
   * @param {string} instanceId - Instance ID
   */
  async delete(instanceId) {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `heartbeat:${instanceId}`;
      await client.del(key);
    } catch (error) {
      logger.error(`Failed to delete heartbeat for ${instanceId}`, error);
    }
  },

  /**
   * Get all instance heartbeats
   * @returns {Promise<Map>} Map of instanceId -> timestamp
   */
  async getAll() {
    const client = getClient();
    if (!client) return new Map();
    
    try {
      const keys = await scanKeys('heartbeat:*');
      const heartbeatMap = new Map();
      
      for (const key of keys) {
        const instanceId = key.replace('heartbeat:', '');
        const value = await client.get(key);
        if (value) {
          heartbeatMap.set(instanceId, parseInt(value, 10));
        }
      }
      
      return heartbeatMap;
    } catch (error) {
      logger.error('Failed to get all heartbeats', error);
      return new Map();
    }
  }
};

/**
 * Server registry operations
 */
const servers = {
  /**
   * Register or update server
   * @param {string} serverId - Server ID
   * @param {Object} serverData - Server information
   */
  async set(serverId, serverData) {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `server:${serverId}`;
      await client.setEx(key, 300, JSON.stringify(serverData)); // 5 minute TTL
    } catch (error) {
      logger.error(`Failed to register server ${serverId}`, error);
    }
  },

  /**
   * Get server information
   * @param {string} serverId - Server ID
   * @returns {Promise<Object|null>} Server data or null
   */
  async get(serverId) {
    const client = getClient();
    if (!client) return null;
    
    try {
      const key = `server:${serverId}`;
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get server ${serverId}`, error);
      return null;
    }
  },

  /**
   * Get all registered servers
   * @returns {Promise<Map>} Map of serverId -> serverData
   */
  async getAll() {
    const client = getClient();
    if (!client) return new Map();
    
    try {
      const keys = await scanKeys('server:*');
      const serverMap = new Map();
      
      for (const key of keys) {
        const serverId = key.replace('server:', '');
        const value = await client.get(key);
        if (value) {
          serverMap.set(serverId, JSON.parse(value));
        }
      }
      
      return serverMap;
    } catch (error) {
      logger.error('Failed to get all servers', error);
      return new Map();
    }
  },

  /**
   * Delete server
   * @param {string} serverId - Server ID
   */
  async delete(serverId) {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `server:${serverId}`;
      await client.del(key);
    } catch (error) {
      logger.error(`Failed to delete server ${serverId}`, error);
    }
  }
};

/**
 * Session/token blacklist operations (for token revocation)
 */
const tokenBlacklist = {
  /**
   * Blacklist a token (for logout/revocation)
   * @param {string} token - JWT token
   * @param {number} expiresIn - Seconds until token naturally expires
   */
  async add(token, expiresIn) {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `blacklist:${token}`;
      await client.setEx(key, expiresIn, '1');
    } catch (error) {
      logger.error('Failed to blacklist token', error);
    }
  },

  /**
   * Check if token is blacklisted
   * @param {string} token - JWT token
   * @returns {Promise<boolean>} True if blacklisted
   */
  async isBlacklisted(token) {
    const client = getClient();
    if (!client) return false;
    
    try {
      const key = `blacklist:${token}`;
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check token blacklist', error);
      return false;
    }
  }
};

/**
 * Health check - verify Redis is responsive
 * @returns {Promise<boolean>} True if healthy
 */
async function healthCheck() {
  const client = getClient();
  if (!client || !isConnected) {
    return false;
  }

  try {
    // Simple PING command to verify connectivity
    const response = await client.ping();
    return response === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  if (redisClient && isConnected) {
    logger.info('Closing Redis connection...');
    await redisClient.quit();
    isConnected = false;
    logger.info('Redis connection closed');
  }
}

module.exports = {
  initializeRedis,
  getClient,
  heartbeats,
  servers,
  tokenBlacklist,
  healthCheck,
  shutdown
};

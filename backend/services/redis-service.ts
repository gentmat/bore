/**
 * Redis Service
 * Centralized Redis client for distributed state management
 * Enables horizontal scaling by moving in-memory state to Redis
 */

import redis, { RedisClientType } from 'redis';
import config from '../config';
import { logger } from '../utils/logger';

type RedisClient = RedisClientType;

let redisClient: RedisClient | null = null;
let isConnected = false;

/**
 * Initialize Redis connection
 * @returns Redis client instance or null if disabled
 */
export async function initializeRedis(): Promise<RedisClient | null> {
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
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Redis reconnect failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 50, 3000);
        }
      }
    }) as RedisClient;

    redisClient.on('error', (err: Error) => {
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
    logger.error('Failed to initialize Redis', error as Error);
    throw error;
  }
}

/**
 * Get Redis client instance
 * @returns Redis client or null if not connected
 */
export function getClient(): RedisClient | null {
  return isConnected ? redisClient : null;
}

/**
 * Scan Redis keys with pattern (production-safe alternative to KEYS)
 * @param pattern - Key pattern to match (e.g., 'heartbeat:*')
 * @returns Array of matching keys
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const client = getClient();
  if (!client) return [];
  
  try {
    const keys: string[] = [];
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
    logger.error(`Failed to scan keys with pattern ${pattern}`, error as Error);
    return [];
  }
}

/**
 * Heartbeat operations
 */
export const heartbeats = {
  /**
   * Set instance heartbeat timestamp
   * @param instanceId - Instance ID
   * @param timestamp - Timestamp in milliseconds
   * @param ttl - Time to live in seconds (default: 60)
   */
  async set(instanceId: string, timestamp: number, ttl: number = 60): Promise<void> {
    const client = getClient();
    if (!client) return; // Fall back to in-memory if Redis unavailable
    
    try {
      const key = `heartbeat:${instanceId}`;
      await client.setEx(key, ttl, timestamp.toString());
    } catch (error) {
      logger.error(`Failed to set heartbeat for ${instanceId}`, error as Error);
    }
  },

  /**
   * Get instance heartbeat timestamp
   * @param instanceId - Instance ID
   * @returns Timestamp or null
   */
  async get(instanceId: string): Promise<number | null> {
    const client = getClient();
    if (!client) return null;
    
    try {
      const key = `heartbeat:${instanceId}`;
      const value = await client.get(key);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error(`Failed to get heartbeat for ${instanceId}`, error as Error);
      return null;
    }
  },

  /**
   * Delete instance heartbeat
   * @param instanceId - Instance ID
   */
  async delete(instanceId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `heartbeat:${instanceId}`;
      await client.del(key);
    } catch (error) {
      logger.error(`Failed to delete heartbeat for ${instanceId}`, error as Error);
    }
  },

  /**
   * Get all instance heartbeats
   * @returns Map of instanceId -> timestamp
   */
  async getAll(): Promise<Map<string, number>> {
    const client = getClient();
    if (!client) return new Map();
    
    try {
      const keys = await scanKeys('heartbeat:*');
      const heartbeatMap = new Map<string, number>();
      
      for (const key of keys) {
        const instanceId = key.replace('heartbeat:', '');
        const value = await client.get(key);
        if (value) {
          heartbeatMap.set(instanceId, parseInt(value, 10));
        }
      }
      
      return heartbeatMap;
    } catch (error) {
      logger.error('Failed to get all heartbeats', error as Error);
      return new Map();
    }
  }
};

/**
 * Server data interface
 */
interface ServerData {
  [key: string]: any;
}

/**
 * Server registry operations
 */
export const servers = {
  /**
   * Register or update server
   * @param serverId - Server ID
   * @param serverData - Server information
   */
  async set(serverId: string, serverData: ServerData): Promise<void> {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `server:${serverId}`;
      await client.setEx(key, 300, JSON.stringify(serverData)); // 5 minute TTL
    } catch (error) {
      logger.error(`Failed to register server ${serverId}`, error as Error);
    }
  },

  /**
   * Get server information
   * @param serverId - Server ID
   * @returns Server data or null
   */
  async get(serverId: string): Promise<ServerData | null> {
    const client = getClient();
    if (!client) return null;
    
    try {
      const key = `server:${serverId}`;
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get server ${serverId}`, error as Error);
      return null;
    }
  },

  /**
   * Get all registered servers
   * @returns Map of serverId -> serverData
   */
  async getAll(): Promise<Map<string, ServerData>> {
    const client = getClient();
    if (!client) return new Map();
    
    try {
      const keys = await scanKeys('server:*');
      const serverMap = new Map<string, ServerData>();
      
      for (const key of keys) {
        const serverId = key.replace('server:', '');
        const value = await client.get(key);
        if (value) {
          serverMap.set(serverId, JSON.parse(value));
        }
      }
      
      return serverMap;
    } catch (error) {
      logger.error('Failed to get all servers', error as Error);
      return new Map();
    }
  },

  /**
   * Delete server
   * @param serverId - Server ID
   */
  async delete(serverId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `server:${serverId}`;
      await client.del(key);
    } catch (error) {
      logger.error(`Failed to delete server ${serverId}`, error as Error);
    }
  }
};

/**
 * Session/token blacklist operations (for token revocation)
 */
export const tokenBlacklist = {
  /**
   * Blacklist a token (for logout/revocation)
   * @param token - JWT token
   * @param expiresIn - Seconds until token naturally expires
   */
  async add(token: string, expiresIn: number): Promise<void> {
    const client = getClient();
    if (!client) return;
    
    try {
      const key = `blacklist:${token}`;
      await client.setEx(key, expiresIn, '1');
    } catch (error) {
      logger.error('Failed to blacklist token', error as Error);
    }
  },

  /**
   * Check if token is blacklisted
   * @param token - JWT token
   * @returns True if blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const client = getClient();
    if (!client) return false;
    
    try {
      const key = `blacklist:${token}`;
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check token blacklist', error as Error);
      return false;
    }
  }
};

/**
 * Health check - verify Redis is responsive
 * @returns True if healthy
 */
export async function healthCheck(): Promise<boolean> {
  const client = getClient();
  if (!client || !isConnected) {
    return false;
  }

  try {
    // Simple PING command to verify connectivity
    const response = await client.ping();
    return response === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', error as Error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function shutdown(): Promise<void> {
  if (redisClient && isConnected) {
    logger.info('Closing Redis connection...');
    await redisClient.quit();
    isConnected = false;
    logger.info('Redis connection closed');
  }
}

// Export scanKeys for use in other modules (non-blocking alternative to KEYS)
export { scanKeys };

// Default export for backward compatibility
export default {
  initializeRedis,
  getClient,
  client: redisClient,
  heartbeats,
  servers,
  tokenBlacklist,
  healthCheck,
  shutdown,
  scanKeys
};

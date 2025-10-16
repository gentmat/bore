/**
 * Physical Server Registry
 * Manages fleet of bore-server instances across multiple machines
 * Supports distributed deployments via Redis or in-memory for single instance
 */

import { db } from './database';
import config from './config';
import redisService from './services/redis-service';
import { logger } from './utils/logger';
import CircuitBreaker from './utils/circuit-breaker';

/**
 * Bore server configuration
 */
export interface BoreServerInfo {
  id?: string;
  host: string;
  port?: number;
  location?: string;
  maxBandwidthMbps?: number;
  maxConcurrentTunnels?: number;
}

/**
 * Registered bore server
 */
export interface BoreServer {
  id: string;
  host: string;
  port: number;
  location: string;
  maxBandwidthMbps: number;
  maxConcurrentTunnels: number;
  status: 'active' | 'inactive' | 'unhealthy';
  registeredAt: string;
  lastHealthCheck: string;
  currentLoad: number;
  currentBandwidthMbps: number;
}

/**
 * Server with utilization metrics
 */
interface ServerWithUtilization extends BoreServer {
  tunnelUtilization: number;
  bandwidthUtilization: number;
  overallUtilization: number;
}

/**
 * Fleet statistics
 */
export interface FleetStats {
  serverCount: number;
  totalCapacity: number;
  totalLoad: number;
  utilizationPercent: number;
  totalBandwidthGbps: number;
  usedBandwidthGbps: number;
  bandwidthUtilizationPercent: number;
  servers: Array<{
    id: string;
    host: string;
    location: string;
    load: number;
    maxLoad: number;
    utilizationPercent: number;
    bandwidthUsedMbps: number;
    bandwidthMaxMbps: number;
    lastHealthCheck: string;
  }>;
}

/**
 * Server load stats
 */
interface ServerLoadStats {
  currentLoad: number;
  currentBandwidthMbps: number;
  lastHealthCheck: string;
  timestamp: number;
}

// In-memory fallback (when Redis is disabled)
const servers = new Map<string, BoreServer>();

// Redis key prefix
const REDIS_PREFIX = 'bore:server:';
const REDIS_STATS_PREFIX = 'bore:server:stats:';
const SERVER_TTL = 60; // Server registration TTL in seconds

// Circuit breaker for Redis operations
const redisCircuitBreaker = new CircuitBreaker({
  name: 'redis-registry',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 5000, // 5 seconds
  resetTimeout: 30000 // 30 seconds
});

/**
 * Register a new bore-server instance
 */
export async function registerServer(serverInfo: BoreServerInfo): Promise<BoreServer> {
  const server: BoreServer = {
    id: serverInfo.id || `server_${Date.now()}`,
    host: serverInfo.host, // e.g., "192.168.1.100"
    port: serverInfo.port || 7835,
    location: serverInfo.location || 'sweden-home',
    maxBandwidthMbps: serverInfo.maxBandwidthMbps || 1000, // 1 Gbps
    maxConcurrentTunnels: serverInfo.maxConcurrentTunnels || 100,
    status: 'active',
    registeredAt: new Date().toISOString(),
    lastHealthCheck: new Date().toISOString(),
    currentLoad: 0,
    currentBandwidthMbps: 0
  };
  
  // Store in Redis if enabled (with TTL for auto-cleanup of dead servers)
  if (config.redis.enabled) {
    try {
      await redisCircuitBreaker.execute(async () => {
        const client: any = redisService.getClient();
        if (client) {
          await client.setEx(
            `${REDIS_PREFIX}${server.id}`,
            SERVER_TTL,
            JSON.stringify(server)
          );
        }
      });
      logger.info(`Registered server ${server.id} in Redis`);
    } catch (error) {
      logger.warn(`Failed to register server in Redis: ${(error as Error).message}`);
    }
  }
  
  // Store in memory as fallback
  servers.set(server.id, server);
  
  // Persist to database for long-term storage
  await db.query(`
    INSERT INTO bore_servers (id, host, port, location, max_bandwidth_mbps, max_concurrent_tunnels, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      host = $2,
      port = $3,
      status = $7,
      updated_at = CURRENT_TIMESTAMP
  `, [server.id, server.host, server.port, server.location, server.maxBandwidthMbps, server.maxConcurrentTunnels, server.status]);
  
  logger.info(`✅ Registered bore-server: ${server.id} at ${server.host}:${server.port}`);
  return server;
}

/**
 * Get all active servers
 */
export async function getActiveServers(): Promise<BoreServer[]> {
  // Try Redis first for distributed deployments
  if (config.redis.enabled) {
    try {
      const redisServers = await redisCircuitBreaker.execute(async () => {
        const client: any = redisService.getClient();
        if (!client) return [];
        
        const keys: string[] = await client.keys(`${REDIS_PREFIX}*`);
        const serverPromises = keys.map(async (key: string) => {
          const data = await client.get(key);
          return data ? JSON.parse(data) as BoreServer : null;
        });
        return (await Promise.all(serverPromises))
          .filter((s: BoreServer | null): s is BoreServer => s !== null && s.status === 'active');
      });
      
      if (redisServers.length > 0) {
        return redisServers;
      }
    } catch (error) {
      logger.warn(`Failed to get servers from Redis: ${(error as Error).message}`);
    }
  }
  
  // Fallback to in-memory
  return Array.from(servers.values()).filter(s => s.status === 'active');
}

/**
 * Get server with most available capacity (lowest utilization)
 */
export async function getBestServer(): Promise<BoreServer | null> {
  const active = await getActiveServers();
  
  if (active.length === 0) return null;
  
  // Calculate utilization for each server
  const withUtilization: ServerWithUtilization[] = active.map(server => ({
    ...server,
    tunnelUtilization: (server.currentLoad / server.maxConcurrentTunnels) * 100,
    bandwidthUtilization: (server.currentBandwidthMbps / server.maxBandwidthMbps) * 100,
    // Use worst of the two metrics
    overallUtilization: Math.max(
      (server.currentLoad / server.maxConcurrentTunnels) * 100,
      (server.currentBandwidthMbps / server.maxBandwidthMbps) * 100
    )
  }));
  
  // Sort by utilization (lowest first)
  withUtilization.sort((a, b) => a.overallUtilization - b.overallUtilization);
  
  return withUtilization[0] || null;
}

/**
 * Update server load metrics
 */
export async function updateServerLoad(serverId: string, load: number, bandwidthMbps: number): Promise<void> {
  const stats: ServerLoadStats = {
    currentLoad: load,
    currentBandwidthMbps: bandwidthMbps,
    lastHealthCheck: new Date().toISOString(),
    timestamp: Date.now()
  };
  
  // Update Redis if enabled
  if (config.redis.enabled) {
    try {
      const client: any = redisService.getClient();
      if (client) {
        // Get existing server data
        const serverData = await client.get(`${REDIS_PREFIX}${serverId}`);
        if (serverData) {
          const server = JSON.parse(serverData) as BoreServer;
          server.currentLoad = load;
          server.currentBandwidthMbps = bandwidthMbps;
          server.lastHealthCheck = stats.lastHealthCheck;
          
          // Update with extended TTL (server is healthy)
          await client.setEx(
            `${REDIS_PREFIX}${serverId}`,
            SERVER_TTL,
            JSON.stringify(server)
          );
        }
        
        // Also store detailed stats with shorter TTL
        await client.setEx(
          `${REDIS_STATS_PREFIX}${serverId}`,
          300, // 5 minutes
          JSON.stringify(stats)
        );
      }
    } catch (error) {
      logger.warn(`Failed to update server load in Redis: ${(error as Error).message}`);
    }
  }
  
  // Update in-memory cache
  const server = servers.get(serverId);
  if (server) {
    server.currentLoad = load;
    server.currentBandwidthMbps = bandwidthMbps;
    server.lastHealthCheck = stats.lastHealthCheck;
  }
}

/**
 * Mark server as unhealthy
 */
export async function markServerUnhealthy(serverId: string): Promise<void> {
  const server = servers.get(serverId);
  if (server) {
    server.status = 'unhealthy';
    await db.query('UPDATE bore_servers SET status = $1 WHERE id = $2', ['unhealthy', serverId]);
    logger.warn(`Server ${serverId} marked as unhealthy`);
  }
}

/**
 * Get fleet-wide statistics
 */
export async function getFleetStats(): Promise<FleetStats> {
  const active = await getActiveServers();
  
  const totalCapacity = active.reduce((sum, s) => sum + s.maxConcurrentTunnels, 0);
  const totalLoad = active.reduce((sum, s) => sum + s.currentLoad, 0);
  const totalBandwidth = active.reduce((sum, s) => sum + s.maxBandwidthMbps, 0);
  const usedBandwidth = active.reduce((sum, s) => sum + s.currentBandwidthMbps, 0);
  
  return {
    serverCount: active.length,
    totalCapacity,
    totalLoad,
    utilizationPercent: totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0,
    totalBandwidthGbps: totalBandwidth / 1000,
    usedBandwidthGbps: usedBandwidth / 1000,
    bandwidthUtilizationPercent: totalBandwidth > 0 ? (usedBandwidth / totalBandwidth) * 100 : 0,
    servers: active.map(s => ({
      id: s.id,
      host: s.host,
      location: s.location,
      load: s.currentLoad,
      maxLoad: s.maxConcurrentTunnels,
      utilizationPercent: (s.currentLoad / s.maxConcurrentTunnels) * 100,
      bandwidthUsedMbps: s.currentBandwidthMbps,
      bandwidthMaxMbps: s.maxBandwidthMbps,
      lastHealthCheck: s.lastHealthCheck
    }))
  };
}

/**
 * Get circuit breaker stats
 */
export function getCircuitBreakerStats() {
  return redisCircuitBreaker.getStats();
}

// Export the servers map for backward compatibility
export { servers };

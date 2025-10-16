/**
 * Physical Server Registry
 * Manages fleet of bore-server instances across multiple machines
 * Supports distributed deployments via Redis or in-memory for single instance
 */

const { db } = require('./database');
const config = require('./config');
const redisService = require('./services/redis-service');
const { logger } = require('./utils/logger');

// In-memory fallback (when Redis is disabled)
const servers = new Map();

// Redis key prefix
const REDIS_PREFIX = 'bore:server:';
const REDIS_STATS_PREFIX = 'bore:server:stats:';
const SERVER_TTL = 60; // Server registration TTL in seconds

/**
 * Register a new bore-server instance
 * @param {Object} serverInfo - Server configuration
 * @param {string} serverInfo.id - Server ID
 * @param {string} serverInfo.host - Server hostname or IP
 * @param {number} serverInfo.port - Server port
 * @param {string} serverInfo.location - Server location/region
 * @param {number} serverInfo.maxBandwidthMbps - Maximum bandwidth in Mbps
 * @param {number} serverInfo.maxConcurrentTunnels - Maximum concurrent tunnels
 * @returns {Promise<Object>} Registered server object
 */
async function registerServer(serverInfo) {
  const server = {
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
      await redisService.client.setex(
        `${REDIS_PREFIX}${server.id}`,
        SERVER_TTL,
        JSON.stringify(server)
      );
      logger.info(`Registered server ${server.id} in Redis`);
    } catch (error) {
      logger.warn(`Failed to register server in Redis: ${error.message}`);
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
 * @returns {Promise<Array>} Array of active server objects
 */
async function getActiveServers() {
  // Try Redis first for distributed deployments
  if (config.redis.enabled) {
    try {
      const keys = await redisService.client.keys(`${REDIS_PREFIX}*`);
      const serverPromises = keys.map(async (key) => {
        const data = await redisService.client.get(key);
        return data ? JSON.parse(data) : null;
      });
      const redisServers = (await Promise.all(serverPromises))
        .filter(s => s && s.status === 'active');
      
      if (redisServers.length > 0) {
        return redisServers;
      }
    } catch (error) {
      logger.warn(`Failed to get servers from Redis: ${error.message}`);
    }
  }
  
  // Fallback to in-memory
  return Array.from(servers.values()).filter(s => s.status === 'active');
}

/**
 * Get server with most available capacity (lowest utilization)
 * @returns {Promise<Object|null>} Best available server or null if none available
 */
async function getBestServer() {
  const active = await getActiveServers();
  
  if (active.length === 0) return null;
  
  // Calculate utilization for each server
  const withUtilization = active.map(server => ({
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
  
  return withUtilization[0];
}

/**
 * Update server load metrics
 * @param {string} serverId - Server ID
 * @param {number} load - Current number of active tunnels
 * @param {number} bandwidthMbps - Current bandwidth usage in Mbps
 * @returns {Promise<void>}
 */
async function updateServerLoad(serverId, load, bandwidthMbps) {
  const stats = {
    currentLoad: load,
    currentBandwidthMbps: bandwidthMbps,
    lastHealthCheck: new Date().toISOString(),
    timestamp: Date.now()
  };
  
  // Update Redis if enabled
  if (config.redis.enabled) {
    try {
      // Get existing server data
      const serverData = await redisService.client.get(`${REDIS_PREFIX}${serverId}`);
      if (serverData) {
        const server = JSON.parse(serverData);
        server.currentLoad = load;
        server.currentBandwidthMbps = bandwidthMbps;
        server.lastHealthCheck = stats.lastHealthCheck;
        
        // Update with extended TTL (server is healthy)
        await redisService.client.setex(
          `${REDIS_PREFIX}${serverId}`,
          SERVER_TTL,
          JSON.stringify(server)
        );
      }
      
      // Also store detailed stats with shorter TTL
      await redisService.client.setex(
        `${REDIS_STATS_PREFIX}${serverId}`,
        300, // 5 minutes
        JSON.stringify(stats)
      );
    } catch (error) {
      logger.warn(`Failed to update server load in Redis: ${error.message}`);
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
 * @param {string} serverId - Server ID to mark as unhealthy
 * @returns {Promise<void>}
 */
async function markServerUnhealthy(serverId) {
  const server = servers.get(serverId);
  if (server) {
    server.status = 'unhealthy';
    await db.query('UPDATE bore_servers SET status = $1 WHERE id = $2', ['unhealthy', serverId]);
    logger.warn(`Server ${serverId} marked as unhealthy`);
  }
}

/**
 * Get fleet-wide statistics
 * @returns {Promise<Object>} Fleet statistics including capacity, utilization, and bandwidth
 */
async function getFleetStats() {
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

module.exports = {
  registerServer,
  getActiveServers,
  getBestServer,
  updateServerLoad,
  markServerUnhealthy,
  getFleetStats,
  servers
};

/**
 * Physical Server Registry
 * Manages fleet of bore-server instances across multiple machines
 */

const { db } = require('./database');

// Server registry - can also store in database
const servers = new Map();

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
    registeredAt: new Date(),
    lastHealthCheck: new Date(),
    currentLoad: 0,
    currentBandwidthMbps: 0
  };
  
  servers.set(server.id, server);
  
  // Persist to database
  await db.query(`
    INSERT INTO bore_servers (id, host, port, location, max_bandwidth_mbps, max_concurrent_tunnels, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      host = $2,
      port = $3,
      status = $7,
      updated_at = CURRENT_TIMESTAMP
  `, [server.id, server.host, server.port, server.location, server.maxBandwidthMbps, server.maxConcurrentTunnels, server.status]);
  
  console.log(`✅ Registered bore-server: ${server.id} at ${server.host}:${server.port}`);
  return server;
}

/**
 * Get all active servers
 * @returns {Array} Array of active server objects
 */
function getActiveServers() {
  return Array.from(servers.values()).filter(s => s.status === 'active');
}

/**
 * Get server with most available capacity (lowest utilization)
 * @returns {Object|null} Best available server or null if none available
 */
function getBestServer() {
  const active = getActiveServers();
  
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
 */
function updateServerLoad(serverId, load, bandwidthMbps) {
  const server = servers.get(serverId);
  if (server) {
    server.currentLoad = load;
    server.currentBandwidthMbps = bandwidthMbps;
    server.lastHealthCheck = new Date();
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
    console.warn(`⚠️ Server ${serverId} marked as unhealthy`);
  }
}

/**
 * Get fleet-wide statistics
 * @returns {Object} Fleet statistics including capacity, utilization, and bandwidth
 */
function getFleetStats() {
  const active = getActiveServers();
  
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
      load: s.currentLoad,
      maxLoad: s.maxConcurrentTunnels,
      utilizationPercent: (s.currentLoad / s.maxConcurrentTunnels) * 100
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

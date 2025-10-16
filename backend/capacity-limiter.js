/**
 * Capacity Management System
 * Prevents overload and ensures fair resource allocation
 */

const { db } = require('./database');
const config = require('./config');
const { getFleetStats } = require('./server-registry');
const { logger } = require('./utils/logger');

// Configuration from environment variables
const CAPACITY_CONFIG = config.capacity;

// Maximum tunnels per user by plan (from config)
const maxTunnelsByPlan = {
  trial: config.plans.trial.maxConcurrentTunnels,
  pro: config.plans.pro.maxConcurrentTunnels,
  enterprise: config.plans.enterprise.maxConcurrentTunnels
};

/**
 * Check if system has capacity for new tunnel
 * Uses real-time data from server registry
 */
async function checkSystemCapacity() {
  try {
    // Get real-time fleet statistics
    const fleetStats = await getFleetStats();
    
    // If we have active servers, use their reported capacity
    if (fleetStats.serverCount > 0) {
      const availableCapacity = fleetStats.totalCapacity - fleetStats.totalLoad;
      const reservedSlots = Math.floor(fleetStats.totalCapacity * CAPACITY_CONFIG.reservedCapacityPercent / 100);
      
      return {
        hasCapacity: fleetStats.totalLoad < (fleetStats.totalCapacity - reservedSlots),
        activeTunnels: fleetStats.totalLoad,
        totalCapacity: fleetStats.totalCapacity,
        availableSlots: availableCapacity,
        utilizationPercent: fleetStats.utilizationPercent,
        serverCount: fleetStats.serverCount,
        bandwidthUtilization: fleetStats.bandwidthUtilizationPercent
      };
    }
    
    // Fallback: count from database
    const instances = await db.query(
      'SELECT COUNT(*) as active FROM instances WHERE tunnel_connected = TRUE'
    );
    
    const activeTunnels = parseInt(instances.rows[0].active);
    const totalCapacity = CAPACITY_CONFIG.totalSystemCapacity;
    const availableCapacity = totalCapacity - activeTunnels;
    const reservedSlots = Math.floor(totalCapacity * CAPACITY_CONFIG.reservedCapacityPercent / 100);
    
    return {
      hasCapacity: activeTunnels < (totalCapacity - reservedSlots),
      activeTunnels,
      totalCapacity,
      availableSlots: availableCapacity,
      utilizationPercent: (activeTunnels / totalCapacity) * 100,
      serverCount: 0,
      bandwidthUtilization: 0
    };
  } catch (error) {
    logger.error('System capacity check error', error);
    // Conservative approach: assume we're at capacity if check fails
    return {
      hasCapacity: false,
      error: error.message
    };
  }
}

/**
 * Check if user can create more tunnels
 */
async function checkUserQuota(userId) {
  try {
    const user = await db.getUserById(userId);
    if (!user) return { allowed: false, reason: 'User not found' };
    
    const plan = user.plan || 'trial';
    const maxTunnels = maxTunnelsByPlan[plan] || 1;
    
    // Count user's active tunnels
    const result = await db.query(
      'SELECT COUNT(*) as count FROM instances WHERE user_id = $1 AND tunnel_connected = TRUE',
      [userId]
    );
    
    const activeTunnels = parseInt(result.rows[0].count);
    
    return {
      allowed: activeTunnels < maxTunnels,
      activeTunnels,
      maxTunnels,
      plan,
      reason: activeTunnels >= maxTunnels ? `Plan limit reached (${maxTunnels} tunnels)` : null
    };
  } catch (error) {
    logger.error('User quota check error', error);
    return {
      allowed: false,
      reason: 'Failed to check quota',
      error: error.message
    };
  }
}

/**
 * Get least loaded bore-server
 * @deprecated Use server-registry.getBestServer() instead
 */
async function getLeastLoadedServer(availableServers) {
  logger.warn('getLeastLoadedServer is deprecated, use server-registry.getBestServer()');
  
  if (!availableServers || availableServers.length === 0) {
    return null;
  }
  
  // Sort by current load (ascending)
  const sorted = availableServers.sort((a, b) => a.currentLoad - b.currentLoad);
  
  // Return server with lowest load that's not at capacity
  for (const server of sorted) {
    if (server.currentLoad < CAPACITY_CONFIG.maxTunnelsPerServer) {
      return server;
    }
  }
  
  return null; // All servers at capacity
}

/**
 * Middleware: Check capacity before tunnel creation
 */
async function requireCapacity(req, res, next) {
  try {
    // Check system capacity
    const systemCheck = await checkSystemCapacity();
    
    if (!systemCheck.hasCapacity) {
      return res.status(503).json({
        error: 'capacity_exceeded',
        message: 'System at capacity. Please try again later or upgrade your plan.',
        details: {
          utilizationPercent: systemCheck.utilizationPercent.toFixed(1),
          activeTunnels: systemCheck.activeTunnels,
          totalCapacity: systemCheck.totalCapacity
        }
      });
    }
    
    // Check user quota
    const userCheck = await checkUserQuota(req.user.user_id);
    
    if (!userCheck.allowed) {
      return res.status(429).json({
        error: 'quota_exceeded',
        message: userCheck.reason,
        details: {
          activeTunnels: userCheck.activeTunnels,
          maxTunnels: userCheck.maxTunnels,
          plan: userCheck.plan
        },
        upgrade_url: '/claim-plan' // Encourage upgrade
      });
    }
    
    // Store capacity info in request for later use
    req.capacityInfo = {
      systemUtilization: systemCheck.utilizationPercent,
      userQuota: userCheck
    };
    
    next();
  } catch (error) {
    logger.error('Capacity check error', error);
    // Fail open (allow request) if check fails - adjust based on preference
    next();
  }
}

/**
 * Get capacity statistics (for admin dashboard)
 */
async function getCapacityStats() {
  const systemCheck = await checkSystemCapacity();
  const fleetStats = await getFleetStats();
  
  return {
    system: systemCheck,
    fleet: fleetStats,
    servers: fleetStats.servers,
    alerts: generateCapacityAlerts(systemCheck),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate capacity alerts
 */
function generateCapacityAlerts(capacityInfo) {
  const alerts = [];
  
  if (capacityInfo.utilizationPercent > 90) {
    alerts.push({
      severity: 'critical',
      message: 'System at 90%+ capacity - add servers immediately!',
      action: 'Add new bore-server instance'
    });
  } else if (capacityInfo.utilizationPercent > 75) {
    alerts.push({
      severity: 'warning',
      message: 'System at 75%+ capacity - prepare to add servers',
      action: 'Order new hardware or increase limits'
    });
  } else if (capacityInfo.utilizationPercent > 50) {
    alerts.push({
      severity: 'info',
      message: 'System at 50%+ capacity - monitor growth',
      action: 'Review growth rate and plan expansion'
    });
  }
  
  return alerts;
}

/**
 * Get real-time server loads from Redis/Database
 * @returns {Promise<Array>} Array of server load information
 */
async function getServerLoads() {
  try {
    const fleetStats = await getFleetStats();
    return fleetStats.servers || [];
  } catch (error) {
    logger.error('Failed to get server loads', error);
    return [];
  }
}

/**
 * Update capacity configuration (when you add new servers)
 * Note: This only updates runtime config. For persistent changes, update environment variables.
 */
function updateCapacity(newTotalCapacity) {
  logger.warn('updateCapacity() modifies runtime config only. Update TOTAL_SYSTEM_CAPACITY env var for persistent changes.');
  CAPACITY_CONFIG.totalSystemCapacity = newTotalCapacity;
  logger.info(`✅ System capacity updated to ${newTotalCapacity} tunnels (runtime only)`);
}

module.exports = {
  checkSystemCapacity,
  checkUserQuota,
  getLeastLoadedServer,
  requireCapacity,
  getCapacityStats,
  updateCapacity,
  CAPACITY_CONFIG
};

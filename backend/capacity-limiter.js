/**
 * Capacity Management System
 * Prevents overload and ensures fair resource allocation
 */

const { db } = require('./database');

// Configuration - ADJUST THESE BASED ON YOUR HARDWARE
const CAPACITY_CONFIG = {
  // Maximum concurrent tunnels per bore-server instance
  maxTunnelsPerServer: 100,
  
  // Maximum bandwidth per tunnel (Mbps) - prevents one user hogging all bandwidth
  maxBandwidthPerTunnel: 100, // 100 Mbps
  
  // Maximum tunnels per user (by plan)
  maxTunnelsByPlan: {
    trial: 1,    // Free tier: 1 tunnel
    pro: 5,      // Pro tier: 5 tunnels
    enterprise: 20  // Enterprise: 20 tunnels
  },
  
  // Total system capacity (adjust as you add servers)
  totalSystemCapacity: 100, // Start with 100, increase as you add machines
  
  // Reserve capacity for existing users
  reservedCapacityPercent: 20, // Keep 20% for existing users
};

/**
 * Check if system has capacity for new tunnel
 */
async function checkSystemCapacity() {
  // Count active tunnels across all instances
  const instances = await db.query(
    'SELECT COUNT(*) as active FROM instances WHERE tunnel_connected = TRUE'
  );
  
  const activeTunnels = parseInt(instances.rows[0].active);
  const availableCapacity = CAPACITY_CONFIG.totalSystemCapacity - activeTunnels;
  const reservedSlots = Math.floor(CAPACITY_CONFIG.totalSystemCapacity * CAPACITY_CONFIG.reservedCapacityPercent / 100);
  
  return {
    hasCapacity: activeTunnels < (CAPACITY_CONFIG.totalSystemCapacity - reservedSlots),
    activeTunnels,
    totalCapacity: CAPACITY_CONFIG.totalSystemCapacity,
    availableSlots: availableCapacity,
    utilizationPercent: (activeTunnels / CAPACITY_CONFIG.totalSystemCapacity) * 100
  };
}

/**
 * Check if user can create more tunnels
 */
async function checkUserQuota(userId) {
  const user = await db.getUserById(userId);
  if (!user) return { allowed: false, reason: 'User not found' };
  
  const plan = user.plan || 'trial';
  const maxTunnels = CAPACITY_CONFIG.maxTunnelsByPlan[plan] || 1;
  
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
}

/**
 * Get least loaded bore-server
 */
async function getLeastLoadedServer(availableServers) {
  // availableServers = [{ host: '192.168.1.100', port: 7835, currentLoad: 45 }, ...]
  
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
    console.error('Capacity check error:', error);
    // Fail open (allow request) if check fails - adjust based on preference
    next();
  }
}

/**
 * Get capacity statistics (for admin dashboard)
 */
async function getCapacityStats() {
  const systemCheck = await checkSystemCapacity();
  
  // Get per-server load (you'll need to track this in Redis or DB)
  const servers = await getServerLoads();
  
  return {
    system: systemCheck,
    servers: servers,
    alerts: generateCapacityAlerts(systemCheck)
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
 * Placeholder - get server loads from your monitoring system
 */
async function getServerLoads() {
  // TODO: Implement actual server load tracking
  // This should query Redis or your monitoring system
  return [
    { host: '192.168.1.100', port: 7835, currentLoad: 45, maxLoad: 100, status: 'healthy' },
    { host: '192.168.1.101', port: 7835, currentLoad: 67, maxLoad: 100, status: 'healthy' },
  ];
}

/**
 * Update capacity configuration (when you add new servers)
 */
function updateCapacity(newTotalCapacity) {
  CAPACITY_CONFIG.totalSystemCapacity = newTotalCapacity;
  console.log(`✅ System capacity updated to ${newTotalCapacity} tunnels`);
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

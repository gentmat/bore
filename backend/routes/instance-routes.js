const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config');
const { db } = require('../database');
const { authenticateJWT } = require('../auth-middleware');
const { incrementCounter, recordHistogram } = require('../metrics');
const { schemas, validate } = require('../middleware/validation');
const { createInstanceLimiter, tunnelLimiter } = require('../middleware/rate-limiter');
const { ErrorResponses } = require('../utils/error-handler');
const redisService = require('../services/redis-service');
const { requireCapacity, checkUserQuota } = require('../capacity-limiter');
const { logger } = require('../utils/logger');

const BORE_SERVER_HOST = config.boreServer.host;
const BORE_SERVER_PORT = config.boreServer.port;

// Heartbeat tracking - uses Redis when available, falls back to in-memory
const instanceHeartbeats = new Map(); // Fallback for when Redis is unavailable
const HEARTBEAT_TIMEOUT = config.heartbeat.timeout;

/**
 * Get heartbeat timestamp for instance (Redis-aware)
 */
async function getHeartbeat(instanceId) {
  if (config.redis.enabled) {
    const timestamp = await redisService.heartbeats.get(instanceId);
    if (timestamp !== null) return timestamp;
  }
  return instanceHeartbeats.get(instanceId);
}

/**
 * Set heartbeat timestamp for instance (Redis-aware)
 */
async function setHeartbeat(instanceId, timestamp) {
  if (config.redis.enabled) {
    await redisService.heartbeats.set(instanceId, timestamp, 60);
  }
  // Always keep in-memory as fallback
  instanceHeartbeats.set(instanceId, timestamp);
}

/**
 * Delete heartbeat for instance (Redis-aware)
 */
async function deleteHeartbeat(instanceId) {
  if (config.redis.enabled) {
    await redisService.heartbeats.delete(instanceId);
  }
  instanceHeartbeats.delete(instanceId);
}

// Get all instances for user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const instances = await db.getInstancesByUserId(req.user.user_id);
    
    // Add heartbeat age to each instance (using camelCase)
    const withHeartbeat = await Promise.all(instances.map(async (instance) => {
      const lastHeartbeat = await getHeartbeat(instance.id);
      return {
        ...instance,
        lastHeartbeat: lastHeartbeat,
        heartbeatAgeMs: lastHeartbeat ? Date.now() - lastHeartbeat : null
      };
    }));
    
    res.json(withHeartbeat);
  } catch (error) {
    logger.error('List instances error', error);
    return ErrorResponses.internalError(res, 'Failed to list instances', req.id);
  }
});

// Create instance
router.post('/', authenticateJWT, createInstanceLimiter, requireCapacity, validate(schemas.createInstance), async (req, res) => {
  // req.body is now normalized to snake_case by validation middleware
  const { name, local_port, region, server_host } = req.body;
  const userId = req.user.user_id;
  
  try {
    const instanceId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Database layer expects snake_case and returns camelCase
    const instance = await db.createInstance({
      id: instanceId,
      user_id: userId,
      name,
      local_port,
      region: region || 'us-east',
      server_host: server_host || BORE_SERVER_HOST,
      status: 'inactive'
    });
    
    // Response is already in camelCase from db.createInstance
    res.status(201).json(instance);
  } catch (error) {
    logger.error('Create instance error', error);
    return ErrorResponses.internalError(res, 'Failed to create instance', req.id);
  }
});

// Delete instance
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    await db.deleteInstance(req.params.id);
    await deleteHeartbeat(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete instance error', error);
    return ErrorResponses.internalError(res, 'Failed to delete instance', req.id);
  }
});

// Rename instance
router.patch('/:id', authenticateJWT, validate(schemas.renameInstance), async (req, res) => {
  const { name } = req.body;
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Validation middleware already checks this, but keeping for extra safety
    if (!name) {
      return ErrorResponses.badRequest(res, 'Name is required', null, req.id);
    }
    
    const updated = await db.updateInstance(req.params.id, { name });
    res.json({ success: true, instance: updated });
  } catch (error) {
    logger.error('Rename instance error', error);
    return ErrorResponses.internalError(res, 'Failed to rename instance', req.id);
  }
});

// Heartbeat endpoint
router.post('/:id/heartbeat', authenticateJWT, validate(schemas.heartbeat), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Update heartbeat timestamp
    await setHeartbeat(instance.id, Date.now());
    incrementCounter('heartbeatsTotal');
    
    // Store health metrics (req.body is normalized to snake_case)
    const { vscode_responsive, last_activity, cpu_usage, memory_usage, has_code_server } = req.body || {};
    if (vscode_responsive !== undefined) {
      await db.saveHealthMetrics(instance.id, {
        vscode_responsive,
        last_activity,
        cpu_usage,
        memory_usage,
        has_code_server
      });
    }
    
    // Determine status using three-tier logic
    const { status, reason } = await determineInstanceStatus(instance);
    
    const oldStatus = instance.status;
    if (oldStatus !== status) {
      await db.updateInstance(instance.id, { status, status_reason: reason });
      await db.addStatusHistory(instance.id, status, reason);
      
      // Broadcast will be handled by caller (server.js)
      res.locals.statusChanged = true;
      res.locals.newStatus = status;
      res.locals.instance = instance;
    }
    
    recordHistogram('heartbeatResponseTimes', Date.now() - startTime);
    res.json({ success: true, status, reason });
  } catch (error) {
    logger.error('Heartbeat error', error);
    return ErrorResponses.internalError(res, 'Heartbeat failed', req.id);
  }
});

// Connect to instance (get tunnel token)
router.post('/:id/connect', authenticateJWT, tunnelLimiter, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // LOAD BALANCING: Get least loaded bore-server
    const { getBestServer } = require('../server-registry');
    const bestServer = await getBestServer();
    
    if (!bestServer) {
      return ErrorResponses.serviceUnavailable(res, 'All servers at capacity. Please try again later.', req.id);
    }
    
    // Delete old token if exists (using camelCase field)
    if (instance.currentTunnelToken) {
      await db.deleteTunnelToken(instance.currentTunnelToken);
    }
    
    // Generate new tunnel token
    const tunnelToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.tokens.tunnel.expiresIn);
    
    await db.saveTunnelToken(tunnelToken, instance.id, req.user.user_id, expiresAt);
    await db.updateInstance(instance.id, {
      current_tunnel_token: tunnelToken,
      tunnel_token_expires_at: expiresAt,
      assigned_server: bestServer.id  // Track which server this tunnel uses
    });
    
    res.json({
      tunnelToken: tunnelToken,
      boreServerHost: bestServer.host,
      boreServerPort: bestServer.port,
      localPort: instance.localPort,
      expiresAt: expiresAt.toISOString(),
      serverInfo: {
        serverId: bestServer.id,
        utilization: bestServer.overallUtilization?.toFixed(1) + '%'
      }
    });
  } catch (error) {
    logger.error('Connect error', error);
    return ErrorResponses.internalError(res, 'Failed to connect', req.id);
  }
});

// Disconnect instance
router.post('/:id/disconnect', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Delete tunnel token (using camelCase field)
    if (instance.currentTunnelToken) {
      await db.deleteTunnelToken(instance.currentTunnelToken);
    }
    
    // Update instance
    await db.updateInstance(instance.id, {
      status: 'inactive',
      tunnel_connected: false,
      public_url: null,
      remote_port: null,
      current_tunnel_token: null,
      tunnel_token_expires_at: null
    });
    
    // Clean up heartbeat (Redis-aware)
    await deleteHeartbeat(instance.id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Disconnect error', error);
    return ErrorResponses.internalError(res, 'Failed to disconnect', req.id);
  }
});

// Get instance status history
router.get('/:id/status-history', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    const history = await db.getStatusHistory(instance.id);
    const healthMetrics = await db.getLatestHealthMetrics(instance.id);
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    
    res.json({
      instanceId: instance.id,
      currentStatus: instance.status,
      statusReason: instance.statusReason,
      healthMetrics: healthMetrics || {},
      lastHeartbeat: lastHeartbeat,
      heartbeatAgeMs: lastHeartbeat ? Date.now() - lastHeartbeat : null,
      statusHistory: history,
      uptimeData: calculateUptimeMetrics(history)
    });
  } catch (error) {
    logger.error('Status history error', error);
    return ErrorResponses.internalError(res, 'Failed to get status history', req.id);
  }
});

// Get instance health metrics
router.get('/:id/health', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.userId !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    const healthMetrics = await db.getLatestHealthMetrics(instance.id);
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    
    res.json({
      instanceId: instance.id,
      status: instance.status,
      statusReason: instance.statusReason,
      tunnelConnected: instance.tunnelConnected,
      ...healthMetrics,
      lastHeartbeat: lastHeartbeat,
      heartbeatAgeMs: lastHeartbeat ? Date.now() - lastHeartbeat : null
    });
  } catch (error) {
    logger.error('Health metrics error', error);
    return ErrorResponses.internalError(res, 'Failed to get health metrics', req.id);
  }
});

/**
 * Helper: Determine instance status based on heartbeat and health metrics
 * @param {Object} instance - Instance object from database (camelCase)
 * @returns {Promise<Object>} Object with status and reason
 */
async function determineInstanceStatus(instance) {
  const now = Date.now();
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  const healthMetrics = await db.getLatestHealthMetrics(instance.id) || {};
  
  if (instance.tunnelConnected === false || instance.status === 'offline') {
    return { status: 'offline', reason: 'Tunnel disconnected' };
  }
  
  if (!lastHeartbeat || (now - lastHeartbeat) > HEARTBEAT_TIMEOUT) {
    return { status: 'offline', reason: 'Heartbeat timeout' };
  }
  
  if (healthMetrics.hasCodeServer && healthMetrics.vscodeResponsive === false) {
    return { status: 'degraded', reason: 'VSCode not responding' };
  }
  
  if (healthMetrics.lastActivity && (now / 1000 - healthMetrics.lastActivity) > config.heartbeat.idleTimeout) {
    return { status: 'idle', reason: `No activity for ${config.heartbeat.idleTimeout / 60}+ minutes` };
  }
  
  return { status: 'online', reason: 'All systems operational' };
}

/**
 * Helper: Calculate uptime metrics from status history
 * @param {Array} history - Array of status history records (camelCase)
 * @returns {Object} Uptime statistics (camelCase)
 */
function calculateUptimeMetrics(history) {
  if (!history || history.length === 0) {
    return { uptimePercentage: 0, totalDowntimeMs: 0, incidentCount: 0 };
  }
  
  let totalTime = 0;
  let uptimeMs = 0;
  let incidentCount = 0;
  
  for (let i = 0; i < history.length; i++) {
    const current = history[i];
    const next = history[i + 1];
    
    if (next) {
      const duration = new Date(next.timestamp) - new Date(current.timestamp);
      totalTime += duration;
      
      if (current.status === 'online' || current.status === 'active') {
        uptimeMs += duration;
      }
      
      if (current.status === 'offline' || current.status === 'degraded') {
        incidentCount++;
      }
    }
  }
  
  const uptimePercentage = totalTime > 0 ? (uptimeMs / totalTime) * 100 : 0;
  
  return {
    uptimePercentage: uptimePercentage.toFixed(2),
    totalDowntimeMs: totalTime - uptimeMs,
    incidentCount: incidentCount,
    historySpanMs: totalTime
  };
}

module.exports = { router, instanceHeartbeats };

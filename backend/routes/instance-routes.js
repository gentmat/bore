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

const BORE_SERVER_HOST = config.boreServer.host;
const BORE_SERVER_PORT = config.boreServer.port;

// Heartbeat tracking (in-memory, could move to Redis for scaling)
const instanceHeartbeats = new Map();
const HEARTBEAT_TIMEOUT = config.heartbeat.timeout;

// Get all instances for user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const instances = await db.getInstancesByUserId(req.user.user_id);
    
    // Add heartbeat age to each instance
    const withHeartbeat = instances.map(instance => ({
      ...instance,
      last_heartbeat: instanceHeartbeats.get(instance.id),
      heartbeat_age_ms: instanceHeartbeats.get(instance.id) 
        ? Date.now() - instanceHeartbeats.get(instance.id)
        : null
    }));
    
    res.json(withHeartbeat);
  } catch (error) {
    console.error('List instances error:', error);
    return ErrorResponses.internalError(res, 'Failed to list instances', req.id);
  }
});

// Create instance
router.post('/', authenticateJWT, createInstanceLimiter, validate(schemas.createInstance), async (req, res) => {
  const { name, local_port, region, server_host } = req.body;
  const userId = req.user.user_id;
  
  try {
    const instanceId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const instance = await db.createInstance({
      id: instanceId,
      user_id: userId,
      name,
      local_port,
      region: region || 'us-east',
      server_host: server_host || BORE_SERVER_HOST,
      status: 'inactive'
    });
    
    res.status(201).json(instance);
  } catch (error) {
    console.error('Create instance error:', error);
    return ErrorResponses.internalError(res, 'Failed to create instance', req.id);
  }
});

// Delete instance
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    await db.deleteInstance(req.params.id);
    instanceHeartbeats.delete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete instance error:', error);
    return ErrorResponses.internalError(res, 'Failed to delete instance', req.id);
  }
});

// Rename instance
router.patch('/:id', authenticateJWT, validate(schemas.renameInstance), async (req, res) => {
  const { name } = req.body;
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Validation middleware already checks this, but keeping for extra safety
    if (!name) {
      return ErrorResponses.badRequest(res, 'Name is required', null, req.id);
    }
    
    const updated = await db.updateInstance(req.params.id, { name });
    res.json({ success: true, instance: updated });
  } catch (error) {
    console.error('Rename instance error:', error);
    return ErrorResponses.internalError(res, 'Failed to rename instance', req.id);
  }
});

// Heartbeat endpoint
router.post('/:id/heartbeat', authenticateJWT, validate(schemas.heartbeat), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Update heartbeat timestamp
    instanceHeartbeats.set(instance.id, Date.now());
    incrementCounter('heartbeatsTotal');
    
    // Store health metrics
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
    }
    
    recordHistogram('heartbeatResponseTimes', Date.now() - startTime);
    res.json({ success: true, status, reason });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return ErrorResponses.internalError(res, 'Heartbeat failed', req.id);
  }
});

// Connect to instance (get tunnel token)
router.post('/:id/connect', authenticateJWT, tunnelLimiter, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // LOAD BALANCING: Get least loaded bore-server
    const { getBestServer } = require('../server-registry');
    const bestServer = getBestServer();
    
    if (!bestServer) {
      return ErrorResponses.serviceUnavailable(res, 'All servers at capacity. Please try again later.', req.id);
    }
    
    // Delete old token if exists
    if (instance.current_tunnel_token) {
      await db.deleteTunnelToken(instance.current_tunnel_token);
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
      tunnel_token: tunnelToken,
      bore_server_host: bestServer.host,  // ← LOAD BALANCED!
      bore_server_port: bestServer.port,
      local_port: instance.local_port,
      expires_at: expiresAt.toISOString(),
      server_info: {
        server_id: bestServer.id,
        utilization: bestServer.overallUtilization?.toFixed(1) + '%'
      }
    });
  } catch (error) {
    console.error('Connect error:', error);
    return ErrorResponses.internalError(res, 'Failed to connect', req.id);
  }
});

// Disconnect instance
router.post('/:id/disconnect', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    // Delete tunnel token
    if (instance.current_tunnel_token) {
      await db.deleteTunnelToken(instance.current_tunnel_token);
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
    
    instanceHeartbeats.delete(instance.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    return ErrorResponses.internalError(res, 'Failed to disconnect', req.id);
  }
});

// Get instance status history
router.get('/:id/status-history', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    const history = await db.getStatusHistory(instance.id);
    const healthMetrics = await db.getLatestHealthMetrics(instance.id);
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    
    res.json({
      instance_id: instance.id,
      current_status: instance.status,
      status_reason: instance.status_reason,
      health_metrics: healthMetrics || {},
      last_heartbeat: lastHeartbeat,
      heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null,
      status_history: history,
      uptime_data: calculateUptimeMetrics(history)
    });
  } catch (error) {
    console.error('Status history error:', error);
    return ErrorResponses.internalError(res, 'Failed to get status history', req.id);
  }
});

// Get instance health metrics
router.get('/:id/health', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    const healthMetrics = await db.getLatestHealthMetrics(instance.id);
    const lastHeartbeat = instanceHeartbeats.get(instance.id);
    
    res.json({
      instance_id: instance.id,
      status: instance.status,
      status_reason: instance.status_reason,
      tunnel_connected: instance.tunnel_connected,
      ...healthMetrics,
      last_heartbeat: lastHeartbeat,
      heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null
    });
  } catch (error) {
    console.error('Health metrics error:', error);
    return ErrorResponses.internalError(res, 'Failed to get health metrics', req.id);
  }
});

/**
 * Helper: Determine instance status based on heartbeat and health metrics
 * @param {Object} instance - Instance object from database
 * @returns {Promise<Object>} Object with status and reason
 */
async function determineInstanceStatus(instance) {
  const now = Date.now();
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  const healthMetrics = await db.getLatestHealthMetrics(instance.id) || {};
  
  if (instance.tunnel_connected === false || instance.status === 'offline') {
    return { status: 'offline', reason: 'Tunnel disconnected' };
  }
  
  if (!lastHeartbeat || (now - lastHeartbeat) > HEARTBEAT_TIMEOUT) {
    return { status: 'offline', reason: 'Heartbeat timeout' };
  }
  
  if (healthMetrics.has_code_server && healthMetrics.vscode_responsive === false) {
    return { status: 'degraded', reason: 'VSCode not responding' };
  }
  
  if (healthMetrics.last_activity && (now / 1000 - healthMetrics.last_activity) > config.heartbeat.idleTimeout) {
    return { status: 'idle', reason: `No activity for ${config.heartbeat.idleTimeout / 60}+ minutes` };
  }
  
  return { status: 'online', reason: 'All systems operational' };
}

/**
 * Helper: Calculate uptime metrics from status history
 * @param {Array} history - Array of status history records
 * @returns {Object} Uptime statistics
 */
function calculateUptimeMetrics(history) {
  if (!history || history.length === 0) {
    return { uptime_percentage: 0, total_downtime_ms: 0, incident_count: 0 };
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
    uptime_percentage: uptimePercentage.toFixed(2),
    total_downtime_ms: totalTime - uptimeMs,
    incident_count: incidentCount,
    history_span_ms: totalTime
  };
}

module.exports = { router, instanceHeartbeats };

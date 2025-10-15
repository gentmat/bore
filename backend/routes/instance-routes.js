const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../database');
const { authenticateJWT } = require('../auth-middleware');
const { incrementCounter, recordHistogram } = require('../metrics');

const BORE_SERVER_HOST = process.env.BORE_SERVER_HOST || '127.0.0.1';
const BORE_SERVER_PORT = parseInt(process.env.BORE_SERVER_PORT || '7835', 10);

// Heartbeat tracking (in-memory, could move to Redis for scaling)
const instanceHeartbeats = new Map();
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to list instances' 
    });
  }
});

// Create instance
router.post('/', authenticateJWT, async (req, res) => {
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to create instance' 
    });
  }
});

// Delete instance
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
    }
    
    await db.deleteInstance(req.params.id);
    instanceHeartbeats.delete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete instance error:', error);
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to delete instance' 
    });
  }
});

// Rename instance
router.patch('/:id', authenticateJWT, async (req, res) => {
  const { name } = req.body;
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
    }
    
    if (!name) {
      return res.status(400).json({ 
        error: 'invalid_input', 
        message: 'Name is required' 
      });
    }
    
    const updated = await db.updateInstance(req.params.id, { name });
    res.json({ success: true, instance: updated });
  } catch (error) {
    console.error('Rename instance error:', error);
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to rename instance' 
    });
  }
});

// Heartbeat endpoint
router.post('/:id/heartbeat', authenticateJWT, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Heartbeat failed' 
    });
  }
});

// Connect to instance (get tunnel token)
router.post('/:id/connect', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
    }
    
    // LOAD BALANCING: Get least loaded bore-server
    const { getBestServer } = require('../server-registry');
    const bestServer = getBestServer();
    
    if (!bestServer) {
      return res.status(503).json({ 
        error: 'no_servers_available', 
        message: 'All servers at capacity. Please try again later.' 
      });
    }
    
    // Delete old token if exists
    if (instance.current_tunnel_token) {
      await db.deleteTunnelToken(instance.current_tunnel_token);
    }
    
    // Generate new tunnel token
    const tunnelToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to connect' 
    });
  }
});

// Disconnect instance
router.post('/:id/disconnect', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to disconnect' 
    });
  }
});

// Get instance status history
router.get('/:id/status-history', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to get status history' 
    });
  }
});

// Get instance health metrics
router.get('/:id/health', authenticateJWT, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance || instance.user_id !== req.user.user_id) {
      return res.status(404).json({ 
        error: 'instance_not_found', 
        message: 'Instance not found' 
      });
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
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Failed to get health metrics' 
    });
  }
});

// Helper: Determine instance status
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
  
  if (healthMetrics.last_activity && (now / 1000 - healthMetrics.last_activity) > 1800) {
    return { status: 'idle', reason: 'No activity for 30+ minutes' };
  }
  
  return { status: 'online', reason: 'All systems operational' };
}

// Helper: Calculate uptime metrics
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

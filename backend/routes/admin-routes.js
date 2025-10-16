const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAdminAuth } = require('../auth-middleware');
const { instanceHeartbeats } = require('./instance-routes');
const { ErrorResponses } = require('../utils/error-handler');

/**
 * Get all instances with health metrics (admin only)
 * Returns comprehensive instance data with health metrics and heartbeat status
 */
router.get('/instances', requireAdminAuth, async (req, res) => {
  try {
    const allInstances = await db.getAllInstances();
    
    const withMetrics = await Promise.all(allInstances.map(async (instance) => {
      const healthMetrics = await db.getLatestHealthMetrics(instance.id);
      const lastHeartbeat = instanceHeartbeats.get(instance.id);
      const history = await db.getStatusHistory(instance.id, 10);
      
      return {
        ...instance,
        health_metrics: healthMetrics || {},
        last_heartbeat: lastHeartbeat,
        heartbeat_age_ms: lastHeartbeat ? Date.now() - lastHeartbeat : null,
        status_history_count: history.length
      };
    }));
    
    res.json({ instances: withMetrics, total: withMetrics.length });
  } catch (error) {
    console.error('Admin get instances error:', error);
    return ErrorResponses.internalError(res, 'Failed to get instances', req.id);
  }
});

/**
 * Get system statistics (admin only)
 * Returns aggregate statistics about all instances and tunnel status
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const allInstances = await db.getAllInstances();
    
    const stats = {
      total_instances: allInstances.length,
      by_status: {
        online: allInstances.filter(i => i.status === 'online').length,
        active: allInstances.filter(i => i.status === 'active').length,
        offline: allInstances.filter(i => i.status === 'offline').length,
        degraded: allInstances.filter(i => i.status === 'degraded').length,
        idle: allInstances.filter(i => i.status === 'idle').length,
        starting: allInstances.filter(i => i.status === 'starting').length,
        error: allInstances.filter(i => i.status === 'error').length,
        inactive: allInstances.filter(i => i.status === 'inactive').length,
      },
      active_tunnels: allInstances.filter(i => i.tunnel_connected).length,
      // Note: SSE/WebSocket stats would come from server.js
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return ErrorResponses.internalError(res, 'Failed to get stats', req.id);
  }
});

/**
 * Get alert history for all instances (admin only)
 * Returns recent alerts across all instances
 */
router.get('/alerts', requireAdminAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  
  try {
    const result = await db.query(
      'SELECT * FROM alert_history ORDER BY sent_at DESC LIMIT $1',
      [limit]
    );
    
    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Admin alerts error:', error);
    return ErrorResponses.internalError(res, 'Failed to get alerts', req.id);
  }
});

/**
 * Make user admin (super admin only - in production, protect this better)
 * Grants admin privileges to a user
 */
router.post('/users/:id/make-admin', requireAdminAuth, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET is_admin = TRUE WHERE id = $1',
      [req.params.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Make admin error:', error);
    return ErrorResponses.internalError(res, 'Failed to make user admin', req.id);
  }
});

module.exports = router;

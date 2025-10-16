const express = require('express');
const router = express.Router();
const config = require('../config');
const { db } = require('../database');
const { requireInternalApiKey } = require('../auth-middleware');
const { incrementCounter } = require('../metrics');
const { instanceHeartbeats } = require('./instance-routes');
const { schemas, validate } = require('../middleware/validation');
const { ErrorResponses } = require('../utils/error-handler');

const BORE_SERVER_HOST = config.boreServer.host;

// Validate tunnel token (called by bore-server)
router.post('/validate-key', requireInternalApiKey, validate(schemas.validateKey), async (req, res) => {
  const { api_key } = req.body;
  
  try {
    const tokenInfo = await db.getTunnelToken(api_key);
    
    if (!tokenInfo) {
      return res.json({
        valid: false,
        usage_allowed: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Check if token expired
    if (new Date(tokenInfo.expires_at) < new Date()) {
      await db.deleteTunnelToken(api_key);
      return res.json({
        valid: false,
        usage_allowed: false,
        message: 'Token expired'
      });
    }
    
    const instance = await db.getInstanceById(tokenInfo.instance_id);
    
    if (!instance) {
      await db.deleteTunnelToken(api_key);
      return res.json({
        valid: false,
        usage_allowed: false,
        message: 'Instance not found'
      });
    }
    
    const user = await db.getUserById(tokenInfo.user_id);
    const planType = user?.plan || 'trial';
    const maxConcurrent = planType === 'pro' ? 5 : 1;
    
    res.json({
      valid: true,
      usage_allowed: true,
      user_id: tokenInfo.user_id,
      plan_type: planType,
      max_concurrent_tunnels: maxConcurrent,
      max_bandwidth_gb: 999,
      instance_id: instance.id,
      message: 'Token validated'
    });
  } catch (error) {
    console.error('Validate key error:', error);
    res.status(500).json({
      valid: false,
      usage_allowed: false,
      message: 'Internal error'
    });
  }
});

// Tunnel connected (called by bore-server)
router.post('/instances/:id/tunnel-connected', requireInternalApiKey, validate(schemas.tunnelConnected), async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    const { remotePort, publicUrl } = req.body || {};
    
    const updates = {
      tunnel_connected: true,
      status: 'active'
    };
    
    if (remotePort !== undefined && remotePort !== null) {
      const effectiveHost = instance.server_host || BORE_SERVER_HOST;
      updates.remote_port = remotePort;
      if (!publicUrl) {
        updates.public_url = `${effectiveHost}:${remotePort}`;
      }
    }
    
    if (publicUrl) {
      updates.public_url = publicUrl;
    }
    
    await db.updateInstance(instance.id, updates);
    await db.addStatusHistory(instance.id, 'active', 'Tunnel connected from bore-server');
    
    instanceHeartbeats.set(instance.id, Date.now());
    incrementCounter('tunnelConnectionsTotal');
    
    // Signal to broadcast
    res.locals.broadcast = true;
    res.locals.userId = instance.user_id;
    res.locals.instanceId = instance.id;
    res.locals.status = 'active';
    
    res.json({ success: true });
  } catch (error) {
    console.error('Tunnel connected error:', error);
    return ErrorResponses.internalError(res, 'Failed to update tunnel status', req.id);
  }
});

// Tunnel disconnected (called by bore-server)
router.post('/instances/:id/tunnel-disconnected', requireInternalApiKey, async (req, res) => {
  try {
    const instance = await db.getInstanceById(req.params.id);
    
    if (!instance) {
      return ErrorResponses.notFound(res, 'Instance', req.id);
    }
    
    await db.updateInstance(instance.id, {
      tunnel_connected: false,
      status: 'offline',
      public_url: null,
      remote_port: null
    });
    
    await db.addStatusHistory(instance.id, 'offline', 'Tunnel disconnected from bore-server');
    
    instanceHeartbeats.delete(instance.id);
    
    // Delete tunnel token if exists
    if (instance.current_tunnel_token) {
      await db.deleteTunnelToken(instance.current_tunnel_token);
      await db.updateInstance(instance.id, {
        current_tunnel_token: null,
        tunnel_token_expires_at: null
      });
    }
    
    incrementCounter('tunnelDisconnectionsTotal');
    
    // Signal to broadcast
    res.locals.broadcast = true;
    res.locals.userId = instance.user_id;
    res.locals.instanceId = instance.id;
    res.locals.status = 'offline';
    
    res.json({ success: true });
  } catch (error) {
    console.error('Tunnel disconnected error:', error);
    return ErrorResponses.internalError(res, 'Failed to update tunnel status', req.id);
  }
});

module.exports = router;

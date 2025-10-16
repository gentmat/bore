import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import config from '../config';
import { db } from '../database';
import { authenticateJWT } from '../auth-middleware';
import { incrementCounter, recordHistogram } from '../metrics';
import { schemas, validate } from '../middleware/validation';
import { createInstanceLimiter, tunnelLimiter } from '../middleware/rate-limiter';
import { ErrorResponses } from '../utils/error-handler';
import redisService from '../services/redis-service';
import { requireCapacity } from '../capacity-limiter';
import { logger } from '../utils/logger';

const router: Router = express.Router();

const BORE_SERVER_HOST = config.boreServer.host;

// Heartbeat tracking - uses Redis when available, falls back to in-memory
const instanceHeartbeats = new Map<string, number>(); // Fallback for when Redis is unavailable
const HEARTBEAT_TIMEOUT = config.heartbeat.timeout;

/**
 * Instance from database (camelCase)
 */
interface Instance {
  id: string;
  userId: string;
  name: string;
  localPort: number;
  remotePort: number | null;
  region: string;
  serverHost: string | null;
  assignedServer: string | null;
  status: string;
  statusReason: string | null;
  tunnelConnected: boolean;
  publicUrl: string | null;
  currentTunnelToken: string | null;
  tunnelTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Instance with heartbeat information
 */
interface InstanceWithHeartbeat extends Instance {
  lastHeartbeat: number | null;
  heartbeatAgeMs: number | null;
}

/**
 * Health metrics
 */
interface HealthMetrics {
  vscodeResponsive?: boolean;
  lastActivity?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  hasCodeServer?: boolean;
}

/**
 * Status history record
 */
interface StatusHistoryRecord {
  id: string;
  instanceId: string;
  status: string;
  reason: string | null;
  timestamp: Date;
}

/**
 * Uptime metrics
 */
interface UptimeMetrics {
  uptimePercentage: string;
  totalDowntimeMs: number;
  incidentCount: number;
  historySpanMs?: number;
}

/**
 * Authenticated request with user
 */
interface AuthRequest extends Request {
  user: {
    user_id: string;
    email: string;
    plan: string;
  };
  id?: string;
}

/**
 * Get heartbeat timestamp for instance (Redis-aware)
 */
async function getHeartbeat(instanceId: string): Promise<number | null> {
  if (config.redis.enabled) {
    const timestamp = await redisService.heartbeats.get(instanceId);
    if (timestamp !== null) return timestamp;
  }
  return instanceHeartbeats.get(instanceId) || null;
}

/**
 * Set heartbeat timestamp for instance (Redis-aware)
 */
async function setHeartbeat(instanceId: string, timestamp: number): Promise<void> {
  if (config.redis.enabled) {
    await redisService.heartbeats.set(instanceId, timestamp, 60);
  }
  // Always keep in-memory as fallback
  instanceHeartbeats.set(instanceId, timestamp);
}

/**
 * Delete heartbeat for instance (Redis-aware)
 */
async function deleteHeartbeat(instanceId: string): Promise<void> {
  if (config.redis.enabled) {
    await redisService.heartbeats.delete(instanceId);
  }
  instanceHeartbeats.delete(instanceId);
}

// Get all instances for user
router.get('/', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instances = await db.getInstancesByUserId(authReq.user.user_id);
    
    // Add heartbeat age to each instance (using camelCase)
    const withHeartbeat: InstanceWithHeartbeat[] = await Promise.all(instances.map(async (instance: any) => {
      const lastHeartbeat = await getHeartbeat(instance.id);
      return {
        ...instance,
        lastHeartbeat: lastHeartbeat,
        heartbeatAgeMs: lastHeartbeat ? Date.now() - lastHeartbeat : null
      };
    }));
    
    res.json(withHeartbeat);
  } catch (error) {
    logger.error('List instances error', error as Error);
    ErrorResponses.internalError(res, 'Failed to list instances', (req as AuthRequest).id);
  }
});

// Create instance
router.post('/', authenticateJWT, createInstanceLimiter, requireCapacity, validate(schemas.createInstance), async (req: Request, res: Response): Promise<void> => {
  // req.body is now normalized to snake_case by validation middleware
  const { name, local_port, region, server_host } = req.body;
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;
  
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
    logger.error('Create instance error', error as Error);
    ErrorResponses.internalError(res, 'Failed to create instance', authReq.id);
  }
});

// Delete instance
router.delete('/:id', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instanceId = req.params.id as string;
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
    }
    
    await db.deleteInstance(instanceId);
    await deleteHeartbeat(instanceId);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete instance error', error as Error);
    ErrorResponses.internalError(res, 'Failed to delete instance', (req as AuthRequest).id);
  }
});

// Rename instance
router.patch('/:id', authenticateJWT, validate(schemas.renameInstance), async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body;
  const authReq = req as AuthRequest;
  const instanceId = req.params.id as string;
  
  try {
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
    }
    
    // Validation middleware already checks this, but keeping for extra safety
    if (!name) {
      ErrorResponses.badRequest(res, 'Name is required', null, authReq.id);
      return;
    }
    
    const updated = await db.updateInstance(instanceId, { name });
    res.json({ success: true, instance: updated });
  } catch (error) {
    logger.error('Rename instance error', error as Error);
    ErrorResponses.internalError(res, 'Failed to rename instance', authReq.id);
  }
});

// Heartbeat endpoint
router.post('/:id/heartbeat', authenticateJWT, validate(schemas.heartbeat), async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const authReq = req as AuthRequest;
  const instanceId = req.params.id as string;
  
  try {
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
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
    const { status, reason } = await determineInstanceStatus(instance as any);
    
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
    logger.error('Heartbeat error', error as Error);
    ErrorResponses.internalError(res, 'Heartbeat failed', authReq.id);
  }
});

// Connect to instance (get tunnel token)
router.post('/:id/connect', authenticateJWT, tunnelLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instanceId = req.params.id as string;
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
    }
    
    // LOAD BALANCING: Get least loaded bore-server
    const { getBestServer } = require('../server-registry');
    const bestServer = await getBestServer();
    
    if (!bestServer) {
      ErrorResponses.serviceUnavailable(res, 'All servers at capacity. Please try again later.', authReq.id);
      return;
    }
    
    // Delete old token if exists (using camelCase field)
    if (instance.currentTunnelToken) {
      await db.deleteTunnelToken(instance.currentTunnelToken);
    }
    
    // Generate new tunnel token
    const tunnelToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.tokens.tunnel.expiresIn);
    
    await db.saveTunnelToken(tunnelToken, instance.id, authReq.user.user_id, expiresAt);
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
    logger.error('Connect error', error as Error);
    ErrorResponses.internalError(res, 'Failed to connect', (req as AuthRequest).id);
  }
});

// Disconnect instance
router.post('/:id/disconnect', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instanceId = req.params.id as string;
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
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
    logger.error('Disconnect error', error as Error);
    ErrorResponses.internalError(res, 'Failed to disconnect', (req as AuthRequest).id);
  }
});

// Get instance status history
router.get('/:id/status-history', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instanceId = req.params.id as string;
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
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
      uptimeData: calculateUptimeMetrics(history as any)
    });
  } catch (error) {
    logger.error('Status history error', error as Error);
    ErrorResponses.internalError(res, 'Failed to get status history', (req as AuthRequest).id);
  }
});

// Get instance health metrics
router.get('/:id/health', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const instanceId = req.params.id as string;
    const instance = await db.getInstanceById(instanceId);
    
    if (!instance || instance.userId !== authReq.user.user_id) {
      ErrorResponses.notFound(res, 'Instance', authReq.id);
      return;
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
    logger.error('Health metrics error', error as Error);
    ErrorResponses.internalError(res, 'Failed to get health metrics', (req as AuthRequest).id);
  }
});

/**
 * Helper: Determine instance status based on heartbeat and health metrics
 */
async function determineInstanceStatus(instance: Instance): Promise<{ status: string; reason: string }> {
  const now = Date.now();
  const lastHeartbeat = instanceHeartbeats.get(instance.id);
  const healthMetrics = await db.getLatestHealthMetrics(instance.id) || {} as HealthMetrics;
  
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
 */
function calculateUptimeMetrics(history: StatusHistoryRecord[]): UptimeMetrics {
  if (!history || history.length === 0) {
    return { uptimePercentage: '0', totalDowntimeMs: 0, incidentCount: 0 };
  }
  
  let totalTime = 0;
  let uptimeMs = 0;
  let incidentCount = 0;
  
  for (let i = 0; i < history.length - 1; i++) {
    const current = history[i];
    const next = history[i + 1];
    
    if (next && current) {
      const duration = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
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

export { router, instanceHeartbeats };

/**
 * Capacity Management System
 * Prevents overload and ensures fair resource allocation
 */

import { Request, Response, NextFunction } from 'express';
import { db } from './database';
import config from './config';
import { logger } from './utils/logger';

// Import types to avoid circular dependency issues
import type { FleetStats } from './server-registry';

// Configuration from environment variables
const CAPACITY_CONFIG = config.capacity;

// Maximum tunnels per user by plan (from config)
const maxTunnelsByPlan: Record<string, number> = {
  trial: config.plans.trial.maxConcurrentTunnels,
  pro: config.plans.pro.maxConcurrentTunnels,
  enterprise: config.plans.enterprise.maxConcurrentTunnels
};

/**
 * System capacity check result
 */
export interface SystemCapacityCheck {
  hasCapacity: boolean;
  activeTunnels: number;
  totalCapacity: number;
  availableSlots: number;
  utilizationPercent: number;
  serverCount: number;
  bandwidthUtilization: number;
  error?: string;
}

/**
 * User quota check result
 */
export interface UserQuotaCheck {
  allowed: boolean;
  activeTunnels: number;
  maxTunnels: number;
  plan: string;
  reason: string | null;
  error?: string;
}

/**
 * Capacity information stored in request
 */
export interface CapacityInfo {
  systemUtilization: number;
  userQuota: UserQuotaCheck;
}

/**
 * Capacity alert
 */
interface CapacityAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  action: string;
}

/**
 * Capacity statistics for admin dashboard
 */
interface CapacityStats {
  system: SystemCapacityCheck;
  fleet: FleetStats;
  servers: unknown[];
  alerts: CapacityAlert[];
  timestamp: string;
}

/**
 * Server information for deprecated function
 */
interface ServerInfo {
  currentLoad: number;
  [key: string]: unknown;
}

/**
 * Check if system has capacity for new tunnel
 * Uses real-time data from server registry
 */
export async function checkSystemCapacity(): Promise<SystemCapacityCheck> {
  try {
    // Get real-time fleet statistics
    const { getFleetStats } = await import('./server-registry');
    const fleetStats: FleetStats = await getFleetStats();
    
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
    
    const activeTunnels = instances.rows[0] ? parseInt(instances.rows[0].active) : 0;
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
    logger.error('System capacity check error', error as Error);
    // Conservative approach: assume we're at capacity if check fails
    return {
      hasCapacity: false,
      activeTunnels: 0,
      totalCapacity: 0,
      availableSlots: 0,
      utilizationPercent: 100,
      serverCount: 0,
      bandwidthUtilization: 0,
      error: (error as Error).message
    };
  }
}

/**
 * Check if user can create more tunnels
 */
export async function checkUserQuota(userId: string): Promise<UserQuotaCheck> {
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return { 
        allowed: false, 
        reason: 'User not found',
        activeTunnels: 0,
        maxTunnels: 0,
        plan: 'unknown'
      };
    }
    
    // Check if plan has expired
    if (user.plan_expires) {
      const planExpiry = user.plan_expires instanceof Date 
        ? user.plan_expires 
        : new Date(user.plan_expires as string);
      if (planExpiry < new Date()) {
        return {
          allowed: false,
          reason: 'Plan expired',
          activeTunnels: 0,
          maxTunnels: 0,
          plan: user.plan || 'trial'
        };
      }
    }
    
    const plan = user.plan || 'trial';
    const maxTunnels = maxTunnelsByPlan[plan] || 1;
    
    // Count user's active tunnels
    const result = await db.query(
      'SELECT COUNT(*) as count FROM instances WHERE user_id = $1 AND tunnel_connected = TRUE',
      [userId]
    );
    
    const activeTunnels = result.rows[0] ? parseInt(result.rows[0].count) : 0;
    
    return {
      allowed: activeTunnels < maxTunnels,
      activeTunnels,
      maxTunnels,
      plan,
      reason: activeTunnels >= maxTunnels ? `Plan limit reached (${maxTunnels} tunnels)` : null
    };
  } catch (error) {
    logger.error('User quota check error', error as Error);
    return {
      allowed: false,
      reason: 'Failed to check quota',
      error: (error as Error).message,
      activeTunnels: 0,
      maxTunnels: 0,
      plan: 'unknown'
    };
  }
}

/**
 * Get least loaded bore-server
 * @deprecated Use server-registry.getBestServer() instead
 */
export async function getLeastLoadedServer(availableServers: ServerInfo[]): Promise<ServerInfo | null> {
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
 * Extended request with authenticated user
 */
interface AuthenticatedRequest extends Request {
  user: {
    user_id: string;
    email: string;
    plan: string;
  };
  capacityInfo?: CapacityInfo;
}

/**
 * Middleware: Check capacity before tunnel creation
 */
export async function requireCapacity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Check system capacity
    const systemCheck = await checkSystemCapacity();
    
    if (!systemCheck.hasCapacity) {
      res.status(503).json({
        error: 'capacity_exceeded',
        message: 'System at capacity. Please try again later or upgrade your plan.',
        details: {
          utilizationPercent: systemCheck.utilizationPercent.toFixed(1),
          activeTunnels: systemCheck.activeTunnels,
          totalCapacity: systemCheck.totalCapacity
        }
      });
      return;
    }
    
    // Check user quota
    const userCheck = await checkUserQuota(authReq.user.user_id);
    
    if (!userCheck.allowed) {
      res.status(429).json({
        error: 'quota_exceeded',
        message: userCheck.reason,
        details: {
          activeTunnels: userCheck.activeTunnels,
          maxTunnels: userCheck.maxTunnels,
          plan: userCheck.plan
        },
        upgrade_url: '/claim-plan' // Encourage upgrade
      });
      return;
    }
    
    // Store capacity info in request for later use
    authReq.capacityInfo = {
      systemUtilization: systemCheck.utilizationPercent,
      userQuota: userCheck
    };
    
    next();
  } catch (error) {
    logger.error('Capacity check error', error as Error);
    // Fail open (allow request) if check fails - adjust based on preference
    next();
  }
}

/**
 * Get capacity statistics (for admin dashboard)
 */
export async function getCapacityStats(): Promise<CapacityStats> {
  const systemCheck = await checkSystemCapacity();
  const { getFleetStats } = await import('./server-registry');
  const fleetStats: FleetStats = await getFleetStats();
  
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
function generateCapacityAlerts(capacityInfo: SystemCapacityCheck): CapacityAlert[] {
  const alerts: CapacityAlert[] = [];
  
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
 * @returns Array of server load information
 */
export async function getServerLoads(): Promise<unknown[]> {
  try {
    const { getFleetStats } = await import('./server-registry');
    const fleetStats: FleetStats = await getFleetStats();
    return fleetStats.servers || [];
  } catch (error) {
    logger.error('Failed to get server loads', error as Error);
    return [];
  }
}

/**
 * Update capacity configuration (when you add new servers)
 * Note: This only updates runtime config. For persistent changes, update environment variables.
 */
export function updateCapacity(newTotalCapacity: number): void {
  logger.warn('updateCapacity() modifies runtime config only. Update TOTAL_SYSTEM_CAPACITY env var for persistent changes.');
  (CAPACITY_CONFIG as { totalSystemCapacity: number }).totalSystemCapacity = newTotalCapacity;
  logger.info(`✅ System capacity updated to ${newTotalCapacity} tunnels (runtime only)`);
}

// Export capacity config
export { CAPACITY_CONFIG };

// Export types
export type { CapacityAlert, CapacityStats, ServerInfo };

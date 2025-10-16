/**
 * Simplified Capacity Checker for In-Memory Server
 * NOTE: For production, migrate to database-backed server-new.js
 * and use full capacity-limiter.js
 */

import { Request, Response, NextFunction } from 'express';

interface CapacityConfig {
  maxTunnelsByPlan: {
    trial: number;
    pro: number;
    enterprise: number;
  };
  totalSystemCapacity: number;
  reservedCapacityPercent: number;
}

interface User {
  id: string;
  plan?: string;
}

interface Instance {
  user_id: string;
  tunnel_connected: boolean;
}

interface AppLocals {
  users?: User[];
  instances?: Instance[];
}

const CAPACITY_CONFIG: CapacityConfig = {
  maxTunnelsByPlan: {
    trial: 1,
    pro: 5,
    enterprise: 20
  },
  totalSystemCapacity: 100,
  reservedCapacityPercent: 20
};

/**
 * Check if user can create more tunnels (in-memory version)
 */
function checkUserQuota(req: Request, res: Response, next: NextFunction): Response | void {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }
    
    // Get user from in-memory store (passed via req.app.locals)
    const locals = req.app.locals as AppLocals;
    const users = locals.users || [];
    const instances = locals.instances || [];
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'User not found' 
      });
    }
    
    const plan = user.plan || 'trial';
    const maxTunnels = CAPACITY_CONFIG.maxTunnelsByPlan[plan as keyof typeof CAPACITY_CONFIG.maxTunnelsByPlan] || 1;
    
    // Count user's active tunnels
    const activeTunnels = instances.filter(
      i => i.user_id === userId && i.tunnel_connected
    ).length;
    
    if (activeTunnels >= maxTunnels) {
      return res.status(429).json({
        error: 'quota_exceeded',
        message: `Plan limit reached (${maxTunnels} tunnels). Upgrade your plan to create more tunnels.`,
        details: {
          activeTunnels,
          maxTunnels,
          plan
        },
        upgrade_url: '/claim-plan'
      });
    }
    
    next();
  } catch (error) {
    console.error('Capacity check error:', error);
    // Fail open - allow request if check fails
    next();
  }
}

/**
 * Check system capacity
 */
function checkSystemCapacity(req: Request, res: Response, next: NextFunction): Response | void {
  try {
    const locals = req.app.locals as AppLocals;
    const instances = locals.instances || [];
    
    const activeTunnels = instances.filter(i => i.tunnel_connected).length;
    const reservedSlots = Math.floor(
      CAPACITY_CONFIG.totalSystemCapacity * CAPACITY_CONFIG.reservedCapacityPercent / 100
    );
    
    if (activeTunnels >= (CAPACITY_CONFIG.totalSystemCapacity - reservedSlots)) {
      return res.status(503).json({
        error: 'capacity_exceeded',
        message: 'System at capacity. Please try again later.',
        details: {
          utilizationPercent: ((activeTunnels / CAPACITY_CONFIG.totalSystemCapacity) * 100).toFixed(1),
          activeTunnels,
          totalCapacity: CAPACITY_CONFIG.totalSystemCapacity
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('System capacity check error:', error);
    next();
  }
}

export {
  checkUserQuota,
  checkSystemCapacity,
  CAPACITY_CONFIG
};

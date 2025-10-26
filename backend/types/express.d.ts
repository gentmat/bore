/**
 * Express Type Extensions
 * Extends Express Request and Response types with custom properties
 */

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        user_id: string;
        email: string;
        plan: string;
      };
      traceId?: string;
      spanId?: string;
      capacityInfo?: {
        systemUtilization: number;
        userQuota: {
          allowed: boolean;
          activeTunnels: number;
          maxTunnels: number;
          plan: string;
          reason: string | null;
        };
      };
    }

    interface Response {
      locals: {
        broadcast?: boolean;
        userId?: string;
        instanceId?: string;
        status?: string;
        statusChanged?: boolean;
        newStatus?: string;
        instance?: { id: string; userId: string };
        responseBody?: unknown;
      };
    }
  }
}

/**
 * Type alias for authenticated requests
 */
export type AuthRequest = Express.Request & {
  user: {
    user_id: string;
    email: string;
    plan: string;
  };
  id: string;
};

/**
 * Type alias for admin-authenticated requests
 */
export type AdminRequest = Express.Request & {
  user: {
    user_id: string;
    email: string;
    plan: string;
    is_admin?: boolean;
  };
  adminUser: {
    id: string;
    email: string;
    name: string;
    plan: string;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
  };
  id: string;
};

export {};

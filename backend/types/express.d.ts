/**
 * Express Type Extensions
 * Extends Express Request and Response types with custom properties
 */

declare global {
  namespace Express {
    interface Request {
      id?: string;
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

export {};

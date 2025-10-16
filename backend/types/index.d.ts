/**
 * TypeScript Type Definitions for Bore Backend
 * Provides type safety for gradual TypeScript migration
 */

declare namespace Bore {
  // User Types
  interface User {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    plan: 'trial' | 'pro' | 'enterprise';
    is_admin: boolean;
    plan_expires: Date | null;
    created_at: Date;
    updated_at: Date;
  }

  interface UserProfile {
    id: string;
    email: string;
    name: string;
    plan: string;
    plan_expires: string | null;
    is_admin: boolean;
  }

  // Instance Types
  interface Instance {
    id: string;
    user_id: string;
    name: string;
    local_port: number;
    remote_port: number | null;
    region: string;
    server_host: string | null;
    assigned_server: string | null;
    status: InstanceStatus;
    status_reason: string | null;
    tunnel_connected: boolean;
    public_url: string | null;
    current_tunnel_token: string | null;
    tunnel_token_expires_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }

  type InstanceStatus = 'inactive' | 'starting' | 'active' | 'online' | 'idle' | 'degraded' | 'offline';

  interface CreateInstanceInput {
    name: string;
    local_port: number;
    localPort?: number;
    region?: string;
    server_host?: string;
  }

  interface HealthMetrics {
    vscode_responsive?: boolean;
    last_activity?: number;
    cpu_usage?: number;
    memory_usage?: number;
    has_code_server?: boolean;
  }

  // Tunnel Token Types
  interface TunnelToken {
    tunnel_token: string;
    bore_server_host: string;
    bore_server_port: number;
    local_port: number;
    expires_at: string;
    server_info: {
      server_id: string;
      utilization: string;
    };
  }

  // Authentication Types
  interface LoginCredentials {
    email: string;
    password: string;
  }

  interface SignupData {
    name: string;
    email: string;
    password: string;
  }

  interface AuthResponse {
    token: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
    user: UserProfile;
  }

  interface JWTPayload {
    user_id: string;
    email: string;
    plan: string;
    iat: number;
    exp: number;
  }

  // Server Registry Types
  interface BoreServer {
    id: string;
    host: string;
    port: number;
    location: string;
    maxBandwidthMbps: number;
    maxConcurrentTunnels: number;
    status: 'active' | 'inactive' | 'unhealthy';
    registeredAt: string;
    lastHealthCheck: string;
    currentLoad: number;
    currentBandwidthMbps: number;
  }

  interface FleetStats {
    serverCount: number;
    totalCapacity: number;
    totalLoad: number;
    utilizationPercent: number;
    totalBandwidthGbps: number;
    usedBandwidthGbps: number;
    bandwidthUtilizationPercent: number;
    servers: Array<{
      id: string;
      host: string;
      location: string;
      load: number;
      maxLoad: number;
      utilizationPercent: number;
      bandwidthUsedMbps: number;
      bandwidthMaxMbps: number;
      lastHealthCheck: string;
    }>;
  }

  // Capacity Types
  interface CapacityCheck {
    hasCapacity: boolean;
    activeTunnels: number;
    totalCapacity: number;
    availableSlots: number;
    utilizationPercent: number;
    serverCount: number;
    bandwidthUtilization: number;
  }

  interface UserQuota {
    allowed: boolean;
    activeTunnels: number;
    maxTunnels: number;
    plan: string;
    reason: string | null;
  }

  // API Response Types
  interface ApiError {
    error: string;
    message: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  }

  interface SuccessResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
  }

  // Express Extensions
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
        userQuota: UserQuota;
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
        instance?: Instance;
      };
    }
  }

  // Database Types
  interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  }

  interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
  }

  // Config Types
  interface Config {
    server: {
      port: number;
      nodeEnv: string;
      isDevelopment: boolean;
      isProduction: boolean;
    };
    security: {
      jwtSecret: string;
      internalApiKey: string | null;
    };
    database: DatabaseConfig;
    redis: {
      host: string;
      port: number;
      enabled: boolean;
    };
    boreServer: {
      host: string;
      port: number;
    };
    cors: {
      allowedOrigins: string[];
    };
    heartbeat: {
      timeout: number;
      checkInterval: number;
      idleTimeout: number;
    };
    tokenCleanup: {
      interval: number;
    };
    plans: {
      [key: string]: {
        name: string;
        duration: number;
        maxConcurrentTunnels: number;
        maxBandwidthGb: number;
      };
    };
    capacity: {
      maxTunnelsPerServer: number;
      maxBandwidthPerTunnel: number;
      totalSystemCapacity: number;
      reservedCapacityPercent: number;
    };
  }

  // Circuit Breaker Types
  interface CircuitBreakerOptions {
    name?: string;
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
    resetTimeout?: number;
  }

  interface CircuitBreakerStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rejectedRequests: number;
    timeouts: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    successCount: number;
    successRate: string;
    nextAttempt: string | null;
  }
}

export = Bore;

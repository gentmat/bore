/**
 * Application Configuration
 * Centralized configuration for the backend server
 */

import dotenv from 'dotenv';

dotenv.config();

interface ServerConfig {
  port: number;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

interface SecurityConfig {
  jwtSecret: string;
  internalApiKey: string | null;
}

interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  poolSize: number;
  idleTimeout: number;
  connectionTimeout: number;
}

interface RedisConfig {
  host: string;
  port: number;
  enabled: boolean;
}

interface BoreServerConfig {
  host: string;
  port: number;
}

interface CorsConfig {
  allowedOrigins: string[];
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface RateLimits {
  auth: RateLimitConfig;
  api: RateLimitConfig;
  tunnel: RateLimitConfig;
  createInstance: RateLimitConfig;
}

interface HeartbeatConfig {
  timeout: number;
  checkInterval: number;
  idleTimeout: number;
}

interface TokenCleanupConfig {
  interval: number;
}

interface TokensConfig {
  jwt: {
    expiresIn: string;
  };
  tunnel: {
    expiresIn: number;
  };
}

interface PlanConfig {
  name: string;
  duration: number;
  maxConcurrentTunnels: number;
  maxBandwidthGb: number;
}

interface PlansConfig {
  trial: PlanConfig;
  pro: PlanConfig;
  enterprise: PlanConfig;
}

interface CapacityConfig {
  maxTunnelsPerServer: number;
  maxBandwidthPerTunnel: number;
  totalSystemCapacity: number;
  reservedCapacityPercent: number;
}

interface SlackConfig {
  webhookUrl: string | null;
  enabled: boolean;
}

interface SendgridConfig {
  apiKey: string | null;
  fromEmail: string;
  toEmail: string | null;
  enabled: boolean;
}

interface AlertingConfig {
  slack: SlackConfig;
  sendgrid: SendgridConfig;
}

interface LoggingConfig {
  level: string;
}

interface AdminConfig {
  email: string | null;
  password: string | null;
  name: string | null;
  autoCreate: boolean;
}

interface Config {
  server: ServerConfig;
  security: SecurityConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  boreServer: BoreServerConfig;
  cors: CorsConfig;
  rateLimit: RateLimits;
  heartbeat: HeartbeatConfig;
  tokenCleanup: TokenCleanupConfig;
  tokens: TokensConfig;
  plans: PlansConfig;
  capacity: CapacityConfig;
  alerting: AlertingConfig;
  logging: LoggingConfig;
  admin: AdminConfig;
}

const config: Config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    internalApiKey: process.env.INTERNAL_API_KEY || null,
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'bore_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolSize: 20,
    idleTimeout: 30000,
    connectionTimeout: 2000,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  // Bore Server Configuration
  boreServer: {
    host: process.env.BORE_SERVER_HOST || '127.0.0.1',
    port: parseInt(process.env.BORE_SERVER_PORT || '7835', 10),
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  },

  // Rate Limiting
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
    },
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // 60 requests per minute
    },
    tunnel: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 tunnel operations per 5 minutes
    },
    createInstance: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 instance creations per hour
    },
  },

  // Heartbeat & Timeouts
  heartbeat: {
    timeout: 30000, // 30 seconds
    checkInterval: 5000, // 5 seconds
    idleTimeout: 1800, // 30 minutes (in seconds)
  },

  // Token Cleanup
  tokenCleanup: {
    interval: 6 * 60 * 60 * 1000, // 6 hours
  },

  // Token Configuration
  tokens: {
    jwt: {
      expiresIn: '7d',
    },
    tunnel: {
      expiresIn: 60 * 60 * 1000, // 1 hour
    },
  },

  // Plan Configuration
  plans: {
    trial: {
      name: 'trial',
      duration: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentTunnels: 1,
      maxBandwidthGb: 10,
    },
    pro: {
      name: 'pro',
      duration: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxConcurrentTunnels: 5,
      maxBandwidthGb: 100,
    },
    enterprise: {
      name: 'enterprise',
      duration: 365 * 24 * 60 * 60 * 1000, // 1 year
      maxConcurrentTunnels: 20,
      maxBandwidthGb: 999,
    },
  },

  // Capacity Management Configuration
  capacity: {
    maxTunnelsPerServer: parseInt(process.env.MAX_TUNNELS_PER_SERVER || '100', 10),
    maxBandwidthPerTunnel: parseInt(process.env.MAX_BANDWIDTH_PER_TUNNEL || '100', 10), // Mbps
    totalSystemCapacity: parseInt(process.env.TOTAL_SYSTEM_CAPACITY || '100', 10),
    reservedCapacityPercent: parseInt(process.env.RESERVED_CAPACITY_PERCENT || '20', 10),
  },

  // Alerting Configuration (Optional)
  alerting: {
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || null,
      enabled: !!process.env.SLACK_WEBHOOK_URL,
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || null,
      fromEmail: process.env.ALERT_EMAIL_FROM || 'alerts@bore.com',
      toEmail: process.env.ALERT_EMAIL_TO || null,
      enabled: !!process.env.SENDGRID_API_KEY,
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || ((process.env.NODE_ENV || 'development') === 'production' ? 'info' : 'debug'),
  },

  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL || null,
    password: process.env.ADMIN_PASSWORD || null,
    name: process.env.ADMIN_NAME || null,
    autoCreate: process.env.ADMIN_AUTO_CREATE === 'true',
  },
};

// Validation: Fail-fast for critical missing configs in production
if (config.server.isProduction) {
  if (config.security.jwtSecret === 'dev-secret-change-in-production') {
    console.error('FATAL: JWT_SECRET must be set in production!');
    console.error('Generate with: openssl rand -base64 32');
    process.exit(1);
  }

  if (!config.security.internalApiKey) {
    console.error('FATAL: INTERNAL_API_KEY must be set in production!');
    console.error('Generate with: openssl rand -hex 32');
    process.exit(1);
  }
}

export default config;
export {
  Config,
  ServerConfig,
  SecurityConfig,
  DatabaseConfig,
  RedisConfig,
  BoreServerConfig,
  CorsConfig,
  RateLimitConfig,
  RateLimits,
  HeartbeatConfig,
  TokenCleanupConfig,
  TokensConfig,
  PlanConfig,
  PlansConfig,
  CapacityConfig,
  AlertingConfig,
  LoggingConfig,
  AdminConfig
};

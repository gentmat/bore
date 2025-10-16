/**
 * Application Configuration
 * Centralized configuration for the backend server
 */

require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
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
    port: parseInt(process.env.DB_PORT, 10) || 5432,
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
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  // Bore Server Configuration
  boreServer: {
    host: process.env.BORE_SERVER_HOST || '127.0.0.1',
    port: parseInt(process.env.BORE_SERVER_PORT, 10) || 7835,
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
    maxTunnelsPerServer: parseInt(process.env.MAX_TUNNELS_PER_SERVER, 10) || 100,
    maxBandwidthPerTunnel: parseInt(process.env.MAX_BANDWIDTH_PER_TUNNEL, 10) || 100, // Mbps
    totalSystemCapacity: parseInt(process.env.TOTAL_SYSTEM_CAPACITY, 10) || 100,
    reservedCapacityPercent: parseInt(process.env.RESERVED_CAPACITY_PERCENT, 10) || 20,
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

module.exports = config;

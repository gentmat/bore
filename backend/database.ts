/**
 * Database Layer (TypeScript)
 * Provides typed access to PostgreSQL using pg Pool.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import config from './config';
import { logger } from './utils/logger';
import { formatDbRow, formatDbRows } from './utils/naming-convention';
import type { PlainObject } from './utils/naming-convention';

type QueryParams = unknown[];

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  plan: string;
  isAdmin: boolean;
  planExpires: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface InstanceRecord {
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
  tunnelTokenExpiresAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface StatusHistoryRecord {
  id: number;
  instanceId: string;
  status: string;
  reason: string | null;
  timestamp: string | Date;
}

interface HealthMetricsInput {
  vscode_responsive?: boolean;
  cpu_usage?: number;
  memory_usage?: number;
  has_code_server?: boolean;
  last_activity?: number;
}

interface HealthMetricsRecord {
  id: number;
  instanceId: string;
  vscodeResponsive: boolean | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  hasCodeServer: boolean | null;
  lastActivity: number | null;
  timestamp: string | Date;
}

interface TunnelTokenRecord {
  token: string;
  instanceId: string;
  userId: string;
  expiresAt: string | Date;
  createdAt: string | Date;
}

interface AlertRecord {
  id: number;
  instanceId: string;
  alertType: string;
  message: string;
  sentAt: string | Date;
}

function mapRequiredRow<T>(row: PlainObject | undefined, context: string): T {
  if (!row) {
    throw new Error(`Expected database row for ${context} but query returned none.`);
  }
  return formatDbRow(row) as unknown as T;
}

function mapOptionalRow<T>(row: PlainObject | undefined): T | undefined {
  return row ? (formatDbRow(row) as unknown as T) : undefined;
}

function mapRows<T>(rows: PlainObject[]): T[] {
  return formatDbRows(rows) as unknown as T[];
}

interface Database {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: QueryParams): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  createUser(id: string, email: string, passwordHash: string, name: string): Promise<UserRecord>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getUserById(id: string): Promise<UserRecord | undefined>;
  updateUserPlan(userId: string, plan: string, expiresAt: Date | string | null): Promise<UserRecord | undefined>;
  createInstance(instance: PlainObject): Promise<InstanceRecord>;
  getInstancesByUserId(userId: string): Promise<InstanceRecord[]>;
  getInstanceById(id: string): Promise<InstanceRecord | undefined>;
  updateInstance(id: string, updates: Record<string, unknown>): Promise<InstanceRecord | undefined>;
  deleteInstance(id: string): Promise<void>;
  getAllInstances(): Promise<InstanceRecord[]>;
  addStatusHistory(instanceId: string, status: string, reason: string | null): Promise<void>;
  getStatusHistory(instanceId: string, limit?: number): Promise<StatusHistoryRecord[]>;
  saveHealthMetrics(instanceId: string, metrics: HealthMetricsInput): Promise<void>;
  getLatestHealthMetrics(instanceId: string): Promise<HealthMetricsRecord | undefined>;
  saveTunnelToken(token: string, instanceId: string, userId: string, expiresAt: Date): Promise<void>;
  getTunnelToken(token: string): Promise<TunnelTokenRecord | undefined>;
  deleteTunnelToken(token: string): Promise<void>;
  saveAlert(instanceId: string, alertType: string, message: string): Promise<void>;
  getAlertHistory(instanceId: string, limit?: number): Promise<AlertRecord[]>;
}

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolSize,
  idleTimeoutMillis: config.database.idleTimeout,
  connectionTimeoutMillis: config.database.connectionTimeout
});

pool.on('connect', () => {
  logger.info('📦 Database connected successfully');
});

pool.on('error', (err: Error) => {
  logger.error('💥 Unexpected database error', err);
});

async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    const migrationsExist = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pgmigrations'
      );
    `);

    if (migrationsExist.rows[0]?.exists) {
      logger.info('✅ Database uses migrations - skipping legacy schema initialization');
      return;
    }

    logger.warn('⚠️  Using legacy schema initialization. Consider migrating to proper migrations!');
    logger.warn('⚠️  Run: npm run migrate:up');

    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'trial',
        is_admin BOOLEAN DEFAULT FALSE,
        plan_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, plan_expires)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        local_port INTEGER NOT NULL,
        remote_port INTEGER,
        region VARCHAR(100) NOT NULL,
        server_host VARCHAR(255),
        assigned_server VARCHAR(50),
        status VARCHAR(50) DEFAULT 'inactive',
        status_reason TEXT,
        tunnel_connected BOOLEAN DEFAULT FALSE,
        public_url TEXT,
        current_tunnel_token TEXT,
        tunnel_token_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_instances_user_id ON instances(user_id);
      CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status, user_id);
      CREATE INDEX IF NOT EXISTS idx_instances_region ON instances(region, status);
      CREATE INDEX IF NOT EXISTS idx_instances_tunnel_connected ON instances(tunnel_connected);
      CREATE INDEX IF NOT EXISTS idx_instances_created_at ON instances(created_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS status_history (
        id SERIAL PRIMARY KEY,
        instance_id VARCHAR(50) REFERENCES instances(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        reason TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_instance_timestamp ON status_history(instance_id, timestamp DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS health_metrics (
        id SERIAL PRIMARY KEY,
        instance_id VARCHAR(50) REFERENCES instances(id) ON DELETE CASCADE,
        vscode_responsive BOOLEAN,
        cpu_usage FLOAT,
        memory_usage BIGINT,
        has_code_server BOOLEAN,
        last_activity BIGINT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_instance_latest ON health_metrics(instance_id, timestamp DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tunnel_tokens (
        token VARCHAR(255) PRIMARY KEY,
        instance_id VARCHAR(50) REFERENCES instances(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tunnel_tokens_instance ON tunnel_tokens(instance_id);
      CREATE INDEX IF NOT EXISTS idx_tunnel_tokens_expires ON tunnel_tokens(expires_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        instance_id VARCHAR(50) REFERENCES instances(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_instance_sent ON alert_history(instance_id, sent_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bore_servers (
        id VARCHAR(50) PRIMARY KEY,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        location VARCHAR(255) DEFAULT 'unknown',
        max_bandwidth_mbps INTEGER DEFAULT 1000,
        max_concurrent_tunnels INTEGER DEFAULT 100,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        requested_plan VARCHAR(50) DEFAULT 'trial',
        position INTEGER,
        status VARCHAR(50) DEFAULT 'waiting',
        notified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_status_position ON waitlist(status, position)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        user_agent TEXT,
        ip_address VARCHAR(45),
        revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_token ON refresh_tokens(user_id, revoked, expires_at);
      CREATE INDEX IF NOT EXISTS idx_token_lookup ON refresh_tokens(token, revoked, expires_at)
    `);

    await client.query('COMMIT');
    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('💥 Database initialization failed', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

const db: Database = {
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: QueryParams = []): Promise<QueryResult<T>> {
    const start = Date.now();

    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;

      const metadata = {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
        rowCount: result.rowCount
      };

      if (duration > 100) {
        logger.warn('Slow query detected', metadata);
      } else {
        logger.debug('Query executed', metadata);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', error as Error, {
        duration: `${duration}ms`,
        query: text.substring(0, 100)
      });
      throw error;
    }
  },

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async createUser(id: string, email: string, passwordHash: string, name: string): Promise<UserRecord> {
    const result = await pool.query<PlainObject>(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, email, passwordHash, name]
    );

    return mapRequiredRow<UserRecord>(result.rows[0], 'createUser');
  },

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await pool.query<PlainObject>('SELECT * FROM users WHERE email = $1', [email]);
    return mapOptionalRow<UserRecord>(result.rows[0]);
  },

  async getUserById(id: string): Promise<UserRecord | undefined> {
    const result = await pool.query<PlainObject>('SELECT * FROM users WHERE id = $1', [id]);
    return mapOptionalRow<UserRecord>(result.rows[0]);
  },

  async updateUserPlan(userId: string, plan: string, expiresAt: Date | string | null): Promise<UserRecord | undefined> {
    const result = await pool.query<PlainObject>(
      'UPDATE users SET plan = $1, plan_expires = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [plan, expiresAt, userId]
    );

    return mapOptionalRow<UserRecord>(result.rows[0]);
  },

  async createInstance(instance: PlainObject): Promise<InstanceRecord> {
    const result = await pool.query<PlainObject>(
      `INSERT INTO instances (id, user_id, name, local_port, region, server_host, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        instance.id,
        instance.user_id,
        instance.name,
        instance.local_port,
        instance.region,
        instance.server_host,
        instance.status || 'inactive'
      ]
    );

    return mapRequiredRow<InstanceRecord>(result.rows[0], 'createInstance');
  },

  async getInstancesByUserId(userId: string): Promise<InstanceRecord[]> {
    const result = await pool.query<PlainObject>(
      'SELECT * FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return mapRows<InstanceRecord>(result.rows);
  },

  async getInstanceById(id: string): Promise<InstanceRecord | undefined> {
    const result = await pool.query<PlainObject>('SELECT * FROM instances WHERE id = $1', [id]);
    return mapOptionalRow<InstanceRecord>(result.rows[0]);
  },

  async updateInstance(id: string, updates: Record<string, unknown>): Promise<InstanceRecord | undefined> {
    const keys = Object.keys(updates);

    if (keys.length === 0) {
      return this.getInstanceById(id);
    }

    const fields = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values: unknown[] = [id, ...keys.map(key => updates[key])];

    const result = await pool.query<PlainObject>(
      `UPDATE instances SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      values
    );

    return mapOptionalRow<InstanceRecord>(result.rows[0]);
  },

  async deleteInstance(id: string): Promise<void> {
    await pool.query('DELETE FROM instances WHERE id = $1', [id]);
  },

  async getAllInstances(): Promise<InstanceRecord[]> {
    const result = await pool.query<PlainObject>('SELECT * FROM instances ORDER BY created_at DESC');
    return mapRows<InstanceRecord>(result.rows);
  },

  async addStatusHistory(instanceId: string, status: string, reason: string | null): Promise<void> {
    await pool.query(
      'INSERT INTO status_history (instance_id, status, reason) VALUES ($1, $2, $3)',
      [instanceId, status, reason]
    );
  },

  async getStatusHistory(instanceId: string, limit: number = 100): Promise<StatusHistoryRecord[]> {
    const result = await pool.query<PlainObject>(
      'SELECT * FROM status_history WHERE instance_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [instanceId, limit]
    );

    return mapRows<StatusHistoryRecord>(result.rows);
  },

  async saveHealthMetrics(instanceId: string, metrics: HealthMetricsInput): Promise<void> {
    await pool.query(
      `INSERT INTO health_metrics (instance_id, vscode_responsive, cpu_usage, memory_usage, has_code_server, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        instanceId,
        metrics.vscode_responsive,
        metrics.cpu_usage,
        metrics.memory_usage,
        metrics.has_code_server,
        metrics.last_activity
      ]
    );
  },

  async getLatestHealthMetrics(instanceId: string): Promise<HealthMetricsRecord | undefined> {
    const result = await pool.query<PlainObject>(
      'SELECT * FROM health_metrics WHERE instance_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [instanceId]
    );

    return mapOptionalRow<HealthMetricsRecord>(result.rows[0]);
  },

  async saveTunnelToken(token: string, instanceId: string, userId: string, expiresAt: Date): Promise<void> {
    await pool.query(
      'INSERT INTO tunnel_tokens (token, instance_id, user_id, expires_at) VALUES ($1, $2, $3, $4)',
      [token, instanceId, userId, expiresAt]
    );
  },

  async getTunnelToken(token: string): Promise<TunnelTokenRecord | undefined> {
    const result = await pool.query<PlainObject>('SELECT * FROM tunnel_tokens WHERE token = $1', [token]);
    return mapOptionalRow<TunnelTokenRecord>(result.rows[0]);
  },

  async deleteTunnelToken(token: string): Promise<void> {
    await pool.query('DELETE FROM tunnel_tokens WHERE token = $1', [token]);
  },

  async saveAlert(instanceId: string, alertType: string, message: string): Promise<void> {
    await pool.query(
      'INSERT INTO alert_history (instance_id, alert_type, message) VALUES ($1, $2, $3)',
      [instanceId, alertType, message]
    );
  },

  async getAlertHistory(instanceId: string, limit: number = 50): Promise<AlertRecord[]> {
    const result = await pool.query<PlainObject>(
      'SELECT * FROM alert_history WHERE instance_id = $1 ORDER BY sent_at DESC LIMIT $2',
      [instanceId, limit]
    );

    return mapRows<AlertRecord>(result.rows);
  }
};

export {
  db,
  initializeDatabase,
  pool,
  Database,
  UserRecord,
  InstanceRecord,
  StatusHistoryRecord,
  HealthMetricsRecord,
  HealthMetricsInput,
  TunnelTokenRecord,
  AlertRecord
};

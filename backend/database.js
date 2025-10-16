const { Pool } = require('pg');
const config = require('./config');
const { logger } = require('./utils/logger');
const { formatDbRow, formatDbRows } = require('./utils/naming-convention');

// Database configuration
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolSize,
  idleTimeoutMillis: config.database.idleTimeout,
  connectionTimeoutMillis: config.database.connectionTimeout,
});

// Test database connection
pool.on('connect', () => {
  logger.info('📦 Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('💥 Unexpected database error', err);
});

/**
 * Initialize database schema
 * NOTE: For new deployments, use migrations instead (npm run migrate:up)
 * This function is kept for backwards compatibility with existing deployments
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Check if migrations table exists
    const migrationsExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pgmigrations'
      );
    `);
    
    if (migrationsExist.rows[0].exists) {
      logger.info('✅ Database uses migrations - skipping legacy schema initialization');
      return;
    }
    
    logger.warn('⚠️  Using legacy schema initialization. Consider migrating to proper migrations!');
    logger.warn('⚠️  Run: npm run migrate:up');
    
    await client.query('BEGIN');
    
    // Users table
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
    
    // Instances table
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
    
    // Status history table
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
    
    // Health metrics table
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
    
    // Tunnel tokens table
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
    
    // Alert history table
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
    
    // Bore servers table (for server registry)
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
    
    // Waitlist table (for capacity management)
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
    
    // Refresh tokens table (for token refresh mechanism)
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
    logger.error('💥 Database initialization failed', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Database query helpers and transaction support
 * Provides abstracted database operations for the application
 */
const db = {
  /**
   * Execute a direct SQL query with performance logging
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        logger.warn('Slow query detected', {
          duration: `${duration}ms`,
          query: text.substring(0, 100),
          rowCount: result.rowCount
        });
      } else {
        logger.debug('Query executed', {
          duration: `${duration}ms`,
          query: text.substring(0, 100),
          rowCount: result.rowCount
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', error, {
        duration: `${duration}ms`,
        query: text.substring(0, 100)
      });
      throw error;
    }
  },
  
  /**
   * Execute operations within a transaction
   * Automatically handles BEGIN, COMMIT, and ROLLBACK
   * @param {Function} callback - Async function that receives client and performs queries
   * @returns {Promise<any>} Result from callback
   */
  async transaction(callback) {
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
  
  // User operations
  async createUser(id, email, passwordHash, name) {
    const result = await pool.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, email, passwordHash, name]
    );
    return formatDbRow(result.rows[0]);
  },
  
  async getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return formatDbRow(result.rows[0]);
  },
  
  async getUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return formatDbRow(result.rows[0]);
  },
  
  async updateUserPlan(userId, plan, expiresAt) {
    const result = await pool.query(
      'UPDATE users SET plan = $1, plan_expires = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [plan, expiresAt, userId]
    );
    return formatDbRow(result.rows[0]);
  },
  
  // Instance operations
  async createInstance(instance) {
    const result = await pool.query(
      `INSERT INTO instances (id, user_id, name, local_port, region, server_host, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [instance.id, instance.user_id, instance.name, instance.local_port, 
       instance.region, instance.server_host, instance.status || 'inactive']
    );
    return formatDbRow(result.rows[0]);
  },
  
  async getInstancesByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return formatDbRows(result.rows);
  },
  
  async getInstanceById(id) {
    const result = await pool.query('SELECT * FROM instances WHERE id = $1', [id]);
    return formatDbRow(result.rows[0]);
  },
  
  async updateInstance(id, updates) {
    const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    const result = await pool.query(
      `UPDATE instances SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      values
    );
    return formatDbRow(result.rows[0]);
  },
  
  async deleteInstance(id) {
    await pool.query('DELETE FROM instances WHERE id = $1', [id]);
  },
  
  async getAllInstances() {
    const result = await pool.query('SELECT * FROM instances ORDER BY created_at DESC');
    return formatDbRows(result.rows);
  },
  
  // Status history operations
  async addStatusHistory(instanceId, status, reason) {
    await pool.query(
      'INSERT INTO status_history (instance_id, status, reason) VALUES ($1, $2, $3)',
      [instanceId, status, reason]
    );
  },
  
  async getStatusHistory(instanceId, limit = 100) {
    const result = await pool.query(
      'SELECT * FROM status_history WHERE instance_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [instanceId, limit]
    );
    return formatDbRows(result.rows);
  },
  
  // Health metrics operations
  async saveHealthMetrics(instanceId, metrics) {
    await pool.query(
      `INSERT INTO health_metrics (instance_id, vscode_responsive, cpu_usage, memory_usage, has_code_server, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [instanceId, metrics.vscode_responsive, metrics.cpu_usage, 
       metrics.memory_usage, metrics.has_code_server, metrics.last_activity]
    );
  },
  
  async getLatestHealthMetrics(instanceId) {
    const result = await pool.query(
      'SELECT * FROM health_metrics WHERE instance_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [instanceId]
    );
    return formatDbRow(result.rows[0]);
  },
  
  // Tunnel token operations
  async saveTunnelToken(token, instanceId, userId, expiresAt) {
    await pool.query(
      'INSERT INTO tunnel_tokens (token, instance_id, user_id, expires_at) VALUES ($1, $2, $3, $4)',
      [token, instanceId, userId, expiresAt]
    );
  },
  
  async getTunnelToken(token) {
    const result = await pool.query('SELECT * FROM tunnel_tokens WHERE token = $1', [token]);
    return formatDbRow(result.rows[0]);
  },
  
  async deleteTunnelToken(token) {
    await pool.query('DELETE FROM tunnel_tokens WHERE token = $1', [token]);
  },
  
  // Alert history
  async saveAlert(instanceId, alertType, message) {
    await pool.query(
      'INSERT INTO alert_history (instance_id, alert_type, message) VALUES ($1, $2, $3)',
      [instanceId, alertType, message]
    );
  },
  
  async getAlertHistory(instanceId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM alert_history WHERE instance_id = $1 ORDER BY sent_at DESC LIMIT $2',
      [instanceId, limit]
    );
    return formatDbRows(result.rows);
  },
};

module.exports = { db, initializeDatabase, pool };

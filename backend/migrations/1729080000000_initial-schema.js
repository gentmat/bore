/**
 * Initial database schema migration
 * Creates all core tables and indexes
 */

exports.up = (pgm) => {
  // Users table
  pgm.createTable('users', {
    id: { type: 'varchar(50)', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    plan: { type: 'varchar(50)', default: "'trial'" },
    is_admin: { type: 'boolean', default: false },
    plan_expires: { type: 'timestamp' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('users', 'email', { name: 'idx_users_email' });
  pgm.createIndex('users', ['plan', 'plan_expires'], { name: 'idx_users_plan' });

  // Instances table
  pgm.createTable('instances', {
    id: { type: 'varchar(50)', primaryKey: true },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    name: { type: 'varchar(255)', notNull: true },
    local_port: { type: 'integer', notNull: true },
    remote_port: { type: 'integer' },
    region: { type: 'varchar(100)', notNull: true },
    server_host: { type: 'varchar(255)' },
    assigned_server: { type: 'varchar(50)' },
    status: { type: 'varchar(50)', default: "'inactive'" },
    status_reason: { type: 'text' },
    tunnel_connected: { type: 'boolean', default: false },
    public_url: { type: 'text' },
    current_tunnel_token: { type: 'text' },
    tunnel_token_expires_at: { type: 'timestamp' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('instances', 'user_id', { name: 'idx_instances_user_id' });
  pgm.createIndex('instances', ['status', 'user_id'], { name: 'idx_instances_status' });
  pgm.createIndex('instances', ['region', 'status'], { name: 'idx_instances_region' });
  pgm.createIndex('instances', 'tunnel_connected', { name: 'idx_instances_tunnel_connected' });
  pgm.createIndex('instances', 'created_at', { name: 'idx_instances_created_at', method: 'btree', order: 'DESC' });

  // Status history table
  pgm.createTable('status_history', {
    id: 'id',
    instance_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'instances(id)',
      onDelete: 'CASCADE'
    },
    status: { type: 'varchar(50)', notNull: true },
    reason: { type: 'text' },
    timestamp: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('status_history', ['instance_id', 'timestamp'], { 
    name: 'idx_instance_timestamp',
    method: 'btree',
    order: 'DESC'
  });

  // Health metrics table
  pgm.createTable('health_metrics', {
    id: 'id',
    instance_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'instances(id)',
      onDelete: 'CASCADE'
    },
    vscode_responsive: { type: 'boolean' },
    cpu_usage: { type: 'float' },
    memory_usage: { type: 'bigint' },
    has_code_server: { type: 'boolean' },
    last_activity: { type: 'bigint' },
    timestamp: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('health_metrics', ['instance_id', 'timestamp'], {
    name: 'idx_instance_latest',
    method: 'btree',
    order: 'DESC'
  });

  // Tunnel tokens table
  pgm.createTable('tunnel_tokens', {
    token: { type: 'varchar(255)', primaryKey: true },
    instance_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'instances(id)',
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('tunnel_tokens', 'instance_id', { name: 'idx_tunnel_tokens_instance' });
  pgm.createIndex('tunnel_tokens', 'expires_at', { name: 'idx_tunnel_tokens_expires' });

  // Alert history table
  pgm.createTable('alert_history', {
    id: 'id',
    instance_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'instances(id)',
      onDelete: 'CASCADE'
    },
    alert_type: { type: 'varchar(50)', notNull: true },
    message: { type: 'text', notNull: true },
    sent_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('alert_history', ['instance_id', 'sent_at'], {
    name: 'idx_instance_sent',
    method: 'btree',
    order: 'DESC'
  });

  // Bore servers table
  pgm.createTable('bore_servers', {
    id: { type: 'varchar(50)', primaryKey: true },
    host: { type: 'varchar(255)', notNull: true },
    port: { type: 'integer', notNull: true },
    location: { type: 'varchar(255)', default: "'unknown'" },
    max_bandwidth_mbps: { type: 'integer', default: 1000 },
    max_concurrent_tunnels: { type: 'integer', default: 100 },
    status: { type: 'varchar(50)', default: "'active'" },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Waitlist table
  pgm.createTable('waitlist', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    name: { type: 'varchar(255)' },
    requested_plan: { type: 'varchar(50)', default: "'trial'" },
    position: { type: 'integer' },
    status: { type: 'varchar(50)', default: "'waiting'" },
    notified_at: { type: 'timestamp' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('waitlist', ['status', 'position'], { name: 'idx_status_position' });

  // Refresh tokens table
  pgm.createTable('refresh_tokens', {
    id: 'id',
    token: { type: 'varchar(255)', notNull: true, unique: true },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    user_agent: { type: 'text' },
    ip_address: { type: 'varchar(45)' },
    revoked: { type: 'boolean', default: false },
    revoked_at: { type: 'timestamp' },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('refresh_tokens', ['user_id', 'revoked', 'expires_at'], {
    name: 'idx_user_token'
  });
  pgm.createIndex('refresh_tokens', ['token', 'revoked', 'expires_at'], {
    name: 'idx_token_lookup'
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('waitlist');
  pgm.dropTable('bore_servers');
  pgm.dropTable('alert_history');
  pgm.dropTable('tunnel_tokens');
  pgm.dropTable('health_metrics');
  pgm.dropTable('status_history');
  pgm.dropTable('instances');
  pgm.dropTable('users');
};

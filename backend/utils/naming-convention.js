/**
 * Naming Convention Utilities
 * 
 * Provides consistent conversion between:
 * - Database layer: snake_case (PostgreSQL standard)
 * - API/JavaScript layer: camelCase (JavaScript standard)
 */

/**
 * Convert snake_case to camelCase
 * @param {string} str - String in snake_case
 * @returns {string} String in camelCase
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 * @param {string} str - String in camelCase
 * @returns {string} String in snake_case
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 * @param {Object|Array} obj - Object or array with snake_case keys
 * @returns {Object|Array} Object or array with camelCase keys
 */
function keysToCamel(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToCamel(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = snakeToCamel(key);
      result[camelKey] = keysToCamel(obj[key]);
      return result;
    }, {});
  }

  return obj;
}

/**
 * Convert object keys from camelCase to snake_case
 * @param {Object|Array} obj - Object or array with camelCase keys
 * @returns {Object|Array} Object or array with snake_case keys
 */
function keysToSnake(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToSnake(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = keysToSnake(obj[key]);
      return result;
    }, {});
  }

  return obj;
}

/**
 * Field mapping for common conversions
 * Maps API field names (camelCase) to database field names (snake_case)
 */
const FIELD_MAPPINGS = {
  // Instance fields
  localPort: 'local_port',
  remotePort: 'remote_port',
  userId: 'user_id',
  instanceId: 'instance_id',
  serverId: 'server_id',
  serverHost: 'server_host',
  publicUrl: 'public_url',
  tunnelConnected: 'tunnel_connected',
  currentTunnelToken: 'current_tunnel_token',
  tunnelTokenExpiresAt: 'tunnel_token_expires_at',
  assignedServer: 'assigned_server',
  statusReason: 'status_reason',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  
  // User fields
  passwordHash: 'password_hash',
  isAdmin: 'is_admin',
  planExpires: 'plan_expires',
  
  // Health metrics
  vscodeResponsive: 'vscode_responsive',
  cpuUsage: 'cpu_usage',
  memoryUsage: 'memory_usage',
  hasCodeServer: 'has_code_server',
  lastActivity: 'last_activity',
  
  // Server fields
  maxBandwidthMbps: 'max_bandwidth_mbps',
  maxConcurrentTunnels: 'max_concurrent_tunnels',
  currentLoad: 'current_load',
  currentBandwidthMbps: 'current_bandwidth_mbps',
  lastHealthCheck: 'last_health_check',
  
  // Token fields
  expiresAt: 'expires_at',
  
  // Alert fields
  alertType: 'alert_type',
  sentAt: 'sent_at',
  
  // Refresh token fields
  userAgent: 'user_agent',
  ipAddress: 'ip_address',
  revokedAt: 'revoked_at'
};

/**
 * Convert API field name to database field name
 * @param {string} apiField - Field name in camelCase
 * @returns {string} Field name in snake_case
 */
function apiToDb(apiField) {
  return FIELD_MAPPINGS[apiField] || camelToSnake(apiField);
}

/**
 * Convert database field name to API field name
 * @param {string} dbField - Field name in snake_case
 * @returns {string} Field name in camelCase
 */
function dbToApi(dbField) {
  // Reverse lookup in mappings
  const apiField = Object.keys(FIELD_MAPPINGS).find(
    key => FIELD_MAPPINGS[key] === dbField
  );
  return apiField || snakeToCamel(dbField);
}

/**
 * Normalize field names in request body
 * Accepts both camelCase and snake_case, converts to snake_case for DB
 * @param {Object} body - Request body
 * @returns {Object} Normalized body with snake_case keys
 */
function normalizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const normalized = {};
  
  for (const [key, value] of Object.entries(body)) {
    // Check if key exists in mappings (camelCase)
    if (FIELD_MAPPINGS[key]) {
      normalized[FIELD_MAPPINGS[key]] = value;
    }
    // Check if it's already in snake_case
    else if (key.includes('_')) {
      normalized[key] = value;
    }
    // Convert camelCase to snake_case
    else {
      normalized[camelToSnake(key)] = value;
    }
  }
  
  return normalized;
}

/**
 * Format database row for API response
 * Converts snake_case to camelCase and adds any additional formatting
 * @param {Object} row - Database row
 * @returns {Object} Formatted object for API
 */
function formatDbRow(row) {
  if (!row) return row;
  return keysToCamel(row);
}

/**
 * Format multiple database rows for API response
 * @param {Array} rows - Array of database rows
 * @returns {Array} Array of formatted objects
 */
function formatDbRows(rows) {
  if (!rows || !Array.isArray(rows)) return rows;
  return rows.map(row => formatDbRow(row));
}

module.exports = {
  snakeToCamel,
  camelToSnake,
  keysToCamel,
  keysToSnake,
  apiToDb,
  dbToApi,
  normalizeRequestBody,
  formatDbRow,
  formatDbRows,
  FIELD_MAPPINGS
};

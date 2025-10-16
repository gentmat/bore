/**
 * Naming Convention Utilities
 * Maintains conversion between database snake_case and API camelCase.
 */

type PlainObject = Record<string, unknown>;

type CamelCase<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<CamelCase<Tail>>}`
    : S;

type CamelCasedProperties<T> = {
  [K in keyof T as K extends string ? CamelCase<K> : K]:
    T[K] extends Array<infer U>
      ? U extends Record<string, unknown>
        ? Array<CamelCasedProperties<U>>
        : T[K]
      : T[K] extends Record<string, unknown>
        ? CamelCasedProperties<T[K]>
        : T[K];
};

const FIELD_MAPPINGS: Record<string, string> = {
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

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function keysToCamel<T extends PlainObject>(obj: T): CamelCasedProperties<T>;
function keysToCamel<T>(obj: T[]): Array<T extends PlainObject ? CamelCasedProperties<T> : T>;
function keysToCamel<T>(obj: T): T;
function keysToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToCamel(item));
  }

  if (isPlainObject(obj)) {
    return Object.keys(obj).reduce<PlainObject>((result, key) => {
      const camelKey = snakeToCamel(key);
      result[camelKey] = keysToCamel((obj as PlainObject)[key]);
      return result;
    }, {});
  }

  return obj;
}

function keysToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToSnake(item));
  }

  if (isPlainObject(obj)) {
    return Object.keys(obj).reduce<PlainObject>((result, key) => {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = keysToSnake((obj as PlainObject)[key]);
      return result;
    }, {});
  }

  return obj;
}

function apiToDb(apiField: string): string {
  return FIELD_MAPPINGS[apiField] || camelToSnake(apiField);
}

function dbToApi(dbField: string): string {
  const apiField = Object.keys(FIELD_MAPPINGS).find(
    key => FIELD_MAPPINGS[key] === dbField
  );
  return apiField || snakeToCamel(dbField);
}

function normalizeRequestBody<T extends PlainObject | null | undefined>(body: T): T extends PlainObject ? PlainObject : T {
  if (!body || !isPlainObject(body)) {
    return body as T extends PlainObject ? PlainObject : T;
  }

  const normalized: PlainObject = {};

  for (const [key, value] of Object.entries(body)) {
    if (FIELD_MAPPINGS[key]) {
      normalized[FIELD_MAPPINGS[key]] = value;
    } else if (key.includes('_')) {
      normalized[key] = value;
    } else {
      normalized[camelToSnake(key)] = value;
    }
  }

  return normalized as T extends PlainObject ? PlainObject : T;
}

function formatDbRow<T extends PlainObject>(row: T): CamelCasedProperties<T>;
function formatDbRow<T>(row: T | null | undefined): T;
function formatDbRow(row: unknown): unknown {
  if (row === null || row === undefined) {
    return row;
  }

  if (!isPlainObject(row)) {
    return row;
  }

  return keysToCamel(row as PlainObject);
}

function formatDbRows<T extends PlainObject>(rows: T[]): Array<CamelCasedProperties<T>>;
function formatDbRows<T>(rows: T | null | undefined): T;
function formatDbRows(rows: unknown): unknown {
  if (rows === null || rows === undefined) {
    return rows;
  }

  if (!Array.isArray(rows)) {
    return rows;
  }

  return rows.map(row => formatDbRow(row)) as unknown;
}

export {
  FIELD_MAPPINGS,
  snakeToCamel,
  camelToSnake,
  keysToCamel,
  keysToSnake,
  apiToDb,
  dbToApi,
  normalizeRequestBody,
  formatDbRow,
  formatDbRows
};

export type {
  CamelCase,
  CamelCasedProperties,
  PlainObject
};

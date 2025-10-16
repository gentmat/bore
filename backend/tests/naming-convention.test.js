/**
 * Naming Convention Utilities Tests
 * Tests the snake_case <-> camelCase conversion utilities
 */

const {
  snakeToCamel,
  camelToSnake,
  keysToCamel,
  keysToSnake,
  apiToDb,
  dbToApi,
  normalizeRequestBody,
  formatDbRow,
  formatDbRows
} = require('../utils/naming-convention');

describe('Naming Convention Utilities', () => {
  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('user_id')).toBe('userId');
      expect(snakeToCamel('local_port')).toBe('localPort');
      expect(snakeToCamel('vscode_responsive')).toBe('vscodeResponsive');
      expect(snakeToCamel('last_heartbeat')).toBe('lastHeartbeat');
    });

    it('should handle strings without underscores', () => {
      expect(snakeToCamel('name')).toBe('name');
      expect(snakeToCamel('status')).toBe('status');
    });

    it('should handle empty strings', () => {
      expect(snakeToCamel('')).toBe('');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('userId')).toBe('user_id');
      expect(camelToSnake('localPort')).toBe('local_port');
      expect(camelToSnake('vscodeResponsive')).toBe('vscode_responsive');
      expect(camelToSnake('lastHeartbeat')).toBe('last_heartbeat');
    });

    it('should handle lowercase strings', () => {
      expect(camelToSnake('name')).toBe('name');
      expect(camelToSnake('status')).toBe('status');
    });

    it('should handle empty strings', () => {
      expect(camelToSnake('')).toBe('');
    });
  });

  describe('keysToCamel', () => {
    it('should convert object keys from snake_case to camelCase', () => {
      const input = {
        user_id: 'user_123',
        local_port: 8080,
        vscode_responsive: true
      };

      const expected = {
        userId: 'user_123',
        localPort: 8080,
        vscodeResponsive: true
      };

      expect(keysToCamel(input)).toEqual(expected);
    });

    it('should handle nested objects', () => {
      const input = {
        user_id: 'user_123',
        health_metrics: {
          cpu_usage: 45.2,
          memory_usage: 2048576
        }
      };

      const expected = {
        userId: 'user_123',
        healthMetrics: {
          cpuUsage: 45.2,
          memoryUsage: 2048576
        }
      };

      expect(keysToCamel(input)).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = [
        { user_id: 'user_1', local_port: 8080 },
        { user_id: 'user_2', local_port: 3000 }
      ];

      const expected = [
        { userId: 'user_1', localPort: 8080 },
        { userId: 'user_2', localPort: 3000 }
      ];

      expect(keysToCamel(input)).toEqual(expected);
    });

    it('should handle null and undefined', () => {
      expect(keysToCamel(null)).toBeNull();
      expect(keysToCamel(undefined)).toBeUndefined();
    });
  });

  describe('keysToSnake', () => {
    it('should convert object keys from camelCase to snake_case', () => {
      const input = {
        userId: 'user_123',
        localPort: 8080,
        vscodeResponsive: true
      };

      const expected = {
        user_id: 'user_123',
        local_port: 8080,
        vscode_responsive: true
      };

      expect(keysToSnake(input)).toEqual(expected);
    });

    it('should handle nested objects', () => {
      const input = {
        userId: 'user_123',
        healthMetrics: {
          cpuUsage: 45.2,
          memoryUsage: 2048576
        }
      };

      const expected = {
        user_id: 'user_123',
        health_metrics: {
          cpu_usage: 45.2,
          memory_usage: 2048576
        }
      };

      expect(keysToSnake(input)).toEqual(expected);
    });
  });

  describe('apiToDb and dbToApi', () => {
    it('should map API field names to database field names', () => {
      expect(apiToDb('localPort')).toBe('local_port');
      expect(apiToDb('userId')).toBe('user_id');
      expect(apiToDb('vscodeResponsive')).toBe('vscode_responsive');
    });

    it('should map database field names to API field names', () => {
      expect(dbToApi('local_port')).toBe('localPort');
      expect(dbToApi('user_id')).toBe('userId');
      expect(dbToApi('vscode_responsive')).toBe('vscodeResponsive');
    });

    it('should fall back to automatic conversion for unmapped fields', () => {
      expect(apiToDb('customField')).toBe('custom_field');
      expect(dbToApi('custom_field')).toBe('customField');
    });
  });

  describe('normalizeRequestBody', () => {
    it('should accept camelCase and convert to snake_case', () => {
      const input = {
        localPort: 8080,
        vscodeResponsive: true
      };

      const expected = {
        local_port: 8080,
        vscode_responsive: true
      };

      expect(normalizeRequestBody(input)).toEqual(expected);
    });

    it('should accept snake_case and keep it', () => {
      const input = {
        local_port: 8080,
        vscode_responsive: true
      };

      const expected = {
        local_port: 8080,
        vscode_responsive: true
      };

      expect(normalizeRequestBody(input)).toEqual(expected);
    });

    it('should handle mixed naming conventions', () => {
      const input = {
        localPort: 8080,
        vscode_responsive: true,
        name: 'Test'
      };

      const expected = {
        local_port: 8080,
        vscode_responsive: true,
        name: 'Test'
      };

      expect(normalizeRequestBody(input)).toEqual(expected);
    });

    it('should use explicit mappings when available', () => {
      const input = {
        localPort: 8080,
        userId: 'user_123'
      };

      const expected = {
        local_port: 8080,
        user_id: 'user_123'
      };

      expect(normalizeRequestBody(input)).toEqual(expected);
    });
  });

  describe('formatDbRow and formatDbRows', () => {
    it('should format a database row to camelCase', () => {
      const dbRow = {
        id: 'inst_123',
        user_id: 'user_123',
        local_port: 8080,
        vscode_responsive: true,
        created_at: '2024-01-01T00:00:00Z'
      };

      const expected = {
        id: 'inst_123',
        userId: 'user_123',
        localPort: 8080,
        vscodeResponsive: true,
        createdAt: '2024-01-01T00:00:00Z'
      };

      expect(formatDbRow(dbRow)).toEqual(expected);
    });

    it('should format multiple database rows', () => {
      const dbRows = [
        { id: 'inst_1', user_id: 'user_1', local_port: 8080 },
        { id: 'inst_2', user_id: 'user_2', local_port: 3000 }
      ];

      const expected = [
        { id: 'inst_1', userId: 'user_1', localPort: 8080 },
        { id: 'inst_2', userId: 'user_2', localPort: 3000 }
      ];

      expect(formatDbRows(dbRows)).toEqual(expected);
    });

    it('should handle null values', () => {
      expect(formatDbRow(null)).toBeNull();
      expect(formatDbRows(null)).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(formatDbRow(undefined)).toBeUndefined();
      expect(formatDbRows(undefined)).toBeUndefined();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle instance creation request', () => {
      // Client sends camelCase
      const request = {
        name: 'My Instance',
        localPort: 8080,
        region: 'us-east'
      };

      // Normalize to snake_case for database
      const normalized = normalizeRequestBody(request);
      expect(normalized).toEqual({
        name: 'My Instance',
        local_port: 8080,
        region: 'us-east'
      });
    });

    it('should handle database row to API response', () => {
      // Database returns snake_case
      const dbRow = {
        id: 'inst_123',
        user_id: 'user_123',
        name: 'My Instance',
        local_port: 8080,
        remote_port: 7835,
        tunnel_connected: true,
        created_at: '2024-01-01T00:00:00Z'
      };

      // Format to camelCase for API response
      const formatted = formatDbRow(dbRow);
      expect(formatted).toEqual({
        id: 'inst_123',
        userId: 'user_123',
        name: 'My Instance',
        localPort: 8080,
        remotePort: 7835,
        tunnelConnected: true,
        createdAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should handle heartbeat request with both naming conventions', () => {
      // Client can send either format
      const camelCaseRequest = {
        vscodeResponsive: true,
        cpuUsage: 45.2,
        memoryUsage: 2048576
      };

      const snakeCaseRequest = {
        vscode_responsive: true,
        cpu_usage: 45.2,
        memory_usage: 2048576
      };

      const normalized1 = normalizeRequestBody(camelCaseRequest);
      const normalized2 = normalizeRequestBody(snakeCaseRequest);

      // Both should result in the same normalized format
      const expected = {
        vscode_responsive: true,
        cpu_usage: 45.2,
        memory_usage: 2048576
      };

      expect(normalized1).toEqual(expected);
      expect(normalized2).toEqual(expected);
    });
  });
});

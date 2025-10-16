/**
 * Unit tests for Server Registry
 * Tests load balancing and server management
 */

import {
  registerServer,
  getActiveServers,
  getBestServer,
  updateServerLoad,
  markServerUnhealthy,
  getFleetStats
} from '../server-registry';
import { db } from '../database';
import * as redisService from '../services/redis-service';
import config from '../config';

// Mock dependencies
jest.mock('../database');
jest.mock('../services/redis-service');
jest.mock('../utils/logger');

const mockDb = db as jest.Mocked<typeof db>;

describe('Server Registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.redis.enabled = false; // Test in-memory mode by default
  });

  describe('registerServer', () => {
    it('should register a new server', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({});

      const serverInfo = {
        id: 'server_1',
        host: '192.168.1.100',
        port: 7835,
        location: 'us-east',
        maxBandwidthMbps: 1000,
        maxConcurrentTunnels: 100
      };

      const result = await registerServer(serverInfo);

      expect(result).toMatchObject({
        id: 'server_1',
        host: '192.168.1.100',
        status: 'active',
        currentLoad: 0
      });
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should register with default values', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({});

      const result = await registerServer({
        host: '192.168.1.100'
      });

      expect(result.port).toBe(7835);
      expect(result.maxConcurrentTunnels).toBe(100);
      expect(result.location).toBe('sweden-home');
    });

    it('should store in Redis when enabled', async () => {
      config.redis.enabled = true;
      (redisService as any).client = {
        setex: jest.fn().mockResolvedValue('OK')
      };
      (mockDb.query as jest.Mock).mockResolvedValue({});

      await registerServer({
        id: 'server_1',
        host: '192.168.1.100'
      });

      expect((redisService as any).client.setex).toHaveBeenCalled();
    });
  });

  describe('getActiveServers', () => {
    it('should return active servers from memory', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({});

      // Register some servers
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        maxConcurrentTunnels: 100
      });
      await registerServer({
        id: 'server_2',
        host: '192.168.1.101',
        maxConcurrentTunnels: 100
      });

      const servers = await getActiveServers();

      expect(servers).toHaveLength(2);
      expect(servers[0].id).toBe('server_1');
      expect(servers[1].id).toBe('server_2');
    });

    it('should filter inactive servers', async () => {
      const { servers } = require('../server-registry');
      servers.clear();
      
      servers.set('server_1', {
        id: 'server_1',
        host: '192.168.1.100',
        status: 'active'
      });
      servers.set('server_2', {
        id: 'server_2',
        host: '192.168.1.101',
        status: 'unhealthy'
      });

      const active = await getActiveServers();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('server_1');
    });
  });

  describe('getBestServer', () => {
    beforeEach(async () => {
      const { servers } = require('../server-registry');
      servers.clear();
      (mockDb.query as jest.Mock).mockResolvedValue({});
    });

    it('should return server with lowest utilization', async () => {
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });
      await registerServer({
        id: 'server_2',
        host: '192.168.1.101',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });

      // Update loads
      await updateServerLoad('server_1', 80, 500);
      await updateServerLoad('server_2', 20, 100);

      const best = await getBestServer();

      expect(best.id).toBe('server_2');
      expect(best.overallUtilization).toBeLessThan(50);
    });

    it('should return null when no servers available', async () => {
      const { servers } = require('../server-registry');
      servers.clear();

      const best = await getBestServer();

      expect(best).toBeNull();
    });

    it('should consider both tunnel and bandwidth utilization', async () => {
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });

      await updateServerLoad('server_1', 20, 900); // Low tunnels, high bandwidth

      const best = await getBestServer();

      // Should use worst of the two metrics (90% bandwidth)
      expect(best.overallUtilization).toBeGreaterThan(80);
    });
  });

  describe('updateServerLoad', () => {
    it('should update server metrics', async () => {
      const { servers } = require('../server-registry');
      (mockDb.query as jest.Mock).mockResolvedValue({});
      
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        maxConcurrentTunnels: 100
      });

      await updateServerLoad('server_1', 50, 300);

      const server = servers.get('server_1');
      expect(server.currentLoad).toBe(50);
      expect(server.currentBandwidthMbps).toBe(300);
      expect(server.lastHealthCheck).toBeDefined();
    });

    it('should update Redis when enabled', async () => {
      config.redis.enabled = true;
      (redisService as any).client = {
        get: jest.fn().mockResolvedValue(JSON.stringify({
          id: 'server_1',
          host: '192.168.1.100'
        })),
        setex: jest.fn().mockResolvedValue('OK')
      };

      await updateServerLoad('server_1', 50, 300);

      expect((redisService as any).client.setex).toHaveBeenCalled();
    });
  });

  describe('markServerUnhealthy', () => {
    it('should mark server as unhealthy', async () => {
      const { servers } = require('../server-registry');
      (mockDb.query as jest.Mock).mockResolvedValue({});
      
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100'
      });

      await markServerUnhealthy('server_1');

      const server = servers.get('server_1');
      expect(server.status).toBe('unhealthy');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['unhealthy', 'server_1']
      );
    });
  });

  describe('getFleetStats', () => {
    beforeEach(async () => {
      const { servers } = require('../server-registry');
      servers.clear();
      (mockDb.query as jest.Mock).mockResolvedValue({});
    });

    it('should calculate fleet-wide statistics', async () => {
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });
      await registerServer({
        id: 'server_2',
        host: '192.168.1.101',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });

      await updateServerLoad('server_1', 50, 500);
      await updateServerLoad('server_2', 30, 300);

      const stats = await getFleetStats();

      expect(stats.serverCount).toBe(2);
      expect(stats.totalCapacity).toBe(200);
      expect(stats.totalLoad).toBe(80);
      expect(stats.utilizationPercent).toBe(40);
      expect(stats.totalBandwidthGbps).toBe(2);
      expect(stats.usedBandwidthGbps).toBe(0.8);
    });

    it('should handle empty fleet', async () => {
      const { servers } = require('../server-registry');
      servers.clear();

      const stats = await getFleetStats();

      expect(stats.serverCount).toBe(0);
      expect(stats.totalCapacity).toBe(0);
      expect(stats.utilizationPercent).toBe(0);
    });

    it('should include per-server details', async () => {
      await registerServer({
        id: 'server_1',
        host: '192.168.1.100',
        location: 'us-east',
        maxConcurrentTunnels: 100,
        maxBandwidthMbps: 1000
      });

      await updateServerLoad('server_1', 25, 250);

      const stats = await getFleetStats();

      expect(stats.servers).toHaveLength(1);
      expect(stats.servers[0]).toMatchObject({
        id: 'server_1',
        host: '192.168.1.100',
        location: 'us-east',
        load: 25,
        maxLoad: 100,
        utilizationPercent: 25
      });
    });
  });
});

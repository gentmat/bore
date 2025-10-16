/**
 * Unit tests for Capacity Limiter
 * Tests system capacity checks and user quota enforcement
 */

const {
  checkSystemCapacity,
  checkUserQuota,
  requireCapacity,
  getCapacityStats,
  CAPACITY_CONFIG
} = require('../capacity-limiter');
const { db } = require('../database');
const { getFleetStats } = require('../server-registry');

// Mock dependencies
jest.mock('../database');
jest.mock('../server-registry');
jest.mock('../utils/logger');

describe('Capacity Limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSystemCapacity', () => {
    it('should return capacity available when under limit', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50,
        bandwidthUtilizationPercent: 30
      });

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(true);
      expect(result.activeTunnels).toBe(50);
      expect(result.totalCapacity).toBe(100);
      expect(result.utilizationPercent).toBe(50);
    });

    it('should return no capacity when at limit', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 85, // Above threshold with 20% reserved
        utilizationPercent: 85,
        bandwidthUtilizationPercent: 80
      });

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(false);
      expect(result.activeTunnels).toBe(85);
    });

    it('should handle no servers available', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 0,
        totalCapacity: 0,
        totalLoad: 0,
        utilizationPercent: 0,
        bandwidthUtilizationPercent: 0
      });

      db.query.mockResolvedValue({
        rows: [{ active: '10' }]
      });

      const result = await checkSystemCapacity();

      expect(result).toBeDefined();
      expect(result.serverCount).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      getFleetStats.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkUserQuota', () => {
    it('should allow user under quota', async () => {
      db.getUserById.mockResolvedValue({
        id: 'user_123',
        plan: 'pro'
      });

      db.query.mockResolvedValue({
        rows: [{ count: '2' }]
      });

      const result = await checkUserQuota('user_123');

      expect(result.allowed).toBe(true);
      expect(result.activeTunnels).toBe(2);
      expect(result.maxTunnels).toBe(5); // Pro plan limit
    });

    it('should reject user at quota', async () => {
      db.getUserById.mockResolvedValue({
        id: 'user_123',
        plan: 'trial'
      });

      db.query.mockResolvedValue({
        rows: [{ count: '1' }]
      });

      const result = await checkUserQuota('user_123');

      expect(result.allowed).toBe(false);
      expect(result.activeTunnels).toBe(1);
      expect(result.maxTunnels).toBe(1); // Trial plan limit
      expect(result.reason).toContain('Plan limit reached');
    });

    it('should handle enterprise plan', async () => {
      db.getUserById.mockResolvedValue({
        id: 'user_123',
        plan: 'enterprise'
      });

      db.query.mockResolvedValue({
        rows: [{ count: '15' }]
      });

      const result = await checkUserQuota('user_123');

      expect(result.allowed).toBe(true);
      expect(result.maxTunnels).toBe(20); // Enterprise plan limit
    });

    it('should handle user not found', async () => {
      db.getUserById.mockResolvedValue(null);

      const result = await checkUserQuota('user_nonexistent');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('User not found');
    });

    it('should handle database errors', async () => {
      db.getUserById.mockRejectedValue(new Error('Database connection lost'));

      const result = await checkUserQuota('user_123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Failed to check quota');
    });
  });

  describe('requireCapacity middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        user: { user_id: 'user_123' },
        id: 'req_123'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should allow request when capacity available', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50
      });

      db.getUserById.mockResolvedValue({ plan: 'pro' });
      db.query.mockResolvedValue({ rows: [{ count: '1' }] });

      await requireCapacity(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.capacityInfo).toBeDefined();
    });

    it('should reject when system at capacity', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 85,
        utilizationPercent: 85
      });

      await requireCapacity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'capacity_exceeded'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user at quota', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50
      });

      db.getUserById.mockResolvedValue({ plan: 'trial' });
      db.query.mockResolvedValue({ rows: [{ count: '1' }] });

      await requireCapacity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'quota_exceeded'
        })
      );
    });
  });

  describe('getCapacityStats', () => {
    it('should return comprehensive capacity statistics', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 3,
        totalCapacity: 300,
        totalLoad: 150,
        utilizationPercent: 50,
        servers: []
      });

      const stats = await getCapacityStats();

      expect(stats).toHaveProperty('system');
      expect(stats).toHaveProperty('fleet');
      expect(stats).toHaveProperty('alerts');
      expect(stats).toHaveProperty('timestamp');
    });

    it('should generate capacity alerts', async () => {
      getFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 92,
        utilizationPercent: 92,
        servers: []
      });

      const stats = await getCapacityStats();

      expect(stats.alerts).toBeDefined();
      expect(stats.alerts.length).toBeGreaterThan(0);
      expect(stats.alerts[0].severity).toBe('critical');
    });
  });
});

/**
 * Unit tests for Capacity Limiter
 * Tests system capacity checks and user quota enforcement
 */

import {
  checkSystemCapacity,
  checkUserQuota,
  requireCapacity,
  getCapacityStats,
} from "../capacity-limiter";
import { db } from "../database";
import { getFleetStats } from "../server-registry";
import { Request, Response, NextFunction } from "express";
import { CapacityInfo } from "../capacity-limiter";

// Mock dependencies
jest.mock("../database");
jest.mock("../server-registry");
jest.mock("../utils/logger");

const mockDb = {
  query: jest.fn(),
  getUserById: jest.fn(),
  getInstanceById: jest.fn(),
  updateInstance: jest.fn(),
  addStatusHistory: jest.fn(),
  deleteTunnelToken: jest.fn(),
} as unknown as jest.Mocked<typeof db>;

const mockGetFleetStats = getFleetStats as jest.MockedFunction<
  typeof getFleetStats
>;

interface RequestWithUser extends Request {
  user?: { user_id: string; email: string; plan: string };
  capacityInfo?: CapacityInfo;
}

describe("Capacity Limiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkSystemCapacity", () => {
    it("should return capacity available when under limit", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 3,
        bandwidthUtilizationPercent: 30,
        servers: [],
      });

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(true);
      expect(result.activeTunnels).toBe(50);
      expect(result.totalCapacity).toBe(100);
      expect(result.utilizationPercent).toBe(50);
    });

    it("should return no capacity when at limit", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 85, // Above threshold with 20% reserved
        utilizationPercent: 85,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 8,
        bandwidthUtilizationPercent: 80,
        servers: [],
      });

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(false);
      expect(result.activeTunnels).toBe(85);
    });

    it("should handle no servers available", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 0,
        totalCapacity: 0,
        totalLoad: 0,
        utilizationPercent: 0,
        totalBandwidthGbps: 0,
        usedBandwidthGbps: 0,
        bandwidthUtilizationPercent: 0,
        servers: [],
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ active: "10" }],
      });

      const result = await checkSystemCapacity();

      expect(result).toBeDefined();
      expect(result.serverCount).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      mockGetFleetStats.mockRejectedValue(new Error("Redis connection failed"));

      const result = await checkSystemCapacity();

      expect(result.hasCapacity).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("checkUserQuota", () => {
    it("should allow user under quota", async () => {
      (mockDb.getUserById as jest.Mock).mockResolvedValue({
        id: "user_123",
        plan: "pro",
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ count: "2" }],
      });

      const result = await checkUserQuota("user_123");

      expect(result.allowed).toBe(true);
      expect(result.activeTunnels).toBe(2);
      expect(result.maxTunnels).toBe(5); // Pro plan limit
    });

    it("should reject user at quota", async () => {
      (mockDb.getUserById as jest.Mock).mockResolvedValue({
        id: "user_123",
        plan: "trial",
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ count: "1" }],
      });

      const result = await checkUserQuota("user_123");

      expect(result.allowed).toBe(false);
      expect(result.activeTunnels).toBe(1);
      expect(result.maxTunnels).toBe(1); // Trial plan limit
      expect(result.reason).toContain("Plan limit reached");
    });

    it("should handle enterprise plan", async () => {
      (mockDb.getUserById as jest.Mock).mockResolvedValue({
        id: "user_123",
        plan: "enterprise",
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ count: "15" }],
      });

      const result = await checkUserQuota("user_123");

      expect(result.allowed).toBe(true);
      expect(result.maxTunnels).toBe(20); // Enterprise plan limit
    });

    it("should handle user not found", async () => {
      (mockDb.getUserById as jest.Mock).mockResolvedValue(null);

      const result = await checkUserQuota("user_nonexistent");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("User not found");
    });

    it("should handle database errors", async () => {
      (mockDb.getUserById as jest.Mock).mockRejectedValue(
        new Error("Database connection lost"),
      );

      const result = await checkUserQuota("user_123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Failed to check quota");
    });
  });

  describe("requireCapacity middleware", () => {
    let req: Partial<RequestWithUser>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        user: { user_id: "user_123", email: "test@example.com", plan: "trial" },
        id: "req_123",
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as Partial<Response>;
      next = jest.fn();
    });

    it("should allow request when capacity available", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 3,
        bandwidthUtilizationPercent: 30,
        servers: [],
      });

      (mockDb.getUserById as jest.Mock).mockResolvedValue({ plan: "pro" });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [{ count: "1" }] });

      await requireCapacity(req as RequestWithUser, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.capacityInfo).toBeDefined();
    });

    it("should reject when system at capacity", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 85,
        utilizationPercent: 85,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 8,
        bandwidthUtilizationPercent: 80,
        servers: [],
      });

      await requireCapacity(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "capacity_exceeded",
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject when user at quota", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 50,
        utilizationPercent: 50,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 3,
        bandwidthUtilizationPercent: 30,
        servers: [],
      });

      (mockDb.getUserById as jest.Mock).mockResolvedValue({ plan: "trial" });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [{ count: "1" }] });

      await requireCapacity(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "quota_exceeded",
        }),
      );
    });
  });

  describe("getCapacityStats", () => {
    it("should return comprehensive capacity statistics", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 3,
        totalCapacity: 300,
        totalLoad: 150,
        utilizationPercent: 50,
        totalBandwidthGbps: 30,
        usedBandwidthGbps: 13.5,
        bandwidthUtilizationPercent: 45,
        servers: [],
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ active: "150" }],
      });

      const stats = await getCapacityStats();

      expect(stats).toBeDefined();
      expect(stats.system.utilizationPercent).toBe(50);
    });

    it("should generate capacity alerts", async () => {
      mockGetFleetStats.mockResolvedValue({
        serverCount: 2,
        totalCapacity: 100,
        totalLoad: 92,
        utilizationPercent: 92,
        totalBandwidthGbps: 10,
        usedBandwidthGbps: 8.8,
        bandwidthUtilizationPercent: 88,
        servers: [],
      });

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ active: "92" }],
      });

      const stats = await getCapacityStats();

      expect(stats).toBeDefined();
      expect(stats.system.utilizationPercent).toBe(92);
    });
  });
});

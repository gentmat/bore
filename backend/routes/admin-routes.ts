import express, { Request, Response, Router } from "express";
import { db } from "../database";
import { requireAdminAuth } from "../auth-middleware";
import { ErrorResponses } from "../utils/error-handler";
import { logger } from "../utils/logger";
import { AdminRequest } from "../types/express";

const router: Router = express.Router();

/**
 * Get system statistics (admin only)
 * Shows overview of total users, instances, plans, etc.
 */
router.get(
  "/stats",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const stats = await db.getSystemStats();

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });

      logger.info("Admin viewed system stats", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
      });
    } catch (error) {
      logger.error("Get system stats error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to get system stats",
        req.id,
      );
    }
  },
);

/**
 * Get all users (admin only)
 * Returns list of all users in the system
 */
router.get(
  "/users",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const users = await db.getAllUsers();

      // Remove password hashes from response
      const sanitizedUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        isAdmin: user.isAdmin,
        planExpires: user.planExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      res.json({
        success: true,
        users: sanitizedUsers,
        total: sanitizedUsers.length,
      });

      logger.info("Admin viewed all users", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        userCount: sanitizedUsers.length,
      });
    } catch (error) {
      logger.error("Get all users error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to get users",
        req.id,
      );
    }
  },
);

/**
 * Get all instances (admin only)
 * Returns list of all tunnel instances across all users
 */
router.get(
  "/instances",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const instances = await db.getAllInstances();

      res.json({
        success: true,
        instances,
        total: instances.length,
      });

      logger.info("Admin viewed all instances", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        instanceCount: instances.length,
      });
    } catch (error) {
      logger.error("Get all instances error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to get instances",
        req.id,
      );
    }
  },
);

/**
 * Update user plan (admin only)
 * Allows admin to change user's plan and expiration
 */
router.patch(
  "/users/:userId/plan",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const { userId } = req.params;
      const { plan, planExpires } = req.body;

      if (!userId) {
        ErrorResponses.badRequest(res, "User ID is required", null, adminReq.id);
        return;
      }

      if (!plan || !["trial", "pro", "enterprise"].includes(plan)) {
        ErrorResponses.badRequest(
          res,
          "Invalid plan. Must be one of: trial, pro, enterprise",
          null,
          adminReq.id,
        );
        return;
      }

      const user = await db.getUserById(userId);
      if (!user) {
        ErrorResponses.notFound(res, "User", adminReq.id);
        return;
      }

      const expiresAt = planExpires ? new Date(planExpires) : null;
      const updatedUser = await db.updateUserPlan(userId, plan, expiresAt);

      res.json({
        success: true,
        user: {
          id: updatedUser?.id,
          email: updatedUser?.email,
          name: updatedUser?.name,
          plan: updatedUser?.plan,
          planExpires: updatedUser?.planExpires,
        },
      });

      logger.info("Admin updated user plan", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        targetUserId: userId,
        newPlan: plan,
        planExpires: expiresAt?.toISOString() || null,
      });
    } catch (error) {
      logger.error("Update user plan error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to update user plan",
        req.id,
      );
    }
  },
);

/**
 * Get user details with instances (admin only)
 * Shows detailed information about a specific user
 */
router.get(
  "/users/:userId",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const { userId } = req.params;

      if (!userId) {
        ErrorResponses.badRequest(res, "User ID is required", null, adminReq.id);
        return;
      }

      const user = await db.getUserById(userId);
      if (!user) {
        ErrorResponses.notFound(res, "User", adminReq.id);
        return;
      }

      const instances = await db.getInstancesByUserId(userId);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          isAdmin: user.isAdmin,
          planExpires: user.planExpires,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        instances,
        instanceCount: instances.length,
      });

      logger.info("Admin viewed user details", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        targetUserId: userId,
      });
    } catch (error) {
      logger.error("Get user details error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to get user details",
        req.id,
      );
    }
  },
);

/**
 * Ban user (admin only)
 * Prevents user from accessing the system
 */
router.post(
  "/users/:userId/ban",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const { userId } = req.params;

      if (!userId) {
        ErrorResponses.badRequest(res, "User ID is required", null, adminReq.id);
        return;
      }

      const user = await db.getUserById(userId);
      if (!user) {
        ErrorResponses.notFound(res, "User", adminReq.id);
        return;
      }

      if (user.isAdmin) {
        ErrorResponses.badRequest(res, "Cannot ban admin users", null, adminReq.id);
        return;
      }

      await db.banUser(userId);
      await db.logAdminAction({
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        action: "ban_user",
        targetType: "user",
        targetId: userId,
        details: { userEmail: user.email },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "User banned successfully",
      });

      logger.info("Admin banned user", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        targetUserId: userId,
        targetUserEmail: user.email,
      });
    } catch (error) {
      logger.error("Ban user error", error as Error);
      ErrorResponses.internalError(res, "Failed to ban user", req.id);
    }
  },
);

/**
 * Unban user (admin only)
 * Restores user access
 */
router.post(
  "/users/:userId/unban",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const { userId } = req.params;

      if (!userId) {
        ErrorResponses.badRequest(res, "User ID is required", null, adminReq.id);
        return;
      }

      const user = await db.getUserById(userId);
      if (!user) {
        ErrorResponses.notFound(res, "User", adminReq.id);
        return;
      }

      await db.unbanUser(userId);
      await db.logAdminAction({
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        action: "unban_user",
        targetType: "user",
        targetId: userId,
        details: { userEmail: user.email },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "User unbanned successfully",
      });

      logger.info("Admin unbanned user", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        targetUserId: userId,
        targetUserEmail: user.email,
      });
    } catch (error) {
      logger.error("Unban user error", error as Error);
      ErrorResponses.internalError(res, "Failed to unban user", req.id);
    }
  },
);

/**
 * Force disconnect instance (admin only)
 * Immediately disconnects a tunnel
 */
router.post(
  "/instances/:instanceId/disconnect",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const { instanceId } = req.params;

      if (!instanceId) {
        ErrorResponses.badRequest(res, "Instance ID is required", null, adminReq.id);
        return;
      }

      const instance = await db.getInstanceById(instanceId);
      if (!instance) {
        ErrorResponses.notFound(res, "Instance", adminReq.id);
        return;
      }

      await db.forceDisconnectInstance(instanceId);
      await db.logAdminAction({
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        action: "force_disconnect_instance",
        targetType: "instance",
        targetId: instanceId,
        details: { instanceName: instance.name, userId: instance.userId },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Instance disconnected successfully",
      });

      logger.info("Admin force disconnected instance", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        instanceId,
        instanceName: instance.name,
      });
    } catch (error) {
      logger.error("Force disconnect instance error", error as Error);
      ErrorResponses.internalError(res, "Failed to disconnect instance", req.id);
    }
  },
);

/**
 * Get audit logs (admin only)
 * Returns recent admin actions
 */
router.get(
  "/audit-logs",
  ...requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminReq = req as unknown as AdminRequest;
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = await db.getAuditLogs(limit);

      res.json({
        success: true,
        logs,
        total: logs.length,
      });

      logger.info("Admin viewed audit logs", {
        adminId: adminReq.adminUser.id,
        adminEmail: adminReq.adminUser.email,
        limit,
      });
    } catch (error) {
      logger.error("Get audit logs error", error as Error);
      ErrorResponses.internalError(res, "Failed to get audit logs", req.id);
    }
  },
);

export default router;

import express, { Request, Response, Router } from "express";
import config from "../config";
import { db, TunnelTokenRecord, InstanceRecord } from "../database";
import { requireInternalApiKey } from "../auth-middleware";
import { incrementCounter } from "../metrics";
import { setHeartbeat, deleteHeartbeat } from "./instance-routes";
import { schemas, validate } from "../middleware/validation";
import { ErrorResponses } from "../utils/error-handler";
import { logger } from "../utils/logger";

const router: Router = express.Router();

const BORE_SERVER_HOST = config.boreServer.host;

/**
 * Validation response
 */
interface ValidationResponse {
  valid: boolean;
  usage_allowed: boolean;
  message: string;
  user_id?: string;
  plan_type?: string;
  max_concurrent_tunnels?: number;
  max_bandwidth_gb?: number;
  instance_id?: string;
}

// Validate tunnel token (called by bore-server)
router.post(
  "/validate-key",
  requireInternalApiKey,
  validate(schemas.validateKey),
  async (req: Request, res: Response): Promise<void> => {
    const { api_key } = req.body;

    try {
      const tokenInfo: TunnelTokenRecord | undefined =
        await db.getTunnelToken(api_key);

      if (!tokenInfo) {
        res.json({
          valid: false,
          usage_allowed: false,
          message: "Invalid or expired token",
        } as ValidationResponse);
        return;
      }

      // Check if token expired
      if (new Date(tokenInfo.expires_at as string | Date) < new Date()) {
        await db.deleteTunnelToken(api_key);
        res.json({
          valid: false,
          usage_allowed: false,
          message: "Token expired",
        } as ValidationResponse);
        return;
      }

      const instance = await db.getInstanceById(
        tokenInfo.instance_id as string,
      );

      if (!instance) {
        await db.deleteTunnelToken(api_key);
        res.json({
          valid: false,
          usage_allowed: false,
          message: "Instance not found",
        } as ValidationResponse);
        return;
      }

      const user = await db.getUserById(tokenInfo.user_id as string);
      const planType = (user?.plan || "trial") as keyof typeof config.plans;

      // Check if plan has expired
      if (user?.plan_expires) {
        const planExpiry =
          user.plan_expires instanceof Date
            ? user.plan_expires
            : new Date(user.plan_expires as string);
        if (planExpiry < new Date()) {
          await db.deleteTunnelToken(api_key);
          res.json({
            valid: false,
            usage_allowed: false,
            message: "Plan expired",
          } as ValidationResponse);
          return;
        }
      }

      // Derive limits from config.plans for proper multi-tier support
      const planConfig = config.plans[planType] || config.plans.trial;
      const maxConcurrent = planConfig.maxConcurrentTunnels;
      const maxBandwidth = planConfig.maxBandwidthGb;

      res.json({
        valid: true,
        usage_allowed: true,
        user_id: tokenInfo.user_id,
        plan_type: planType,
        max_concurrent_tunnels: maxConcurrent,
        max_bandwidth_gb: maxBandwidth,
        instance_id: instance.id,
        message: "Token validated",
      } as ValidationResponse);
    } catch (error) {
      logger.error("Validate key error", error as Error);
      res.status(500).json({
        valid: false,
        usage_allowed: false,
        message: "Internal error",
      } as ValidationResponse);
    }
  },
);

// Tunnel connected (called by bore-server)
router.post(
  "/instances/:id/tunnel-connected",
  requireInternalApiKey,
  validate(schemas.tunnelConnected),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const instanceId = req.params.id as string;
      const instance: InstanceRecord | undefined =
        await db.getInstanceById(instanceId);

      if (!instance) {
        ErrorResponses.notFound(res, "Instance", req.id);
        return;
      }

      const { remotePort, publicUrl } = req.body || {};

      const updates: Record<string, unknown> = {
        tunnel_connected: true,
        status: "active",
      };

      if (remotePort !== undefined && remotePort !== null) {
        const effectiveHost =
          instance.server_host || instance.serverHost || BORE_SERVER_HOST;
        updates.remote_port = remotePort;
        if (!publicUrl) {
          updates.public_url = `${effectiveHost}:${remotePort}`;
        }
      }

      if (publicUrl) {
        updates.public_url = publicUrl;
      }

      await db.updateInstance(instance.id, updates);
      await db.addStatusHistory(
        instance.id,
        "active",
        "Tunnel connected from bore-server",
      );

      // Use Redis-aware heartbeat setter for multi-node support
      await setHeartbeat(instance.id, Date.now());
      incrementCounter("tunnelConnectionsTotal");

      // Signal to broadcast
      res.locals.broadcast = true;
      res.locals.userId = instance.userId || instance.user_id;
      res.locals.instanceId = instance.id;
      res.locals.status = "active";

      res.json({ success: true });
    } catch (error) {
      logger.error("Tunnel connected error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to update tunnel status",
        req.id,
      );
    }
  },
);

// Tunnel disconnected (called by bore-server)
router.post(
  "/instances/:id/tunnel-disconnected",
  requireInternalApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const instanceId = req.params.id as string;
      const instance: InstanceRecord | undefined =
        await db.getInstanceById(instanceId);

      if (!instance) {
        ErrorResponses.notFound(res, "Instance", req.id);
        return;
      }

      await db.updateInstance(instance.id, {
        tunnel_connected: false,
        status: "offline",
        public_url: null,
        remote_port: null,
      });

      await db.addStatusHistory(
        instance.id,
        "offline",
        "Tunnel disconnected from bore-server",
      );

      // Use Redis-aware heartbeat deletion for multi-node support
      await deleteHeartbeat(instance.id);

      // Delete tunnel token if exists
      const currentToken =
        instance.current_tunnel_token || instance.currentTunnelToken;
      if (currentToken) {
        await db.deleteTunnelToken(currentToken as string);
        await db.updateInstance(instance.id, {
          current_tunnel_token: null,
          tunnel_token_expires_at: null,
        });
      }

      incrementCounter("tunnelDisconnectionsTotal");

      // Signal to broadcast
      res.locals.broadcast = true;
      res.locals.userId = instance.userId || instance.user_id;
      res.locals.instanceId = instance.id;
      res.locals.status = "offline";

      res.json({ success: true });
    } catch (error) {
      logger.error("Tunnel disconnected error", error as Error);
      ErrorResponses.internalError(
        res,
        "Failed to update tunnel status",
        req.id,
      );
    }
  },
);

export default router;

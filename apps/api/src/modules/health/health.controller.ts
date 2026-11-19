import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { getDatabaseStatus } from "../../shared/db.js";

export interface HealthCheckResponse {
  data: {
    status: "ok" | "degraded";
    database: string | { status: string; latencyMs: number | null };
    storage?: { status: string; provider: string };
    ai?: { status: string; provider: string };
    version?: string;
    uptime?: number;
    timestamp?: string;
  };
}

export async function healthCheckController(
  req: Request,
  res: Response<HealthCheckResponse>,
): Promise<void> {
  const isDeep = req.query.deep === "true" || req.query.deep === "1";

  if (!isDeep) {
    res.status(200).json({
      data: {
        status: "ok",
        database: getDatabaseStatus(),
      },
    });
    return;
  }

  // Deep health assessment
  const dbStatus = getDatabaseStatus();
  let dbLatencyMs: number | null = null;
  if (dbStatus === "connected" && mongoose.connection.db) {
    try {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatencyMs = Date.now() - startTime;
    } catch {
      dbLatencyMs = null;
    }
  }

  // Storage provider status
  let storageStatus = "ok";
  if (env.STORAGE_PROVIDER === "local") {
    try {
      const uploadPath = path.resolve(env.UPLOAD_DIR);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
    } catch {
      storageStatus = "degraded";
    }
  } else if (env.STORAGE_PROVIDER === "cloud") {
    const hasCloudinaryUrl = Boolean(env.CLOUDINARY_URL);
    const hasCloudinaryKeys = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
    );
    if (!hasCloudinaryUrl && !hasCloudinaryKeys) {
      storageStatus = "degraded";
    }
  }

  // AI provider status
  const aiStatus = "ok";

  const overallStatus = dbStatus === "connected" && storageStatus === "ok" ? "ok" : "degraded";

  res.status(200).json({
    data: {
      status: overallStatus,
      version: env.GIT_SHA,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      storage: {
        status: storageStatus,
        provider: env.STORAGE_PROVIDER,
      },
      ai: {
        status: aiStatus,
        provider: env.AI_PROVIDER,
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}

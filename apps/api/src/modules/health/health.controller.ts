import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { getDatabaseStatus } from "../../shared/db.js";
import { getAiTelemetry } from "../ai/ai-telemetry.js";
import { getGradingProvider } from "../ai/ai.service.js";
import { GeminiGradingProvider } from "../ai/gemini-grading.provider.js";

export interface HealthCheckResponse {
  data: {
    status: "ok" | "degraded";
    database: string | { status: string; latencyMs: number | null };
    storage?: { status: string; provider: string };
    ai?: {
      status: string;
      provider: string;
      gradingProvider?: string;
      priceProvider?: string;
      circuitBreaker?: string;
      lastSuccessTime?: string | null;
      lastFailureTime?: string | null;
      latencyMs?: number | null;
      usage?: {
        totalRequests: number;
        totalSuccesses: number;
        totalFailures: number;
        totalTokens: number;
        promptTokens: number;
        candidateTokens: number;
      };
    };
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
    const hasS3Config = Boolean(
      env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
    );
    const hasCloudinaryUrl = Boolean(env.CLOUDINARY_URL);
    const hasCloudinaryKeys = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
    );
    if (!hasS3Config && !hasCloudinaryUrl && !hasCloudinaryKeys) {
      storageStatus = "degraded";
    }
  }

  // AI provider status & telemetry (Task G6)
  const aiTelemetry = getAiTelemetry();
  let circuitBreakerState = "CLOSED";
  try {
    const gradingProvider = getGradingProvider();
    if (gradingProvider instanceof GeminiGradingProvider) {
      circuitBreakerState = gradingProvider.getCircuitBreaker().getState();
    }
  } catch {
    circuitBreakerState = "CLOSED";
  }

  const aiStatus = circuitBreakerState === "OPEN" ? "degraded" : "ok";

  const overallStatus =
    dbStatus === "connected" && storageStatus === "ok" && aiStatus === "ok" ? "ok" : "degraded";

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
        provider: env.AI_GRADING_PROVIDER,
        gradingProvider: env.AI_GRADING_PROVIDER,
        priceProvider: env.AI_PRICE_PROVIDER,
        circuitBreaker: circuitBreakerState,
        lastSuccessTime: aiTelemetry.lastSuccessTime,
        lastFailureTime: aiTelemetry.lastFailureTime,
        latencyMs: aiTelemetry.lastLatencyMs,
        usage: {
          totalRequests: aiTelemetry.usage.totalRequests,
          totalSuccesses: aiTelemetry.usage.totalSuccesses,
          totalFailures: aiTelemetry.usage.totalFailures,
          totalTokens: aiTelemetry.usage.totalTokens,
          promptTokens: aiTelemetry.usage.promptTokens,
          candidateTokens: aiTelemetry.usage.candidateTokens,
        },
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}

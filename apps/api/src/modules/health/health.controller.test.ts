import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../config/env.js";
import { recordAiCall, resetAiTelemetry } from "../ai/ai-telemetry.js";
import {
  type HealthCheckResponse,
  healthCheckController,
} from "./health.controller.js";

describe("Health Check Controller (Task G6)", () => {
  beforeEach(() => {
    resetAiTelemetry();
    vi.restoreAllMocks();
  });

  function createMockResponse(): {
    res: Response<HealthCheckResponse>;
    statusCode: number;
    jsonBody: HealthCheckResponse | null;
  } {
    const mockState = {
      statusCode: 200,
      jsonBody: null as HealthCheckResponse | null,
    };

    const res = {
      status: vi.fn((code: number) => {
        mockState.statusCode = code;
        return res;
      }),
      json: vi.fn((body: HealthCheckResponse) => {
        mockState.jsonBody = body;
        return res;
      }),
    } as unknown as Response<HealthCheckResponse>;

    return { res, ...mockState };
  }

  it("returns shallow health check when deep query is false", async () => {
    const req = { query: {} } as Request;
    const { res } = createMockResponse();

    await healthCheckController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "ok",
        database: expect.any(String),
      }),
    });
  });

  it("returns deep health check with AI telemetry and usage counters", async () => {
    // Record mock AI telemetry
    recordAiCall({
      provider: "gemini",
      modelVersion: "gemini-2.5-flash",
      durationMs: 420,
      success: true,
      promptTokens: 250,
      candidateTokens: 60,
      totalTokens: 310,
    });

    const req = { query: { deep: "true" } } as unknown as Request;
    const { res } = createMockResponse();

    await healthCheckController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const firstCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall?.[0] as HealthCheckResponse;
    expect(body.data.ai).toBeDefined();
    expect(body.data.ai?.provider).toBe(env.AI_GRADING_PROVIDER);
    expect(body.data.ai?.circuitBreaker).toBe("CLOSED");
    expect(body.data.ai?.latencyMs).toBe(420);
    expect(typeof body.data.ai?.lastSuccessTime).toBe("string");
    expect(body.data.ai?.usage).toEqual({
      totalRequests: 1,
      totalSuccesses: 1,
      totalFailures: 0,
      totalTokens: 310,
      promptTokens: 250,
      candidateTokens: 60,
    });
  });

  it("never includes API keys or sensitive secrets in response", async () => {
    const req = { query: { deep: "true" } } as unknown as Request;
    const { res } = createMockResponse();

    await healthCheckController(req, res);

    const firstCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall?.[0] as HealthCheckResponse;
    const jsonStr = JSON.stringify(body);
    expect(jsonStr).not.toContain("GEMINI_API_KEY");
    expect(jsonStr).not.toContain("JWT_ACCESS_SECRET");
    expect(jsonStr).not.toContain("CLOUDINARY_API_SECRET");
    expect(jsonStr).not.toContain("S3_SECRET_ACCESS_KEY");
  });
});

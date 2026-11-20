import { beforeEach, describe, expect, it } from "vitest";

import { getAiTelemetry, recordAiCall, resetAiTelemetry } from "./ai-telemetry.js";

describe("AI Telemetry Tracker (Task G6)", () => {
  beforeEach(() => {
    resetAiTelemetry();
  });

  it("initializes with zero counters and null timestamps", () => {
    const snapshot = getAiTelemetry();
    expect(snapshot.usage.totalRequests).toBe(0);
    expect(snapshot.usage.totalSuccesses).toBe(0);
    expect(snapshot.usage.totalFailures).toBe(0);
    expect(snapshot.usage.totalTokens).toBe(0);
    expect(snapshot.usage.promptTokens).toBe(0);
    expect(snapshot.usage.candidateTokens).toBe(0);
    expect(snapshot.lastSuccessTime).toBeNull();
    expect(snapshot.lastFailureTime).toBeNull();
    expect(snapshot.lastLatencyMs).toBeNull();
  });

  it("records successful calls and aggregates token counts", () => {
    recordAiCall({
      provider: "gemini",
      modelVersion: "gemini-2.5-flash",
      durationMs: 450,
      success: true,
      promptTokens: 120,
      candidateTokens: 35,
      totalTokens: 155,
      sampleCount: 3,
    });

    let snapshot = getAiTelemetry();
    expect(snapshot.usage.totalRequests).toBe(1);
    expect(snapshot.usage.totalSuccesses).toBe(1);
    expect(snapshot.usage.totalFailures).toBe(0);
    expect(snapshot.usage.promptTokens).toBe(120);
    expect(snapshot.usage.candidateTokens).toBe(35);
    expect(snapshot.usage.totalTokens).toBe(155);
    expect(snapshot.lastLatencyMs).toBe(450);
    expect(typeof snapshot.lastSuccessTime).toBe("string");
    expect(snapshot.lastFailureTime).toBeNull();

    // Record a second call
    recordAiCall({
      provider: "gemini",
      modelVersion: "gemini-2.5-flash",
      durationMs: 320,
      success: true,
      promptTokens: 100,
      candidateTokens: 30,
    });

    snapshot = getAiTelemetry();
    expect(snapshot.usage.totalRequests).toBe(2);
    expect(snapshot.usage.totalSuccesses).toBe(2);
    expect(snapshot.usage.promptTokens).toBe(220);
    expect(snapshot.usage.candidateTokens).toBe(65);
    expect(snapshot.usage.totalTokens).toBe(285);
    expect(snapshot.lastLatencyMs).toBe(320);
  });

  it("records failed calls without corrupting token counts", () => {
    recordAiCall({
      provider: "gemini",
      modelVersion: "gemini-2.5-flash",
      durationMs: 1200,
      success: false,
      error: "429 Resource Exhausted",
    });

    const snapshot = getAiTelemetry();
    expect(snapshot.usage.totalRequests).toBe(1);
    expect(snapshot.usage.totalSuccesses).toBe(0);
    expect(snapshot.usage.totalFailures).toBe(1);
    expect(snapshot.usage.totalTokens).toBe(0);
    expect(snapshot.lastLatencyMs).toBe(1200);
    expect(typeof snapshot.lastFailureTime).toBe("string");
    expect(snapshot.lastSuccessTime).toBeNull();
  });
});

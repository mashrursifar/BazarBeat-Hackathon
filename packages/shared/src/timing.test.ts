import { describe, expect, it } from "vitest";
import {
  AUCTION_TIMING,
  ORDER_HANDOVER,
  ORDER_TIMING,
  getAntiSnipingExtensionDurationMs,
  getAntiSnipingTriggerWindowMs,
  getOrderAutoCancelMs,
  getOrderAutoCompleteMs,
  getSchedulerIntervalMs,
} from "./timing.js";

describe("Auction timing constants and helpers", () => {
  it("defines standard timing parameters adhering to AUCTION_RULES §6", () => {
    expect(AUCTION_TIMING.ANTI_SNIPING_TRIGGER_WINDOW_MS).toBe(120_000); // 2 minutes
    expect(AUCTION_TIMING.ANTI_SNIPING_EXTENSION_DURATION_MS).toBe(120_000); // 2 minutes
    expect(AUCTION_TIMING.ANTI_SNIPING_MAX_EXTENSIONS).toBe(5);
  });

  it("defines demo mode timing parameters", () => {
    expect(AUCTION_TIMING.DEMO_ANTI_SNIPING_TRIGGER_WINDOW_MS).toBe(15_000); // 15 seconds
    expect(AUCTION_TIMING.DEMO_ANTI_SNIPING_EXTENSION_DURATION_MS).toBe(15_000); // 15 seconds
  });

  it("returns appropriate values based on demoMode flag", () => {
    expect(getAntiSnipingTriggerWindowMs(false)).toBe(120_000);
    expect(getAntiSnipingTriggerWindowMs(true)).toBe(15_000);

    expect(getAntiSnipingExtensionDurationMs(false)).toBe(120_000);
    expect(getAntiSnipingExtensionDurationMs(true)).toBe(15_000);

    expect(getSchedulerIntervalMs(false)).toBe(10_000);
    expect(getSchedulerIntervalMs(true)).toBe(2_000);
  });

  it("defines SSE heartbeat interval and stream cap parameters", () => {
    expect(AUCTION_TIMING.SSE_HEARTBEAT_INTERVAL_MS).toBe(20_000);
    expect(AUCTION_TIMING.MAX_CONCURRENT_STREAMS_PER_USER).toBe(5);
  });

  it("defines order lifecycle timing and handover constants", () => {
    expect(ORDER_TIMING.AUTO_CANCEL_HOURS).toBe(12);
    expect(ORDER_TIMING.AUTO_CANCEL_MS).toBe(12 * 60 * 60 * 1000);
    expect(ORDER_TIMING.DEMO_AUTO_CANCEL_MS).toBe(60 * 1000);

    expect(ORDER_TIMING.AUTO_COMPLETE_HOURS).toBe(24);
    expect(ORDER_TIMING.AUTO_COMPLETE_MS).toBe(24 * 60 * 60 * 1000);
    expect(ORDER_TIMING.DEMO_AUTO_COMPLETE_MS).toBe(120 * 1000);

    expect(ORDER_HANDOVER.MIN_HOURS_AHEAD).toBe(0);
    expect(ORDER_HANDOVER.MAX_HOURS_AHEAD).toBe(72);
    expect(ORDER_HANDOVER.MAX_NOTE_LENGTH).toBe(200);

    expect(getOrderAutoCancelMs(false)).toBe(12 * 60 * 60 * 1000);
    expect(getOrderAutoCancelMs(true)).toBe(60 * 1000);

    expect(getOrderAutoCompleteMs(false)).toBe(24 * 60 * 60 * 1000);
    expect(getOrderAutoCompleteMs(true)).toBe(120 * 1000);
  });
});


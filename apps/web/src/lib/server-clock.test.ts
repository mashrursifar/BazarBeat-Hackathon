import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLastSyncedServerTime,
  getServerNow,
  getServerOffsetMs,
  resetServerClock,
  syncServerTime,
  useServerClock,
  useServerClockOffset,
} from "./server-clock.js";

describe("server-clock offset store and hook", () => {
  const baseClientTime = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseClientTime);
    resetServerClock();
  });

  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
  });

  it("defaults to 0 offset when no serverTime has synced", () => {
    expect(getServerOffsetMs()).toBe(0);
    expect(getServerNow()).toBe(baseClientTime);
    expect(getLastSyncedServerTime()).toBeNull();
  });

  it("calculates positive offset when client clock is behind server clock", () => {
    const serverTimeIso = new Date(baseClientTime + 30_000).toISOString(); // server is 30s ahead
    syncServerTime(serverTimeIso);

    expect(getServerOffsetMs()).toBe(30_000);
    expect(getServerNow()).toBe(baseClientTime + 30_000);
    expect(getLastSyncedServerTime()).toBe(serverTimeIso);
  });

  it("calculates negative offset when client clock is ahead of server clock", () => {
    const serverTimeMs = baseClientTime - 15_000; // server is 15s behind client
    syncServerTime(serverTimeMs);

    expect(getServerOffsetMs()).toBe(-15_000);
    expect(getServerNow()).toBe(baseClientTime - 15_000);
  });

  it("accepts a Date object for synchronization", () => {
    const serverDate = new Date(baseClientTime + 5_000);
    syncServerTime(serverDate);

    expect(getServerOffsetMs()).toBe(5_000);
    expect(getServerNow()).toBe(baseClientTime + 5_000);
  });

  it("ignores invalid date inputs without throwing", () => {
    syncServerTime("invalid-date-string");
    expect(getServerOffsetMs()).toBe(0);
  });

  it("useServerClockOffset hook updates reactively on sync", () => {
    const { result } = renderHook(() => useServerClockOffset());
    expect(result.current).toBe(0);

    act(() => {
      syncServerTime(new Date(baseClientTime + 10_000).toISOString());
    });

    expect(result.current).toBe(10_000);
  });

  it("useServerClock hook exposes helper methods and current state", () => {
    const { result } = renderHook(() => useServerClock());
    expect(result.current.serverOffsetMs).toBe(0);

    act(() => {
      result.current.syncServerTime(baseClientTime + 20_000);
    });

    expect(result.current.serverOffsetMs).toBe(20_000);
    expect(result.current.getServerNow()).toBe(baseClientTime + 20_000);
  });
});

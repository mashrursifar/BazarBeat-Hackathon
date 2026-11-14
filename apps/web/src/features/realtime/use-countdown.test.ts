import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingStatus } from "@bazarbeat/shared";

import { resetServerClock, syncServerTime } from "../../lib/server-clock.js";
import { COUNTDOWN_THRESHOLDS, useCountdown } from "./use-countdown.js";

describe("useCountdown hook", () => {
  const baseNow = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetServerClock();
  });

  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
  });

  it("reports normal state when time left is 10 minutes or more", () => {
    const endsAt = new Date(baseNow + 15 * 60 * 1000).toISOString(); // 15 mins
    const { result } = renderHook(() => useCountdown({ endsAt }));

    expect(result.current.isNormal).toBe(true);
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isUrgent).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.isFinalizing).toBe(false);
    expect(result.current.minutes).toBe(15);
    expect(result.current.digital).toBe("15:00");
  });

  it("transitions to amber warning state when under 10 minutes", () => {
    // 9 minutes and 30 seconds
    const endsAt = new Date(baseNow + (9 * 60 + 30) * 1000).toISOString();
    const { result } = renderHook(() => useCountdown({ endsAt }));

    expect(result.current.isNormal).toBe(false);
    expect(result.current.isWarning).toBe(true);
    expect(result.current.isUrgent).toBe(false);
    expect(result.current.digital).toBe("09:30");
  });

  it("transitions to red urgent state when under 2 minutes", () => {
    // 1 minute and 45 seconds (105 seconds)
    const endsAt = new Date(baseNow + 105 * 1000).toISOString();
    const { result } = renderHook(() => useCountdown({ endsAt }));

    expect(result.current.isNormal).toBe(false);
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isUrgent).toBe(true);
    expect(result.current.digital).toBe("01:45");
  });

  it("counts down correctly over fake timer progression", () => {
    const endsAt = new Date(baseNow + 5000).toISOString(); // 5 seconds
    const { result } = renderHook(() => useCountdown({ endsAt }));

    expect(result.current.seconds).toBe(5);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.seconds).toBe(3);
    expect(result.current.digital).toBe("00:03");
  });

  it("displays 'Finalizing…' state at zero when auction status is still ACTIVE", () => {
    const endsAt = new Date(baseNow + 2000).toISOString();
    const { result } = renderHook(() =>
      useCountdown({ endsAt, status: ListingStatus.ACTIVE }),
    );

    expect(result.current.isExpired).toBe(false);
    expect(result.current.isFinalizing).toBe(false);

    // Advance past zero
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Zero reached: client never decides outcome, stays in finalizing state
    expect(result.current.timeLeftMs).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.isFinalizing).toBe(true);
    expect(result.current.digital).toBe("00:00");
  });

  it("does not report finalizing once server confirms auction is closed (SOLD or EXPIRED_UNSOLD)", () => {
    const endsAt = new Date(baseNow - 1000).toISOString();
    const { result } = renderHook(() =>
      useCountdown({ endsAt, status: ListingStatus.SOLD }),
    );

    expect(result.current.isExpired).toBe(true);
    expect(result.current.isFinalizing).toBe(false);
  });

  it("triggers brief 'Extended' flash when anti-sniping extends endsAt", () => {
    const initialEndsAt = new Date(baseNow + 60 * 1000).toISOString(); // 1 min
    const extendedEndsAt = new Date(baseNow + 3 * 60 * 1000).toISOString(); // extended to 3 mins

    const { result, rerender } = renderHook(
      ({ endsAt }) => useCountdown({ endsAt }),
      { initialProps: { endsAt: initialEndsAt } },
    );

    expect(result.current.isExtended).toBe(false);

    // Anti-sniping extension arrives: endsAt pushed back
    rerender({ endsAt: extendedEndsAt });

    expect(result.current.isExtended).toBe(true);
    expect(result.current.isUrgent).toBe(false);
    expect(result.current.isWarning).toBe(true);

    // Flash expires after 3 seconds
    act(() => {
      vi.advanceTimersByTime(COUNTDOWN_THRESHOLDS.EXTENSION_FLASH_MS);
    });

    expect(result.current.isExtended).toBe(false);
  });

  it("incorporates server clock offset accurately", () => {
    // Client clock is 10 seconds behind server clock (server is 10s ahead)
    syncServerTime(baseNow + 10_000);

    // endsAt is 30 seconds after server time (so 40 seconds from client now)
    const endsAt = new Date(baseNow + 40_000).toISOString();

    const { result } = renderHook(() => useCountdown({ endsAt }));

    // Remaining time should be relative to server time: 30 seconds, not 40 seconds
    expect(result.current.seconds).toBe(30);
  });
});

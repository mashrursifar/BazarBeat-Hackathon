import { afterEach, describe, expect, it } from "vitest";
import {
  SystemClock,
  TestClock,
  getClock,
  resetClock,
  setClock,
} from "./clock.js";

describe("Clock abstractions", () => {
  afterEach(() => {
    resetClock();
  });

  describe("SystemClock", () => {
    it("returns real system time", () => {
      const clock = new SystemClock();
      const before = Date.now();
      const timestamp = clock.timestamp();
      const now = clock.now();
      const iso = clock.iso();
      const after = Date.now();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
      expect(now.getTime()).toBeLessThanOrEqual(after);
      expect(new Date(iso).getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe("TestClock", () => {
    it("initializes with default or specified time", () => {
      const fixedDate = new Date("2026-11-14T10:00:00.000Z");
      const clock = new TestClock(fixedDate);

      expect(clock.timestamp()).toBe(fixedDate.getTime());
      expect(clock.now().toISOString()).toBe("2026-11-14T10:00:00.000Z");
      expect(clock.iso()).toBe("2026-11-14T10:00:00.000Z");
    });

    it("advances time forward by milliseconds", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      clock.advanceBy(2 * 60 * 1000); // 2 minutes

      expect(clock.iso()).toBe("2026-11-14T10:02:00.000Z");
      expect(clock.timestamp()).toBe(new Date("2026-11-14T10:02:00.000Z").getTime());
    });

    it("rejects negative advance durations", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      expect(() => clock.advanceBy(-1000)).toThrow();
    });

    it("advances forward to target time", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      clock.advanceTo("2026-11-14T11:30:00.000Z");

      expect(clock.iso()).toBe("2026-11-14T11:30:00.000Z");
    });

    it("rejects advanceTo when target is in the past", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      expect(() => clock.advanceTo("2026-11-14T09:00:00.000Z")).toThrow();
    });

    it("allows setting time explicitly including backwards", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      clock.setTime("2026-11-14T08:00:00.000Z");

      expect(clock.iso()).toBe("2026-11-14T08:00:00.000Z");
    });

    it("resets clock to specified timestamp", () => {
      const clock = new TestClock("2026-11-14T10:00:00.000Z");
      clock.advanceBy(5000);
      clock.reset("2026-11-14T12:00:00.000Z");

      expect(clock.iso()).toBe("2026-11-14T12:00:00.000Z");
    });
  });

  describe("Global clock management", () => {
    it("manages global clock replacement and reset", () => {
      expect(getClock()).toBeInstanceOf(SystemClock);

      const testClock = new TestClock("2026-11-14T10:00:00.000Z");
      setClock(testClock);

      expect(getClock()).toBe(testClock);
      expect(getClock().iso()).toBe("2026-11-14T10:00:00.000Z");

      resetClock();
      expect(getClock()).toBeInstanceOf(SystemClock);
    });
  });
});

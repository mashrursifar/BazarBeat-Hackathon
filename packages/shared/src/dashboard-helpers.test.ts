import { describe, expect, it } from "vitest";

import {
  asiaDhakaBucketKey,
  asiaDhakaBucketKeys,
  calculatePercentChange,
  calculateWinRate,
  fillNumericSeries,
  fillSeriesBuckets,
  generateAsiaDhakaBucketKeys,
  getAsiaDhakaBucketKey,
  getRangeBucketKeys,
  percentChange,
  seriesFilling,
  toAsiaDhakaCivilDate,
  winRate,
} from "./dashboard-helpers.js";

describe("Dashboard Helpers", () => {
  describe("calculateWinRate (winRate)", () => {
    it("calculates win rate percentage with 1 decimal place", () => {
      expect(calculateWinRate(9, 12)).toBe(75.0);
      expect(calculateWinRate(5, 8)).toBe(62.5);
      expect(calculateWinRate(4, 8)).toBe(50.0);
      expect(calculateWinRate(1, 3)).toBe(33.3);
      expect(calculateWinRate(2, 3)).toBe(66.7);
    });

    it("returns 0 when total is 0 or non-positive", () => {
      expect(calculateWinRate(0, 0)).toBe(0);
      expect(calculateWinRate(5, 0)).toBe(0);
      expect(calculateWinRate(5, -1)).toBe(0);
    });

    it("returns 0 when won/sold is 0 or non-positive", () => {
      expect(calculateWinRate(0, 10)).toBe(0);
      expect(calculateWinRate(-2, 10)).toBe(0);
    });

    it("clamps between 0 and 100", () => {
      expect(calculateWinRate(15, 10)).toBe(100);
    });

    it("handles non-finite values safely", () => {
      expect(calculateWinRate(NaN, 10)).toBe(0);
      expect(calculateWinRate(5, Infinity)).toBe(0);
    });

    it("exports winRate alias identical to calculateWinRate", () => {
      expect(winRate).toBe(calculateWinRate);
    });
  });

  describe("calculatePercentChange (percentChange)", () => {
    it("calculates positive and negative percentage changes", () => {
      expect(calculatePercentChange(150, 100)).toBe(50.0);
      expect(calculatePercentChange(50, 100)).toBe(-50.0);
      expect(calculatePercentChange(100, 100)).toBe(0.0);
      // Real golden dataset numbers: Farmer 2 7d change
      // ((580725 - 352000) / 352000) * 100 = 64.97869... -> 65.0%
      expect(calculatePercentChange(580725, 352000)).toBe(65.0);
    });

    it("CRITICAL RULE: returns null when previous value is zero (no delta when previous is zero)", () => {
      expect(calculatePercentChange(100, 0)).toBeNull();
      expect(calculatePercentChange(0, 0)).toBeNull();
      expect(calculatePercentChange(1311390, 0)).toBeNull();
    });

    it("returns null when previous value is null or undefined", () => {
      expect(calculatePercentChange(100, null)).toBeNull();
      expect(calculatePercentChange(100, undefined)).toBeNull();
    });

    it("returns null for non-finite inputs", () => {
      expect(calculatePercentChange(NaN, 100)).toBeNull();
      expect(calculatePercentChange(100, NaN)).toBeNull();
      expect(calculatePercentChange(Infinity, 100)).toBeNull();
    });

    it("exports percentChange alias identical to calculatePercentChange", () => {
      expect(percentChange).toBe(calculatePercentChange);
    });
  });

  describe("Asia/Dhaka Bucket Keys & Timezone Authority", () => {
    it("converts timestamps into Asia/Dhaka civil dates (+06:00 offset)", () => {
      // 2026-11-10T00:00:00.000Z in UTC is 06:00:00 in Asia/Dhaka
      const civil = toAsiaDhakaCivilDate("2026-11-10T00:00:00.000Z");
      expect(civil.getUTCHours()).toBe(6);
    });

    it("tests Asia/Dhaka MIDNIGHT boundary: 18:00:00 UTC corresponds to 00:00:00 next day in Asia/Dhaka", () => {
      // 2026-11-09T18:00:00.000Z + 6 hours = 2026-11-10 00:00:00 Asia/Dhaka
      expect(getAsiaDhakaBucketKey("2026-11-09T18:00:00.000Z", "day")).toBe("2026-11-10");

      // 1 ms before midnight: 2026-11-09T17:59:59.999Z + 6 hours = 2026-11-09 23:59:59.999 Asia/Dhaka
      expect(getAsiaDhakaBucketKey("2026-11-09T17:59:59.999Z", "day")).toBe("2026-11-09");

      // Another midnight boundary: 2026-11-14T18:00:00.000Z => 2026-11-15 00:00:00
      expect(getAsiaDhakaBucketKey("2026-11-14T18:00:00.000Z", "day")).toBe("2026-11-15");
    });

    it("formats monthly and weekly bucket keys in Asia/Dhaka", () => {
      expect(getAsiaDhakaBucketKey("2026-11-16T12:00:00.000Z", "month")).toBe("2026-11");
      expect(getAsiaDhakaBucketKey("2026-12-31T18:00:00.000Z", "month")).toBe("2027-01"); // Midnight boundary into new year
      expect(getAsiaDhakaBucketKey("2026-11-16T12:00:00.000Z", "week")).toMatch(/^2026-W\d{2}$/);
    });

    it("generates continuous chronological bucket keys", () => {
      const keys = generateAsiaDhakaBucketKeys(
        "2026-11-10T00:00:00.000Z",
        "2026-11-16T12:00:00.000Z",
        "day",
      );
      expect(keys).toEqual([
        "2026-11-10",
        "2026-11-11",
        "2026-11-12",
        "2026-11-13",
        "2026-11-14",
        "2026-11-15",
        "2026-11-16",
      ]);
    });

    it("generates monthly bucket keys across year boundaries", () => {
      const keys = generateAsiaDhakaBucketKeys(
        "2025-11-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
        "month",
      );
      expect(keys).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    });

    it("returns empty array when start date exceeds end date", () => {
      const keys = generateAsiaDhakaBucketKeys(
        "2026-11-16T00:00:00.000Z",
        "2026-11-10T00:00:00.000Z",
        "day",
      );
      expect(keys).toEqual([]);
    });

    it("exports asiaDhakaBucketKey and asiaDhakaBucketKeys aliases", () => {
      expect(asiaDhakaBucketKey).toBe(getAsiaDhakaBucketKey);
      expect(asiaDhakaBucketKeys).toBe(generateAsiaDhakaBucketKeys);
    });
  });

  describe("getRangeBucketKeys", () => {
    const refDate = "2026-11-16T12:00:00.000Z";

    it("computes 7d daily window and bucket keys", () => {
      const result = getRangeBucketKeys("7d", refDate);
      expect(result.preset).toBe("7d");
      expect(result.granularity).toBe("day");
      expect(result.currentKeys).toHaveLength(7);
      expect(result.previousKeys).toHaveLength(7);
      expect(result.currentKeys[0]).toBe("2026-11-10");
      expect(result.currentKeys[6]).toBe("2026-11-16");
      expect(result.previousKeys[0]).toBe("2026-11-03");
      expect(result.previousKeys[6]).toBe("2026-11-09");
      expect(result.previousWindow).not.toBeNull();
    });

    it("computes 30d daily window and bucket keys", () => {
      const result = getRangeBucketKeys("30d", refDate);
      expect(result.preset).toBe("30d");
      expect(result.granularity).toBe("day");
      expect(result.currentKeys).toHaveLength(30);
      expect(result.previousKeys).toHaveLength(30);
      expect(result.currentKeys[29]).toBe("2026-11-16");
      expect(result.previousKeys[29]).toBe("2026-10-17");
    });

    it("computes 1y monthly window and bucket keys", () => {
      const result = getRangeBucketKeys("1y", refDate);
      expect(result.preset).toBe("1y");
      expect(result.granularity).toBe("month");
      expect(result.currentKeys).toHaveLength(12);
      expect(result.previousKeys).toHaveLength(12);
      expect(result.currentKeys[11]).toBe("2026-11");
    });

    it("handles 'all' preset without previous period", () => {
      const result = getRangeBucketKeys("all", refDate);
      expect(result.preset).toBe("all");
      expect(result.granularity).toBe("month");
      expect(result.previousWindow).toBeNull();
      expect(result.previousKeys).toEqual([]);
      expect(result.currentKeys.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe("Series Filling with Zero Buckets (fillSeriesBuckets / seriesFilling)", () => {
    it("fills missing bucket keys with zero-initialized default items", () => {
      const keys = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
      const sparse = [
        { bucket: "2026-11-10", sales: 266025, count: 2 },
        { bucket: "2026-11-12", sales: 56875, count: 1 },
      ];

      const filled = fillSeriesBuckets(keys, sparse, (bucket) => ({
        bucket,
        sales: 0,
        count: 0,
      }));

      expect(filled).toHaveLength(4);
      expect(filled).toEqual([
        { bucket: "2026-11-10", sales: 266025, count: 2 },
        { bucket: "2026-11-11", sales: 0, count: 0 }, // filled with zero!
        { bucket: "2026-11-12", sales: 56875, count: 1 },
        { bucket: "2026-11-13", sales: 0, count: 0 }, // filled with zero!
      ]);
    });

    it("handles completely empty sparse items", () => {
      const keys = ["2026-11-01", "2026-11-02"];
      const filled = fillSeriesBuckets(keys, [], (bucket) => ({ bucket, value: 0 }));
      expect(filled).toEqual([
        { bucket: "2026-11-01", value: 0 },
        { bucket: "2026-11-02", value: 0 },
      ]);
    });

    it("exports seriesFilling alias identical to fillSeriesBuckets", () => {
      expect(seriesFilling).toBe(fillSeriesBuckets);
    });
  });

  describe("fillNumericSeries", () => {
    const keys = ["2026-11-10", "2026-11-11", "2026-11-12"];

    it("fills from a plain Record", () => {
      const record = { "2026-11-10": 100, "2026-11-12": 300 };
      const filled = fillNumericSeries(keys, record);
      expect(filled).toEqual([
        { bucket: "2026-11-10", value: 100 },
        { bucket: "2026-11-11", value: 0 },
        { bucket: "2026-11-12", value: 300 },
      ]);
    });

    it("fills from a Map", () => {
      const map = new Map<string, number>([
        ["2026-11-10", 50],
        ["2026-11-12", 150],
      ]);
      const filled = fillNumericSeries(keys, map);
      expect(filled).toEqual([
        { bucket: "2026-11-10", value: 50 },
        { bucket: "2026-11-11", value: 0 },
        { bucket: "2026-11-12", value: 150 },
      ]);
    });

    it("fills from an Array", () => {
      const array = [{ bucket: "2026-11-10", value: 40 }];
      const filled = fillNumericSeries(keys, array, 0);
      expect(filled).toEqual([
        { bucket: "2026-11-10", value: 40 },
        { bucket: "2026-11-11", value: 0 },
        { bucket: "2026-11-12", value: 0 },
      ]);
    });
  });
});

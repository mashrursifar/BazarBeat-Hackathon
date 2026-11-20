import { describe, expect, it } from "vitest";
import { PriceReasonCode, priceGuidanceSchema, priceReasonItemSchema } from "@bazarbeat/shared";

import {
  type MarketPriceInputRow,
  calculate7DayTrend,
  calculateBaselinePriceGuidance,
  calculateDivisionAverage,
  calculateSeasonalFactor,
  calculateSparseBandWidth,
  generatePriceReasonItems,
  getGradeMultiplier,
} from "./baseline-price.strategy.js";

describe("Baseline Price Strategy (pure functional logic)", () => {
  describe("calculateSeasonalFactor", () => {
    it("returns 1.00 at the beginning of the year (day 0 / Jan 1)", () => {
      const jan1 = new Date(Date.UTC(2026, 0, 1));
      const factor = calculateSeasonalFactor(jan1);
      expect(factor).toBeCloseTo(1.0, 2);
    });

    it("reaches positive peak (+500 bps = 1.05) in spring (day ~91 / early April)", () => {
      const spring = new Date(Date.UTC(2026, 3, 2));
      const factor = calculateSeasonalFactor(spring);
      expect(factor).toBeGreaterThanOrEqual(1.04);
      expect(factor).toBeLessThanOrEqual(1.06);
    });

    it("reaches negative trough (-500 bps = 0.95) in autumn (day ~273 / early October)", () => {
      const autumn = new Date(Date.UTC(2026, 9, 2));
      const factor = calculateSeasonalFactor(autumn);
      expect(factor).toBeGreaterThanOrEqual(0.94);
      expect(factor).toBeLessThanOrEqual(0.96);
    });

    it("strictly stays bounded between 0.95 and 1.05 throughout the year", () => {
      for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 28; day += 7) {
          const date = new Date(Date.UTC(2026, month, day));
          const factor = calculateSeasonalFactor(date);
          expect(factor).toBeGreaterThanOrEqual(0.949);
          expect(factor).toBeLessThanOrEqual(1.051);
        }
      }
    });
  });

  describe("calculateDivisionAverage", () => {
    const rows: MarketPriceInputRow[] = [
      { avgPricePerKg: 6_200, date: "2026-11-20", division: "dhaka" },
      { avgPricePerKg: 6_000, date: "2026-11-19", division: "dhaka" },
      { avgPricePerKg: 5_500, date: "2026-11-20", division: "rajshahi" },
      { avgPricePerKg: 5_300, date: "2026-11-19", division: "rajshahi" },
      { avgPricePerKg: 5_800, date: "2026-11-20", division: "chittagong" },
    ];

    it("averages only matching division rows when division is specified", () => {
      const result = calculateDivisionAverage(rows, "Dhaka");
      expect(result.isDivisionSpecific).toBe(true);
      expect(result.sampleCount).toBe(2);
      expect(result.average).toBe(6_100); // (6200 + 6000) / 2
      // National average = (6200 + 6000 + 5500 + 5300 + 5800) / 5 = 5760
      // Dhaka deviation = (6100 - 5760) / 5760 = +5.9%
      expect(result.nationalAverage).toBe(5_760);
      expect(result.divisionDeviationPercent).toBeCloseTo(5.9, 1);
    });

    it("handles case-insensitive and trimmed division strings", () => {
      const result = calculateDivisionAverage(rows, "  RAJSHAHI  ");
      expect(result.isDivisionSpecific).toBe(true);
      expect(result.average).toBe(5_400); // (5500 + 5300) / 2
      expect(result.divisionDeviationPercent).toBeLessThan(0); // Rajshahi is below national
    });

    it("falls back to all rows when the specified division has no rows", () => {
      const result = calculateDivisionAverage(rows, "Sylhet");
      expect(result.isDivisionSpecific).toBe(false);
      expect(result.sampleCount).toBe(5);
      expect(result.average).toBe(5_760);
      expect(result.divisionDeviationPercent).toBe(0);
    });

    it("falls back to all rows when division is undefined", () => {
      const result = calculateDivisionAverage(rows, undefined);
      expect(result.isDivisionSpecific).toBe(false);
      expect(result.sampleCount).toBe(5);
      expect(result.average).toBe(5_760);
    });

    it("returns the fallback price when rows array is empty", () => {
      const result = calculateDivisionAverage([], "dhaka", [], 4_500);
      expect(result.isDivisionSpecific).toBe(false);
      expect(result.sampleCount).toBe(0);
      expect(result.average).toBe(4_500);
      expect(result.nationalAverage).toBe(4_500);
    });

    it("uses explicit nationalRows pool for deviation computation when provided", () => {
      const divisionRows: MarketPriceInputRow[] = [
        { avgPricePerKg: 7_000, date: "2026-11-20", division: "dhaka" },
      ];
      const nationalRows: MarketPriceInputRow[] = [
        { avgPricePerKg: 5_000, date: "2026-11-20", division: "rajshahi" },
        { avgPricePerKg: 5_000, date: "2026-11-20", division: "khulna" },
      ];
      const result = calculateDivisionAverage(divisionRows, "dhaka", nationalRows);
      expect(result.average).toBe(7_000);
      expect(result.nationalAverage).toBe(5_000);
      expect(result.divisionDeviationPercent).toBe(40.0);
    });
  });

  describe("calculate7DayTrend", () => {
    it("returns FLAT when rows are empty", () => {
      const result = calculate7DayTrend([]);
      expect(result.trend).toBe("FLAT");
      expect(result.trendFactor).toBe(1.0);
      expect(result.changePercent).toBe(0);
      expect(result.recent7DayAvg).toBeNull();
    });

    it("returns FLAT when fewer than 7 days of daily observations exist", () => {
      const rows: MarketPriceInputRow[] = [
        { avgPricePerKg: 5_000, date: "2026-11-20" },
        { avgPricePerKg: 5_100, date: "2026-11-19" },
        { avgPricePerKg: 5_200, date: "2026-11-18" },
      ];
      const result = calculate7DayTrend(rows);
      expect(result.trend).toBe("FLAT");
      expect(result.trendFactor).toBe(1.0);
      expect(result.recent7DayAvg).toBe(5_000); // Most recent day
      expect(result.previous7DayAvg).toBeNull();
    });

    it("detects UP trend when recent 7-day average is >= 2% higher than previous 7-day average", () => {
      // 14 days of data: days 1..7 (previous) at 5,000, days 8..14 (recent) at 5,300 (+6%)
      const rows: MarketPriceInputRow[] = [];
      const baseDate = new Date(Date.UTC(2026, 10, 20));

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(baseDate);
        date.setUTCDate(date.getUTCDate() - dayOffset);
        // dayOffset 0..6: recent; dayOffset 7..13: previous
        const price = dayOffset < 7 ? 5_300 : 5_000;
        rows.push({ avgPricePerKg: price, date });
      }

      const result = calculate7DayTrend(rows);
      expect(result.trend).toBe("UP");
      expect(result.trendFactor).toBe(1.02);
      expect(result.recent7DayAvg).toBe(5_300);
      expect(result.previous7DayAvg).toBe(5_000);
      expect(result.changePercent).toBe(6.0);
    });

    it("detects DOWN trend when recent 7-day average is >= 2% lower than previous 7-day average", () => {
      const rows: MarketPriceInputRow[] = [];
      const baseDate = new Date(Date.UTC(2026, 10, 20));

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(baseDate);
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const price = dayOffset < 7 ? 4_700 : 5_000; // -6%
        rows.push({ avgPricePerKg: price, date });
      }

      const result = calculate7DayTrend(rows);
      expect(result.trend).toBe("DOWN");
      expect(result.trendFactor).toBe(0.98);
      expect(result.recent7DayAvg).toBe(4_700);
      expect(result.previous7DayAvg).toBe(5_000);
      expect(result.changePercent).toBe(-6.0);
    });

    it("detects FLAT trend when recent and previous 7-day averages are within ±2%", () => {
      const rows: MarketPriceInputRow[] = [];
      const baseDate = new Date(Date.UTC(2026, 10, 20));

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(baseDate);
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const price = dayOffset < 7 ? 5_050 : 5_000; // +1.0% (within ±2%)
        rows.push({ avgPricePerKg: price, date });
      }

      const result = calculate7DayTrend(rows);
      expect(result.trend).toBe("FLAT");
      expect(result.trendFactor).toBe(1.0);
      expect(result.changePercent).toBe(1.0);
    });

    it("aggregates multiple rows on the same date into a single daily average", () => {
      const rows: MarketPriceInputRow[] = [];
      const baseDate = new Date(Date.UTC(2026, 10, 20));

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(baseDate);
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const basePrice = dayOffset < 7 ? 6_000 : 5_000;
        // 2 intraday records per day
        rows.push({ avgPricePerKg: basePrice - 100, date });
        rows.push({ avgPricePerKg: basePrice + 100, date });
      }

      const result = calculate7DayTrend(rows);
      expect(result.trend).toBe("UP");
      expect(result.recent7DayAvg).toBe(6_000);
      expect(result.previous7DayAvg).toBe(5_000);
    });
  });

  describe("getGradeMultiplier", () => {
    it("returns 1.10 for Grade A (+10% premium)", () => {
      expect(getGradeMultiplier("A")).toBe(1.1);
    });

    it("returns 1.00 for Grade B (baseline)", () => {
      expect(getGradeMultiplier("B")).toBe(1.0);
    });

    it("returns 0.85 for Grade C (-15% discount)", () => {
      expect(getGradeMultiplier("C")).toBe(0.85);
    });

    it("defaults to 1.00 for any unexpected grade input", () => {
      expect(getGradeMultiplier("UNKNOWN")).toBe(1.0);
    });
  });

  describe("calculateSparseBandWidth", () => {
    it("returns narrowest 5% band (0.05) and 0.95 confidence with 60 samples", () => {
      const result = calculateSparseBandWidth(60);
      expect(result.scarcity).toBe(0);
      expect(result.bandWidth).toBe(0.05);
      expect(result.confidence).toBe(0.95);
    });

    it("returns mid-range 10% band (0.10) and ~0.78 confidence with 30 samples", () => {
      const result = calculateSparseBandWidth(30);
      expect(result.scarcity).toBe(0.5);
      expect(result.bandWidth).toBe(0.1);
      expect(result.confidence).toBe(0.78);
    });

    it("returns widest 15% band (0.15) and 0.60 confidence when zero samples are available", () => {
      const result = calculateSparseBandWidth(0);
      expect(result.scarcity).toBe(1);
      expect(result.bandWidth).toBe(0.15);
      expect(result.confidence).toBe(0.6);
    });

    it("clamps scarcity to 0 when sample count exceeds maxSamples", () => {
      const result = calculateSparseBandWidth(100);
      expect(result.scarcity).toBe(0);
      expect(result.bandWidth).toBe(0.05);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe("generatePriceReasonItems", () => {
    it("generates structured items validated against priceReasonItemSchema", () => {
      const items = generatePriceReasonItems({
        grade: "A",
        trend: "UP",
        sampleCount: 45,
        changePercent: 3.5,
        division: "dhaka",
        divisionDeviationPercent: 4.2,
      });

      expect(items.length).toBeGreaterThanOrEqual(4);
      for (const item of items) {
        expect(() => priceReasonItemSchema.parse(item)).not.toThrow();
      }

      const codes = items.map((i) => i.code);
      expect(codes).toContain(PriceReasonCode.HISTORICAL_BENCHMARK);
      expect(codes).toContain(PriceReasonCode.TREND_UP);
      expect(codes).toContain(PriceReasonCode.GRADE_PREMIUM);
      expect(codes).toContain(PriceReasonCode.DIVISION_PREMIUM);
      expect(codes).toContain(PriceReasonCode.DEMAND_HIGH);
    });

    it("omits GRADE_PREMIUM for Grade B and Grade C", () => {
      const itemsB = generatePriceReasonItems({
        grade: "B",
        trend: "FLAT",
        sampleCount: 30,
      });
      expect(itemsB.some((i) => i.code === PriceReasonCode.GRADE_PREMIUM)).toBe(false);

      const itemsC = generatePriceReasonItems({
        grade: "C",
        trend: "DOWN",
        sampleCount: 30,
      });
      expect(itemsC.some((i) => i.code === PriceReasonCode.GRADE_PREMIUM)).toBe(false);
    });

    it("omits DIVISION_PREMIUM if deviation is negligible (< 1%)", () => {
      const items = generatePriceReasonItems({
        grade: "B",
        trend: "FLAT",
        sampleCount: 60,
        division: "khulna",
        divisionDeviationPercent: 0.4,
      });
      expect(items.some((i) => i.code === PriceReasonCode.DIVISION_PREMIUM)).toBe(false);
    });
  });

  describe("calculateBaselinePriceGuidance (End-to-End)", () => {
    function generateHistoryRows(
      count: number,
      basePrice: number,
      division = "dhaka",
    ): MarketPriceInputRow[] {
      const rows: MarketPriceInputRow[] = [];
      const now = new Date(Date.UTC(2026, 0, 1)); // Jan 1 (seasonal factor = 1.0)
      for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        rows.push({
          avgPricePerKg: basePrice,
          date: d,
          division,
          minPricePerKg: Math.round(basePrice * 0.95),
          maxPricePerKg: Math.round(basePrice * 1.05),
        });
      }
      return rows;
    }

    it("produces valid PriceGuidance matching priceGuidanceSchema", () => {
      const rows = generateHistoryRows(60, 6_000, "dhaka");
      const guidance = calculateBaselinePriceGuidance({
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "A",
        division: "dhaka",
        rows,
        asOf: new Date(Date.UTC(2026, 0, 1)),
      });

      const parsed = priceGuidanceSchema.parse(guidance);
      expect(parsed.provider).toBe("baseline");
      expect(parsed.modelVersion).toBe("seasonal-baseline-v1");
      expect(parsed.degraded).toBe(false);
      expect(parsed.suggestedFloorPerKg).toBe(parsed.lowPerKg);
      expect(parsed.lowPerKg).toBeLessThanOrEqual(parsed.expectedPerKg);
      expect(parsed.expectedPerKg).toBeLessThanOrEqual(parsed.highPerKg);
      // Grade A should reflect +10% multiplier and seasonal baseline
      expect(parsed.expectedPerKg).toBe(6_601);
    });

    it("applies grade discount (-15%) for Grade C", () => {
      const rows = generateHistoryRows(60, 6_000, "dhaka");
      const guidance = calculateBaselinePriceGuidance({
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "C",
        division: "dhaka",
        rows,
        asOf: new Date(Date.UTC(2026, 0, 1)),
      });

      expect(guidance.expectedPerKg).toBe(5_101);
      expect(guidance.lowPerKg).toBeLessThan(guidance.expectedPerKg);
      expect(guidance.highPerKg).toBeGreaterThan(guidance.expectedPerKg);
    });

    it("widens price band and decreases confidence on sparse data (zero history)", () => {
      const guidanceSparse = calculateBaselinePriceGuidance({
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "B",
        division: "dhaka",
        rows: [],
        fallbackPrice: 5_000,
        asOf: new Date(Date.UTC(2026, 0, 1)),
      });

      const guidanceFull = calculateBaselinePriceGuidance({
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "B",
        division: "dhaka",
        rows: generateHistoryRows(60, 5_000, "dhaka"),
        asOf: new Date(Date.UTC(2026, 0, 1)),
      });

      // Sparse band is 15% wide, full band is 5% wide
      const sparseSpread =
        (guidanceSparse.highPerKg - guidanceSparse.lowPerKg) / guidanceSparse.expectedPerKg;
      const fullSpread =
        (guidanceFull.highPerKg - guidanceFull.lowPerKg) / guidanceFull.expectedPerKg;

      expect(sparseSpread).toBeGreaterThan(fullSpread);
      expect(guidanceSparse.confidence).toBe(0.6);
      expect(guidanceFull.confidence).toBe(0.95);
    });

    it("guarantees low <= expected <= high invariant even on tiny poisha boundary values", () => {
      const guidance = calculateBaselinePriceGuidance({
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "C",
        rows: [{ avgPricePerKg: 1, date: "2026-11-20" }],
        fallbackPrice: 1,
      });

      expect(guidance.lowPerKg).toBeGreaterThanOrEqual(1);
      expect(guidance.lowPerKg).toBeLessThanOrEqual(guidance.expectedPerKg);
      expect(guidance.expectedPerKg).toBeLessThanOrEqual(guidance.highPerKg);
      expect(Number.isInteger(guidance.lowPerKg)).toBe(true);
      expect(Number.isInteger(guidance.expectedPerKg)).toBe(true);
      expect(Number.isInteger(guidance.highPerKg)).toBe(true);
      expect(() => priceGuidanceSchema.parse(guidance)).not.toThrow();
    });
  });
});

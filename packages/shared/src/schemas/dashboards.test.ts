import { describe, expect, it } from "vitest";

import {
  DASHBOARD_BUCKET_RULES,
  DASHBOARD_RANGE_PRESETS,
  buyerDashboardResponseSchema,
  dashboardQuerySchema,
  dashboardRangePresetSchema,
  farmerDashboardResponseSchema,
  kpiMetricSchema,
  kpiValueSchema,
  marketHistoryResponseSchema,
  marketPriceQuerySchema,
  marketSummaryResponseSchema,
  nationalSummaryResponseSchema,
} from "./dashboards.js";
import { GOLDEN_EXPECTED_VALUES } from "../fixtures/dashboard-golden-dataset.js";

describe("Dashboard & Market Schemas", () => {
  describe("Range Presets and Bucket Rules", () => {
    it("validates all range presets", () => {
      for (const preset of DASHBOARD_RANGE_PRESETS) {
        expect(dashboardRangePresetSchema.safeParse(preset).success).toBe(true);
      }
      expect(dashboardRangePresetSchema.safeParse("10d").success).toBe(false);
      expect(dashboardRangePresetSchema.safeParse("").success).toBe(false);
    });

    it("has bucket rules for each preset with required metadata", () => {
      for (const preset of DASHBOARD_RANGE_PRESETS) {
        const rule = DASHBOARD_BUCKET_RULES[preset];
        expect(rule).toBeDefined();
        expect(rule.preset).toBe(preset);
        expect(["day", "week", "month"]).toContain(rule.granularity);
        expect(rule.bucketFormat).toBeDefined();
      }
    });
  });

  describe("KPI Metric Schema", () => {
    it("validates KPI objects with current value and optional previous", () => {
      const valid1 = { value: 125000 };
      expect(kpiMetricSchema.safeParse(valid1).success).toBe(true);

      const valid2 = { value: 150000, previous: 100000, changePercent: 50.0 };
      expect(kpiMetricSchema.safeParse(valid2).success).toBe(true);

      const validWithNullPrevious = { value: 150000, previous: null, changePercent: null };
      expect(kpiMetricSchema.safeParse(validWithNullPrevious).success).toBe(true);

      const validWithZeroPrevious = { value: 150000, previous: 0, changePercent: null };
      expect(kpiMetricSchema.safeParse(validWithZeroPrevious).success).toBe(true);
    });

    it("rejects non-numeric values", () => {
      expect(kpiMetricSchema.safeParse({ value: "invalid" }).success).toBe(false);
      expect(kpiMetricSchema.safeParse({}).success).toBe(false);
    });

    it("exports kpiValueSchema alias identical to kpiMetricSchema", () => {
      expect(kpiValueSchema).toBe(kpiMetricSchema);
    });
  });

  describe("Farmer Dashboard Schema", () => {
    it("validates a complete farmer dashboard response matching golden dataset structure", () => {
      const payload = {
        data: {
          kpis: {
            totalSales: GOLDEN_EXPECTED_VALUES.farmer1.kpis7d.totalSales,
            earnings: GOLDEN_EXPECTED_VALUES.farmer1.kpis7d.earnings,
            activeAuctions: GOLDEN_EXPECTED_VALUES.farmer1.kpis7d.activeAuctions,
            pendingOrders: GOLDEN_EXPECTED_VALUES.farmer1.kpis7d.pendingOrders,
            winRate: GOLDEN_EXPECTED_VALUES.farmer1.kpis7d.winRate,
            topCrop: GOLDEN_EXPECTED_VALUES.farmer1.kpis30d.topCrop,
          },
          salesTrend: GOLDEN_EXPECTED_VALUES.farmer1.salesTrend7d,
          earningsByCrop: [
            {
              cropId: "670000000000000000000101",
              cropName: "Onion",
              quantityKg: 78.0,
              totalSales: 364900,
              earnings: 357601,
              orderCount: 3,
            },
          ],
          endingSoonAuctions: [
            {
              id: "670000000000000000000221",
              cropId: "670000000000000000000101",
              cropName: "Onion",
              grade: "A",
              quantityKg: 65.0,
              floorPricePerKg: 4000,
              currentBidPerKg: 4500,
              bidCount: 2,
              endsAt: "2026-11-16T14:00:00.000Z",
              status: "ACTIVE",
            },
          ],
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          range: "7d" as const,
          granularity: "day" as const,
          timezone: "Asia/Dhaka" as const,
        },
      };

      const result = farmerDashboardResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("Buyer Dashboard Schema", () => {
    it("validates a complete buyer dashboard response matching golden dataset structure", () => {
      const payload = {
        data: {
          kpis: {
            totalSpend: GOLDEN_EXPECTED_VALUES.buyer1.kpis30d.totalSpend,
            activeBids: GOLDEN_EXPECTED_VALUES.buyer1.kpis30d.activeBids,
            winRate: GOLDEN_EXPECTED_VALUES.buyer1.kpis30d.winRate,
            avgPriceVsMarket: GOLDEN_EXPECTED_VALUES.buyer1.kpis30d.avgPriceVsMarket,
            pendingOrders: GOLDEN_EXPECTED_VALUES.buyer1.kpis30d.pendingOrders,
          },
          spendTrend: [
            { bucket: "2026-11-10", date: "2026-11-10", spend: 116025, quantityKg: 25.5, orderCount: 1 },
            { bucket: "2026-11-11", date: "2026-11-11", spend: 0, quantityKg: 0, orderCount: 0 },
            { bucket: "2026-11-14", date: "2026-11-14", spend: 210015, quantityKg: 15.0, orderCount: 1 },
          ],
          purchasesByCrop: [
            {
              cropId: "670000000000000000000101",
              cropName: "Onion",
              quantityKg: 105.5,
              totalSpend: 468025,
              orderCount: 2,
            },
          ],
          activeBidsList: [
            {
              listingId: "670000000000000000000221",
              cropId: "670000000000000000000101",
              cropName: "Onion",
              grade: "A",
              myBidPerKg: 4500,
              currentBidPerKg: 4500,
              bidCount: 2,
              endsAt: "2026-11-16T14:00:00.000Z",
              status: "WINNING" as const,
            },
          ],
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          range: "30d" as const,
          granularity: "day" as const,
          timezone: "Asia/Dhaka" as const,
        },
      };

      const result = buyerDashboardResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("Market History Schema", () => {
    it("validates market history response with trend and series", () => {
      const payload = {
        data: {
          cropId: "670000000000000000000101",
          cropName: "Onion",
          division: "rajshahi",
          range: "30d" as const,
          trend: "UP" as const,
          currentAvgPricePerKg: 4600,
          minPricePerKg: 4200,
          maxPricePerKg: 5000,
          changePercent: 2.2,
          series: [
            {
              date: "2026-11-10",
              avgPricePerKg: 4500,
              minPricePerKg: 4200,
              maxPricePerKg: 4800,
              source: "PLATFORM",
            },
            {
              date: "2026-11-16",
              avgPricePerKg: 4600,
              minPricePerKg: 4400,
              maxPricePerKg: 4900,
              source: "PLATFORM",
            },
          ],
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          cropId: "670000000000000000000101",
          division: "rajshahi",
          range: "30d" as const,
        },
      };

      expect(marketHistoryResponseSchema.safeParse(payload).success).toBe(true);
    });

    it("validates market history response with grade guide for A, B, and C", () => {
      const payload = {
        data: {
          cropId: "670000000000000000000101",
          cropName: "Onion",
          range: "30d" as const,
          trend: "UP" as const,
          currentAvgPricePerKg: 4600,
          minPricePerKg: 4200,
          maxPricePerKg: 5000,
          changePercent: 2.2,
          series: [
            {
              date: "2026-11-16",
              avgPricePerKg: 4600,
              minPricePerKg: 4400,
              maxPricePerKg: 4900,
              source: "PLATFORM",
            },
          ],
          gradeGuide: {
            A: {
              grade: "A" as const,
              description: "Firm bulbs",
              expectedPerKg: 5060,
              lowPerKg: 4554,
              highPerKg: 5566,
              suggestedFloorPerKg: 4554,
              trend: "UP" as const,
              provider: "mock",
            },
            B: {
              grade: "B" as const,
              description: "Minor marks",
              expectedPerKg: 4600,
              lowPerKg: 4140,
              highPerKg: 5060,
              suggestedFloorPerKg: 4140,
              trend: "UP" as const,
              provider: "mock",
            },
            C: {
              grade: "C" as const,
              description: "Small bulbs",
              expectedPerKg: 3910,
              lowPerKg: 3519,
              highPerKg: 4301,
              suggestedFloorPerKg: 3519,
              trend: "UP" as const,
              provider: "mock",
            },
          },
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          cropId: "670000000000000000000101",
          range: "30d" as const,
        },
      };

      expect(marketHistoryResponseSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe("Market Summary & National Summary Schemas", () => {
    it("validates market summary response", () => {
      const payload = {
        data: {
          items: [
            {
              cropId: "670000000000000000000101",
              cropSlug: "onion",
              cropName: "Onion",
              currentAvgPricePerKg: 4650,
              minPricePerKg: 4200,
              maxPricePerKg: 5200,
              trend: "UP" as const,
              priceChange7dPercent: 3.5,
              activeListingsCount: 5,
              lastUpdated: "2026-11-16T12:00:00.000Z",
            },
          ],
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          totalCrops: 1,
        },
      };

      expect(marketSummaryResponseSchema.safeParse(payload).success).toBe(true);
    });

    it("validates national summary response", () => {
      const payload = {
        data: {
          divisions: [
            {
              division: "rajshahi",
              crops: [
                {
                  cropId: "670000000000000000000101",
                  cropSlug: "onion",
                  cropName: "Onion",
                  avgPricePerKg: 4600,
                  minPricePerKg: 4200,
                  maxPricePerKg: 5000,
                  activeListingsCount: 3,
                  completedSalesCount: 12,
                },
              ],
            },
          ],
        },
        meta: {
          serverTime: "2026-11-16T12:00:00.000Z",
          totalDivisions: 1,
        },
      };

      expect(nationalSummaryResponseSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe("Query Schemas", () => {
    it("defaults range to 30d for dashboard query", () => {
      const parsed = dashboardQuerySchema.parse({});
      expect(parsed.range).toBe("30d");
    });

    it("validates market price query and requires cropId", () => {
      expect(marketPriceQuerySchema.safeParse({ cropId: "c1" }).success).toBe(true);
      expect(marketPriceQuerySchema.safeParse({}).success).toBe(false);
    });
  });
});

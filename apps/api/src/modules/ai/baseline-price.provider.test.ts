import { beforeEach, describe, expect, it, vi } from "vitest";
import { PriceReasonCode, type PriceReasonItem, priceGuidanceSchema } from "@bazarbeat/shared";
import { ObjectId } from "bson";

import { BaselinePricePredictionProvider } from "./baseline-price.provider.js";
import * as marketPriceService from "../market-prices/market-price.service.js";
import { Crop } from "../crops/crop.model.js";
import type { MarketPriceRecord } from "../market-prices/market-price.model.js";

describe("BaselinePricePredictionProvider (Task G5)", () => {
  let provider: BaselinePricePredictionProvider;

  beforeEach(() => {
    provider = new BaselinePricePredictionProvider();
    vi.restoreAllMocks();
    vi.spyOn(Crop, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new ObjectId("65f1a1a1a1a1a1a1a1a1a101"),
        slug: "onion",
        name: "Onion",
      }),
    } as unknown as ReturnType<typeof Crop.findById>);
  });

  it("predicts price guidance using division rows and returns provider: 'baseline'", async () => {
    const mockRows: MarketPriceRecord[] = [
      {
        avgPricePerKg: 6_200,
        minPricePerKg: 5_900,
        maxPricePerKg: 6_500,
        date: new Date("2026-11-20T00:00:00Z"),
        division: "dhaka",
        cropId: new ObjectId("65f1a1a1a1a1a1a1a1a1a101"),
        source: "SEED",
        createdAt: new Date("2026-11-20T00:00:00Z"),
        updatedAt: new Date("2026-11-20T00:00:00Z"),
      },
      {
        avgPricePerKg: 6_000,
        minPricePerKg: 5_700,
        maxPricePerKg: 6_300,
        date: new Date("2026-11-19T00:00:00Z"),
        division: "dhaka",
        cropId: new ObjectId("65f1a1a1a1a1a1a1a1a1a101"),
        source: "SEED",
        createdAt: new Date("2026-11-19T00:00:00Z"),
        updatedAt: new Date("2026-11-19T00:00:00Z"),
      },
    ];

    vi.spyOn(marketPriceService, "getRecentMarketPrices").mockImplementation(
      async (_cropId, division) => {
        if (division === "dhaka") {
          return mockRows;
        }
        return [];
      },
    );

    const guidance = await provider.predictPrice(
      {
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "A",
        quantityKg: 50,
      },
      "dhaka",
    );

    expect(guidance.provider).toBe("baseline");
    expect(guidance.modelVersion).toBe("seasonal-baseline-v1");
    expect(guidance.degraded).toBe(false);
    expect(guidance.expectedPerKg).toBeGreaterThan(0);
    expect(guidance.lowPerKg).toBeLessThanOrEqual(guidance.expectedPerKg);
    expect(guidance.expectedPerKg).toBeLessThanOrEqual(guidance.highPerKg);
    expect(guidance.suggestedFloorPerKg).toBe(guidance.lowPerKg);

    // Schema validation
    expect(() => priceGuidanceSchema.parse(guidance)).not.toThrow();

    // Verify structured reason codes
    const codes = guidance.explanation
      .filter(
        (item): item is PriceReasonItem =>
          typeof item === "object" && item !== null && "code" in item,
      )
      .map((item) => item.code);
    expect(codes).toContain(PriceReasonCode.HISTORICAL_BENCHMARK);
    expect(codes).toContain(PriceReasonCode.GRADE_PREMIUM); // Grade A
  });

  it("falls back to national rows or crop default when division rows are empty", async () => {
    vi.spyOn(marketPriceService, "getRecentMarketPrices").mockResolvedValue([]);
    vi.spyOn(Crop, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new ObjectId("65f1a1a1a1a1a1a1a1a1a101"),
        slug: "onion",
        name: "Onion",
      }),
    } as unknown as ReturnType<typeof Crop.findById>);

    const guidance = await provider.predictPrice(
      {
        cropId: "65f1a1a1a1a1a1a1a1a1a101",
        grade: "B",
        quantityKg: 20,
      },
      "rangpur",
    );

    expect(guidance.provider).toBe("baseline");
    expect(guidance.modelVersion).toBe("seasonal-baseline-v1");
    // Onion fallback is 6,000 poisha
    expect(guidance.expectedPerKg).toBeGreaterThan(5_000);
    expect(guidance.expectedPerKg).toBeLessThan(7_000);
    expect(guidance.confidence).toBe(0.6); // sparse data confidence
    expect(() => priceGuidanceSchema.parse(guidance)).not.toThrow();
  });

  it("handles Grade C with commercial discount", async () => {
    const mockRows: MarketPriceRecord[] = Array.from({ length: 30 }, (_, i) => ({
      avgPricePerKg: 10_000,
      minPricePerKg: 9_500,
      maxPricePerKg: 10_500,
      date: new Date(Date.now() - i * 86_400_000),
      division: "chittagong",
      cropId: new ObjectId("65f1a1a1a1a1a1a1a1a1a102"),
      source: "SEED" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    vi.spyOn(marketPriceService, "getRecentMarketPrices").mockResolvedValue(mockRows);

    const guidance = await provider.predictPrice(
      {
        cropId: "65f1a1a1a1a1a1a1a1a1a102",
        grade: "C",
        quantityKg: 10,
      },
      "chittagong",
    );

    expect(guidance.provider).toBe("baseline");
    // Grade C multiplier is 0.85 -> expected around ~8,500 poisha
    expect(guidance.expectedPerKg).toBeLessThan(9_500);
    expect(guidance.expectedPerKg).toBeGreaterThan(7_500);
    expect(() => priceGuidanceSchema.parse(guidance)).not.toThrow();
  });
});

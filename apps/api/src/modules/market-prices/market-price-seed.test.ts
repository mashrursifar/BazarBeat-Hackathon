import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { BANGLADESH_DIVISIONS, MarketPriceSource } from "@bazarbeat/shared";

import { MarketPrice } from "./market-price.model.js";
import {
  MARKET_PRICE_BASE_PRICES,
  MARKET_PRICE_HISTORY_DAYS,
  generateMarketPriceHistory,
  seedMarketPriceHistory,
} from "./market-price-seed.js";

const crops = [
  { id: new Types.ObjectId(), slug: "onion" },
  { id: new Types.ObjectId(), slug: "green-chilli" },
  { id: new Types.ObjectId(), slug: "bitter-gourd" },
  { id: new Types.ObjectId(), slug: "eggplant" },
  { id: new Types.ObjectId(), slug: "potato" },
];
const asOf = new Date("2026-11-04T23:59:59.000Z");
let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(mongoServer.getUri());
  await MarketPrice.init();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) await mongoServer.stop();
});

beforeEach(async () => {
  await MarketPrice.deleteMany({});
});

describe("MarketPrice seed", () => {
  it("generates repeatable 60-day integer-poisha history for every crop and division", () => {
    const generated = generateMarketPriceHistory(crops, asOf);
    const repeated = generateMarketPriceHistory(crops, asOf);

    expect(generated).toEqual(repeated);
    expect(generated).toHaveLength(
      crops.length * BANGLADESH_DIVISIONS.length * MARKET_PRICE_HISTORY_DAYS,
    );
    expect(generated.every((row) => row.source === MarketPriceSource.SEED)).toBe(true);
    expect(
      generated.every(
        (row) =>
          Number.isInteger(row.avgPricePerKg) &&
          Number.isInteger(row.minPricePerKg) &&
          Number.isInteger(row.maxPricePerKg) &&
          row.minPricePerKg <= row.avgPricePerKg &&
          row.avgPricePerKg <= row.maxPricePerKg &&
          row.date.toISOString().endsWith("T00:00:00.000Z"),
      ),
    ).toBe(true);

    for (const crop of crops) {
      for (const { id: division } of BANGLADESH_DIVISIONS) {
        expect(
          generated.filter(
            (row) => String(row.cropId) === String(crop.id) && row.division === division,
          ),
        ).toHaveLength(60);
      }
    }

    const onionCrop = crops[0];
    if (onionCrop === undefined) throw new Error("Onion seed fixture missing");
    const onionDhaka = generated.filter(
      (row) => String(row.cropId) === String(onionCrop.id) && row.division === "dhaka",
    );
    expect(new Set(onionDhaka.map(({ avgPricePerKg }) => avgPricePerKg)).size).toBeGreaterThan(1);
    expect(Object.keys(MARKET_PRICE_BASE_PRICES)).toHaveLength(5);
  });

  it("upserts on repeated runs and keeps exactly the current 60-day seed window", async () => {
    const crop = crops[0];
    if (crop === undefined) throw new Error("Seed fixture crop missing");

    const firstCount = await seedMarketPriceHistory([crop], asOf);
    const initialRows = await MarketPrice.find({ cropId: crop.id }).sort({ date: 1 }).lean();
    const repeatedCount = await seedMarketPriceHistory([crop], asOf);
    const repeatedRows = await MarketPrice.find({ cropId: crop.id }).sort({ date: 1 }).lean();

    expect(firstCount).toBe(BANGLADESH_DIVISIONS.length * MARKET_PRICE_HISTORY_DAYS);
    expect(repeatedCount).toBe(firstCount);
    expect(repeatedRows).toHaveLength(firstCount);
    expect(
      repeatedRows.map(
        ({
          cropId: rowCropId,
          division,
          date,
          avgPricePerKg,
          minPricePerKg,
          maxPricePerKg,
          source,
        }) => ({
          cropId: String(rowCropId),
          division,
          date,
          avgPricePerKg,
          minPricePerKg,
          maxPricePerKg,
          source,
        }),
      ),
    ).toEqual(
      initialRows.map(
        ({
          cropId: rowCropId,
          division,
          date,
          avgPricePerKg,
          minPricePerKg,
          maxPricePerKg,
          source,
        }) => ({
          cropId: String(rowCropId),
          division,
          date,
          avgPricePerKg,
          minPricePerKg,
          maxPricePerKg,
          source,
        }),
      ),
    );
  });

  it("rejects crops without a configured base price", () => {
    expect(() =>
      generateMarketPriceHistory([{ id: new Types.ObjectId(), slug: "unknown" }], asOf),
    ).toThrow("Missing base market price for crop: unknown");
  });
});

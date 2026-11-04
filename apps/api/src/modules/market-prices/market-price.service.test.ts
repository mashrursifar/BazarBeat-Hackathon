import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MarketPriceSource } from "@bazarbeat/shared";

import { MarketPrice } from "./market-price.model.js";
import { getRecentMarketPrices } from "./market-price.service.js";

const cropId = new Types.ObjectId();
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

describe("getRecentMarketPrices", () => {
  it("returns the newest matching rows first and excludes other crops and divisions", async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      cropId,
      division: "dhaka",
      date: new Date(Date.UTC(2026, 9, 1 + index)),
      avgPricePerKg: 6_000 + index,
      minPricePerKg: 5_700 + index,
      maxPricePerKg: 6_300 + index,
      source: MarketPriceSource.SEED,
    }));
    await MarketPrice.insertMany([
      ...rows,
      { ...rows[0], cropId: new Types.ObjectId() },
      { ...rows[0], division: "khulna" },
    ]);

    const result = await getRecentMarketPrices(cropId.toString(), "dhaka", 2);

    expect(result).toHaveLength(2);
    expect(result.map(({ avgPricePerKg }) => avgPricePerKg)).toEqual([6_003, 6_002]);
  });
});

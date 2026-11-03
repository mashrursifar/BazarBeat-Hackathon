import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "../../shared/errors.js";
import { InventoryItem } from "./inventory-item.model.js";
import { addStock, reserveStockForListing } from "./inventory.service.js";
import { StockMovement } from "./stock-movement.model.js";

const farmerId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();
const listingId = new Types.ObjectId().toString();

let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([InventoryItem.init(), StockMovement.init()]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([InventoryItem.deleteMany({}), StockMovement.deleteMany({})]);
});

describe("standalone Mongo inventory fallback", () => {
  it("recovers an interrupted pending movement before applying the next movement", async () => {
    await addStock({ farmerId, cropId, quantityKg: 8, operationId: "fallback-add" });
    await StockMovement.create({
      farmerId,
      cropId,
      type: "LIST",
      quantityKg: 2,
      listingId,
      operationId: "interrupted-reservation",
      status: "PENDING",
    });
    await InventoryItem.updateOne(
      { farmerId, cropId },
      { $inc: { availableKg: -2, listedKg: 2 }, $set: { pendingMovementId: "interrupted-reservation" } },
    );

    await reserveStockForListing({ farmerId, cropId, quantityKg: 3, listingId, operationId: "fallback-next-list" });

    expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({
      availableKg: 3,
      listedKg: 5,
    });
    expect(await StockMovement.countDocuments({ status: "APPLIED" })).toBe(3);
    expect(await InventoryItem.countDocuments({ pendingMovementId: { $exists: true } })).toBe(0);
  });

  it("keeps parallel standalone reservations from exceeding available stock", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "fallback-parallel-add" });
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => reserveStockForListing({
      farmerId,
      cropId,
      quantityKg: 2,
      listingId,
      operationId: `fallback-parallel-list-${index}`,
    })));
    const successful = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(successful).toHaveLength(5);
    expect(rejected).toHaveLength(3);
    expect(rejected.every((result) => result.status === "rejected" && result.reason instanceof AppError && result.reason.code === "INSUFFICIENT_STOCK")).toBe(true);
    expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({ availableKg: 0, listedKg: 10 });
    expect(await InventoryItem.countDocuments({ pendingMovementId: { $exists: true } })).toBe(0);
  });
});

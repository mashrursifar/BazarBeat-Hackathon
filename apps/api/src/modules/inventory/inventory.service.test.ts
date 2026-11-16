import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "../../shared/errors.js";
import { InventoryItem } from "./inventory-item.model.js";
import {
  addStock,
  adjustStock,
  markStockSold,
  releaseStock,
  reserveStockForListing,
  returnStock,
} from "./inventory.service.js";
import { StockMovement } from "./stock-movement.model.js";

const farmerId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();
const listingId = new Types.ObjectId().toString();
const orderId = new Types.ObjectId().toString();

let mongoReplicaSet: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
  await mongoose.connect(mongoReplicaSet.getUri());
  await Promise.all([InventoryItem.init(), StockMovement.init()]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplicaSet !== undefined) await mongoReplicaSet.stop();
});

beforeEach(async () => {
  await Promise.all([InventoryItem.deleteMany({}), StockMovement.deleteMany({})]);
});

describe("inventory movement service", () => {
  it("applies ADD, LIST, RELEASE, SELL, and ADJUST and reconciles the ledger", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "movement-add" });
    await reserveStockForListing({ farmerId, cropId, quantityKg: 4, listingId, operationId: "movement-list-one" });
    await releaseStock({ farmerId, cropId, quantityKg: 1, listingId, operationId: "movement-release" });
    await reserveStockForListing({ farmerId, cropId, quantityKg: 3, listingId, operationId: "movement-list-two" });
    await markStockSold({ farmerId, cropId, quantityKg: 2, orderId, operationId: "movement-sell" });
    await adjustStock({ farmerId, cropId, quantityKg: 0.5, orderId, operationId: "movement-adjust" });
    await returnStock({ farmerId, cropId, quantityKg: 1, orderId, operationId: "movement-return" });

    const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
    const movements = await StockMovement.find({ status: "APPLIED" }).lean();
    const ledgerTotals = movements.reduce(
      (totals, movement) => {
        const quantity = movement.quantityKg;
        if (movement.type === "ADD" || movement.type === "ADJUST") totals.availableKg += quantity;
        if (movement.type === "LIST") {
          totals.availableKg -= quantity;
          totals.listedKg += quantity;
        }
        if (movement.type === "RELEASE") {
          totals.availableKg += quantity;
          totals.listedKg -= quantity;
        }
        if (movement.type === "SELL") {
          totals.listedKg -= quantity;
          totals.soldKg += quantity;
        }
        if (movement.type === "RETURN") {
          totals.availableKg += quantity;
          totals.soldKg -= quantity;
        }
        return totals;
      },
      { availableKg: 0, listedKg: 0, soldKg: 0 },
    );

    expect(inventory).toMatchObject(ledgerTotals);
    expect(inventory).toMatchObject({ availableKg: 5.5, listedKg: 4, soldKg: 1 });
    expect(movements).toHaveLength(7);
  });

  it("applies a valid RETURN movement (decreases sold, increases available, traceable to order)", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "return-setup-add" });
    await reserveStockForListing({ farmerId, cropId, quantityKg: 5, listingId, operationId: "return-setup-list" });
    await markStockSold({ farmerId, cropId, quantityKg: 5, orderId, operationId: "return-setup-sell" });

    // Initial state: available 5, listed 0, sold 5
    expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({
      availableKg: 5,
      listedKg: 0,
      soldKg: 5,
    });

    await returnStock({
      farmerId,
      cropId,
      quantityKg: 2,
      orderId,
      operationId: "return-valid-op",
      note: "Cancelled order return",
    });

    const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
    expect(inventory).toMatchObject({
      availableKg: 7,
      listedKg: 0,
      soldKg: 3,
    });

    const returnMovement = await StockMovement.findOne({ operationId: "return-valid-op" }).lean();
    expect(returnMovement).toBeDefined();
    expect(returnMovement?.type).toBe("RETURN");
    expect(returnMovement?.status).toBe("APPLIED");
    expect(returnMovement?.quantityKg).toBe(2);
    expect(returnMovement?.orderId?.toString()).toBe(orderId);
    expect(returnMovement?.note).toBe("Cancelled order return");
  });

  it("rejects returning more than was sold with INSUFFICIENT_STOCK and never allows sold below zero", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "return-underflow-add" });
    await reserveStockForListing({ farmerId, cropId, quantityKg: 3, listingId, operationId: "return-underflow-list" });
    await markStockSold({ farmerId, cropId, quantityKg: 3, orderId, operationId: "return-underflow-sell" });

    // soldKg is 3. Attempting to return 3.1 kg must fail
    await expect(
      returnStock({
        farmerId,
        cropId,
        quantityKg: 3.1,
        orderId,
        operationId: "return-underflow-fail",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", statusCode: 409 });

    expect(await StockMovement.countDocuments({ operationId: "return-underflow-fail" })).toBe(0);
    const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
    expect(inventory).toMatchObject({ availableKg: 7, listedKg: 0, soldKg: 3 });
  });

  it("enforces concurrency safety during parallel returns without overselling or underflowing sold stock", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "parallel-return-add" });
    await reserveStockForListing({ farmerId, cropId, quantityKg: 10, listingId, operationId: "parallel-return-list" });
    await markStockSold({ farmerId, cropId, quantityKg: 10, orderId, operationId: "parallel-return-sell" });

    // 10 kg sold. Run 8 parallel returns of 2 kg each (16 kg total requested).
    // Exactly 5 should succeed (totaling 10 kg), and 3 should fail with INSUFFICIENT_STOCK.
    const attempts = Array.from({ length: 8 }, (_, index) =>
      returnStock({
        farmerId,
        cropId,
        quantityKg: 2,
        orderId,
        operationId: `parallel-return-${index}`,
      }),
    );

    const results = await Promise.allSettled(attempts);
    const successful = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(successful).toHaveLength(5);
    expect(rejected).toHaveLength(3);
    expect(
      rejected.every(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof AppError &&
          result.reason.code === "INSUFFICIENT_STOCK",
      ),
    ).toBe(true);

    const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
    expect(inventory).toMatchObject({ availableKg: 10, listedKg: 0, soldKg: 0 });
    expect(await StockMovement.countDocuments({ type: "RETURN", status: "APPLIED" })).toBe(5);
  });

  it("rejects a movement that would underflow a bucket with INSUFFICIENT_STOCK", async () => {
    await addStock({ farmerId, cropId, quantityKg: 2, operationId: "stock-initial" });

    await expect(
      reserveStockForListing({ farmerId, cropId, quantityKg: 2.1, listingId, operationId: "stock-too-large" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", statusCode: 409 });
    expect(await StockMovement.countDocuments({ operationId: "stock-too-large" })).toBe(0);
    expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({ availableKg: 2, listedKg: 0 });
  });

  it("rejects releases and sales that would underflow listed stock", async () => {
    await addStock({ farmerId, cropId, quantityKg: 2, operationId: "listed-underflow-initial" });

    await expect(
      releaseStock({ farmerId, cropId, quantityKg: 1, listingId, operationId: "listed-underflow-release" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(
      markStockSold({ farmerId, cropId, quantityKg: 1, orderId, operationId: "listed-underflow-sell" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("does not oversell during parallel reservations", async () => {
    await addStock({ farmerId, cropId, quantityKg: 10, operationId: "parallel-initial" });
    const attempts = Array.from({ length: 8 }, (_, index) => reserveStockForListing({
      farmerId,
      cropId,
      quantityKg: 2,
      listingId,
      operationId: `parallel-reservation-${index}`,
    }));
    const results = await Promise.allSettled(attempts);
    const successful = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();

    expect(successful).toHaveLength(5);
    expect(rejected).toHaveLength(3);
    expect(rejected.every((result) => result.status === "rejected" && result.reason instanceof AppError && result.reason.code === "INSUFFICIENT_STOCK")).toBe(true);
    expect(inventory).toMatchObject({ availableKg: 0, listedKg: 10, soldKg: 0 });
    expect(await StockMovement.countDocuments({ type: "LIST", status: "APPLIED" })).toBe(5);
  });

  it("returns the prior result for a repeated operation ID without applying it twice", async () => {
    const input = { farmerId, cropId, quantityKg: 3, operationId: "idempotent-add" };
    await addStock(input);
    await addStock(input);

    expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({ availableKg: 3 });
    expect(await StockMovement.countDocuments({ operationId: input.operationId })).toBe(1);
  });
});

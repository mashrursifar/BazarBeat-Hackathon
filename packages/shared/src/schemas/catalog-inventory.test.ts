import { describe, expect, it } from "vitest";

import {
  addStockRequestSchema,
  cropResponseSchema,
  inventorySummaryItemSchema,
  paginationQuerySchema,
  stockMovementResponseSchema,
} from "./catalog-inventory.js";

const crop = {
  id: "0123456789abcdef01234567",
  slug: "green-chilli",
  nameEn: "Green Chilli",
  nameBn: "কাঁচা মরিচ",
  unit: "KG",
  minLotKg: 1,
  maxLotKg: 500,
  shelfLifeHours: 72,
  gradeGuide: { A: "Fresh", B: "Good", C: "Usable" },
  imageUrl: "https://example.test/chilli.png",
};

describe("catalog and inventory schemas", () => {
  it("parses a crop response and defaults minimum increment to 100 poisha", () => {
    expect(cropResponseSchema.parse(crop).minIncrementPerKg).toBe(100);
    expect(cropResponseSchema.parse({ ...crop, minIncrementPerKg: 250 }).minIncrementPerKg).toBe(250);
    expect(cropResponseSchema.safeParse({ ...crop, imageUrl: "/images/crops/placeholder.svg" }).success).toBe(true);
    expect(cropResponseSchema.safeParse({ ...crop, id: "green-chilli" }).success).toBe(false);
  });

  it("validates inventory summaries and valid stock additions", () => {
    expect(inventorySummaryItemSchema.safeParse({ crop, availableKg: 2, listedKg: 1, soldKg: 0 }).success).toBe(true);
    expect(addStockRequestSchema.parse({ cropId: crop.id, quantityKg: 12.5, note: "Morning harvest" }).quantityKg).toBe(12.5);
    expect(addStockRequestSchema.safeParse({ cropId: crop.id, quantityKg: 5_000 }).success).toBe(true);
  });

  it("rejects zero, negative, fractional precision, excessive quantity, and long notes", () => {
    for (const quantityKg of [0, -1, 1.25, 5_000.1]) {
      expect(addStockRequestSchema.safeParse({ cropId: crop.id, quantityKg }).success).toBe(false);
    }
    expect(addStockRequestSchema.safeParse({ cropId: crop.id, quantityKg: 1, note: "x".repeat(201) }).success).toBe(false);
  });

  it("validates movement response types and pagination bounds", () => {
    const movement = {
      id: "0123456789abcdef01234568",
      farmerId: crop.id,
      cropId: crop.id,
      type: "ADD",
      quantityKg: 3,
      createdAt: "2026-11-03T00:00:00.000Z",
    };
    expect(stockMovementResponseSchema.safeParse(movement).success).toBe(true);
    expect(stockMovementResponseSchema.safeParse({ ...movement, type: "RETURN" }).success).toBe(true);
    expect(stockMovementResponseSchema.safeParse({ ...movement, type: "REMOVE" }).success).toBe(false);
    expect(paginationQuerySchema.parse({ page: "2" })).toEqual({ page: 2, limit: 20 });
    expect(paginationQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
  });
});

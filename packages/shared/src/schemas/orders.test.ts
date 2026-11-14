import { describe, expect, it } from "vitest";
import { CropGrade, OrderStatus, PaymentStatus } from "../enums.js";
import { minimalOrderSchema } from "./orders.js";

describe("minimalOrderSchema", () => {
  const validOrder = {
    id: "651234567890abcdef123456",
    listingId: "651234567890abcdef123457",
    farmerId: "651234567890abcdef123458",
    buyerId: "651234567890abcdef123459",
    cropId: "651234567890abcdef12345a",
    quantityKg: 20.5,
    grade: CropGrade.A,
    pricePerKg: 5000,
    subtotal: 102500,
    platformFee: 2050,
    farmerNet: 100450,
    status: OrderStatus.PENDING,
    payment: {
      status: PaymentStatus.UNPAID,
    },
    createdAt: "2026-11-14T10:00:00.000Z",
  };

  it("accepts a valid minimal order document", () => {
    const result = minimalOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects when platformFee + farmerNet !== subtotal", () => {
    const invalid = {
      ...validOrder,
      farmerNet: 100000, // missing 450 poisha
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer poisha amounts", () => {
    const invalid = {
      ...validOrder,
      subtotal: 102500.5,
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const invalid = {
      ...validOrder,
      status: "INVALID_STATUS",
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});


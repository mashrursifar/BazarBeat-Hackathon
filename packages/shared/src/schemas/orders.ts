import { z } from "zod";
import { CropGrade, OrderStatus, PaymentMethod, PaymentStatus } from "../enums.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

/**
 * Minimal Order payment subdocument schema.
 * Phase 4 / AUCTION_RULES §11: Default status is UNPAID.
 */
export const orderPaymentSchema = z.object({
  status: z.enum([
    PaymentStatus.UNPAID,
    PaymentStatus.PAID,
    PaymentStatus.REFUNDED,
  ]),
  method: z.enum([PaymentMethod.COD, PaymentMethod.WALLET_SIM]).optional(),
  paidAt: z.string().datetime().optional(),
});

export type OrderPayment = z.infer<typeof orderPaymentSchema>;

/**
 * Minimal Order model schema (Phase 4 Task 4.4).
 * Single source of truth for order creation on auction closing.
 * DATA_MODEL (Order): Unique per listing, price/grade snapshots, fee from PLATFORM_FEE_BPS, farmer net.
 */
export const minimalOrderSchema = z
  .object({
    id: databaseIdSchema,
    listingId: databaseIdSchema,
    farmerId: databaseIdSchema,
    buyerId: databaseIdSchema,
    cropId: databaseIdSchema,
    quantityKg: inventoryQuantityKgSchema,
    grade: z.enum([CropGrade.A, CropGrade.B, CropGrade.C]),
    pricePerKg: z.number().int().positive("pricePerKg must be a positive integer in poisha"),
    subtotal: z.number().int().positive("subtotal must be a positive integer in poisha"),
    platformFee: z.number().int().nonnegative("platformFee must be non-negative integer in poisha"),
    farmerNet: z.number().int().nonnegative("farmerNet must be non-negative integer in poisha"),
    status: z.enum([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ]),
    payment: orderPaymentSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine((data) => data.platformFee + data.farmerNet === data.subtotal, {
    message: "platformFee + farmerNet must equal subtotal",
    path: ["farmerNet"],
  });

export type MinimalOrder = z.infer<typeof minimalOrderSchema>;

/**
 * API response envelope for an order.
 */
export const orderResponseSchema = z.object({
  data: minimalOrderSchema,
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;


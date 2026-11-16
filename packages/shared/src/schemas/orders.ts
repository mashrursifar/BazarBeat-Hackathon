import { z } from "zod";
import {
  CropGrade,
  FulfilmentMethod,
  ORDER_DISPUTE_REASONS,
  OrderAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockReturnDecision,
  UserRole,
} from "../enums.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

/**
 * Zod enum schemas for order lifecycle and payments.
 */
export const orderStatusSchema = z.enum([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.DISPUTED,
]);

export const paymentStatusSchema = z.enum([
  PaymentStatus.UNPAID,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
]);

export const paymentMethodSchema = z.enum([
  PaymentMethod.COD,
  PaymentMethod.WALLET_SIM,
]);

export const fulfilmentMethodSchema = z.enum([
  FulfilmentMethod.PICKUP,
  FulfilmentMethod.BUYER_ARRANGED,
]);

export const orderActionSchema = z.enum([
  OrderAction.CONFIRM,
  OrderAction.MARK_PAID,
  OrderAction.MARK_DELIVERED,
  OrderAction.COMPLETE,
  OrderAction.DISPUTE,
  OrderAction.CANCEL,
]);

/**
 * Minimal Order payment subdocument schema.
 * Phase 4 / AUCTION_RULES §11: Default status is UNPAID.
 */
export const orderPaymentSchema = z.object({
  status: paymentStatusSchema,
  method: paymentMethodSchema.optional(),
  paidAt: z.string().datetime().optional(),
  refundedAt: z.string().datetime().optional(),
});

export type OrderPayment = z.infer<typeof orderPaymentSchema>;

export const stockReturnDecisionSchema = z.enum([
  StockReturnDecision.RETURNED,
  StockReturnDecision.DISCARDED,
]);

export type StockReturnDecisionType = z.infer<typeof stockReturnDecisionSchema>;

export const orderStockReturnSchema = z.object({
  decision: stockReturnDecisionSchema,
  decidedAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
});

export type OrderStockReturn = z.infer<typeof orderStockReturnSchema>;

export const decideStockReturnRequestSchema = z
  .object({
    decision: stockReturnDecisionSchema,
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type DecideStockReturnRequest = z.infer<typeof decideStockReturnRequestSchema>;

/**
 * Fulfilment details for pickup/handover.
 * DATA_MODEL (Order): fulfilment { method, note?, handoverAt? }
 */
export const orderFulfilmentSchema = z.object({
  method: fulfilmentMethodSchema,
  note: z.string().trim().max(200).optional(),
  handoverAt: z.string().datetime().optional(),
});

export type OrderFulfilment = z.infer<typeof orderFulfilmentSchema>;

/**
 * Dispute details for delivered orders (P1).
 */
export const orderDisputeSchema = z.object({
  reason: z.enum(ORDER_DISPUTE_REASONS),
  note: z.string().trim().max(500).optional(),
  raisedAt: z.string().datetime(),
  resolution: z.string().trim().max(500).optional(),
});

export type OrderDispute = z.infer<typeof orderDisputeSchema>;

/**
 * Timeline / audit status history entry.
 */
export const orderTimelineEntrySchema = z.object({
  status: orderStatusSchema,
  at: z.string().datetime(),
  byUserId: databaseIdSchema.optional(),
  note: z.string().trim().max(200).optional(),
});

export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;

/**
 * Counterparty information schemas.
 * AUCTION_RULES §10 / API_SPEC:
 * - In PENDING: Counterparty is masked (anonymized name/label, division/district only, no phone/address).
 * - After CONFIRMED: Full contact details revealed to authorized participants.
 */
export const counterpartyLocationSchema = z.object({
  division: z.string(),
  district: z.string(),
  upazila: z.string().optional(),
  address: z.string().optional(),
});

export type CounterpartyLocation = z.infer<typeof counterpartyLocationSchema>;

export const maskedCounterpartySchema = z.object({
  id: databaseIdSchema,
  name: z.string(),
  role: z.enum([UserRole.FARMER, UserRole.BUYER]),
  isMasked: z.literal(true),
  division: z.string().optional(),
  district: z.string().optional(),
});

export type MaskedCounterparty = z.infer<typeof maskedCounterpartySchema>;

export const revealedCounterpartySchema = z.object({
  id: databaseIdSchema,
  name: z.string(),
  role: z.enum([UserRole.FARMER, UserRole.BUYER]),
  phone: z.string().min(10).max(20),
  organizationName: z.string().optional(),
  location: counterpartyLocationSchema.optional(),
  isMasked: z.literal(false),
});

export type RevealedCounterparty = z.infer<typeof revealedCounterpartySchema>;

export const counterpartySchema = z.discriminatedUnion("isMasked", [
  maskedCounterpartySchema,
  revealedCounterpartySchema,
]);

export type CounterpartyDto = z.infer<typeof counterpartySchema>;

/**
 * Minimal Order model schema (Phase 4 Task 4.4 / Phase 6 Task 6.1).
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
    status: orderStatusSchema,
    payment: orderPaymentSchema,
    fulfilment: orderFulfilmentSchema.optional(),
    dispute: orderDisputeSchema.optional(),
    statusHistory: z.array(orderTimelineEntrySchema).optional(),
    confirmedAt: z.string().datetime().optional(),
    deliveredAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    cancelledAt: z.string().datetime().optional(),
    cancelledBy: databaseIdSchema.optional(),
    cancelReason: z.string().optional(),
    cancelNote: z.string().optional(),
    stockReturn: orderStockReturnSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine((data) => data.platformFee + data.farmerNet === data.subtotal, {
    message: "platformFee + farmerNet must equal subtotal",
    path: ["farmerNet"],
  });

export type MinimalOrder = z.infer<typeof minimalOrderSchema>;

/**
 * Listing summary embedded in order detail.
 */
export const listingSummaryInOrderSchema = z.object({
  id: databaseIdSchema,
  title: z.string().optional(),
  imageUrl: z.string().optional(),
  division: z.string(),
  district: z.string(),
});

export type ListingSummaryInOrder = z.infer<typeof listingSummaryInOrderSchema>;

/**
 * Role-specific Order Card DTOs.
 */
export const farmerOrderCardSchema = z.object({
  id: databaseIdSchema,
  listingId: databaseIdSchema,
  cropId: databaseIdSchema,
  cropName: z.string(),
  cropNameBn: z.string(),
  imageUrl: z.string().optional(),
  grade: z.enum([CropGrade.A, CropGrade.B, CropGrade.C]),
  quantityKg: inventoryQuantityKgSchema,
  pricePerKg: z.number().int().positive(),
  subtotal: z.number().int().positive(),
  platformFee: z.number().int().nonnegative(),
  farmerNet: z.number().int().nonnegative(),
  status: orderStatusSchema,
  payment: orderPaymentSchema,
  fulfilment: orderFulfilmentSchema,
  buyer: counterpartySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type FarmerOrderCard = z.infer<typeof farmerOrderCardSchema>;

export const buyerOrderCardSchema = z.object({
  id: databaseIdSchema,
  listingId: databaseIdSchema,
  cropId: databaseIdSchema,
  cropName: z.string(),
  cropNameBn: z.string(),
  imageUrl: z.string().optional(),
  grade: z.enum([CropGrade.A, CropGrade.B, CropGrade.C]),
  quantityKg: inventoryQuantityKgSchema,
  pricePerKg: z.number().int().positive(),
  subtotal: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  status: orderStatusSchema,
  payment: orderPaymentSchema,
  fulfilment: orderFulfilmentSchema,
  farmer: counterpartySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type BuyerOrderCard = z.infer<typeof buyerOrderCardSchema>;

/**
 * Role-specific Order Detail DTOs.
 */
export const farmerOrderDetailSchema = farmerOrderCardSchema.extend({
  timeline: z.array(orderTimelineEntrySchema),
  availableActions: z.array(orderActionSchema),
  dispute: orderDisputeSchema.optional(),
  listingSummary: listingSummaryInOrderSchema.optional(),
});

export type FarmerOrderDetail = z.infer<typeof farmerOrderDetailSchema>;

export const buyerOrderDetailSchema = buyerOrderCardSchema.extend({
  timeline: z.array(orderTimelineEntrySchema),
  availableActions: z.array(orderActionSchema),
  dispute: orderDisputeSchema.optional(),
  listingSummary: listingSummaryInOrderSchema.optional(),
});

export type BuyerOrderDetail = z.infer<typeof buyerOrderDetailSchema>;

/**
 * Action Request Schemas.
 */
export const confirmOrderRequestSchema = z
  .object({
    handoverAt: z.string().datetime(),
    note: z.string().trim().max(200).optional(),
    fulfilmentMethod: fulfilmentMethodSchema.optional(),
  })
  .strict();

export type ConfirmOrderRequest = z.infer<typeof confirmOrderRequestSchema>;

export const markPaidRequestSchema = z
  .object({
    method: paymentMethodSchema.optional(),
  })
  .strict();

export type MarkPaidRequest = z.infer<typeof markPaidRequestSchema>;

export const markDeliveredRequestSchema = z
  .object({
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type MarkDeliveredRequest = z.infer<typeof markDeliveredRequestSchema>;

export const completeOrderRequestSchema = z
  .object({
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type CompleteOrderRequest = z.infer<typeof completeOrderRequestSchema>;

export const disputeOrderRequestSchema = z
  .object({
    reason: z.enum(ORDER_DISPUTE_REASONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type DisputeOrderRequest = z.infer<typeof disputeOrderRequestSchema>;

export const cancelOrderRequestSchema = z
  .object({
    reason: z.string().trim().min(1, "Cancellation reason is required").max(100),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/**
 * Sales item and response schemas (GET /sales).
 */
export const saleItemSchema = z.object({
  id: databaseIdSchema,
  listingId: databaseIdSchema,
  cropId: databaseIdSchema,
  cropName: z.string(),
  cropNameBn: z.string(),
  grade: z.enum([CropGrade.A, CropGrade.B, CropGrade.C]),
  quantityKg: z.number().positive(),
  pricePerKg: z.number().int().positive(),
  expectedPricePerKg: z.number().int().positive().optional(),
  subtotal: z.number().int().positive(),
  platformFee: z.number().int().nonnegative(),
  farmerNet: z.number().int().nonnegative(),
  pricePremiumPercent: z.number().optional(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema.optional(),
  buyerName: z.string(),
  soldAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type SaleItem = z.infer<typeof saleItemSchema>;

export const salesQuerySchema = z.object({
  cropId: databaseIdSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type SalesQuery = z.infer<typeof salesQuerySchema>;

export const salesResponseSchema = z.object({
  data: z.array(saleItemSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    serverTime: z.string().datetime(),
  }),
});

export type SalesResponse = z.infer<typeof salesResponseSchema>;

/**
 * Earnings response schemas (GET /earnings).
 */
export const earningsCropSummarySchema = z.object({
  cropId: databaseIdSchema,
  cropName: z.string(),
  cropNameBn: z.string(),
  totalKg: z.number().nonnegative(),
  totalEarnings: z.number().int().nonnegative(),
  averagePricePerKg: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
});

export type EarningsCropSummary = z.infer<typeof earningsCropSummarySchema>;

export const earningsRecentPayoutSchema = z.object({
  orderId: databaseIdSchema,
  cropName: z.string(),
  amount: z.number().int().positive(),
  status: paymentStatusSchema,
  method: paymentMethodSchema.optional(),
  date: z.string().datetime(),
});

export type EarningsRecentPayout = z.infer<typeof earningsRecentPayoutSchema>;

export const earningsDataSchema = z.object({
  summary: z.object({
    totalEarnings: z.number().int().nonnegative(),
    totalSubtotal: z.number().int().nonnegative(),
    totalPlatformFees: z.number().int().nonnegative(),
    completedOrdersCount: z.number().int().nonnegative(),
    pendingPayout: z.number().int().nonnegative(),
    paidPayout: z.number().int().nonnegative(),
    averagePricePremiumPercent: z.number(),
  }),
  byCrop: z.array(earningsCropSummarySchema),
  recentPayouts: z.array(earningsRecentPayoutSchema),
});

export type EarningsData = z.infer<typeof earningsDataSchema>;

export const earningsResponseSchema = z.object({
  data: earningsDataSchema,
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type EarningsResponse = z.infer<typeof earningsResponseSchema>;

/**
 * API response envelope for a single order.
 */
export const orderResponseSchema = z.object({
  data: minimalOrderSchema,
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;

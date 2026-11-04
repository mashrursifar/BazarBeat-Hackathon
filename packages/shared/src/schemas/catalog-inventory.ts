import { z } from "zod";

import { StockMovementType } from "../enums.js";

export const databaseIdSchema = z.string().regex(/^[\da-f]{24}$/i, "Expected a database ID");
export const inventoryQuantityKgSchema = z.number().positive().max(5_000).refine((value) => Number.isInteger(value * 10), {
  message: "Quantity must have at most one decimal place",
});

export const cropUnitSchema = z.literal("KG");
export const cropGradeGuideSchema = z.object({
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
}).strict();

export const cropResponseSchema = z.object({
  id: databaseIdSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().min(1),
  nameBn: z.string().min(1),
  unit: cropUnitSchema,
  minLotKg: z.number().positive(),
  maxLotKg: z.number().positive(),
  shelfLifeHours: z.number().positive(),
  gradeGuide: cropGradeGuideSchema,
  minIncrementPerKg: z.number().int().positive().default(100),
  imageUrl: z.union([z.string().url(), z.string().startsWith("/")]),
}).strict().refine((crop) => crop.minLotKg <= crop.maxLotKg, {
  path: ["maxLotKg"],
  message: "Maximum lot size must be at least the minimum lot size",
});

export const inventorySummaryItemSchema = z.object({
  crop: cropResponseSchema,
  availableKg: z.number().nonnegative(),
  listedKg: z.number().nonnegative(),
  soldKg: z.number().nonnegative(),
}).strict();

export const addStockRequestSchema = z.object({
  cropId: databaseIdSchema,
  quantityKg: inventoryQuantityKgSchema,
  note: z.string().trim().max(200).optional(),
}).strict();

export const stockMovementTypeSchema = z.enum([
  StockMovementType.ADD,
  StockMovementType.LIST,
  StockMovementType.RELEASE,
  StockMovementType.SELL,
  StockMovementType.ADJUST,
]);

export const stockMovementResponseSchema = z.object({
  id: databaseIdSchema,
  farmerId: databaseIdSchema,
  cropId: databaseIdSchema,
  type: stockMovementTypeSchema,
  quantityKg: z.number().positive(),
  listingId: databaseIdSchema.optional(),
  orderId: databaseIdSchema.optional(),
  note: z.string().max(200).optional(),
  createdAt: z.iso.datetime(),
}).strict();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const emptyQuerySchema = z.object({}).strict();
export const stockMovementQuerySchema = paginationQuerySchema.extend({ cropId: databaseIdSchema }).strict();

export type CropResponse = z.infer<typeof cropResponseSchema>;
export type InventorySummaryItem = z.infer<typeof inventorySummaryItemSchema>;
export type AddStockRequest = z.infer<typeof addStockRequestSchema>;
export type StockMovementResponse = z.infer<typeof stockMovementResponseSchema>;
export type StockMovement = z.infer<typeof stockMovementTypeSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;

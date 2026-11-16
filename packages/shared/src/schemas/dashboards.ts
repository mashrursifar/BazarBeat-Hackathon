import { z } from "zod";

/**
 * Standardized dashboard range presets.
 */
export const DASHBOARD_RANGE_PRESETS = ["7d", "30d", "90d", "1y", "all"] as const;
export type DashboardRangePreset = (typeof DASHBOARD_RANGE_PRESETS)[number];
export const dashboardRangePresetSchema = z.enum(DASHBOARD_RANGE_PRESETS);

/**
 * Bucket granularities for time-series charts.
 */
export const BUCKET_GRANULARITIES = ["day", "week", "month"] as const;
export type BucketGranularity = (typeof BUCKET_GRANULARITIES)[number];
export const bucketGranularitySchema = z.enum(BUCKET_GRANULARITIES);

/**
 * Specification rule for a dashboard range preset.
 */
export interface RangePresetRule {
  preset: DashboardRangePreset;
  days: number | null;
  granularity: BucketGranularity;
  bucketFormat: "YYYY-MM-DD" | "YYYY-[W]WW" | "YYYY-MM";
  hasPreviousPeriod: boolean;
}

/**
 * Mapping of dashboard presets to their bucketing and period-comparison rules.
 */
export const DASHBOARD_BUCKET_RULES: Record<DashboardRangePreset, RangePresetRule> = {
  "7d": {
    preset: "7d",
    days: 7,
    granularity: "day",
    bucketFormat: "YYYY-MM-DD",
    hasPreviousPeriod: true,
  },
  "30d": {
    preset: "30d",
    days: 30,
    granularity: "day",
    bucketFormat: "YYYY-MM-DD",
    hasPreviousPeriod: true,
  },
  "90d": {
    preset: "90d",
    days: 90,
    granularity: "day",
    bucketFormat: "YYYY-MM-DD",
    hasPreviousPeriod: true,
  },
  "1y": {
    preset: "1y",
    days: 365,
    granularity: "month",
    bucketFormat: "YYYY-MM",
    hasPreviousPeriod: true,
  },
  all: {
    preset: "all",
    days: null,
    granularity: "month",
    bucketFormat: "YYYY-MM",
    hasPreviousPeriod: false,
  },
};

/**
 * KPI Metric Schema:
 * Carries current value and optional previous value for period-over-period change.
 * Optional changePercent is computed as ((value - previous) / previous) * 100
 * and is null when previous is zero (no delta when previous is zero).
 */
export const kpiMetricSchema = z.object({
  value: z.number(),
  previous: z.number().nullable().optional(),
  changePercent: z.number().nullable().optional(),
});
export type KpiMetric = z.infer<typeof kpiMetricSchema>;

// Alias for flexibility
export const kpiValueSchema = kpiMetricSchema;
export type KpiValue = KpiMetric;

/**
 * Common metadata returned in dashboard responses.
 */
export const dashboardMetaSchema = z.object({
  serverTime: z.string(),
  range: dashboardRangePresetSchema,
  granularity: bucketGranularitySchema,
  timezone: z.literal("Asia/Dhaka").default("Asia/Dhaka"),
});
export type DashboardMeta = z.infer<typeof dashboardMetaSchema>;

// ==========================================
// Farmer Dashboard Schemas
// ==========================================

export const farmerSalesTrendBucketSchema = z.object({
  bucket: z.string(),
  date: z.string(),
  sales: z.number().int().nonnegative(), // integer poisha
  quantityKg: z.number().nonnegative(),
  orderCount: z.number().int().nonnegative(),
});
export type FarmerSalesTrendBucket = z.infer<typeof farmerSalesTrendBucketSchema>;

export const farmerEarningsByCropSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string().optional(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  quantityKg: z.number().nonnegative(),
  totalSales: z.number().int().nonnegative(), // gross in integer poisha
  earnings: z.number().int().nonnegative(), // net in integer poisha
  orderCount: z.number().int().nonnegative(),
});
export type FarmerEarningsByCrop = z.infer<typeof farmerEarningsByCropSchema>;

export const farmerTopCropSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string().optional(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  quantityKg: z.number().nonnegative(),
  totalSales: z.number().int().nonnegative(), // in integer poisha
  earnings: z.number().int().nonnegative(), // in integer poisha
  orderCount: z.number().int().nonnegative(),
});
export type FarmerTopCrop = z.infer<typeof farmerTopCropSchema>;

export const farmerEndingSoonAuctionSchema = z.object({
  id: z.string(),
  cropId: z.string(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  grade: z.string(),
  quantityKg: z.number().positive(),
  floorPricePerKg: z.number().int().positive(),
  currentBidPerKg: z.number().int().positive(),
  bidCount: z.number().int().nonnegative(),
  endsAt: z.string(),
  status: z.string(),
});
export type FarmerEndingSoonAuction = z.infer<typeof farmerEndingSoonAuctionSchema>;

export const farmerDashboardKpiSetSchema = z.object({
  totalSales: kpiMetricSchema, // integer poisha
  earnings: kpiMetricSchema, // integer poisha
  activeAuctions: kpiMetricSchema, // count
  pendingOrders: kpiMetricSchema, // count
  winRate: kpiMetricSchema, // percentage (0..100)
  topCrop: farmerTopCropSchema.nullable().optional(),
});
export type FarmerDashboardKpiSet = z.infer<typeof farmerDashboardKpiSetSchema>;

export const farmerDashboardDataSchema = z.object({
  kpis: farmerDashboardKpiSetSchema,
  salesTrend: z.array(farmerSalesTrendBucketSchema),
  earningsByCrop: z.array(farmerEarningsByCropSchema),
  endingSoonAuctions: z.array(farmerEndingSoonAuctionSchema).optional(),
});
export type FarmerDashboardData = z.infer<typeof farmerDashboardDataSchema>;

export const farmerDashboardResponseSchema = z.object({
  data: farmerDashboardDataSchema,
  meta: dashboardMetaSchema,
});
export type FarmerDashboardResponse = z.infer<typeof farmerDashboardResponseSchema>;

// ==========================================
// Buyer Dashboard Schemas
// ==========================================

export const buyerSpendTrendBucketSchema = z.object({
  bucket: z.string(),
  date: z.string(),
  spend: z.number().int().nonnegative(), // integer poisha
  quantityKg: z.number().nonnegative(),
  orderCount: z.number().int().nonnegative(),
});
export type BuyerSpendTrendBucket = z.infer<typeof buyerSpendTrendBucketSchema>;

export const buyerPurchasesByCropSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string().optional(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  quantityKg: z.number().nonnegative(),
  totalSpend: z.number().int().nonnegative(), // in integer poisha
  orderCount: z.number().int().nonnegative(),
});
export type BuyerPurchasesByCrop = z.infer<typeof buyerPurchasesByCropSchema>;

export const buyerActiveBidItemSchema = z.object({
  listingId: z.string(),
  cropId: z.string(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  grade: z.string(),
  myBidPerKg: z.number().int().positive(),
  currentBidPerKg: z.number().int().positive(),
  bidCount: z.number().int().positive(),
  endsAt: z.string(),
  status: z.enum(["WINNING", "OUTBID"]),
});
export type BuyerActiveBidItem = z.infer<typeof buyerActiveBidItemSchema>;

export const buyerDashboardKpiSetSchema = z.object({
  totalSpend: kpiMetricSchema, // integer poisha
  activeBids: kpiMetricSchema, // count
  winRate: kpiMetricSchema, // percentage (0..100)
  avgPriceVsMarket: kpiMetricSchema, // percentage premium/discount vs AI market estimate
  pendingOrders: kpiMetricSchema, // count
});
export type BuyerDashboardKpiSet = z.infer<typeof buyerDashboardKpiSetSchema>;

export const buyerDashboardDataSchema = z.object({
  kpis: buyerDashboardKpiSetSchema,
  spendTrend: z.array(buyerSpendTrendBucketSchema),
  purchasesByCrop: z.array(buyerPurchasesByCropSchema),
  activeBidsList: z.array(buyerActiveBidItemSchema).optional(),
});
export type BuyerDashboardData = z.infer<typeof buyerDashboardDataSchema>;

export const buyerDashboardResponseSchema = z.object({
  data: buyerDashboardDataSchema,
  meta: dashboardMetaSchema,
});
export type BuyerDashboardResponse = z.infer<typeof buyerDashboardResponseSchema>;

// ==========================================
// Market History Schemas
// ==========================================

export const marketPriceTrendSchema = z.enum(["UP", "DOWN", "FLAT"]);
export type MarketPriceTrend = z.infer<typeof marketPriceTrendSchema>;

export const marketHistoryPointSchema = z.object({
  date: z.string(),
  avgPricePerKg: z.number().int().positive(),
  minPricePerKg: z.number().int().positive(),
  maxPricePerKg: z.number().int().positive(),
  source: z.string().optional(),
});
export type MarketHistoryPoint = z.infer<typeof marketHistoryPointSchema>;

export const marketHistoryDataSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string().optional(),
  cropName: z.string().optional(),
  cropNameBn: z.string().optional(),
  division: z.string().optional(),
  range: dashboardRangePresetSchema,
  trend: marketPriceTrendSchema,
  currentAvgPricePerKg: z.number().int().positive(),
  minPricePerKg: z.number().int().positive(),
  maxPricePerKg: z.number().int().positive(),
  changePercent: z.number().nullable().optional(),
  series: z.array(marketHistoryPointSchema),
});
export type MarketHistoryData = z.infer<typeof marketHistoryDataSchema>;

export const marketHistoryResponseSchema = z.object({
  data: marketHistoryDataSchema,
  meta: z.object({
    serverTime: z.string(),
    cropId: z.string(),
    division: z.string().optional(),
    range: dashboardRangePresetSchema,
  }),
});
export type MarketHistoryResponse = z.infer<typeof marketHistoryResponseSchema>;

// ==========================================
// Market Summary Schemas
// ==========================================

export const marketSummaryItemSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  division: z.string().optional(),
  currentAvgPricePerKg: z.number().int().positive(),
  minPricePerKg: z.number().int().positive(),
  maxPricePerKg: z.number().int().positive(),
  trend: marketPriceTrendSchema,
  priceChange7dPercent: z.number().nullable().optional(),
  activeListingsCount: z.number().int().nonnegative().default(0),
  lastUpdated: z.string(),
});
export type MarketSummaryItem = z.infer<typeof marketSummaryItemSchema>;

export const marketSummaryDataSchema = z.object({
  items: z.array(marketSummaryItemSchema),
});
export type MarketSummaryData = z.infer<typeof marketSummaryDataSchema>;

export const marketSummaryResponseSchema = z.object({
  data: marketSummaryDataSchema,
  meta: z.object({
    serverTime: z.string(),
    totalCrops: z.number().int().nonnegative(),
  }),
});
export type MarketSummaryResponse = z.infer<typeof marketSummaryResponseSchema>;

// ==========================================
// National Summary Schemas
// ==========================================

export const nationalSummaryCropItemSchema = z.object({
  cropId: z.string(),
  cropSlug: z.string(),
  cropName: z.string(),
  cropNameBn: z.string().optional(),
  avgPricePerKg: z.number().int().positive(),
  minPricePerKg: z.number().int().positive(),
  maxPricePerKg: z.number().int().positive(),
  activeListingsCount: z.number().int().nonnegative().default(0),
  completedSalesCount: z.number().int().nonnegative().default(0),
});
export type NationalSummaryCropItem = z.infer<typeof nationalSummaryCropItemSchema>;

export const nationalSummaryDivisionItemSchema = z.object({
  division: z.string(),
  divisionBn: z.string().optional(),
  crops: z.array(nationalSummaryCropItemSchema),
});
export type NationalSummaryDivisionItem = z.infer<typeof nationalSummaryDivisionItemSchema>;

export const nationalSummaryDataSchema = z.object({
  divisions: z.array(nationalSummaryDivisionItemSchema),
});
export type NationalSummaryData = z.infer<typeof nationalSummaryDataSchema>;

export const nationalSummaryResponseSchema = z.object({
  data: nationalSummaryDataSchema,
  meta: z.object({
    serverTime: z.string(),
    totalDivisions: z.number().int().nonnegative(),
  }),
});
export type NationalSummaryResponse = z.infer<typeof nationalSummaryResponseSchema>;

// ==========================================
// Query Schemas
// ==========================================

export const dashboardQuerySchema = z.object({
  range: dashboardRangePresetSchema.optional().default("30d"),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const marketPriceQuerySchema = z.object({
  cropId: z.string().min(1, "cropId is required"),
  division: z.string().optional(),
  range: dashboardRangePresetSchema.optional().default("30d"),
});
export type MarketPriceQuery = z.infer<typeof marketPriceQuerySchema>;

export const marketSummaryQuerySchema = z.object({
  cropId: z.string().optional(),
  division: z.string().optional(),
});
export type MarketSummaryQuery = z.infer<typeof marketSummaryQuerySchema>;

export const nationalSummaryQuerySchema = z.object({
  cropId: z.string().optional(),
});
export type NationalSummaryQuery = z.infer<typeof nationalSummaryQuerySchema>;

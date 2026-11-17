import { ObjectId } from "bson";
import type mongoose from "mongoose";
import {
  BANGLADESH_DIVISIONS,
  CropGrade,
  type DashboardRangePreset,
  ListingStatus,
  type MarketGradeGuide,
  type MarketGradeGuideItem,
  type MarketHistoryData,
  type MarketHistoryPoint,
  type MarketHistoryResponse,
  MarketPriceSource,
  type MarketPriceTrend,
  type MarketSummaryItem,
  type MarketSummaryResponse,
  type NationalSummaryCropItem,
  type NationalSummaryDivisionItem,
  type NationalSummaryResponse,
  OrderStatus,
  calculatePercentChange,
  getAsiaDhakaBucketKey,
  getRangeBucketKeys,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import { getPricePredictionProvider } from "../ai/ai.service.js";
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";
import { marketPriceCache } from "./market-price-cache.js";
import { MARKET_PRICE_BASE_PRICES } from "./market-price-seed.js";
import { MarketPrice, type MarketPriceRecord } from "./market-price.model.js";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function getRecentMarketPrices(
  cropId: string,
  division?: string,
  limit = 60,
): Promise<MarketPriceRecord[]> {
  const query: Record<string, unknown> = { cropId };
  if (division) {
    query.division = division.trim().toLowerCase();
  }
  return MarketPrice.find(query)
    .sort({ date: -1 })
    .limit(limit)
    .lean<MarketPriceRecord[]>();
}

/**
 * Records or updates a PLATFORM market price record for a completed auction sale.
 * AUCTION_RULES §8 & DATA_MODEL (MarketPrice):
 * Unique on (cropId, division, date, source). Platform-derived rows are written when auctions close.
 */
export async function recordPlatformSalePrice(
  cropId: string,
  division: string,
  pricePerKg: number,
  soldAt: Date,
  session?: mongoose.ClientSession,
): Promise<void> {
  const utcDay = new Date(Date.UTC(soldAt.getUTCFullYear(), soldAt.getUTCMonth(), soldAt.getUTCDate()));
  const normalizedDivision = division.trim().toLowerCase();

  const filter = {
    cropId,
    division: normalizedDivision,
    date: utcDay,
    source: MarketPriceSource.PLATFORM,
  };

  const existing = await MarketPrice.findOne(filter, null, session ? { session } : {});
  if (!existing) {
    try {
      await MarketPrice.create(
        [
          {
            cropId,
            division: normalizedDivision,
            date: utcDay,
            avgPricePerKg: pricePerKg,
            minPricePerKg: pricePerKg,
            maxPricePerKg: pricePerKg,
            source: MarketPriceSource.PLATFORM,
          },
        ],
        session ? { session } : {},
      );
      return;
    } catch (err: unknown) {
      if (!isDuplicateKey(err)) throw err;
      // Concurrent insert or re-run
    }
  }

  const current = existing ?? (await MarketPrice.findOne(filter, null, session ? { session } : {}));
  if (current) {
    const newMin = Math.min(current.minPricePerKg, pricePerKg);
    const newMax = Math.max(current.maxPricePerKg, pricePerKg);
    const newAvg = Math.round((current.avgPricePerKg + pricePerKg) / 2);

    await MarketPrice.updateOne(
      { _id: current._id },
      {
        $set: {
          minPricePerKg: newMin,
          maxPricePerKg: newMax,
          avgPricePerKg: newAvg,
        },
      },
      session ? { session } : {},
    );
  }
}

/**
 * Helper to get or predict price guidance for a specific crop/grade/division,
 * caching results in memory for 10 minutes keyed by crop, division, date, and grade.
 */
async function getOrPredictGradeGuidance(
  cropId: string,
  grade: CropGrade,
  division: string | undefined,
  dateKey: string,
): Promise<{
  guidance: Awaited<ReturnType<ReturnType<typeof getPricePredictionProvider>["predictPrice"]>>;
  cached: boolean;
}> {
  const cacheKey = marketPriceCache.buildKey(cropId, division, dateKey, grade);
  const cached = marketPriceCache.get<Awaited<ReturnType<ReturnType<typeof getPricePredictionProvider>["predictPrice"]>>>(cacheKey);
  if (cached) {
    return { guidance: cached, cached: true };
  }

  const guidance = await getPricePredictionProvider().predictPrice(
    { cropId, grade, quantityKg: 100 },
    division,
  );
  marketPriceCache.set(cacheKey, guidance);
  return { guidance, cached: false };
}

/**
 * Helper to get or predict benchmark cell price when a crop/division cell has no active listings,
 * cached for 10 minutes keyed by crop, division, date, and "cell".
 */
async function getOrPredictCellBenchmark(
  cropId: string,
  division: string | undefined,
  dateKey: string,
): Promise<{ expectedPerKg: number; lowPerKg: number; highPerKg: number; trend: MarketPriceTrend }> {
  const cacheKey = marketPriceCache.buildKey(cropId, division, dateKey, "cell");
  const cached = marketPriceCache.get<{
    expectedPerKg: number;
    lowPerKg: number;
    highPerKg: number;
    trend: MarketPriceTrend;
  }>(cacheKey);
  if (cached) {
    return cached;
  }

  const guidance = await getPricePredictionProvider().predictPrice(
    { cropId, grade: CropGrade.B, quantityKg: 100 },
    division,
  );

  const result = {
    expectedPerKg: guidance.expectedPerKg,
    lowPerKg: guidance.lowPerKg,
    highPerKg: guidance.highPerKg,
    trend: guidance.trend as MarketPriceTrend,
  };
  marketPriceCache.set(cacheKey, result);
  return result;
}

export class MarketPriceService {
  /**
   * GET /market-prices?cropId&division&range
   * Returns price history and trend for a crop and division (or national mean when division is omitted),
   * along with a grade guide calling the price provider for grades A, B, and C.
   */
  public async getMarketHistory(
    cropId: string,
    division?: string,
    range: DashboardRangePreset = "30d",
  ): Promise<MarketHistoryResponse> {
    if (!ObjectId.isValid(cropId)) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const crop = await Crop.findById(cropId).lean();
    if (!crop || !crop.isActive) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const normalizedDivision = division ? division.trim().toLowerCase() : undefined;
    if (normalizedDivision) {
      const isValidDiv = BANGLADESH_DIVISIONS.some((d) => d.id === normalizedDivision);
      if (!isValidDiv) {
        throw new AppError(400, "VALIDATION_ERROR", `Invalid division: ${division}`);
      }
    }

    const clock = getClock();
    const now = clock.now();
    const dateKey = now.toISOString().slice(0, 10);

    // 1. Calculate time windows and bucket keys
    const { currentWindow, currentKeys, granularity } = getRangeBucketKeys(range, now);

    // 2. Query MarketPrice records within the window
    const priceQuery: Record<string, unknown> = {
      cropId: new ObjectId(cropId),
      date: { $gte: currentWindow.start, $lte: currentWindow.end },
    };
    if (normalizedDivision) {
      priceQuery.division = normalizedDivision;
    }

    const rawRecords = await MarketPrice.find(priceQuery).sort({ date: 1, source: -1 }).lean();

    // 3. Aggregate records by bucket key
    const bucketsMap = new Map<
      string,
      { avgPricePerKg: number; minPricePerKg: number; maxPricePerKg: number; source?: string }
    >();

    if (normalizedDivision) {
      // Division-specific series: if multiple records fall into same bucket, PLATFORM takes precedence
      for (const rec of rawRecords) {
        const bucket = getAsiaDhakaBucketKey(rec.date, granularity);
        if (!bucketsMap.has(bucket) || rec.source === MarketPriceSource.PLATFORM) {
          bucketsMap.set(bucket, {
            avgPricePerKg: rec.avgPricePerKg,
            minPricePerKg: rec.minPricePerKg,
            maxPricePerKg: rec.maxPricePerKg,
            source: rec.source,
          });
        }
      }
    } else {
      // National mean: group all division records per bucket and calculate arithmetic mean
      const bucketGroups = new Map<string, { sumAvg: number; count: number; min: number; max: number; hasPlatform: boolean }>();
      for (const rec of rawRecords) {
        const bucket = getAsiaDhakaBucketKey(rec.date, granularity);
        const group = bucketGroups.get(bucket) ?? {
          sumAvg: 0,
          count: 0,
          min: Number.POSITIVE_INFINITY,
          max: Number.NEGATIVE_INFINITY,
          hasPlatform: false,
        };
        group.sumAvg += rec.avgPricePerKg;
        group.count += 1;
        group.min = Math.min(group.min, rec.minPricePerKg);
        group.max = Math.max(group.max, rec.maxPricePerKg);
        if (rec.source === MarketPriceSource.PLATFORM) group.hasPlatform = true;
        bucketGroups.set(bucket, group);
      }

      for (const [bucket, group] of bucketGroups.entries()) {
        bucketsMap.set(bucket, {
          avgPricePerKg: group.count > 0 ? Math.round(group.sumAvg / group.count) : 0,
          minPricePerKg: Number.isFinite(group.min) ? group.min : 0,
          maxPricePerKg: Number.isFinite(group.max) ? group.max : 0,
          source: group.hasPlatform ? MarketPriceSource.PLATFORM : MarketPriceSource.SEED,
        });
      }
    }

    // 4. Chronologically fill series across currentKeys (LOCF / forward-fill)
    let lastKnown:
      | { avgPricePerKg: number; minPricePerKg: number; maxPricePerKg: number; source?: string }
      | undefined;

    // Check first available in bucketsMap for back-filling
    if (bucketsMap.size > 0) {
      for (const key of currentKeys) {
        const found = bucketsMap.get(key);
        if (found) {
          lastKnown = found;
          break;
        }
      }
    }

    // If still undefined, search for prior historical record
    if (!lastKnown) {
      const priorQuery: Record<string, unknown> = { cropId: new ObjectId(cropId) };
      if (normalizedDivision) priorQuery.division = normalizedDivision;
      const prior = await MarketPrice.findOne(priorQuery).sort({ date: -1 }).lean();
      if (prior) {
        lastKnown = {
          avgPricePerKg: prior.avgPricePerKg,
          minPricePerKg: prior.minPricePerKg,
          maxPricePerKg: prior.maxPricePerKg,
          source: prior.source,
        };
      } else {
        const base =
          MARKET_PRICE_BASE_PRICES[crop.slug as keyof typeof MARKET_PRICE_BASE_PRICES] ?? 5_000;
        lastKnown = {
          avgPricePerKg: base,
          minPricePerKg: Math.round(base * 0.95),
          maxPricePerKg: Math.round(base * 1.05),
          source: MarketPriceSource.SEED,
        };
      }
    }

    const series: MarketHistoryPoint[] = [];
    for (const bucket of currentKeys) {
      const current = bucketsMap.get(bucket);
      if (current) {
        lastKnown = current;
      }
      series.push({
        date: bucket,
        avgPricePerKg: lastKnown.avgPricePerKg,
        minPricePerKg: lastKnown.minPricePerKg,
        maxPricePerKg: lastKnown.maxPricePerKg,
        source: lastKnown.source,
      });
    }

    // 5. Calculate summary metrics
    const latestPoint = series[series.length - 1];
    const firstPoint = series[0];
    const currentAvgPricePerKg = latestPoint?.avgPricePerKg ?? 0;
    const minPricePerKg = series.length > 0 ? Math.min(...series.map((s) => s.minPricePerKg)) : 0;
    const maxPricePerKg = series.length > 0 ? Math.max(...series.map((s) => s.maxPricePerKg)) : 0;
    const startPrice = firstPoint?.avgPricePerKg ?? currentAvgPricePerKg;
    const changePercent = calculatePercentChange(currentAvgPricePerKg, startPrice);

    let trend: MarketPriceTrend = "FLAT";
    if (changePercent !== null) {
      if (changePercent > 1.0) trend = "UP";
      else if (changePercent < -1.0) trend = "DOWN";
    }

    // 6. Generate Grade Guide for A, B, and C calling price provider with caching
    const [guideA, guideB, guideC] = await Promise.all([
      getOrPredictGradeGuidance(crop._id.toString(), CropGrade.A, normalizedDivision, dateKey),
      getOrPredictGradeGuidance(crop._id.toString(), CropGrade.B, normalizedDivision, dateKey),
      getOrPredictGradeGuidance(crop._id.toString(), CropGrade.C, normalizedDivision, dateKey),
    ]);

    const buildGradeItem = (
      grade: CropGrade,
      guidance: typeof guideA.guidance,
    ): MarketGradeGuideItem => ({
      grade,
      description: crop.gradeGuide?.[grade] ?? "",
      expectedPerKg: guidance.expectedPerKg,
      lowPerKg: guidance.lowPerKg,
      highPerKg: guidance.highPerKg,
      suggestedFloorPerKg: guidance.suggestedFloorPerKg,
      trend: guidance.trend as MarketPriceTrend,
      confidence: guidance.confidence,
      explanation: guidance.explanation,
      modelVersion: guidance.modelVersion,
      provider: guidance.provider,
      degraded: guidance.degraded,
      generatedAt: guidance.generatedAt,
    });

    const gradeGuide: MarketGradeGuide = {
      A: buildGradeItem(CropGrade.A, guideA.guidance),
      B: buildGradeItem(CropGrade.B, guideB.guidance),
      C: buildGradeItem(CropGrade.C, guideC.guidance),
    };

    const data: MarketHistoryData = {
      cropId: crop._id.toString(),
      cropSlug: crop.slug,
      cropName: crop.nameEn,
      cropNameBn: crop.nameBn,
      ...(normalizedDivision ? { division: normalizedDivision } : {}),
      range,
      trend,
      currentAvgPricePerKg,
      minPricePerKg,
      maxPricePerKg,
      changePercent,
      series,
      gradeGuide,
    };

    return {
      data,
      meta: {
        serverTime: now.toISOString(),
        cropId: crop._id.toString(),
        ...(normalizedDivision ? { division: normalizedDivision } : {}),
        range,
      },
    };
  }

  /**
   * GET /market-prices/summary?division&cropId
   * Market summary across crops: computed from ACTIVE listings using quantity-weighted averages.
   * If a crop has no active listings, benchmark prices are pulled from the price provider
   * and cached in memory for 10 minutes.
   */
  public async getMarketSummary(
    division?: string,
    cropId?: string,
  ): Promise<MarketSummaryResponse> {
    const normalizedDivision = division ? division.trim().toLowerCase() : undefined;
    if (normalizedDivision) {
      const isValidDiv = BANGLADESH_DIVISIONS.some((d) => d.id === normalizedDivision);
      if (!isValidDiv) {
        throw new AppError(400, "VALIDATION_ERROR", `Invalid division: ${division}`);
      }
    }

    if (cropId && !ObjectId.isValid(cropId)) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const cropFilter: Record<string, unknown> = { isActive: true };
    if (cropId) {
      cropFilter._id = new ObjectId(cropId);
    }

    const crops = await Crop.find(cropFilter).sort({ _id: 1 }).lean();
    if (cropId && crops.length === 0) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const clock = getClock();
    const now = clock.now();
    const dateKey = now.toISOString().slice(0, 10);

    const items: MarketSummaryItem[] = [];

    for (const crop of crops) {
      const listingQuery: Record<string, unknown> = {
        cropId: crop._id,
        status: ListingStatus.ACTIVE,
      };
      if (normalizedDivision) {
        listingQuery["location.division"] = normalizedDivision;
      }

      const activeListings = await Listing.find(listingQuery).lean();

      if (activeListings.length > 0) {
        // Weighted listing average: sum(qty * price) / sum(qty)
        const totalQty = activeListings.reduce((sum, l) => sum + l.quantityKg, 0);
        const totalAmount = activeListings.reduce(
          (sum, l) => sum + l.quantityKg * (l.currentBidPerKg ?? l.floorPricePerKg),
          0,
        );
        const currentAvgPricePerKg =
          totalQty > 0
            ? Math.round(totalAmount / totalQty)
            : (activeListings[0].currentBidPerKg ?? activeListings[0].floorPricePerKg);

        const prices = activeListings.map((l) => l.currentBidPerKg ?? l.floorPricePerKg);
        const minPricePerKg = Math.min(...prices);
        const maxPricePerKg = Math.max(...prices);

        // Calculate 7d trend and price change from recent MarketPrice history
        const recentRows = await getRecentMarketPrices(crop._id.toString(), normalizedDivision, 14);
        let priceChange7dPercent: number | null = null;
        let trend: MarketPriceTrend = "FLAT";

        if (recentRows.length >= 7) {
          const recent7 = recentRows.slice(0, 7);
          const prev7 = recentRows.slice(7);
          const avgRecent = recent7.reduce((s, r) => s + r.avgPricePerKg, 0) / recent7.length;
          const avgPrev =
            prev7.length > 0
              ? prev7.reduce((s, r) => s + r.avgPricePerKg, 0) / prev7.length
              : null;
          priceChange7dPercent = avgPrev !== null ? calculatePercentChange(avgRecent, avgPrev) : null;
          if (priceChange7dPercent !== null) {
            if (priceChange7dPercent > 1.0) trend = "UP";
            else if (priceChange7dPercent < -1.0) trend = "DOWN";
          }
        }

        items.push({
          cropId: crop._id.toString(),
          cropSlug: crop.slug,
          cropName: crop.nameEn,
          cropNameBn: crop.nameBn,
          ...(normalizedDivision ? { division: normalizedDivision } : {}),
          currentAvgPricePerKg,
          minPricePerKg,
          maxPricePerKg,
          trend,
          priceChange7dPercent,
          activeListingsCount: activeListings.length,
          lastUpdated: now.toISOString(),
        });
      } else {
        // Cells with no listings: pull benchmark from provider and cache for 10 minutes
        const benchmark = await getOrPredictCellBenchmark(
          crop._id.toString(),
          normalizedDivision,
          dateKey,
        );

        items.push({
          cropId: crop._id.toString(),
          cropSlug: crop.slug,
          cropName: crop.nameEn,
          cropNameBn: crop.nameBn,
          ...(normalizedDivision ? { division: normalizedDivision } : {}),
          currentAvgPricePerKg: benchmark.expectedPerKg,
          minPricePerKg: benchmark.lowPerKg,
          maxPricePerKg: benchmark.highPerKg,
          trend: benchmark.trend,
          priceChange7dPercent: null,
          activeListingsCount: 0,
          lastUpdated: now.toISOString(),
        });
      }
    }

    return {
      data: { items },
      meta: {
        serverTime: now.toISOString(),
        totalCrops: items.length,
      },
    };
  }

  /**
   * GET /market-prices/national-summary?cropId
   * Avg listing and completed sale prices per crop per division across all 8 divisions.
   * Computed from ACTIVE listings using weighted listing averages.
   * Cells with no listings fall back to provider estimates cached for 10 minutes.
   */
  public async getNationalSummary(cropId?: string): Promise<NationalSummaryResponse> {
    if (cropId && !ObjectId.isValid(cropId)) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const cropFilter: Record<string, unknown> = { isActive: true };
    if (cropId) {
      cropFilter._id = new ObjectId(cropId);
    }

    const crops = await Crop.find(cropFilter).sort({ _id: 1 }).lean();
    if (cropId && crops.length === 0) {
      throw new AppError(404, "NOT_FOUND", "Crop not found");
    }

    const cropIds = crops.map((c) => c._id);
    const clock = getClock();
    const now = clock.now();
    const dateKey = now.toISOString().slice(0, 10);

    // 1. Fetch all ACTIVE listings for relevant crops
    const allActiveListings = await Listing.find({
      cropId: { $in: cropIds },
      status: ListingStatus.ACTIVE,
    }).lean();

    // 2. Fetch completed sales counts grouped by cropId and division
    const salesAggregation = (await Order.aggregate([
      {
        $match: {
          cropId: { $in: cropIds },
          status: OrderStatus.COMPLETED,
        },
      },
      {
        $lookup: {
          from: "listings",
          localField: "listingId",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "farmerId",
          foreignField: "_id",
          as: "farmer",
        },
      },
      {
        $project: {
          cropId: 1,
          division: {
            $toLower: {
              $ifNull: [
                { $arrayElemAt: ["$listing.location.division", 0] },
                { $arrayElemAt: ["$farmer.division", 0] },
                "unknown",
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: {
            cropId: { $toString: "$cropId" },
            division: "$division",
          },
          count: { $sum: 1 },
        },
      },
    ])) as { _id: { cropId: string; division: string }; count: number }[];

    const salesCountMap = new Map<string, number>();
    for (const record of salesAggregation) {
      salesCountMap.set(`${record._id.cropId}:${record._id.division}`, record.count);
    }

    // 3. Assemble response for each of the 8 divisions
    const divisions: NationalSummaryDivisionItem[] = [];

    for (const division of BANGLADESH_DIVISIONS) {
      const cropsForDivision: NationalSummaryCropItem[] = [];

      for (const crop of crops) {
        const cropIdStr = crop._id.toString();
        const activeListings = allActiveListings.filter(
          (l) =>
            l.cropId.toString() === cropIdStr &&
            l.location?.division?.toLowerCase().trim() === division.id,
        );

        const completedSalesCount = salesCountMap.get(`${cropIdStr}:${division.id}`) ?? 0;

        if (activeListings.length > 0) {
          const totalQty = activeListings.reduce((sum, l) => sum + l.quantityKg, 0);
          const totalAmount = activeListings.reduce(
            (sum, l) => sum + l.quantityKg * (l.currentBidPerKg ?? l.floorPricePerKg),
            0,
          );
          const avgPricePerKg =
            totalQty > 0
              ? Math.round(totalAmount / totalQty)
              : (activeListings[0].currentBidPerKg ?? activeListings[0].floorPricePerKg);

          const prices = activeListings.map((l) => l.currentBidPerKg ?? l.floorPricePerKg);
          const minPricePerKg = Math.min(...prices);
          const maxPricePerKg = Math.max(...prices);

          cropsForDivision.push({
            cropId: cropIdStr,
            cropSlug: crop.slug,
            cropName: crop.nameEn,
            cropNameBn: crop.nameBn,
            avgPricePerKg,
            minPricePerKg,
            maxPricePerKg,
            activeListingsCount: activeListings.length,
            completedSalesCount,
          });
        } else {
          // Cell with no active listings: fetch benchmark from provider cached for 10 minutes
          const benchmark = await getOrPredictCellBenchmark(cropIdStr, division.id, dateKey);

          cropsForDivision.push({
            cropId: cropIdStr,
            cropSlug: crop.slug,
            cropName: crop.nameEn,
            cropNameBn: crop.nameBn,
            avgPricePerKg: benchmark.expectedPerKg,
            minPricePerKg: benchmark.lowPerKg,
            maxPricePerKg: benchmark.highPerKg,
            activeListingsCount: 0,
            completedSalesCount,
          });
        }
      }

      divisions.push({
        division: division.id,
        divisionBn: division.nameBn,
        crops: cropsForDivision,
      });
    }

    return {
      data: { divisions },
      meta: {
        serverTime: now.toISOString(),
        totalDivisions: divisions.length,
      },
    };
  }
}

export const marketPriceService = new MarketPriceService();

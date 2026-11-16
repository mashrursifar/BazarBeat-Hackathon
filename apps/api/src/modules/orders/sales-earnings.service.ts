import { ObjectId } from "bson";
import {
  type EarningsCropSummary,
  type EarningsData,
  type EarningsMonthlySeriesItem,
  type EarningsRecentPayout,
  OrderStatus,
  type PricePremiumItem,
  type SaleItem,
  type SalesQuery,
  type SalesResponse,
  type SalesTotals,
  calculatePricePremium,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { Crop, type CropRecord } from "../crops/crop.model.js";
import { User, type UserRecord } from "../users/user.model.js";
import { Order } from "./order.model.js";

type WithId<T> = T & { _id: { toString(): string } };

/**
 * Calculates civil year and 1-based month in Asia/Dhaka (UTC+6).
 */
export function getAsiaDhakaYearMonth(date: Date): { year: number; month: number } {
  // Asia/Dhaka is permanently UTC+6 with no daylight saving time.
  const dhakaMs = date.getTime() + 6 * 60 * 60 * 1000;
  const dhakaDate = new Date(dhakaMs);
  return {
    year: dhakaDate.getUTCFullYear(),
    month: dhakaDate.getUTCMonth() + 1,
  };
}

/**
 * Builds the array of the last N calendar months (in Asia/Dhaka time) ending at reference date.
 */
export function buildRecentMonthsList(
  referenceDate: Date,
  count = 6,
): { month: string; year: number; monthIndex: number }[] {
  const { year: currentYear, month: currentMonth } = getAsiaDhakaYearMonth(referenceDate);
  const result: { month: string; year: number; monthIndex: number }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    let y = currentYear;
    let m = currentMonth - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const monthStr = `${y}-${String(m).padStart(2, "0")}`;
    result.push({ month: monthStr, year: y, monthIndex: m });
  }

  return result;
}

export class SalesEarningsService {
  /**
   * Retrieves paginated completed sales for a farmer with filtered totals in meta.
   */
  public async getSales(farmerId: string, query: SalesQuery): Promise<SalesResponse> {
    const clock = getClock();
    const farmerObjectId = new ObjectId(farmerId);

    // 1. Base filter: COMPLETED orders for this farmer only
    const matchFilter: Record<string, unknown> = {
      farmerId: farmerObjectId,
      status: OrderStatus.COMPLETED,
    };

    // 2. Crop filter (by cropId or slug/name)
    if (query.cropId) {
      matchFilter.cropId = new ObjectId(query.cropId);
    } else if (query.crop) {
      if (/^[\da-f]{24}$/i.test(query.crop)) {
        matchFilter.cropId = new ObjectId(query.crop);
      } else {
        const cropDoc = (await Crop.findOne({ slug: query.crop.toLowerCase() })
          .select("_id")
          .lean()) as { _id: { toString(): string } } | null;
        if (cropDoc) {
          matchFilter.cropId = cropDoc._id;
        } else {
          matchFilter.cropId = new ObjectId(); // Unmatched
        }
      }
    }

    // 3. Date range filter on completedAt (or createdAt)
    const fromStr = query.from ?? query.startDate ?? query.dateFrom;
    const toStr = query.to ?? query.endDate ?? query.dateTo;
    if (fromStr || toStr) {
      const dateCond: Record<string, Date> = {};
      if (fromStr) {
        const parsed = new Date(fromStr);
        if (!isNaN(parsed.getTime())) dateCond.$gte = parsed;
      }
      if (toStr) {
        const parsed = new Date(toStr);
        if (!isNaN(parsed.getTime())) dateCond.$lte = parsed;
      }
      if (Object.keys(dateCond).length > 0) {
        matchFilter.$or = [
          { completedAt: dateCond },
          { completedAt: { $exists: false }, createdAt: dateCond },
        ];
      }
    }

    // 4. Buyer division filter
    const buyerDivisionFilter = query.buyerDivision ?? query.division;
    if (buyerDivisionFilter && buyerDivisionFilter.trim().length > 0) {
      const matchingBuyers = (await User.find({
        division: { $regex: new RegExp(`^${buyerDivisionFilter.trim()}$`, "i") },
      })
        .select("_id")
        .lean()) as { _id: { toString(): string } }[];

      const buyerIds = matchingBuyers.map((b) => b._id);
      matchFilter.buyerId = { $in: buyerIds };
    }

    // 5. Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    // 6. Database aggregation with $facet for atomic totals & paginated rows
    interface AggregateFacetResult {
      metadata: {
        count: number;
        totalQuantityKg: number;
        totalSubtotal: number;
        totalPlatformFee: number;
        totalFarmerNet: number;
      }[];
      items: {
        _id: { toString(): string };
        listingId: { toString(): string };
        cropId: { toString(): string };
        farmerId: { toString(): string };
        buyerId: { toString(): string };
        grade: string;
        quantityKg: number;
        pricePerKg: number;
        subtotal: number;
        platformFee: number;
        farmerNet: number;
        status: string;
        payment: { status: string; method?: string };
        confirmedAt?: Date;
        completedAt?: Date;
        createdAt: Date;
        crop?: CropRecord;
        buyer?: UserRecord;
        listing?: {
          aiPriceGuidance?: { expectedPerKg?: number };
        };
      }[];
    }

    const [facetResult] = (await Order.aggregate([
      { $match: matchFilter },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalQuantityKg: { $sum: "$quantityKg" },
                totalSubtotal: { $sum: "$subtotal" },
                totalPlatformFee: { $sum: "$platformFee" },
                totalFarmerNet: { $sum: "$farmerNet" },
              },
            },
          ],
          items: [
            { $sort: { completedAt: -1, createdAt: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "crops",
                localField: "cropId",
                foreignField: "_id",
                as: "crop",
              },
            },
            { $unwind: { path: "$crop", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "users",
                localField: "buyerId",
                foreignField: "_id",
                as: "buyer",
              },
            },
            { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "listings",
                localField: "listingId",
                foreignField: "_id",
                as: "listing",
              },
            },
            { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
          ],
        },
      },
    ])) as [AggregateFacetResult];

    const metaTotals = facetResult.metadata[0];
    const totalCount = metaTotals?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const totals: SalesTotals = {
      totalQuantityKg: Math.round((metaTotals?.totalQuantityKg ?? 0) * 10) / 10,
      totalSubtotal: metaTotals?.totalSubtotal ?? 0,
      totalPlatformFee: metaTotals?.totalPlatformFee ?? 0,
      totalFarmerNet: metaTotals?.totalFarmerNet ?? 0,
      totalGross: metaTotals?.totalSubtotal ?? 0,
      totalFees: metaTotals?.totalPlatformFee ?? 0,
      totalNet: metaTotals?.totalFarmerNet ?? 0,
      count: totalCount,
    };

    const data: SaleItem[] = facetResult.items.map((row) => {
      const expectedPrice = row.listing?.aiPriceGuidance?.expectedPerKg;
      let pricePremiumPercent: number | undefined;

      if (expectedPrice && expectedPrice > 0) {
        pricePremiumPercent = calculatePricePremium([
          {
            quantityKg: row.quantityKg,
            winningPricePerKg: row.pricePerKg,
            expectedPricePerKg: expectedPrice,
          },
        ]);
      }

      const soldDate = row.confirmedAt ?? row.createdAt;
      const completedDate = row.completedAt ?? soldDate;

      return {
        id: row._id.toString(),
        listingId: row.listingId.toString(),
        cropId: row.cropId.toString(),
        cropName: row.crop?.nameEn ?? "Unknown Crop",
        cropNameBn: row.crop?.nameBn ?? "অজানা ফসল",
        grade: row.grade as SaleItem["grade"],
        quantityKg: row.quantityKg,
        pricePerKg: row.pricePerKg,
        ...(expectedPrice !== undefined ? { expectedPricePerKg: expectedPrice } : {}),
        subtotal: row.subtotal,
        platformFee: row.platformFee,
        farmerNet: row.farmerNet,
        ...(pricePremiumPercent !== undefined ? { pricePremiumPercent } : {}),
        status: row.status as SaleItem["status"],
        paymentStatus: (row.payment?.status ?? "UNPAID") as SaleItem["paymentStatus"],
        ...(row.payment?.method ? { paymentMethod: row.payment.method as SaleItem["paymentMethod"] } : {}),
        buyerName: row.buyer?.name ?? "Buyer",
        buyerRegion: row.buyer?.division ?? "Unknown",
        ...(row.buyer?.division ? { buyerDivision: row.buyer.division } : {}),
        date: completedDate.toISOString(),
        soldAt: soldDate.toISOString(),
        completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages,
        serverTime: clock.iso(),
        totals,
      },
    };
  }

  /**
   * Computes farmer earnings with database aggregations:
   * - Settled net, gross, fees from COMPLETED orders
   * - Expected net from in-progress orders (PENDING, CONFIRMED, DELIVERED)
   * - Cancelled & disputed orders strictly excluded
   * - Asia/Dhaka 6-month series
   * - Price premium calculation overall and per-crop
   * - Current platform fee rate
   */
  public async getEarnings(farmerId: string): Promise<EarningsData> {
    const clock = getClock();
    const now = clock.now();
    const farmerObjectId = new ObjectId(farmerId);

    // 1. Fetch settled and active orders with listing information for price guidance
    interface AggregatedOrder {
      _id: { toString(): string };
      cropId: { toString(): string };
      quantityKg: number;
      pricePerKg: number;
      subtotal: number;
      platformFee: number;
      farmerNet: number;
      status: OrderStatus;
      payment: { status: string; method?: string };
      completedAt?: Date;
      createdAt: Date;
      crop?: { nameEn: string; nameBn: string };
      listing?: { aiPriceGuidance?: { expectedPerKg?: number } };
    }

    const orders = (await Order.aggregate([
      {
        $match: {
          farmerId: farmerObjectId,
          status: {
            $in: [
              OrderStatus.COMPLETED,
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.DELIVERED,
            ],
          },
        },
      },
      {
        $lookup: {
          from: "crops",
          localField: "cropId",
          foreignField: "_id",
          as: "crop",
        },
      },
      { $unwind: { path: "$crop", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "listings",
          localField: "listingId",
          foreignField: "_id",
          as: "listing",
        },
      },
      { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
    ])) as AggregatedOrder[];

    // 2. Separate settled (COMPLETED) and in-progress (PENDING, CONFIRMED, DELIVERED)
    let gross = 0;
    let fees = 0;
    let settledNet = 0;
    let completedOrdersCount = 0;
    let paidPayout = 0;
    let pendingPayout = 0;

    let expectedNet = 0;

    const completedPriceItems: PricePremiumItem[] = [];
    const cropCompletedMap = new Map<
      string,
      {
        cropId: string;
        cropName: string;
        cropNameBn: string;
        totalKg: number;
        totalEarnings: number;
        totalSubtotal: number;
        orderCount: number;
        premiumItems: PricePremiumItem[];
      }
    >();

    for (const order of orders) {
      if (order.status === OrderStatus.COMPLETED) {
        gross += order.subtotal;
        fees += order.platformFee;
        settledNet += order.farmerNet;
        completedOrdersCount += 1;

        if (order.payment?.status === "PAID") {
          paidPayout += order.farmerNet;
        } else {
          pendingPayout += order.farmerNet;
        }

        const expectedPrice = order.listing?.aiPriceGuidance?.expectedPerKg;
        if (expectedPrice !== undefined && expectedPrice > 0) {
          completedPriceItems.push({
            quantityKg: order.quantityKg,
            winningPricePerKg: order.pricePerKg,
            expectedPricePerKg: expectedPrice,
          });
        }

        const cId = order.cropId.toString();
        let cropEntry = cropCompletedMap.get(cId);
        if (!cropEntry) {
          cropEntry = {
            cropId: cId,
            cropName: order.crop?.nameEn ?? "Unknown Crop",
            cropNameBn: order.crop?.nameBn ?? "অজানা ফসল",
            totalKg: 0,
            totalEarnings: 0,
            totalSubtotal: 0,
            orderCount: 0,
            premiumItems: [],
          };
          cropCompletedMap.set(cId, cropEntry);
        }

        cropEntry.totalKg += order.quantityKg;
        cropEntry.totalEarnings += order.farmerNet;
        cropEntry.totalSubtotal += order.subtotal;
        cropEntry.orderCount += 1;

        if (expectedPrice !== undefined && expectedPrice > 0) {
          cropEntry.premiumItems.push({
            quantityKg: order.quantityKg,
            winningPricePerKg: order.pricePerKg,
            expectedPricePerKg: expectedPrice,
          });
        }
      } else {
        // Active orders awaiting completion (PENDING, CONFIRMED, DELIVERED)
        expectedNet += order.farmerNet;
      }
    }

    // 3. Calculate price premiums
    const averagePricePremiumPercent = calculatePricePremium(completedPriceItems);

    const byCrop: EarningsCropSummary[] = Array.from(cropCompletedMap.values()).map((c) => {
      const avgPrice = c.totalKg > 0 ? Math.round(c.totalSubtotal / c.totalKg) : 0;
      const cropPremium = calculatePricePremium(c.premiumItems);
      return {
        cropId: c.cropId,
        cropName: c.cropName,
        cropNameBn: c.cropNameBn,
        totalKg: Math.round(c.totalKg * 10) / 10,
        totalEarnings: c.totalEarnings,
        averagePricePerKg: avgPrice,
        orderCount: c.orderCount,
        averagePricePremiumPercent: cropPremium,
        averagePremiumPercent: cropPremium,
      };
    });

    // 4. Monthly series aggregation in Asia/Dhaka time
    interface MonthlyDbGroup {
      _id: string; // "YYYY-MM"
      gross: number;
      fees: number;
      net: number;
      orderCount: number;
      totalKg: number;
    }

    const monthlyAggregation = (await Order.aggregate([
      {
        $match: {
          farmerId: farmerObjectId,
          status: OrderStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: { $ifNull: ["$completedAt", "$createdAt"] },
              format: "%Y-%m",
              timezone: "Asia/Dhaka",
            },
          },
          gross: { $sum: "$subtotal" },
          fees: { $sum: "$platformFee" },
          net: { $sum: "$farmerNet" },
          orderCount: { $sum: 1 },
          totalKg: { $sum: "$quantityKg" },
        },
      },
    ])) as MonthlyDbGroup[];

    const monthlyMap = new Map<string, MonthlyDbGroup>();
    for (const row of monthlyAggregation) {
      if (row._id) {
        monthlyMap.set(row._id, row);
      }
    }

    const monthsWindow = buildRecentMonthsList(now, 6);
    const monthlySeries: EarningsMonthlySeriesItem[] = monthsWindow.map((m) => {
      const dbRow = monthlyMap.get(m.month);
      return {
        month: m.month,
        year: m.year,
        monthIndex: m.monthIndex,
        gross: dbRow?.gross ?? 0,
        fees: dbRow?.fees ?? 0,
        net: dbRow?.net ?? 0,
        orderCount: dbRow?.orderCount ?? 0,
        totalKg: Math.round((dbRow?.totalKg ?? 0) * 10) / 10,
      };
    });

    // 5. Recent payouts
    const recentCompletedOrders = (await Order.find({
      farmerId: farmerObjectId,
      status: OrderStatus.COMPLETED,
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(10)
      .populate<{ cropId: WithId<CropRecord> }>("cropId")
      .lean()) as unknown as {
      _id: { toString(): string };
      cropId?: { nameEn?: string };
      farmerNet: number;
      payment: { status: string; method?: string };
      completedAt?: Date;
      createdAt: Date;
    }[];

    const recentPayouts: EarningsRecentPayout[] = recentCompletedOrders.map((ord) => ({
      orderId: ord._id.toString(),
      cropName: ord.cropId?.nameEn ?? "Unknown Crop",
      amount: ord.farmerNet,
      status: (ord.payment?.status ?? "UNPAID") as EarningsRecentPayout["status"],
      ...(ord.payment?.method ? { method: ord.payment.method as EarningsRecentPayout["method"] } : {}),
      date: (ord.completedAt ?? ord.createdAt).toISOString(),
    }));

    const feeRateBps = env.PLATFORM_FEE_BPS;
    const feeRatePercent = Math.round((feeRateBps / 100) * 10) / 10;

    return {
      summary: {
        gross,
        fees,
        settledNet,
        expectedNet,
        activeNet: expectedNet,
        totalExpectedNet: settledNet + expectedNet,
        feeRateBps,
        feeRatePercent,
        totalEarnings: settledNet,
        totalSubtotal: gross,
        totalPlatformFees: fees,
        completedOrdersCount,
        pendingPayout,
        paidPayout,
        averagePricePremiumPercent,
        averagePremiumPercent: averagePricePremiumPercent,
      },
      byCrop,
      recentPayouts,
      monthlySeries,
      last6MonthsSeries: monthlySeries,
      feeRate: {
        bps: feeRateBps,
        percent: feeRatePercent,
      },
    };
  }
}

let salesEarningsServiceInstance: SalesEarningsService | undefined;

export function getSalesEarningsService(): SalesEarningsService {
  if (!salesEarningsServiceInstance) {
    salesEarningsServiceInstance = new SalesEarningsService();
  }
  return salesEarningsServiceInstance;
}

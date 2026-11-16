import { ObjectId } from "bson";
import {
  type DashboardQuery,
  type DashboardRangePreset,
  type FarmerDashboardData,
  type FarmerDashboardKpiSet,
  type FarmerDashboardResponse,
  type FarmerEarningsByCrop,
  type FarmerEndingSoonAuction,
  type FarmerRightNow,
  type FarmerSalesTrendBucket,
  type FarmerTopCrop,
  ListingStatus,
  OrderStatus,
  type PricePremiumItem,
  calculatePercentChange,
  calculatePricePremium,
  calculateWinRate,
  fillSeriesBuckets,
  getAsiaDhakaBucketKey,
  getOrderAutoCancelMs,
  getRangeBucketKeys,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import type { CropRecord } from "../crops/crop.model.js";
import { Listing, type ListingRecord } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";

interface AggregatedOrderDoc {
  _id: { toString(): string };
  cropId: { toString(): string };
  quantityKg: number;
  pricePerKg: number;
  subtotal: number;
  platformFee: number;
  farmerNet: number;
  status: OrderStatus;
  createdAt: Date;
  crop?: {
    _id: { toString(): string };
    slug: string;
    nameEn: string;
    nameBn: string;
  };
  listing?: {
    _id: { toString(): string };
    aiPriceGuidance?: {
      expectedPerKg?: number;
    };
  };
}

export class FarmerDashboardService {
  /**
   * Computes the farmer dashboard analytics for a given time range preset.
   */
  public async getFarmerDashboard(
    farmerId: string,
    query: DashboardQuery,
  ): Promise<FarmerDashboardResponse> {
    const clock = getClock();
    const now = clock.now();
    const farmerObjectId = new ObjectId(farmerId);
    const range: DashboardRangePreset = query.range ?? "30d";

    // 1. Calculate time windows and bucket keys in Asia/Dhaka civil representation
    const { currentWindow, previousWindow, currentKeys, granularity } = getRangeBucketKeys(
      range,
      now,
    );

    // 2. Fetch current window booked orders (excluding CANCELLED and DISPUTED)
    const currentOrders = (await Order.aggregate([
      {
        $match: {
          farmerId: farmerObjectId,
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.DISPUTED] },
          createdAt: { $gte: currentWindow.start, $lte: currentWindow.end },
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
    ])) as AggregatedOrderDoc[];

    // 3. Aggregate current period financial metrics, price premium, and crop breakdown
    let totalSales = 0;
    let settledEarnings = 0;
    const currentPremiumItems: PricePremiumItem[] = [];

    const cropMap = new Map<
      string,
      {
        cropId: string;
        cropSlug: string;
        cropName: string;
        cropNameBn: string;
        quantityKg: number;
        totalSales: number;
        earnings: number;
        orderCount: number;
      }
    >();

    const sparseTrendMap = new Map<string, { sales: number; quantityKg: number; orderCount: number }>();

    for (const order of currentOrders) {
      totalSales += order.subtotal;
      settledEarnings += order.farmerNet;

      const expectedPrice = order.listing?.aiPriceGuidance?.expectedPerKg;
      if (expectedPrice !== undefined && expectedPrice > 0) {
        currentPremiumItems.push({
          quantityKg: order.quantityKg,
          winningPricePerKg: order.pricePerKg,
          expectedPricePerKg: expectedPrice,
        });
      }

      // Group by crop
      const cId = order.cropId.toString();
      let cropEntry = cropMap.get(cId);
      if (!cropEntry) {
        cropEntry = {
          cropId: cId,
          cropSlug: order.crop?.slug ?? "unknown",
          cropName: order.crop?.nameEn ?? "Unknown Crop",
          cropNameBn: order.crop?.nameBn ?? "অজানা ফসল",
          quantityKg: 0,
          totalSales: 0,
          earnings: 0,
          orderCount: 0,
        };
        cropMap.set(cId, cropEntry);
      }
      cropEntry.quantityKg += order.quantityKg;
      cropEntry.totalSales += order.subtotal;
      cropEntry.earnings += order.farmerNet;
      cropEntry.orderCount += 1;

      // Group by Asia/Dhaka bucket key for salesTrend
      const bucketKey = getAsiaDhakaBucketKey(order.createdAt, granularity);
      const trendEntry = sparseTrendMap.get(bucketKey) ?? { sales: 0, quantityKg: 0, orderCount: 0 };
      trendEntry.sales += order.subtotal;
      trendEntry.quantityKg += order.quantityKg;
      trendEntry.orderCount += 1;
      sparseTrendMap.set(bucketKey, trendEntry);
    }

    const currentPricePremium = calculatePricePremium(currentPremiumItems);

    // Sort earningsByCrop: highest totalSales first, ties broken by crop slug alphabetically
    const earningsByCrop: FarmerEarningsByCrop[] = Array.from(cropMap.values())
      .map((item) => ({
        ...item,
        quantityKg: Math.round(item.quantityKg * 10) / 10,
      }))
      .sort((a, b) => {
        if (b.totalSales !== a.totalSales) {
          return b.totalSales - a.totalSales;
        }
        return a.cropSlug.localeCompare(b.cropSlug);
      });

    const topCrop: FarmerTopCrop | null =
      earningsByCrop.length > 0 && earningsByCrop[0] ? earningsByCrop[0] : null;

    // Fill salesTrend with zero buckets
    const sparseTrendList: FarmerSalesTrendBucket[] = Array.from(sparseTrendMap.entries()).map(
      ([bucket, data]) => ({
        bucket,
        date: bucket,
        sales: data.sales,
        quantityKg: Math.round(data.quantityKg * 10) / 10,
        orderCount: data.orderCount,
      }),
    );

    const salesTrend: FarmerSalesTrendBucket[] = fillSeriesBuckets(
      currentKeys,
      sparseTrendList,
      (bucketKey) => ({
        bucket: bucketKey,
        date: bucketKey,
        sales: 0,
        quantityKg: 0,
        orderCount: 0,
      }),
    );

    // 4. Fetch previous period orders for period-over-period comparison (if range has previous period)
    let prevSales: number | null = null;
    let prevEarnings: number | null = null;
    let prevOrders: number | null = null;
    let prevPricePremium: number | null = null;

    if (previousWindow) {
      const prevOrdersDocs = (await Order.aggregate([
        {
          $match: {
            farmerId: farmerObjectId,
            status: { $nin: [OrderStatus.CANCELLED, OrderStatus.DISPUTED] },
            createdAt: { $gte: previousWindow.start, $lte: previousWindow.end },
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
        { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
      ])) as AggregatedOrderDoc[];

      prevSales = 0;
      prevEarnings = 0;
      prevOrders = prevOrdersDocs.length;
      const prevPremiumItems: PricePremiumItem[] = [];

      for (const order of prevOrdersDocs) {
        prevSales += order.subtotal;
        prevEarnings += order.farmerNet;

        const expectedPrice = order.listing?.aiPriceGuidance?.expectedPerKg;
        if (expectedPrice !== undefined && expectedPrice > 0) {
          prevPremiumItems.push({
            quantityKg: order.quantityKg,
            winningPricePerKg: order.pricePerKg,
            expectedPricePerKg: expectedPrice,
          });
        }
      }

      prevPricePremium = prevPremiumItems.length > 0 ? calculatePricePremium(prevPremiumItems) : null;
    }

    // 5. Right-now KPIs (injected clock):
    // 5a. Active listings and kg currently listed
    type PopulatedListing = ListingRecord & {
      _id: { toString(): string };
      cropId: CropRecord & { _id: { toString(): string } };
    };

    const activeListings = (await Listing.find({
      farmerId: farmerObjectId,
      status: ListingStatus.ACTIVE,
      endsAt: { $gt: now },
    })
      .populate("cropId")
      .sort({ endsAt: 1 })
      .lean()) as unknown as PopulatedListing[];

    const activeAuctionsCount = activeListings.length;
    const kgListed = Math.round(activeListings.reduce((sum, l) => sum + l.quantityKg, 0) * 10) / 10;

    // 5b. Ending soon auctions (top 3 nearest active listings)
    const endingSoon: FarmerEndingSoonAuction[] = activeListings.slice(0, 3).map((l) => ({
      id: l._id.toString(),
      cropId: l.cropId._id ? l.cropId._id.toString() : l.cropId.toString(),
      cropName: l.cropId.nameEn ?? "Unknown Crop",
      cropNameBn: l.cropId.nameBn,
      photoUrl: l.images?.[0]?.url ?? null,
      grade: l.aiAssessment?.grade ?? "B",
      quantityKg: l.quantityKg,
      floorPricePerKg: l.floorPricePerKg,
      currentBidPerKg: l.currentBidPerKg || l.floorPricePerKg,
      bidCount: l.bidCount ?? 0,
      endsAt: l.endsAt.toISOString(),
      status: l.status,
    }));

    // 5c. Orders needing action and nearest deadline
    const pendingOrders = await Order.find({
      farmerId: farmerObjectId,
      status: OrderStatus.PENDING,
    })
      .select("createdAt")
      .lean();

    const ordersNeedingAction = pendingOrders.length;
    let nearestDeadline: string | null = null;
    if (ordersNeedingAction > 0) {
      const autoCancelMs = getOrderAutoCancelMs(env.DEMO_MODE);
      const deadlines = pendingOrders.map((o) => new Date(o.createdAt.getTime() + autoCancelMs));
      const earliest = new Date(Math.min(...deadlines.map((d) => d.getTime())));
      nearestDeadline = earliest.toISOString();
    }

    // 6. Win Rate (auctions sold vs total closed auctions: SOLD + EXPIRED_UNSOLD + CANCELLED)
    const closedListings = await Listing.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          farmerId: farmerObjectId,
          status: {
            $in: [
              ListingStatus.SOLD,
              ListingStatus.EXPIRED_UNSOLD,
              ListingStatus.CANCELLED,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = new Map<string, number>(closedListings.map((c) => [c._id, c.count]));
    const sold = statusCounts.get(ListingStatus.SOLD) ?? 0;
    const expired = statusCounts.get(ListingStatus.EXPIRED_UNSOLD) ?? 0;
    const cancelled = statusCounts.get(ListingStatus.CANCELLED) ?? 0;
    const totalClosed = sold + expired + cancelled;
    const winRateValue = calculateWinRate(sold, totalClosed);

    // 7. Assemble KPI metric cards with period-over-period comparison
    const kpis: FarmerDashboardKpiSet = {
      totalSales: {
        value: totalSales,
        previous: prevSales ?? 0,
        changePercent: calculatePercentChange(totalSales, prevSales),
      },
      earnings: {
        value: settledEarnings,
        previous: prevEarnings ?? 0,
        changePercent: calculatePercentChange(settledEarnings, prevEarnings),
      },
      activeAuctions: {
        value: activeAuctionsCount,
        previous: 0,
        changePercent: null,
      },
      pendingOrders: {
        value: ordersNeedingAction,
        previous: 0,
        changePercent: null,
      },
      winRate: {
        value: winRateValue,
        previous: null,
        changePercent: null,
      },
      topCrop,
      orders: {
        value: currentOrders.length,
        previous: prevOrders ?? 0,
        changePercent: calculatePercentChange(currentOrders.length, prevOrders),
      },
      pricePremium: {
        value: currentPricePremium,
        previous: prevPricePremium,
        changePercent: calculatePercentChange(currentPricePremium, prevPricePremium),
      },
      kgListed,
      nearestDeadline,
    };

    const rightNow: FarmerRightNow = {
      activeAuctions: activeAuctionsCount,
      ordersNeedingAction,
      nearestDeadline,
      kgListed,
    };

    const data: FarmerDashboardData = {
      kpis,
      rightNow,
      salesTrend,
      earningsByCrop,
      endingSoonAuctions: endingSoon,
      endingSoon,
    };

    return {
      data,
      meta: {
        serverTime: clock.iso(),
        range,
        granularity,
        timezone: "Asia/Dhaka",
      },
    };
  }
}

export const farmerDashboardService = new FarmerDashboardService();

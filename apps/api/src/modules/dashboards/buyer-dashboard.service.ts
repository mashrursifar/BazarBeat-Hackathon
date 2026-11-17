import { ObjectId } from "bson";
import {
  type BuyerActiveBidItem,
  type BuyerDashboardData,
  type BuyerDashboardKpiSet,
  type BuyerDashboardResponse,
  type BuyerOrderCard,
  type BuyerPurchasesByCrop,
  type BuyerRightNow,
  type BuyerSpendTrendBucket,
  type DashboardQuery,
  type DashboardRangePreset,
  OrderStatus,
  type PricePremiumItem,
  calculatePercentChange,
  calculatePricePremium,
  fillSeriesBuckets,
  getAsiaDhakaBucketKey,
  getOrderAutoCancelMs,
  getOrderAutoCompleteMs,
  getRangeBucketKeys,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { getBuyerBidsGrouped } from "../bids/bid.service.js";
import { Crop, type CropRecord } from "../crops/crop.model.js";
import { mapOrderToBuyerOrderCard } from "../orders/order.mapper.js";
import { Order, type OrderRecord } from "../orders/order.model.js";
import { User, type UserRecord } from "../users/user.model.js";

interface AggregatedOrderDoc {
  _id: { toString(): string };
  cropId: { toString(): string };
  farmerId: { toString(): string };
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

export class BuyerDashboardService {
  /**
   * Computes buyer dashboard analytics for a given time range preset.
   */
  public async getBuyerDashboard(
    buyerId: string,
    query: DashboardQuery,
  ): Promise<BuyerDashboardResponse> {
    const clock = getClock();
    const now = clock.now();
    const buyerObjectId = new ObjectId(buyerId);
    const range: DashboardRangePreset = query.range ?? "30d";

    // 1. Calculate time windows and bucket keys in Asia/Dhaka civil representation
    const { currentWindow, previousWindow, currentKeys, granularity } = getRangeBucketKeys(
      range,
      now,
    );

    // 2. Fetch current window booked orders (excluding CANCELLED orders)
    const currentOrders = (await Order.aggregate([
      {
        $match: {
          buyerId: buyerObjectId,
          status: { $ne: OrderStatus.CANCELLED },
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

    // 3. Aggregate financial metrics, total kg purchased, and crop breakdown
    let totalSpend = 0;
    let totalKgPurchased = 0;
    const currentPremiumItems: PricePremiumItem[] = [];

    const cropMap = new Map<
      string,
      {
        cropId: string;
        cropSlug: string;
        cropName: string;
        cropNameBn: string;
        quantityKg: number;
        totalSpend: number;
        orderCount: number;
      }
    >();

    const sparseTrendMap = new Map<
      string,
      { spend: number; quantityKg: number; orderCount: number }
    >();

    for (const order of currentOrders) {
      totalSpend += order.subtotal;
      totalKgPurchased += order.quantityKg;

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
          totalSpend: 0,
          orderCount: 0,
        };
        cropMap.set(cId, cropEntry);
      }
      cropEntry.quantityKg += order.quantityKg;
      cropEntry.totalSpend += order.subtotal;
      cropEntry.orderCount += 1;

      // Group by Asia/Dhaka bucket key for spendTrend
      const bucketKey = getAsiaDhakaBucketKey(order.createdAt, granularity);
      const trendEntry = sparseTrendMap.get(bucketKey) ?? {
        spend: 0,
        quantityKg: 0,
        orderCount: 0,
      };
      trendEntry.spend += order.subtotal;
      trendEntry.quantityKg += order.quantityKg;
      trendEntry.orderCount += 1;
      sparseTrendMap.set(bucketKey, trendEntry);
    }

    const currentPriceVsMarket = calculatePricePremium(currentPremiumItems);
    totalKgPurchased = Math.round(totalKgPurchased * 10) / 10;

    // Sort purchasesByCrop: highest totalSpend first, ties broken by crop slug alphabetically
    const purchasesByCrop: BuyerPurchasesByCrop[] = Array.from(cropMap.values())
      .map((item) => ({
        ...item,
        quantityKg: Math.round(item.quantityKg * 10) / 10,
      }))
      .sort((a, b) => {
        if (b.totalSpend !== a.totalSpend) {
          return b.totalSpend - a.totalSpend;
        }
        return a.cropSlug.localeCompare(b.cropSlug);
      });

    // Fill spendTrend with zero buckets
    const sparseTrendList: BuyerSpendTrendBucket[] = Array.from(sparseTrendMap.entries()).map(
      ([bucket, data]) => ({
        bucket,
        date: bucket,
        spend: data.spend,
        quantityKg: Math.round(data.quantityKg * 10) / 10,
        orderCount: data.orderCount,
      }),
    );

    const spendTrend: BuyerSpendTrendBucket[] = fillSeriesBuckets(
      currentKeys,
      sparseTrendList,
      (bucketKey) => ({
        bucket: bucketKey,
        date: bucketKey,
        spend: 0,
        quantityKg: 0,
        orderCount: 0,
      }),
    );

    // 4. Fetch previous period orders for period-over-period comparison
    let prevSpend: number | null = null;
    let prevKg: number | null = null;
    let prevOrdersCount: number | null = null;
    let prevPriceVsMarket: number | null = null;

    if (previousWindow) {
      const prevOrdersDocs = (await Order.aggregate([
        {
          $match: {
            buyerId: buyerObjectId,
            status: { $ne: OrderStatus.CANCELLED },
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

      prevSpend = 0;
      prevKg = 0;
      prevOrdersCount = prevOrdersDocs.length;
      const prevPremiumItems: PricePremiumItem[] = [];

      for (const order of prevOrdersDocs) {
        prevSpend += order.subtotal;
        prevKg += order.quantityKg;

        const expectedPrice = order.listing?.aiPriceGuidance?.expectedPerKg;
        if (expectedPrice !== undefined && expectedPrice > 0) {
          prevPremiumItems.push({
            quantityKg: order.quantityKg,
            winningPricePerKg: order.pricePerKg,
            expectedPricePerKg: expectedPrice,
          });
        }
      }

      prevKg = Math.round(prevKg * 10) / 10;
      prevPriceVsMarket =
        prevPremiumItems.length > 0 ? calculatePricePremium(prevPremiumItems) : null;
    }

    // 5. Shared My Bids grouping implementation:
    // Derives active bids (split into winning and outbid), completed bids (won vs lost), and win rate
    const buyerBidsSummary = await getBuyerBidsGrouped(buyerId);

    // 3 nearest-ending active bids
    const nearestEndingActiveRows = [...buyerBidsSummary.activeRows]
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
      .slice(0, 3);

    const activeBidsList: BuyerActiveBidItem[] = nearestEndingActiveRows.map((r) => ({
      listingId: r.listingId,
      cropId: r.cropId,
      cropName: r.cropNameEn,
      cropNameBn: r.cropNameBn,
      photoUrl: r.thumbnailUrl,
      grade: r.grade,
      myBidPerKg: r.myBidPerKg,
      currentBidPerKg: r.currentBidPerKg,
      bidCount: r.bidCount,
      endsAt: r.endsAt,
      status: r.status as "WINNING" | "OUTBID",
    }));

    // 6. Right-now KPIs:
    // Orders needing action: PENDING (pay) or DELIVERED (confirm receipt)
    const actionNeededOrders = (await Order.find({
      buyerId: buyerObjectId,
      status: { $in: [OrderStatus.PENDING, OrderStatus.DELIVERED] },
    })
      .select("status createdAt deliveredAt updatedAt")
      .lean()) as unknown as Array<{
      status: OrderStatus;
      createdAt: Date;
      deliveredAt?: Date;
      updatedAt?: Date;
    }>;

    const ordersNeedingAction = actionNeededOrders.length;
    const pendingOrdersCount = actionNeededOrders.filter(
      (o) => o.status === OrderStatus.PENDING,
    ).length;

    let nearestDeadline: string | null = null;
    if (actionNeededOrders.length > 0) {
      const autoCancelMs = getOrderAutoCancelMs(env.DEMO_MODE);
      const autoCompleteMs = getOrderAutoCompleteMs(env.DEMO_MODE);
      const deadlines: Date[] = [];

      for (const order of actionNeededOrders) {
        if (order.status === OrderStatus.PENDING) {
          deadlines.push(new Date(order.createdAt.getTime() + autoCancelMs));
        } else if (order.status === OrderStatus.DELIVERED) {
          const deliveredTime = order.deliveredAt ?? order.updatedAt ?? order.createdAt;
          deadlines.push(new Date(deliveredTime.getTime() + autoCompleteMs));
        }
      }

      if (deadlines.length > 0) {
        const earliest = new Date(Math.min(...deadlines.map((d) => d.getTime())));
        nearestDeadline = earliest.toISOString();
      }
    }

    // 7. Recent orders (top 3 newest orders for this buyer)
    type RawOrderDoc = OrderRecord & {
      _id: { toString(): string };
      createdAt: Date;
      updatedAt?: Date;
    };

    const recentOrderDocs = (await Order.find({
      buyerId: buyerObjectId,
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()) as unknown as RawOrderDoc[];

    let recentOrders: BuyerOrderCard[] = [];
    if (recentOrderDocs.length > 0) {
      const cropIds = Array.from(new Set(recentOrderDocs.map((o) => o.cropId.toString())));
      const farmerIds = Array.from(new Set(recentOrderDocs.map((o) => o.farmerId.toString())));

      const [recentCrops, recentFarmers] = await Promise.all([
        Crop.find({ _id: { $in: cropIds.map((id) => new ObjectId(id)) } }).lean(),
        User.find({ _id: { $in: farmerIds.map((id) => new ObjectId(id)) } }).lean(),
      ]);

      type WithId<T> = T & { _id: { toString(): string } };

      const recentCropMap = new Map<string, WithId<CropRecord>>(
        recentCrops.map((c) => [c._id.toString(), c as unknown as WithId<CropRecord>]),
      );
      const recentFarmerMap = new Map<string, WithId<UserRecord>>(
        recentFarmers.map((f) => [f._id.toString(), f as unknown as WithId<UserRecord>]),
      );

      recentOrders = recentOrderDocs.map((order) => {
        const crop = recentCropMap.get(order.cropId.toString());
        const farmer = recentFarmerMap.get(order.farmerId.toString());
        return mapOrderToBuyerOrderCard(order, crop, farmer, env.DEMO_MODE);
      });
    }

    // 8. Assemble KPI metric cards with period-over-period comparison
    const kpis: BuyerDashboardKpiSet = {
      totalSpend: {
        value: totalSpend,
        previous: prevSpend ?? 0,
        changePercent: calculatePercentChange(totalSpend, prevSpend),
      },
      kgPurchased: {
        value: totalKgPurchased,
        previous: prevKg ?? 0,
        changePercent: calculatePercentChange(totalKgPurchased, prevKg),
      },
      activeBids: {
        value: buyerBidsSummary.activeCount,
        previous: 0,
        changePercent: null,
      },
      winRate: {
        value: buyerBidsSummary.winRate,
        previous: null,
        changePercent: null,
      },
      avgPriceVsMarket: {
        value: currentPriceVsMarket,
        previous: prevPriceVsMarket,
        changePercent: calculatePercentChange(currentPriceVsMarket, prevPriceVsMarket),
      },
      pendingOrders: {
        value: pendingOrdersCount,
        previous: 0,
        changePercent: null,
      },
      orders: {
        value: currentOrders.length,
        previous: prevOrdersCount ?? 0,
        changePercent: calculatePercentChange(currentOrders.length, prevOrdersCount),
      },
      nearestDeadline,
    };

    const rightNow: BuyerRightNow = {
      activeBids: buyerBidsSummary.activeCount,
      winningBids: buyerBidsSummary.winningCount,
      outbidBids: buyerBidsSummary.outbidCount,
      ordersNeedingAction,
      nearestDeadline,
    };

    const data: BuyerDashboardData = {
      kpis,
      rightNow,
      spendTrend,
      purchasesByCrop,
      activeBidsList,
      nearestEndingBids: activeBidsList,
      recentOrders,
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

export const buyerDashboardService = new BuyerDashboardService();

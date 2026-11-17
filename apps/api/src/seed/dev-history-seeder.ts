import { Types } from "mongoose";
import {
  CropGrade,
  FulfilmentMethod,
  ListingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockMovementType,
  StockReturnDecision,
  calculateSubtotal,
} from "@bazarbeat/shared";

import { Crop, type CropRecord } from "../modules/crops/crop.model.js";
import { Listing } from "../modules/listings/listing.model.js";
import { Bid } from "../modules/bids/bid.model.js";
import { Order } from "../modules/orders/order.model.js";
import { InventoryItem } from "../modules/inventory/inventory-item.model.js";
import { StockMovement } from "../modules/inventory/stock-movement.model.js";
import { User, type UserRecord } from "../modules/users/user.model.js";
import { MARKET_PRICE_BASE_PRICES } from "../modules/market-prices/market-price-seed.js";

export interface SeedDevHistoryResult {
  listingsCount: number;
  bidsCount: number;
  ordersCount: number;
  soldCount: number;
  unsoldCount: number;
  cancelledCount: number;
}

interface HistoricalAuctionPlan {
  daysAgo: number;
  cropSlug: keyof typeof MARKET_PRICE_BASE_PRICES;
  grade: CropGrade;
  quantityKg: number;
  status: "SOLD" | "EXPIRED_UNSOLD" | "CANCELLED";
  orderStatus?: OrderStatus;
  orderCancelledReturn?: boolean;
  bids: Array<{
    buyerIndex: number;
    markupPercent: number; // relative to floor
    minutesBeforeClose: number;
  }>;
  winningBuyerIndex?: number;
}

/**
 * Curated 75-day historical schedule providing rich, realistic activity
 * spread across the last 60 to 90 days for demo farmer Rahim Uddin and demo buyers.
 */
const HISTORICAL_AUCTION_PLANS: readonly HistoricalAuctionPlan[] = [
  // --- Month 3 (Days 72 down to 55) ---
  {
    daysAgo: 72,
    cropSlug: "onion",
    grade: CropGrade.A,
    quantityKg: 300,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 2, minutesBeforeClose: 40 },
      { buyerIndex: 1, markupPercent: 6, minutesBeforeClose: 20 },
      { buyerIndex: 0, markupPercent: 10, minutesBeforeClose: 5 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 68,
    cropSlug: "potato",
    grade: CropGrade.B,
    quantityKg: 500,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 0, minutesBeforeClose: 35 },
      { buyerIndex: 2, markupPercent: 5, minutesBeforeClose: 10 },
    ],
    winningBuyerIndex: 2,
  },
  {
    daysAgo: 64,
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    quantityKg: 80,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 5, minutesBeforeClose: 50 },
      { buyerIndex: 1, markupPercent: 12, minutesBeforeClose: 15 },
    ],
    winningBuyerIndex: 1,
  },
  {
    daysAgo: 61,
    cropSlug: "eggplant",
    grade: CropGrade.C,
    quantityKg: 200,
    status: "EXPIRED_UNSOLD",
    bids: [],
  },
  {
    daysAgo: 58,
    cropSlug: "bitter-gourd",
    grade: CropGrade.B,
    quantityKg: 150,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 2, markupPercent: 3, minutesBeforeClose: 45 },
      { buyerIndex: 0, markupPercent: 8, minutesBeforeClose: 12 },
    ],
    winningBuyerIndex: 0,
  },

  // --- Month 2 (Days 54 down to 25) ---
  {
    daysAgo: 52,
    cropSlug: "onion",
    grade: CropGrade.B,
    quantityKg: 400,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 1, minutesBeforeClose: 30 },
      { buyerIndex: 0, markupPercent: 7, minutesBeforeClose: 8 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 47,
    cropSlug: "potato",
    grade: CropGrade.A,
    quantityKg: 600,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 2, minutesBeforeClose: 60 },
      { buyerIndex: 2, markupPercent: 8, minutesBeforeClose: 25 },
      { buyerIndex: 1, markupPercent: 14, minutesBeforeClose: 6 },
    ],
    winningBuyerIndex: 1,
  },
  {
    daysAgo: 43,
    cropSlug: "green-chilli",
    grade: CropGrade.B,
    quantityKg: 120,
    status: "CANCELLED",
    bids: [],
  },
  {
    daysAgo: 39,
    cropSlug: "eggplant",
    grade: CropGrade.A,
    quantityKg: 250,
    status: "SOLD",
    orderStatus: OrderStatus.CANCELLED,
    orderCancelledReturn: true,
    bids: [
      { buyerIndex: 2, markupPercent: 0, minutesBeforeClose: 40 },
      { buyerIndex: 0, markupPercent: 6, minutesBeforeClose: 10 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 35,
    cropSlug: "bitter-gourd",
    grade: CropGrade.A,
    quantityKg: 180,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 4, minutesBeforeClose: 35 },
      { buyerIndex: 1, markupPercent: 9, minutesBeforeClose: 14 },
      { buyerIndex: 0, markupPercent: 13, minutesBeforeClose: 3 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 31,
    cropSlug: "onion",
    grade: CropGrade.A,
    quantityKg: 350,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 2, minutesBeforeClose: 50 },
      { buyerIndex: 2, markupPercent: 7, minutesBeforeClose: 20 },
      { buyerIndex: 0, markupPercent: 11, minutesBeforeClose: 4 },
    ],
    winningBuyerIndex: 0,
  },

  // --- Month 1 (Days 28 down to 8) ---
  {
    daysAgo: 26,
    cropSlug: "potato",
    grade: CropGrade.B,
    quantityKg: 450,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 3, minutesBeforeClose: 45 },
      { buyerIndex: 1, markupPercent: 8, minutesBeforeClose: 15 },
    ],
    winningBuyerIndex: 1,
  },
  {
    daysAgo: 22,
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    quantityKg: 90,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 2, markupPercent: 4, minutesBeforeClose: 50 },
      { buyerIndex: 0, markupPercent: 10, minutesBeforeClose: 12 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 19,
    cropSlug: "eggplant",
    grade: CropGrade.B,
    quantityKg: 220,
    status: "EXPIRED_UNSOLD",
    bids: [],
  },
  {
    daysAgo: 16,
    cropSlug: "bitter-gourd",
    grade: CropGrade.B,
    quantityKg: 160,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 2, minutesBeforeClose: 30 },
      { buyerIndex: 0, markupPercent: 7, minutesBeforeClose: 9 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 12,
    cropSlug: "onion",
    grade: CropGrade.A,
    quantityKg: 280,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 0, markupPercent: 4, minutesBeforeClose: 40 },
      { buyerIndex: 2, markupPercent: 8, minutesBeforeClose: 18 },
      { buyerIndex: 0, markupPercent: 12, minutesBeforeClose: 5 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 9,
    cropSlug: "potato",
    grade: CropGrade.A,
    quantityKg: 550,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 3, minutesBeforeClose: 45 },
      { buyerIndex: 0, markupPercent: 9, minutesBeforeClose: 14 },
    ],
    winningBuyerIndex: 0,
  },

  // --- Recent Period (Last 7 days: Days 6 down to today) ---
  {
    daysAgo: 6,
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    quantityKg: 100,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 2, markupPercent: 5, minutesBeforeClose: 35 },
      { buyerIndex: 0, markupPercent: 11, minutesBeforeClose: 8 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 4,
    cropSlug: "eggplant",
    grade: CropGrade.A,
    quantityKg: 260,
    status: "SOLD",
    orderStatus: OrderStatus.COMPLETED,
    bids: [
      { buyerIndex: 1, markupPercent: 2, minutesBeforeClose: 40 },
      { buyerIndex: 2, markupPercent: 6, minutesBeforeClose: 15 },
    ],
    winningBuyerIndex: 2,
  },
  {
    daysAgo: 3,
    cropSlug: "bitter-gourd",
    grade: CropGrade.A,
    quantityKg: 140,
    status: "CANCELLED",
    bids: [],
  },
  {
    daysAgo: 2,
    cropSlug: "onion",
    grade: CropGrade.A,
    quantityKg: 320,
    status: "SOLD",
    orderStatus: OrderStatus.DELIVERED,
    bids: [
      { buyerIndex: 1, markupPercent: 3, minutesBeforeClose: 30 },
      { buyerIndex: 0, markupPercent: 8, minutesBeforeClose: 10 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 1,
    cropSlug: "potato",
    grade: CropGrade.A,
    quantityKg: 400,
    status: "SOLD",
    orderStatus: OrderStatus.CONFIRMED,
    bids: [
      { buyerIndex: 2, markupPercent: 2, minutesBeforeClose: 40 },
      { buyerIndex: 0, markupPercent: 7, minutesBeforeClose: 12 },
    ],
    winningBuyerIndex: 0,
  },
  {
    daysAgo: 0.2, // ~5 hours ago
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    quantityKg: 75,
    status: "SOLD",
    orderStatus: OrderStatus.PENDING,
    bids: [
      { buyerIndex: 1, markupPercent: 2, minutesBeforeClose: 20 },
      { buyerIndex: 0, markupPercent: 6, minutesBeforeClose: 4 },
    ],
    winningBuyerIndex: 0,
  },
];

/**
 * Dev-only historical activity seeder.
 * Seeds 60 to 90 days of past activity for demo farmer and demo buyers.
 * Guarantees all invariants:
 * - One order per sold listing
 * - Consistent bid and listing summaries
 * - Inventory ledger reconciling to zero discrepancy
 */
export async function seedDevHistory(
  demoFarmer: UserRecord & { _id: Types.ObjectId },
  demoBuyers: Array<UserRecord & { _id: Types.ObjectId }>,
  crops: Array<CropRecord & { _id: Types.ObjectId }>,
  referenceDate: Date = new Date(),
): Promise<SeedDevHistoryResult> {
  const cropMap = new Map<string, CropRecord & { _id: Types.ObjectId }>();
  for (const crop of crops) {
    cropMap.set(crop.slug, crop);
  }

  const nowMs = referenceDate.getTime();
  let listingsCount = 0;
  let bidsCount = 0;
  let ordersCount = 0;
  let soldCount = 0;
  let unsoldCount = 0;
  let cancelledCount = 0;

  // Track inventory movements per crop to reconcile afterwards
  const inventoryDeltas = new Map<
    string,
    { availableKg: number; listedKg: number; soldKg: number }
  >();

  const getDeltas = (cropId: string) => {
    let entry = inventoryDeltas.get(cropId);
    if (!entry) {
      entry = { availableKg: 0, listedKg: 0, soldKg: 0 };
      inventoryDeltas.set(cropId, entry);
    }
    return entry;
  };

  for (let idx = 0; idx < HISTORICAL_AUCTION_PLANS.length; idx += 1) {
    const plan = HISTORICAL_AUCTION_PLANS[idx]!;
    const crop = cropMap.get(plan.cropSlug);
    if (!crop) continue;

    const cropIdStr = crop._id.toString();
    const deltas = getDeltas(cropIdStr);

    const basePrice = MARKET_PRICE_BASE_PRICES[plan.cropSlug];
    const gradeMultiplier = plan.grade === CropGrade.A ? 1.05 : plan.grade === CropGrade.B ? 0.95 : 0.85;
    const expectedPricePerKg = Math.round(basePrice * gradeMultiplier);
    const floorPricePerKg = Math.round(expectedPricePerKg * 0.95);

    // Timestamps
    const auctionEndMs = nowMs - Math.round(plan.daysAgo * 86_400_000);
    const auctionStartMs = auctionEndMs - 6 * 3_600_000; // 6-hour auction
    const auctionCreatedAt = new Date(auctionStartMs);
    const auctionEndsAt = new Date(auctionEndMs);

    // 1. Ledger: Harvest Stock Allocation (ADD)
    const addOperationId = `hist-add-${demoFarmer._id}-${crop._id}-${idx}`;
    await StockMovement.create({
      farmerId: demoFarmer._id,
      cropId: crop._id,
      type: StockMovementType.ADD,
      quantityKg: plan.quantityKg,
      operationId: addOperationId,
      status: "APPLIED",
      appliedAt: auctionCreatedAt,
      createdAt: auctionCreatedAt,
      updatedAt: auctionCreatedAt,
      note: `Historical harvest allocation for ${crop.nameEn}`,
    });
    deltas.availableKg += plan.quantityKg;

    // 2. Create Listing in backdated state
    const listingId = new Types.ObjectId();

    // 3. Ledger: Listing reservation (LIST)
    const listOperationId = `hist-list-${listingId}`;
    await StockMovement.create({
      farmerId: demoFarmer._id,
      cropId: crop._id,
      listingId,
      type: StockMovementType.LIST,
      quantityKg: plan.quantityKg,
      operationId: listOperationId,
      status: "APPLIED",
      appliedAt: auctionCreatedAt,
      createdAt: auctionCreatedAt,
      updatedAt: auctionCreatedAt,
      note: `Historical stock reservation for listing`,
    });
    deltas.availableKg -= plan.quantityKg;
    deltas.listedKg += plan.quantityKg;

    // 4. Create Bids
    const createdBidDocs = [];
    let currentBidPerKg = floorPricePerKg;

    for (let bIdx = 0; bIdx < plan.bids.length; bIdx += 1) {
      const bidSpec = plan.bids[bIdx]!;
      const buyer = demoBuyers[bidSpec.buyerIndex] ?? demoBuyers[0]!;
      const bidAmount = Math.round(floorPricePerKg * (1 + bidSpec.markupPercent / 100));
      currentBidPerKg = bidAmount;

      const bidTimeMs = auctionEndMs - bidSpec.minutesBeforeClose * 60_000;
      const bidCreatedAt = new Date(bidTimeMs);

      const bidDoc = await Bid.create({
        listingId,
        buyerId: buyer._id,
        bidderLabel: `Bidder ${buyer.phone.slice(-4)}`,
        amountPerKg: bidAmount,
        totalAmount: calculateSubtotal(plan.quantityKg, bidAmount),
        seq: bIdx + 1,
        status: "ACCEPTED",
        placedAt: bidCreatedAt,
        createdAt: bidCreatedAt,
        updatedAt: bidCreatedAt,
      });
      createdBidDocs.push(bidDoc);
      bidsCount += 1;
    }

    // 5. Finalize Listing state and invariants
    let winningBidDoc = null;
    let winningBuyer = null;

    if (plan.status === "SOLD" && createdBidDocs.length > 0) {
      winningBidDoc = createdBidDocs.reduce(
        (highest, b) => (b.amountPerKg > highest.amountPerKg ? b : highest),
        createdBidDocs[0]!,
      );
      winningBuyer =
        demoBuyers.find((b) => b._id.toString() === winningBidDoc.buyerId.toString()) ??
        demoBuyers[0]!;
      currentBidPerKg = winningBidDoc.amountPerKg;
    }

    const listingStatus =
      plan.status === "SOLD"
        ? ListingStatus.SOLD
        : plan.status === "CANCELLED"
          ? ListingStatus.CANCELLED
          : ListingStatus.EXPIRED_UNSOLD;

    await Listing.create({
      _id: listingId,
      farmerId: demoFarmer._id,
      cropId: crop._id,
      quantityKg: plan.quantityKg,
      floorPricePerKg,
      durationMinutes: 360,
      startsAt: auctionCreatedAt,
      endsAt: auctionEndsAt,
      originalEndsAt: auctionEndsAt,
      extensionCount: 0,
      status: listingStatus,
      bidCount: createdBidDocs.length,
      currentBidPerKg: createdBidDocs.length > 0 ? currentBidPerKg : floorPricePerKg,
      currentBidderId: winningBuyer ? winningBuyer._id : undefined,
      winningBidId: winningBidDoc ? winningBidDoc._id : undefined,
      location: {
        division: demoFarmer.division,
        district: demoFarmer.district,
        upazila: demoFarmer.upazila,
      },
      closedAt: auctionEndsAt,
      aiAssessment: {
        grade: plan.grade,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: {
          A: plan.grade === CropGrade.A ? 0.9 : 0.05,
          B: plan.grade === CropGrade.B ? 0.9 : 0.05,
          C: plan.grade === CropGrade.C ? 0.9 : 0.05,
        },
        qualityNotes: [`Quality verified for ${crop.nameEn}`],
        cropMatch: true,
        modelVersion: "mock-1.0",
        provider: "mock",
        degraded: false,
        assessedAt: auctionCreatedAt,
        imageHashes: [`sample-hash-${plan.cropSlug}-${plan.grade}`],
      },
      aiPriceGuidance: {
        lowPerKg: Math.round(expectedPricePerKg * 0.9),
        expectedPerKg: expectedPricePerKg,
        highPerKg: Math.round(expectedPricePerKg * 1.1),
        suggestedFloorPerKg: floorPricePerKg,
        trend: "FLAT",
        confidence: 0.92,
        explanation: [`Historical reference for ${crop.nameEn}`],
        modelVersion: "mock-1.0",
        provider: "mock",
        degraded: false,
        generatedAt: auctionCreatedAt,
      },
      images: [
        {
          url: `/uploads/crops/${plan.cropSlug}/${plan.grade}.jpg`,
          width: 800,
          height: 600,
        },
      ],
      createdAt: auctionCreatedAt,
      updatedAt: auctionEndsAt,
    });
    listingsCount += 1;

    // Update bid statuses (WON for winning bid, LOST for others)
    if (winningBidDoc) {
      await Bid.updateOne({ _id: winningBidDoc._id }, { $set: { status: "WON" } });
      await Bid.updateMany(
        { listingId, _id: { $ne: winningBidDoc._id } },
        { $set: { status: "LOST" } },
      );
    } else if (createdBidDocs.length > 0) {
      await Bid.updateMany({ listingId }, { $set: { status: "LOST" } });
    }

    // 6. Handle stock movement and Order for SOLD / UNSOLD / CANCELLED
    if (plan.status === "SOLD" && winningBidDoc && winningBuyer) {
      soldCount += 1;

      // Ledger: SELL movement
      const sellOpId = `hist-sell-${listingId}`;
      await StockMovement.create({
        farmerId: demoFarmer._id,
        cropId: crop._id,
        listingId,
        type: StockMovementType.SELL,
        quantityKg: plan.quantityKg,
        operationId: sellOpId,
        status: "APPLIED",
        appliedAt: auctionEndsAt,
        createdAt: auctionEndsAt,
        updatedAt: auctionEndsAt,
        note: `Sold via historical auction close`,
      });
      deltas.listedKg -= plan.quantityKg;
      deltas.soldKg += plan.quantityKg;

      // Exactly ONE order per sold listing
      const subtotal = calculateSubtotal(plan.quantityKg, winningBidDoc.amountPerKg);
      const platformFee = Math.round(subtotal * 0.02);
      const farmerNet = subtotal - platformFee;

      const orderStatus = plan.orderStatus ?? OrderStatus.COMPLETED;
      const orderCreatedAt = auctionEndsAt;
      const confirmedAt = new Date(auctionEndMs + 30 * 60_000);
      const deliveredAt = new Date(auctionEndMs + 2 * 3_600_000);
      const completedAt = new Date(auctionEndMs + 4 * 3_600_000);
      const cancelledAt = new Date(auctionEndMs + 1 * 3_600_000);

      const orderDoc = await Order.create({
        listingId,
        farmerId: demoFarmer._id,
        buyerId: winningBuyer._id,
        cropId: crop._id,
        quantityKg: plan.quantityKg,
        grade: plan.grade,
        pricePerKg: winningBidDoc.amountPerKg,
        subtotal,
        platformFee,
        farmerNet,
        status: orderStatus,
        payment: {
          status:
            orderStatus === OrderStatus.COMPLETED || orderStatus === OrderStatus.DELIVERED
              ? PaymentStatus.PAID
              : PaymentStatus.UNPAID,
          method: PaymentMethod.WALLET_SIM,
          paidAt:
            orderStatus === OrderStatus.COMPLETED || orderStatus === OrderStatus.DELIVERED
              ? confirmedAt
              : undefined,
        },
        fulfilment: {
          method: FulfilmentMethod.PICKUP,
          handoverAt: confirmedAt,
          note: "Pickup at Savar warehouse",
        },
        statusHistory: [
          { status: OrderStatus.PENDING, at: orderCreatedAt },
          ...(orderStatus !== OrderStatus.PENDING
            ? [{ status: OrderStatus.CONFIRMED, at: confirmedAt }]
            : []),
          ...(orderStatus === OrderStatus.DELIVERED || orderStatus === OrderStatus.COMPLETED
            ? [{ status: OrderStatus.DELIVERED, at: deliveredAt }]
            : []),
          ...(orderStatus === OrderStatus.COMPLETED
            ? [{ status: OrderStatus.COMPLETED, at: completedAt }]
            : []),
          ...(orderStatus === OrderStatus.CANCELLED
            ? [{ status: OrderStatus.CANCELLED, at: cancelledAt, note: "Buyer requested cancellation" }]
            : []),
        ],
        confirmedAt: orderStatus !== OrderStatus.PENDING ? confirmedAt : undefined,
        deliveredAt:
          orderStatus === OrderStatus.DELIVERED || orderStatus === OrderStatus.COMPLETED
            ? deliveredAt
            : undefined,
        completedAt: orderStatus === OrderStatus.COMPLETED ? completedAt : undefined,
        cancelledAt: orderStatus === OrderStatus.CANCELLED ? cancelledAt : undefined,
        cancelledBy: orderStatus === OrderStatus.CANCELLED ? winningBuyer._id : undefined,
        cancelReason:
          orderStatus === OrderStatus.CANCELLED ? "Buyer logistics constraints" : undefined,
        stockReturn:
          orderStatus === OrderStatus.CANCELLED && plan.orderCancelledReturn
            ? {
                decision: StockReturnDecision.RETURNED,
                decidedAt: new Date(cancelledAt.getTime() + 15 * 60_000),
                note: "Produce inspected and returned to storage",
              }
            : undefined,
        createdAt: orderCreatedAt,
        updatedAt: completedAt,
      });
      ordersCount += 1;

      // Handle stock return movement if order was cancelled with RETURNED decision
      if (orderStatus === OrderStatus.CANCELLED && plan.orderCancelledReturn) {
        const returnOpId = `hist-return-${orderDoc._id}`;
        const returnTime = new Date(cancelledAt.getTime() + 15 * 60_000);
        await StockMovement.create({
          farmerId: demoFarmer._id,
          cropId: crop._id,
          orderId: orderDoc._id,
          type: StockMovementType.RETURN,
          quantityKg: plan.quantityKg,
          operationId: returnOpId,
          status: "APPLIED",
          appliedAt: returnTime,
          createdAt: returnTime,
          updatedAt: returnTime,
          note: `Stock return following order cancellation`,
        });
        deltas.availableKg += plan.quantityKg;
        deltas.soldKg -= plan.quantityKg;
      }
    } else {
      // EXPIRED_UNSOLD or CANCELLED: Release reserved stock
      if (plan.status === "EXPIRED_UNSOLD") {
        unsoldCount += 1;
      } else {
        cancelledCount += 1;
      }

      const releaseOpId = `hist-release-${listingId}`;
      await StockMovement.create({
        farmerId: demoFarmer._id,
        cropId: crop._id,
        listingId,
        type: StockMovementType.RELEASE,
        quantityKg: plan.quantityKg,
        operationId: releaseOpId,
        status: "APPLIED",
        appliedAt: auctionEndsAt,
        createdAt: auctionEndsAt,
        updatedAt: auctionEndsAt,
        note: `Released stock for ${plan.status.toLowerCase()} listing`,
      });
      deltas.availableKg += plan.quantityKg;
      deltas.listedKg -= plan.quantityKg;
    }
  }

  // 7. Update InventoryItem balances by adding historical movement deltas
  for (const [cropIdStr, delta] of inventoryDeltas.entries()) {
    const item = await InventoryItem.findOne({
      farmerId: demoFarmer._id,
      cropId: new Types.ObjectId(cropIdStr),
    });

    if (item) {
      item.availableKg = Math.round((item.availableKg + delta.availableKg) * 10) / 10;
      item.listedKg = Math.round((item.listedKg + delta.listedKg) * 10) / 10;
      item.soldKg = Math.round((item.soldKg + delta.soldKg) * 10) / 10;
      await item.save();
    } else {
      await InventoryItem.create({
        farmerId: demoFarmer._id,
        cropId: new Types.ObjectId(cropIdStr),
        availableKg: Math.round(delta.availableKg * 10) / 10,
        listedKg: Math.round(delta.listedKg * 10) / 10,
        soldKg: Math.round(delta.soldKg * 10) / 10,
      });
    }
  }

  return {
    listingsCount,
    bidsCount,
    ordersCount,
    soldCount,
    unsoldCount,
    cancelledCount,
  };
}

import { ObjectId } from "bson";
import {
  GOLDEN_BIDS,
  GOLDEN_CROPS,
  GOLDEN_LISTINGS,
  GOLDEN_MARKET_PRICES,
  GOLDEN_ORDERS,
  GOLDEN_USERS,
  type GoldenBid,
  type GoldenCrop,
  type GoldenListing,
  type GoldenMarketPrice,
  type GoldenOrder,
  type GoldenUser,
} from "@bazarbeat/shared";

import { User } from "../modules/users/user.model.js";
import { Crop } from "../modules/crops/crop.model.js";
import { Listing } from "../modules/listings/listing.model.js";
import { Bid } from "../modules/bids/bid.model.js";
import { Order } from "../modules/orders/order.model.js";
import { MarketPrice } from "../modules/market-prices/market-price.model.js";

// Dummy bcrypt hash for password "password123"
const DUMMY_PASSWORD_HASH =
  "$2a$12$e80yq9PjO6eH8zB4M7qXv.NfXqQ0bW6f2v4b6f8b0d2f4h6j8l0n.";

export interface LoadedDashboardGoldenDataset {
  users: GoldenUser[];
  crops: GoldenCrop[];
  listings: GoldenListing[];
  bids: GoldenBid[];
  orders: GoldenOrder[];
  marketPrices: GoldenMarketPrice[];
}

/**
 * Loads the dashboard golden dataset into the target MongoDB database.
 * Idempotently cleans up previous fixture records before insertion.
 */
export async function loadDashboardGoldenDataset(): Promise<LoadedDashboardGoldenDataset> {
  const userIds = GOLDEN_USERS.map((u) => new ObjectId(u.id));
  const cropIds = GOLDEN_CROPS.map((c) => new ObjectId(c.id));
  const listingIds = GOLDEN_LISTINGS.map((l) => new ObjectId(l.id));
  const bidIds = GOLDEN_BIDS.map((b) => new ObjectId(b.id));
  const orderIds = GOLDEN_ORDERS.map((o) => new ObjectId(o.id));

  // 1. Clean up any existing records
  await Promise.all([
    User.deleteMany({ _id: { $in: userIds } }),
    Crop.deleteMany({ _id: { $in: cropIds } }),
    Listing.deleteMany({ _id: { $in: listingIds } }),
    Bid.deleteMany({ _id: { $in: bidIds } }),
    Order.deleteMany({ _id: { $in: orderIds } }),
    MarketPrice.deleteMany({ cropId: { $in: cropIds } }),
  ]);

  // 2. Insert Users
  const userDocs = GOLDEN_USERS.map((u) => ({
    _id: new ObjectId(u.id),
    role: u.role,
    name: u.name,
    phone: u.phone,
    passwordHash: DUMMY_PASSWORD_HASH,
    division: u.division,
    district: u.district,
    upazila: u.upazila,
    organization: u.organization,
    language: "en",
    isActive: true,
  }));
  await User.insertMany(userDocs);

  // 3. Insert Crops
  const cropDocs = GOLDEN_CROPS.map((c) => ({
    _id: new ObjectId(c.id),
    slug: c.slug,
    nameEn: c.name,
    nameBn: c.nameBn,
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120,
    gradeGuide: {
      A: "Premium export quality, uniform size and skin",
      B: "Good commercial standard, minor surface blemishes",
      C: "Fair utility standard, varied size",
    },
    minIncrementPerKg: c.minIncrement,
    imageUrl: `/images/crops/${c.slug}.jpg`,
    isActive: true,
  }));
  await Crop.insertMany(cropDocs);

  // 4. Insert Listings
  const listingDocs = GOLDEN_LISTINGS.map((l) => {
    const farmer = GOLDEN_USERS.find((u) => u.id === l.farmerId);
    return {
      _id: new ObjectId(l.id),
      farmerId: new ObjectId(l.farmerId),
      cropId: new ObjectId(l.cropId),
      quantityKg: l.quantityKg,
      images: [
        {
          url: `/uploads/golden-${l.id}-1.jpg`,
          width: 1200,
          height: 900,
        },
      ],
      aiAssessment: {
        grade: l.grade,
        confidence: 0.94,
        confidenceBand: "HIGH",
        classProbabilities: {
          A: l.grade === "A" ? 0.85 : 0.1,
          B: l.grade === "B" ? 0.85 : 0.1,
          C: l.grade === "C" ? 0.85 : 0.05,
        },
        qualityNotes: ["Uniform appearance", "Certified moisture content"],
        cropMatch: true,
        modelVersion: "golden-mock-v1",
        provider: "mock",
        degraded: false,
        assessedAt: new Date(l.createdAt),
        imageHashes: [`hash-${l.id}-1`],
      },
      aiPriceGuidance: {
        lowPerKg: Math.round(l.expectedPricePerKg * 0.9),
        expectedPerKg: l.expectedPricePerKg,
        highPerKg: Math.round(l.expectedPricePerKg * 1.1),
        trend: "UP",
        confidence: 0.9,
        explanation: ["High seasonal wholesale demand"],
        modelVersion: "golden-mock-v1",
        provider: "mock",
        degraded: false,
        generatedAt: new Date(l.createdAt),
        suggestedFloorPerKg: l.floorPricePerKg,
      },
      floorPricePerKg: l.floorPricePerKg,
      minIncrementPerKg: 50,
      startsAt: new Date(l.createdAt),
      endsAt: new Date(l.endsAt),
      originalEndsAt: new Date(l.endsAt),
      extensionCount: 0,
      status: l.status,
      currentBidPerKg: l.currentBidPerKg,
      currentBidderId: l.winningBidderId
        ? new ObjectId(l.winningBidderId)
        : GOLDEN_BIDS.filter((b) => b.listingId === l.id).sort((a, b) => b.amountPerKg - a.amountPerKg)[0]
          ? new ObjectId(
              GOLDEN_BIDS.filter((b) => b.listingId === l.id).sort((a, b) => b.amountPerKg - a.amountPerKg)[0]!.buyerId,
            )
          : undefined,
      bidCount: l.bidCount,
      winningBidId: l.winningBidId ? new ObjectId(l.winningBidId) : undefined,
      location: {
        division: farmer?.division ?? "rajshahi",
        district: farmer?.district ?? "bogura",
        upazila: farmer?.upazila,
      },
      closedAt: l.closedAt ? new Date(l.closedAt) : undefined,
    };
  });
  await Listing.insertMany(listingDocs);

  // 5. Insert Bids
  const bidDocs = GOLDEN_BIDS.map((b) => ({
    _id: new ObjectId(b.id),
    listingId: new ObjectId(b.listingId),
    buyerId: new ObjectId(b.buyerId),
    amountPerKg: b.amountPerKg,
    totalAmount: b.totalAmount,
    seq: b.seq,
    status: b.status,
    placedAt: new Date(b.placedAt),
  }));
  await Bid.insertMany(bidDocs);

  // 6. Insert Orders
  const orderDocs = GOLDEN_ORDERS.map((o) => ({
    _id: new ObjectId(o.id),
    listingId: new ObjectId(o.listingId),
    farmerId: new ObjectId(o.farmerId),
    buyerId: new ObjectId(o.buyerId),
    cropId: new ObjectId(o.cropId),
    quantityKg: o.quantityKg,
    grade: o.grade,
    pricePerKg: o.pricePerKg,
    subtotal: o.subtotal,
    platformFee: o.platformFee,
    farmerNet: o.farmerNet,
    status: o.status,
    payment: {
      method: o.payment.method,
      status: o.payment.status,
      paidAt: o.payment.paidAt ? new Date(o.payment.paidAt) : undefined,
    },
    fulfilment: {
      method: "PICKUP",
      note: "Produce packed and available at warehouse gate",
    },
    statusHistory: [
      {
        status: "PENDING",
        at: new Date(o.createdAt),
        byUserId: new ObjectId(o.buyerId),
      },
      ...(o.confirmedAt
        ? [
            {
              status: "CONFIRMED",
              at: new Date(o.confirmedAt),
              byUserId: new ObjectId(o.farmerId),
            },
          ]
        : []),
      ...(o.deliveredAt
        ? [
            {
              status: "DELIVERED",
              at: new Date(o.deliveredAt),
              byUserId: new ObjectId(o.farmerId),
            },
          ]
        : []),
      ...(o.completedAt
        ? [
            {
              status: "COMPLETED",
              at: new Date(o.completedAt),
              byUserId: new ObjectId(o.buyerId),
            },
          ]
        : []),
      ...(o.cancelledAt
        ? [
            {
              status: "CANCELLED",
              at: new Date(o.cancelledAt),
              byUserId: new ObjectId(o.buyerId),
              note: "Order cancelled per request",
            },
          ]
        : []),
      ...(o.dispute
        ? [
            {
              status: "DISPUTED",
              at: new Date(o.dispute.raisedAt),
              byUserId: new ObjectId(o.buyerId),
              note: o.dispute.note,
            },
          ]
        : []),
    ],
    createdAt: new Date(o.createdAt),
    confirmedAt: o.confirmedAt ? new Date(o.confirmedAt) : undefined,
    deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : undefined,
    completedAt: o.completedAt ? new Date(o.completedAt) : undefined,
    cancelledAt: o.cancelledAt ? new Date(o.cancelledAt) : undefined,
    dispute: o.dispute
      ? {
          reason: o.dispute.reason,
          note: o.dispute.note,
          raisedAt: new Date(o.dispute.raisedAt),
        }
      : undefined,
  }));
  await Order.insertMany(orderDocs);

  // 7. Insert Market Prices
  const marketPriceDocs = GOLDEN_MARKET_PRICES.map((mp) => ({
    cropId: new ObjectId(mp.cropId),
    division: mp.division,
    date: new Date(mp.date),
    avgPricePerKg: mp.avgPricePerKg,
    minPricePerKg: mp.minPricePerKg,
    maxPricePerKg: mp.maxPricePerKg,
    source: mp.source,
  }));
  await MarketPrice.insertMany(marketPriceDocs);

  return {
    users: [...GOLDEN_USERS],
    crops: [...GOLDEN_CROPS],
    listings: [...GOLDEN_LISTINGS],
    bids: [...GOLDEN_BIDS],
    orders: [...GOLDEN_ORDERS],
    marketPrices: [...GOLDEN_MARKET_PRICES],
  };
}

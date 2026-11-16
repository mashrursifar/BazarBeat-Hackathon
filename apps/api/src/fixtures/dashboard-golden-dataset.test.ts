import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  GOLDEN_BIDS,
  GOLDEN_CROPS,
  GOLDEN_LISTINGS,
  GOLDEN_MARKET_PRICES,
  GOLDEN_ORDERS,
  GOLDEN_USERS,
  getAsiaDhakaBucketKey,
} from "@bazarbeat/shared";

import { loadDashboardGoldenDataset } from "./dashboard-golden-dataset.js";
import { User } from "../modules/users/user.model.js";
import { Crop } from "../modules/crops/crop.model.js";
import { Listing } from "../modules/listings/listing.model.js";
import { Bid } from "../modules/bids/bid.model.js";
import { Order } from "../modules/orders/order.model.js";
import { MarketPrice } from "../modules/market-prices/market-price.model.js";

let mongoServer: MongoMemoryServer | undefined;

describe("Dashboard Golden Dataset Fixture (Task 7.1)", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("loads the golden dataset cleanly into a test database", async () => {
    const loaded = await loadDashboardGoldenDataset();

    expect(loaded.users).toHaveLength(5);
    expect(loaded.crops).toHaveLength(3);
    expect(loaded.listings).toHaveLength(24);
    expect(loaded.bids).toHaveLength(29);
    expect(loaded.orders).toHaveLength(15);
    expect(loaded.marketPrices.length).toBeGreaterThanOrEqual(15);

    // Verify in database via Mongoose models
    const [userCount, cropCount, listingCount, bidCount, orderCount, marketPriceCount] =
      await Promise.all([
        User.countDocuments({ _id: { $in: GOLDEN_USERS.map((u) => u.id) } }),
        Crop.countDocuments({ _id: { $in: GOLDEN_CROPS.map((c) => c.id) } }),
        Listing.countDocuments({ _id: { $in: GOLDEN_LISTINGS.map((l) => l.id) } }),
        Bid.countDocuments({ _id: { $in: GOLDEN_BIDS.map((b) => b.id) } }),
        Order.countDocuments({ _id: { $in: GOLDEN_ORDERS.map((o) => o.id) } }),
        MarketPrice.countDocuments({ cropId: { $in: GOLDEN_CROPS.map((c) => c.id) } }),
      ]);

    expect(userCount).toBe(5);
    expect(cropCount).toBe(3);
    expect(listingCount).toBe(24);
    expect(bidCount).toBe(29);
    expect(orderCount).toBe(15);
    expect(marketPriceCount).toBe(GOLDEN_MARKET_PRICES.length);
  });

  it("satisfies user role distribution: 2 farmers and 3 buyers", async () => {
    const farmers = await User.find({ role: "FARMER" });
    const buyers = await User.find({ role: "BUYER" });

    expect(farmers).toHaveLength(2);
    expect(buyers).toHaveLength(3);
    expect(farmers.map((f) => f.name)).toContain("Rahim Farmer");
    expect(farmers.map((f) => f.name)).toContain("Anwar Farmer");
  });

  it("satisfies order status requirement: orders in every status including cancelled and disputed", async () => {
    const orders = await Order.find().lean();
    const statuses = new Set(orders.map((o) => o.status));

    expect(statuses.has("COMPLETED")).toBe(true);
    expect(statuses.has("DELIVERED")).toBe(true);
    expect(statuses.has("CONFIRMED")).toBe(true);
    expect(statuses.has("PENDING")).toBe(true);
    expect(statuses.has("CANCELLED")).toBe(true);
    expect(statuses.has("DISPUTED")).toBe(true);

    const counts = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts["COMPLETED"]).toBe(4);
    expect(counts["DELIVERED"]).toBe(2);
    expect(counts["CONFIRMED"]).toBe(3);
    expect(counts["PENDING"]).toBe(2);
    expect(counts["CANCELLED"]).toBe(2);
    expect(counts["DISPUTED"]).toBe(2);
    expect(orders).toHaveLength(15);
  });

  it("satisfies listing status requirements: sold, unsold, cancelled, and active", async () => {
    const listings = await Listing.find().lean();
    const statuses = new Set(listings.map((l) => l.status));

    expect(statuses.has("SOLD")).toBe(true);
    expect(statuses.has("EXPIRED_UNSOLD")).toBe(true);
    expect(statuses.has("CANCELLED")).toBe(true);
    expect(statuses.has("ACTIVE")).toBe(true);

    const counts = listings.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts["SOLD"]).toBe(15);
    expect(counts["EXPIRED_UNSOLD"]).toBe(3);
    expect(counts["CANCELLED"]).toBe(2);
    expect(counts["ACTIVE"]).toBe(4);
    expect(listings).toHaveLength(24);
  });

  it("satisfies fractional kg and fee rounding requirements", async () => {
    const orders = await Order.find().lean();

    // Fractional quantities
    const fractionalOrders = orders.filter((o) => !Number.isInteger(o.quantityKg));
    expect(fractionalOrders.length).toBeGreaterThanOrEqual(4);
    expect(fractionalOrders.map((o) => o.quantityKg)).toEqual(
      expect.arrayContaining([25.5, 12.5, 100.5, 18.5]),
    );

    // Platform fee invariants: fee + net === subtotal on every order
    for (const o of orders) {
      expect(o.platformFee + o.farmerNet).toBe(o.subtotal);
      expect(Number.isInteger(o.platformFee)).toBe(true);
      expect(Number.isInteger(o.farmerNet)).toBe(true);
      expect(Number.isInteger(o.subtotal)).toBe(true);
    }

    // Specific fee rounding tests
    // Order 1: 116025 * 0.02 = 2320.5 => Math.round is 2321 (rounds UP)
    const order1 = orders.find((o) => o._id.toString() === "670000000000000000000301");
    expect(order1?.platformFee).toBe(2321);

    // Order 4: 210015 * 0.02 = 4200.3 => Math.round is 4200 (rounds DOWN)
    const order4 = orders.find((o) => o._id.toString() === "670000000000000000000304");
    expect(order4?.platformFee).toBe(4200);

    // Order 5: 296475 * 0.02 = 5929.5 => Math.round is 5930 (rounds UP)
    const order5 = orders.find((o) => o._id.toString() === "670000000000000000000305");
    expect(order5?.platformFee).toBe(5930);
  });

  it("satisfies orders exactly at Asia/Dhaka midnight", async () => {
    const orders = await Order.find().lean();

    // Order 2 created at 2026-11-09T18:00:00.000Z
    const order2 = orders.find((o) => o._id.toString() === "670000000000000000000302");
    expect(order2).toBeDefined();
    expect(order2!.createdAt.toISOString()).toBe("2026-11-09T18:00:00.000Z");
    expect(getAsiaDhakaBucketKey(order2!.createdAt, "day")).toBe("2026-11-10");

    // Order 6 created at 2026-11-14T18:00:00.000Z
    const order6 = orders.find((o) => o._id.toString() === "670000000000000000000306");
    expect(order6).toBeDefined();
    expect(order6!.createdAt.toISOString()).toBe("2026-11-14T18:00:00.000Z");
    expect(getAsiaDhakaBucketKey(order6!.createdAt, "day")).toBe("2026-11-15");
  });

  it("is idempotent on repeated loading", async () => {
    await loadDashboardGoldenDataset();
    await loadDashboardGoldenDataset();

    const orderCount = await Order.countDocuments();
    expect(orderCount).toBe(15);
  });
});

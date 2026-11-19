import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ListingStatus,
  OrderStatus,
  UserRole,
  normalizeBangladeshPhone,
} from "@bazarbeat/shared";

import { User } from "../modules/users/user.model.js";
import { Crop } from "../modules/crops/crop.model.js";
import { Listing } from "../modules/listings/listing.model.js";
import { Bid } from "../modules/bids/bid.model.js";
import { Order } from "../modules/orders/order.model.js";
import { InventoryItem } from "../modules/inventory/inventory-item.model.js";
import { StockMovement } from "../modules/inventory/stock-movement.model.js";
import { MarketPrice } from "../modules/market-prices/market-price.model.js";
import { farmerDashboardService } from "../modules/dashboards/farmer-dashboard.service.js";
import { buyerDashboardService } from "../modules/dashboards/buyer-dashboard.service.js";
import { closeDueListings } from "../modules/auctions/scheduler.service.js";
import { DEV_SEED_CREDENTIALS, verifyFarmerCropLedger } from "./dev-listings.js";
import { seedDemo, spawnDemoAuctions } from "./demo-seeder.js";

let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([
    User.init(),
    Crop.init(),
    Listing.init(),
    Bid.init(),
    InventoryItem.init(),
    StockMovement.init(),
    Order.init(),
    MarketPrice.init(),
  ]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) {
    await mongoServer.stop();
  }
});

describe("Task 9.4 — Consolidated Demo Seed, Reset and Spawn", () => {
  describe("Safety Guard (ALLOW_DEMO_SEED=true)", () => {
    it("refuses to run seedDemo unless ALLOW_DEMO_SEED=true", async () => {
      const originalEnv = process.env.ALLOW_DEMO_SEED;
      delete process.env.ALLOW_DEMO_SEED;
      try {
        await expect(seedDemo({ silent: true })).rejects.toThrow(
          /ALLOW_DEMO_SEED=true/,
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.ALLOW_DEMO_SEED = originalEnv;
        }
      }
    });

    it("refuses to run spawnDemoAuctions unless ALLOW_DEMO_SEED=true", async () => {
      const originalEnv = process.env.ALLOW_DEMO_SEED;
      delete process.env.ALLOW_DEMO_SEED;
      try {
        await expect(spawnDemoAuctions({ silent: true })).rejects.toThrow(
          /ALLOW_DEMO_SEED=true/,
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.ALLOW_DEMO_SEED = originalEnv;
        }
      }
    });
  });

  describe("Deterministic Full Demo Seeding (npm run seed:demo)", () => {
    it("rebuilds the whole demo dataset deterministically with 12 farmers, 8 buyers, 20+ listings, and 60-90d history", async () => {
      const startTime = Date.now();
      const result = await seedDemo({ silent: true, allowDemoSeed: true });
      const elapsedSeconds = (Date.now() - startTime) / 1000;

      // Reset timing under 30 seconds requirement
      expect(elapsedSeconds).toBeLessThan(30);

      // 1. Exactly 12 farmers across at least 6 divisions (all 8 divisions present)
      expect(result.farmers.length).toBe(12);
      const divisions = new Set(result.farmers.map((f) => f.division));
      expect(divisions.size).toBe(8);
      expect(divisions.size).toBeGreaterThanOrEqual(6);

      // 2. Exactly 8 buyers with distinct profiles
      expect(result.buyers.length).toBe(8);

      // 3. Documented Demo Farmer and Demo Buyer credentials
      const demoFarmer = await User.findOne({
        phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.farmer.phone),
      });
      expect(demoFarmer).not.toBeNull();
      expect(demoFarmer?.role).toBe(UserRole.FARMER);
      expect(demoFarmer?.division).toBe("dhaka");
      expect(demoFarmer?.upazila).toBe("Savar");

      const demoBuyer = await User.findOne({
        phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.buyer.phone),
      });
      expect(demoBuyer).not.toBeNull();
      expect(demoBuyer?.role).toBe(UserRole.BUYER);
      expect(demoBuyer?.organization).toBe("Bengal Agro Wholesale Ltd");

      // 4. Crop catalog: 5 active crops
      const crops = await Crop.find({ isActive: true }).lean();
      expect(crops.length).toBe(5);

      // 5. 60 days of market price history for all 5 crops across 8 divisions
      const marketPriceCount = await MarketPrice.countDocuments();
      expect(marketPriceCount).toBe(60 * 5 * 8); // 2,400 rows

      // 6. 25 active listings (>= 20 requirement) across all 5 crops and grades (A, B, C)
      expect(result.listings.length).toBe(25);
      const activeListings = await Listing.find({ status: ListingStatus.ACTIVE }).lean();
      expect(activeListings.length).toBe(25);

      // Verify sample photos are stored URLs (via active storage provider)
      for (const listing of activeListings) {
        expect(listing.images.length).toBeGreaterThan(0);
        expect(listing.images[0]?.url).toBeDefined();
        expect(listing.images[0]!.url.length).toBeGreaterThan(0);
      }

      // 7. Active bids placed
      expect(result.bidsCount).toBeGreaterThan(0);

      // 8. 60 to 90 days of historical activity (dev-history-seeder)
      expect(result.history).toBeDefined();
      expect(result.history?.listingsCount).toBeGreaterThanOrEqual(20);
      expect(result.history?.soldCount).toBeGreaterThanOrEqual(15);
      expect(result.history?.unsoldCount).toBeGreaterThanOrEqual(1);
      expect(result.history?.cancelledCount).toBeGreaterThanOrEqual(1);
      expect(result.history?.ordersCount).toBeGreaterThanOrEqual(15);

      // 9. All ledger reconciliations pass for every farmer and crop
      expect(result.reconciliationPassed).toBe(true);
      for (const crop of crops) {
        const balances = await verifyFarmerCropLedger(result.farmers[0]!.id, crop._id.toString());
        expect(balances.availableKg).toBeGreaterThanOrEqual(0);
        expect(balances.listedKg).toBeGreaterThanOrEqual(0);
      }

      // 10. Dashboard golden numbers hold for Demo Farmer and Demo Buyer
      const farmerDash = await farmerDashboardService.getFarmerDashboard(result.farmers[0]!.id, {
        range: "30d",
      });
      expect(farmerDash.data.kpis.totalSales.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.earnings.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.winRate.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.orders?.value).toBeGreaterThan(0);
      expect(farmerDash.data.salesTrend.length).toBe(30);

      const buyerDash = await buyerDashboardService.getBuyerDashboard(result.buyers[0]!.id, {
        range: "30d",
      });
      expect(buyerDash.data.kpis.totalSpend.value).toBeGreaterThan(0);
      expect(buyerDash.data.kpis.winRate.value).toBeGreaterThan(0);
      expect(buyerDash.data.kpis.orders?.value).toBeGreaterThan(0);
      expect(buyerDash.data.spendTrend.length).toBe(30);
    }, 45_000);

    it("can be run repeatedly (demo:reset) in under 30 seconds leaving identical state", async () => {
      const firstRun = await seedDemo({ silent: true, allowDemoSeed: true });
      expect(firstRun.reconciliationPassed).toBe(true);
      const firstActiveListings = await Listing.countDocuments({ status: ListingStatus.ACTIVE });
      const firstOrders = await Order.countDocuments();
      const firstBids = await Bid.countDocuments();

      const resetStartTime = Date.now();
      const secondRun = await seedDemo({ silent: true, allowDemoSeed: true });
      const resetElapsedSeconds = (Date.now() - resetStartTime) / 1000;

      // In under 30 seconds
      expect(resetElapsedSeconds).toBeLessThan(30);

      const secondActiveListings = await Listing.countDocuments({ status: ListingStatus.ACTIVE });
      const secondOrders = await Order.countDocuments();
      const secondBids = await Bid.countDocuments();

      expect(secondActiveListings).toBe(firstActiveListings);
      expect(secondOrders).toBe(firstOrders);
      expect(secondBids).toBe(firstBids);
      expect(secondRun.reconciliationPassed).toBe(true);
    }, 90_000);
  });

  describe("Spawn Demo Auctions (npm run demo:spawn-auctions)", () => {
    it("publishes fresh short auctions that end in minutes and close on schedule", async () => {
      // Ensure base demo dataset is ready
      await seedDemo({ silent: true, allowDemoSeed: true });

      const spawnResult = await spawnDemoAuctions({ silent: true, allowDemoSeed: true });
      expect(spawnResult.listings.length).toBe(3);
      expect(spawnResult.bidsCount).toBe(1);

      // Verify they are active with 2-minute durations
      const now = Date.now();
      for (const listing of spawnResult.listings) {
        expect(listing.status).toBe(ListingStatus.ACTIVE);
        const endsAtMs = new Date(listing.endsAt).getTime();
        expect(endsAtMs).toBeGreaterThan(now);
        // Ends within ~2 minutes
        expect(endsAtMs - now).toBeLessThanOrEqual(130 * 1000);
      }

      // Fast-forward auction expiration by setting endsAt to the past
      const pastTime = new Date(Date.now() - 5000);
      const spawnedIds = spawnResult.listings.map((l) => l.id);
      await Listing.updateMany({ _id: { $in: spawnedIds } }, { $set: { endsAt: pastTime } });

      // Run auction scheduler catch-up / expiration processing
      const summary = await closeDueListings();
      expect(summary.closed).toBeGreaterThanOrEqual(3);

      // Auction 1 (with bid from Demo Buyer) sold and generated an order
      const soldListing = await Listing.findById(spawnedIds[0]).lean();
      expect(soldListing?.status).toBe(ListingStatus.SOLD);
      const order = await Order.findOne({ listingId: spawnedIds[0] }).lean();
      expect(order).not.toBeNull();
      expect(order?.status).toBe(OrderStatus.PENDING);
      expect(order?.pricePerKg).toBe(6400);

      // Auctions 2 and 3 (without bids) expired unsold
      const unsoldListing1 = await Listing.findById(spawnedIds[1]).lean();
      expect(unsoldListing1?.status).toBe(ListingStatus.EXPIRED_UNSOLD);

      const unsoldListing2 = await Listing.findById(spawnedIds[2]).lean();
      expect(unsoldListing2?.status).toBe(ListingStatus.EXPIRED_UNSOLD);

      // Re-running seedDemo (demo:reset) after spawned auctions cleans up cleanly
      const postReset = await seedDemo({ silent: true, allowDemoSeed: true });
      expect(postReset.reconciliationPassed).toBe(true);
      expect(await Listing.countDocuments({ status: ListingStatus.ACTIVE })).toBe(25);
    }, 90_000);
  });
});

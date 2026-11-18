import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CropGrade,
  MarketplaceSort,
  UserRole,
  marketplaceQuerySchema,
  normalizeBangladeshPhone,
} from "@bazarbeat/shared";

import { User } from "../modules/users/user.model.js";
import { Crop } from "../modules/crops/crop.model.js";
import { Listing } from "../modules/listings/listing.model.js";
import { Bid } from "../modules/bids/bid.model.js";
import { InventoryItem } from "../modules/inventory/inventory-item.model.js";
import { StockMovement } from "../modules/inventory/stock-movement.model.js";
import { Order } from "../modules/orders/order.model.js";
import { farmerDashboardService } from "../modules/dashboards/farmer-dashboard.service.js";
import { buyerDashboardService } from "../modules/dashboards/buyer-dashboard.service.js";
import { getMarketplaceListings } from "../modules/listings/listing.service.js";
import { DEV_SEED_CREDENTIALS, seedDevListings, verifyFarmerCropLedger } from "./dev-listings.js";

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
  ]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) {
    await mongoServer.stop();
  }
});

describe("Dev Listing Seeder (Task 5.6)", () => {
  it("refuses to run when NODE_ENV is production", async () => {
    await expect(seedDevListings({ nodeEnv: "production", silent: true })).rejects.toThrow(
      /Refusing to run seed:dev-listings in production environment/,
    );
  });

  it("seeds farmers across >= 6 divisions, crops, 25 listings with varied properties, and bids", async () => {
    const result = await seedDevListings({ silent: true });

    // 1. Farmers and buyers count
    expect(result.farmers.length).toBe(8);
    const divisions = new Set(result.farmers.map((f) => f.division));
    expect(divisions.size).toBeGreaterThanOrEqual(6);
    expect(result.buyers.length).toBe(3);

    // 2. Demo credentials check
    const demoFarmer = await User.findOne({
      phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.farmer.phone),
    });
    expect(demoFarmer).not.toBeNull();
    expect(demoFarmer?.role).toBe(UserRole.FARMER);
    expect(demoFarmer?.division).toBe(DEV_SEED_CREDENTIALS.farmer.division);

    const demoBuyer = await User.findOne({
      phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.buyer.phone),
    });
    expect(demoBuyer).not.toBeNull();
    expect(demoBuyer?.role).toBe(UserRole.BUYER);
    expect(demoBuyer?.organization).toBe(DEV_SEED_CREDENTIALS.buyer.organization);

    // 3. Exactly 25 listings across all 5 crops and all grades
    expect(result.listings.length).toBe(25);
    const dbListingsCount = await Listing.countDocuments();
    expect(dbListingsCount).toBe(25);

    const crops = await Crop.find({ isActive: true }).lean();
    expect(crops.length).toBe(5);

    for (const crop of crops) {
      const cropListings = await Listing.find({ cropId: crop._id }).lean();
      expect(cropListings.length).toBe(5);

      const grades = cropListings.map((l) => l.aiAssessment.grade);
      expect(grades).toContain(CropGrade.A);
      expect(grades).toContain(CropGrade.B);
      expect(grades).toContain(CropGrade.C);
    }

    // 4. Varied durations (some ending soon <= 60 min, others longer)
    const nowMs = Date.now();
    const endingSoon = result.listings.filter((l) => {
      const endsAtMs = new Date(l.endsAt).getTime();
      return endsAtMs - nowMs <= 65 * 60 * 1000;
    });
    expect(endingSoon.length).toBe(5);

    // 5. Bids placed
    expect(result.bidsCount).toBe(24);
    const totalBidsInDb = await Bid.countDocuments();
    expect(totalBidsInDb).toBe(24);

    // 6. Ledger reconciliation verified
    expect(result.reconciliationPassed).toBe(true);

    const inventoryItems = await InventoryItem.find().lean();
    expect(inventoryItems.length).toBeGreaterThan(0);
    for (const item of inventoryItems) {
      const balances = await verifyFarmerCropLedger(
        item.farmerId.toString(),
        item.cropId.toString(),
      );
      expect(balances.availableKg).toBe(100); // 100 kg reserve buffer
      expect(balances.listedKg).toBeGreaterThan(0);
      expect(balances.soldKg).toBe(0);
    }
  }, 30_000);

  it("returns varied results for marketplace endpoint queries (filters and sorts)", async () => {
    // All 25 active listings returned
    const all = await getMarketplaceListings(marketplaceQuerySchema.parse({ page: 1, limit: 50 }));
    expect(all.total).toBe(25);
    expect(all.listings.length).toBe(25);

    // Filter by crop
    const onionListings = await getMarketplaceListings(
      marketplaceQuerySchema.parse({ crop: "onion", page: 1, limit: 20 }),
    );
    expect(onionListings.total).toBe(5);
    expect(onionListings.listings.every((l) => l.crop.slug === "onion")).toBe(true);

    // Filter by grade
    const gradeAListings = await getMarketplaceListings(
      marketplaceQuerySchema.parse({
        grade: CropGrade.A,
        page: 1,
        limit: 20,
      }),
    );
    expect(gradeAListings.total).toBe(10);
    expect(gradeAListings.listings.every((l) => l.grade === CropGrade.A)).toBe(true);

    // Filter by division
    const dhakaListings = await getMarketplaceListings(
      marketplaceQuerySchema.parse({
        division: "dhaka",
        page: 1,
        limit: 20,
      }),
    );
    expect(dhakaListings.total).toBeGreaterThan(0);
    expect(dhakaListings.listings.every((l) => l.location.division === "dhaka")).toBe(true);

    // Filter by endingWithin (ending soon <= 1h)
    const endingSoonListings = await getMarketplaceListings(
      marketplaceQuerySchema.parse({
        endingWithin: 1,
        page: 1,
        limit: 20,
      }),
    );
    expect(endingSoonListings.total).toBe(5);

    // Sort by lowest price
    const lowestPrice = await getMarketplaceListings(
      marketplaceQuerySchema.parse({
        sort: MarketplaceSort.LOWEST_PRICE,
        page: 1,
        limit: 25,
      }),
    );
    for (let i = 1; i < lowestPrice.listings.length; i += 1) {
      const prev = lowestPrice.listings[i - 1];
      const curr = lowestPrice.listings[i];
      if (prev && curr) {
        expect(prev.displayPricePerKg).toBeLessThanOrEqual(curr.displayPricePerKg);
      }
    }

    // Sort by highest grade (A > B > C)
    const gradeWeight = { A: 3, B: 2, C: 1 };
    const highestGrade = await getMarketplaceListings(
      marketplaceQuerySchema.parse({
        sort: MarketplaceSort.HIGHEST_GRADE,
        page: 1,
        limit: 25,
      }),
    );
    for (let i = 1; i < highestGrade.listings.length; i += 1) {
      const prev = highestGrade.listings[i - 1];
      const curr = highestGrade.listings[i];
      if (prev && curr) {
        expect(gradeWeight[prev.grade]).toBeGreaterThanOrEqual(gradeWeight[curr.grade]);
      }
    }
  }, 30_000);

  it("is repeatable and leaves a consistent database when run twice (cleans up previous run)", async () => {
    // Run second time on already seeded database
    const secondResult = await seedDevListings({ silent: true });

    // Assert counts do not double
    expect(secondResult.listings.length).toBe(25);
    const dbListingsCount = await Listing.countDocuments();
    expect(dbListingsCount).toBe(25);

    const dbFarmersCount = await User.countDocuments({ role: UserRole.FARMER });
    expect(dbFarmersCount).toBe(8);

    const dbBuyersCount = await User.countDocuments({ role: UserRole.BUYER });
    expect(dbBuyersCount).toBe(3);

    const totalBidsInDb = await Bid.countDocuments();
    expect(totalBidsInDb).toBe(24);

    // Assert ledger reconciliation passes completely on repeated run
    expect(secondResult.reconciliationPassed).toBe(true);

    const inventoryItems = await InventoryItem.find().lean();
    for (const item of inventoryItems) {
      const balances = await verifyFarmerCropLedger(
        item.farmerId.toString(),
        item.cropId.toString(),
      );
      expect(balances.availableKg).toBe(100);
      expect(balances.listedKg).toBeGreaterThan(0);
      expect(balances.soldKg).toBe(0);
    }
  }, 30_000);

  describe("History Mode (Task 7.5)", () => {
    it("seeds 60 to 90 days of past activity with consistent invariants, reconciliation, and dashboard series", async () => {
      const result = await seedDevListings({ history: true, silent: true });

      // 1. History result is populated
      expect(result.history).toBeDefined();
      expect(result.history?.listingsCount).toBeGreaterThanOrEqual(20);
      expect(result.history?.ordersCount).toBeGreaterThanOrEqual(15);
      expect(result.history?.soldCount).toBeGreaterThanOrEqual(15);
      expect(result.history?.unsoldCount).toBeGreaterThanOrEqual(1);
      expect(result.history?.cancelledCount).toBeGreaterThanOrEqual(1);

      // 2. Active listings are still exactly 25
      expect(result.listings.length).toBe(25);
      const activeCount = await Listing.countDocuments({ status: "ACTIVE" });
      expect(activeCount).toBe(25);

      // 3. Invariant: One order per sold listing
      const soldListings = await Listing.find({ status: "SOLD" }).lean();
      expect(soldListings.length).toBe(result.history!.soldCount);
      for (const soldListing of soldListings) {
        const order = await Order.findOne({ listingId: soldListing._id });
        expect(order).not.toBeNull();
        expect(order?.quantityKg).toBe(soldListing.quantityKg);
        expect(order?.pricePerKg).toBe(soldListing.currentBidPerKg);
        expect(order?.farmerId.toString()).toBe(soldListing.farmerId.toString());
        expect(order?.buyerId.toString()).toBe(soldListing.currentBidderId?.toString());
      }

      // 4. Invariant: Bid counts and summaries match
      for (const soldListing of soldListings) {
        const bidCount = await Bid.countDocuments({ listingId: soldListing._id });
        expect(soldListing.bidCount).toBe(bidCount);
      }

      // 5. Invariant: Inventory ledger reconciles for demo farmer across all crops
      const demoFarmerId = result.farmers[0]!.id;
      const crops = await Crop.find({ isActive: true }).lean();
      for (const crop of crops) {
        const balances = await verifyFarmerCropLedger(demoFarmerId, crop._id.toString());
        expect(balances.soldKg).toBeGreaterThan(0);
      }

      // 6. Farmer Dashboard shows non-trivial series and KPIs
      const farmerDash = await farmerDashboardService.getFarmerDashboard(demoFarmerId, {
        range: "30d",
      });
      expect(farmerDash.data.kpis.totalSales.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.earnings.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.winRate.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.orders?.value).toBeGreaterThan(0);
      expect(farmerDash.data.kpis.topCrop).not.toBeNull();
      expect(farmerDash.data.salesTrend.length).toBe(30);
      const nonZeroTrend = farmerDash.data.salesTrend.filter((b) => b.sales > 0);
      expect(nonZeroTrend.length).toBeGreaterThan(0);
      expect(farmerDash.data.earningsByCrop.length).toBeGreaterThan(0);

      // 7. Buyer Dashboard shows non-trivial series and KPIs for demo buyer
      const demoBuyerId = result.buyers[0]!.id;
      const buyerDash = await buyerDashboardService.getBuyerDashboard(demoBuyerId, {
        range: "30d",
      });
      expect(buyerDash.data.kpis.totalSpend.value).toBeGreaterThan(0);
      expect(buyerDash.data.kpis.winRate.value).toBeGreaterThan(0);
      expect(buyerDash.data.kpis.orders?.value).toBeGreaterThan(0);
      expect(buyerDash.data.spendTrend.length).toBe(30);
      const nonZeroSpend = buyerDash.data.spendTrend.filter((b) => b.spend > 0);
      expect(nonZeroSpend.length).toBeGreaterThan(0);
      expect(buyerDash.data.purchasesByCrop.length).toBeGreaterThan(0);
    }, 45_000);

    it("is repeatable and leaves a consistent database when history mode is run twice", async () => {
      // First run with history
      const firstResult = await seedDevListings({ history: true, silent: true });
      expect(firstResult.reconciliationPassed).toBe(true);
      const firstListingsCount = await Listing.countDocuments();
      const firstOrdersCount = await Order.countDocuments();
      const firstBidsCount = await Bid.countDocuments();

      // Second run with history
      const secondResult = await seedDevListings({ history: true, silent: true });
      const secondListingsCount = await Listing.countDocuments();
      const secondOrdersCount = await Order.countDocuments();
      const secondBidsCount = await Bid.countDocuments();

      expect(secondListingsCount).toBe(firstListingsCount);
      expect(secondOrdersCount).toBe(firstOrdersCount);
      expect(secondBidsCount).toBe(firstBidsCount);

      // Invariants and reconciliation hold on repeat
      expect(secondResult.reconciliationPassed).toBe(true);
      const demoFarmerId = secondResult.farmers[0]!.id;
      const crops = await Crop.find({ isActive: true }).lean();
      for (const crop of crops) {
        await verifyFarmerCropLedger(demoFarmerId, crop._id.toString());
      }
    }, 45_000);
  });
});

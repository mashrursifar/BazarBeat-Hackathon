import mongoose, { Types } from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ListingStatus,
  type PublicUser,
  UserRole,
  farmerListingResponseSchema,
} from "@bazarbeat/shared";

import { resetClock } from "../../shared/clock.js";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { Crop } from "../crops/crop.model.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { addStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { AiAssessmentRecord } from "../ai/ai-assessment-record.model.js";
import { Bid } from "../bids/bid.model.js";
import { Order } from "../orders/order.model.js";
import { Listing } from "./listing.model.js";

const farmerAId = new Types.ObjectId().toString();
const farmerBId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const activeCropId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmerA: {
    id: farmerAId,
    role: UserRole.FARMER,
    name: "Farmer A",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  farmerB: {
    id: farmerBId,
    role: UserRole.FARMER,
    name: "Farmer B",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  buyer: {
    id: buyerId,
    role: UserRole.BUYER,
    name: "Buyer",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
};

let mongoReplSet: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplSet.getUri());
  await Promise.all([
    Crop.init(),
    InventoryItem.init(),
    StockMovement.init(),
    AiAssessmentRecord.init(),
    Listing.init(),
    Bid.init(),
    Order.init(),
  ]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (user === undefined) throw new Error("Unexpected test access token");
    return user;
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet !== undefined) await mongoReplSet.stop();
});

afterEach(() => {
  resetClock();
});

beforeEach(async () => {
  await Promise.all([
    Crop.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    AiAssessmentRecord.deleteMany({}),
    Listing.deleteMany({}),
    Bid.deleteMany({}),
    Order.deleteMany({}),
  ]);

  await Crop.create({
    _id: activeCropId,
    slug: "bitter-gourd",
    nameEn: "Bitter Gourd",
    nameBn: "করলা",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120, // 120 hours = 7200 minutes
    gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Ripe and usable" },
    minIncrementPerKg: 100,
    imageUrl: "/images/crops/placeholder.svg",
    isActive: true,
  });

  // Seed farmerA with 500 kg stock
  await addStock({
    farmerId: farmerAId,
    cropId: activeCropId,
    quantityKg: 500,
    operationId: `seed-stock-${Date.now()}`,
    note: "Initial test harvest stock",
  });
});

function withAccessToken(token: "farmerA" | "farmerB" | "buyer"): string {
  return `accessToken=${token}`;
}

async function createActiveListing(options?: {
  farmerId?: string;
  cropId?: string;
  quantityKg?: number;
  floorPricePerKg?: number;
  assessedAt?: Date;
  endsAt?: Date;
}): Promise<string> {
  const listingId = new Types.ObjectId().toString();
  const farmerId = options?.farmerId ?? farmerAId;
  const cropId = options?.cropId ?? activeCropId;
  const quantityKg = options?.quantityKg ?? 50;
  const floorPricePerKg = options?.floorPricePerKg ?? 4500;
  const assessedAt = options?.assessedAt ?? new Date();
  const now = new Date();
  const endsAt = options?.endsAt ?? new Date(now.getTime() + 6 * 3600 * 1000);

  // Reserve stock for listing
  await reserveStockForListing({
    farmerId,
    cropId,
    quantityKg,
    listingId,
    operationId: `list-${listingId}`,
    note: `Reserved for test listing ${listingId}`,
  });

  await Listing.create({
    _id: listingId,
    farmerId: new ObjectId(farmerId),
    cropId: new ObjectId(cropId),
    quantityKg,
    images: [{ url: "/uploads/img1.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: "A",
      confidence: 0.92,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.8, B: 0.15, C: 0.05 },
      qualityNotes: ["Firm and fresh"],
      cropMatch: true,
      modelVersion: "mock-1.0",
      provider: "mock",
      degraded: false,
      assessedAt,
      imageHashes: ["hash123"],
    },
    aiPriceGuidance: {
      lowPerKg: 4000,
      expectedPerKg: 5000,
      highPerKg: 6000,
      trend: "UP",
      confidence: 0.85,
      explanation: ["Test guidance"],
      modelVersion: "mock-1.0",
      provider: "mock",
      degraded: false,
      generatedAt: now,
      suggestedFloorPerKg: 4500,
    },
    floorPricePerKg,
    minIncrementPerKg: 100,
    startsAt: now,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    bidCount: 0,
    location: {
      division: "dhaka",
      district: "dhaka",
    },
    pickupNote: "Farm gate collection",
  });

  return listingId;
}

describe("Task 4.6 — Farmer controls: cancel, accept now, relist", () => {
  describe("POST /api/v1/listings/:id/cancel", () => {
    it("successfully cancels an ACTIVE listing with zero bids, releases stock, sets status CANCELLED", async () => {
      const listingId = await createActiveListing();

      // Check stock before cancellation: 450 available, 50 listed
      let inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(450);
      expect(inventory?.listedKg).toBe(50);

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/cancel`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(200);
      expect(farmerListingResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.data.status).toBe(ListingStatus.CANCELLED);
      expect(res.body.data.closedAt).toBeDefined();

      // Check listing in DB
      const dbListing = await Listing.findById(listingId);
      expect(dbListing?.status).toBe(ListingStatus.CANCELLED);

      // Check stock after cancellation: 500 available, 0 listed
      inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(500);
      expect(inventory?.listedKg).toBe(0);

      // Check ledger movement RELEASE
      const movements = await StockMovement.find({ listingId }).sort({ createdAt: -1 });
      expect(movements.length).toBe(2);
      const latestMovement = movements[0];
      expect(latestMovement?.type).toBe("RELEASE");
      expect(latestMovement?.quantityKg).toBe(50);
      expect(latestMovement?.status).toBe("APPLIED");
    });

    it("rejects cancel with 400 HAS_BIDS when listing has existing bids, leaves stock unchanged", async () => {
      const listingId = await createActiveListing();

      // Buyer places a valid bid
      const bidRes = await request(app)
        .post(`/api/v1/listings/${listingId}/bids`)
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4600 });
      expect(bidRes.status).toBe(201);

      // Farmer attempts to cancel
      const cancelRes = await request(app)
        .post(`/api/v1/listings/${listingId}/cancel`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error.code).toBe("HAS_BIDS");

      // Listing must remain ACTIVE
      const dbListing = await Listing.findById(listingId);
      expect(dbListing?.status).toBe(ListingStatus.ACTIVE);
      expect(dbListing?.bidCount).toBe(1);

      // Stock remains listed (450 available, 50 listed)
      const inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(450);
      expect(inventory?.listedKg).toBe(50);
    });

    it("enforces mutual exclusion in cancel versus bid race: simultaneous bid and cancel cannot both win", async () => {
      const listingId = await createActiveListing();

      // Launch cancel and bid concurrently
      const [cancelRes, bidRes] = await Promise.all([
        request(app)
          .post(`/api/v1/listings/${listingId}/cancel`)
          .set("Cookie", withAccessToken("farmerA"))
          .set("X-CSRF-Protection", "1"),
        request(app)
          .post(`/api/v1/listings/${listingId}/bids`)
          .set("Cookie", withAccessToken("buyer"))
          .set("X-CSRF-Protection", "1")
          .send({ amountPerKg: 4600 }),
      ]);

      const dbListing = await Listing.findById(listingId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });

      if (cancelRes.status === 200) {
        // Cancel won the race!
        expect(cancelRes.body.data.status).toBe(ListingStatus.CANCELLED);
        // Bid must have failed because auction is closed / cancelled
        expect(bidRes.status).toBe(400);
        expect(bidRes.body.error.code).toBe("AUCTION_CLOSED");
        expect(dbListing?.status).toBe(ListingStatus.CANCELLED);
        expect(dbListing?.bidCount).toBe(0);
        // Stock must be released
        expect(inventory?.availableKg).toBe(500);
        expect(inventory?.listedKg).toBe(0);
      } else {
        // Bid won the race!
        expect(bidRes.status).toBe(201);
        // Cancel must have failed with HAS_BIDS
        expect(cancelRes.status).toBe(400);
        expect(cancelRes.body.error.code).toBe("HAS_BIDS");
        expect(dbListing?.status).toBe(ListingStatus.ACTIVE);
        expect(dbListing?.bidCount).toBe(1);
        // Stock remains listed
        expect(inventory?.availableKg).toBe(450);
        expect(inventory?.listedKg).toBe(50);
      }
    });

    it("rejects cancel on non-existent listing with 404 NOT_FOUND", async () => {
      const nonexistentId = new Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/listings/${nonexistentId}/cancel`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects cancel on non-ACTIVE listing with 400 INVALID_TRANSITION", async () => {
      const listingId = await createActiveListing();
      // Set to EXPIRED_UNSOLD directly
      await Listing.updateOne({ _id: listingId }, { status: ListingStatus.EXPIRED_UNSOLD });

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/cancel`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    });

    it("negative authorization: rejects cancel by another farmer with 403 FORBIDDEN", async () => {
      const listingId = await createActiveListing({ farmerId: farmerAId });

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/cancel`)
        .set("Cookie", withAccessToken("farmerB"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("negative authorization: rejects cancel by a buyer with 403 FORBIDDEN", async () => {
      const listingId = await createActiveListing({ farmerId: farmerAId });

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/cancel`)
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/listings/:id/accept-current-bid", () => {
    it("rejects accept without a bid with 400 NO_BIDS", async () => {
      const listingId = await createActiveListing();

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/accept-current-bid`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NO_BIDS");
    });

    it("successfully accepts when current bid is at or above floor, moves stock to sold, creates order", async () => {
      const listingId = await createActiveListing({ floorPricePerKg: 4500 });

      // Place a bid at 4800 (above floor)
      const bidRes = await request(app)
        .post(`/api/v1/listings/${listingId}/bids`)
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4800 });
      expect(bidRes.status).toBe(201);

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/accept-current-bid`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      // Check listing in DB
      const dbListing = await Listing.findById(listingId);
      expect(dbListing?.status).toBe(ListingStatus.SOLD);
      expect(dbListing?.closedAt).toBeDefined();

      // Order created in DB
      const order = await Order.findOne({ listingId });
      expect(order).toBeDefined();
      expect(order?.pricePerKg).toBe(4800);
      expect(order?.quantityKg).toBe(50);
      expect(order?.farmerId.toString()).toBe(farmerAId);
      expect(order?.buyerId.toString()).toBe(buyerId);

      // Stock moved to sold: available 450, listed 0, sold 50
      const inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(450);
      expect(inventory?.listedKg).toBe(0);
      expect(inventory?.soldKg).toBe(50);

      // Check SELL ledger movement
      const sellMovement = await StockMovement.findOne({
        orderId: order?._id.toString(),
        type: "SELL",
      });
      expect(sellMovement).toBeDefined();
      expect(sellMovement?.quantityKg).toBe(50);
    });

    it("negative authorization: rejects accept by another farmer with 403 FORBIDDEN", async () => {
      const listingId = await createActiveListing({ farmerId: farmerAId });

      await request(app)
        .post(`/api/v1/listings/${listingId}/bids`)
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4600 });

      const res = await request(app)
        .post(`/api/v1/listings/${listingId}/accept-current-bid`)
        .set("Cookie", withAccessToken("farmerB"))
        .set("X-CSRF-Protection", "1");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/listings/:id/relist", () => {
    async function createUnsoldListing(options?: {
      assessedAt?: Date;
      quantityKg?: number;
      relistedToListingId?: string;
    }): Promise<string> {
      const listingId = new Types.ObjectId().toString();
      const quantityKg = options?.quantityKg ?? 50;
      const assessedAt = options?.assessedAt ?? new Date();
      const now = new Date();

      await Listing.create({
        _id: listingId,
        farmerId: new ObjectId(farmerAId),
        cropId: new ObjectId(activeCropId),
        quantityKg,
        images: [{ url: "/uploads/img1.jpg", width: 800, height: 600 }],
        aiAssessment: {
          grade: "A",
          confidence: 0.92,
          confidenceBand: "HIGH",
          classProbabilities: { A: 0.8, B: 0.15, C: 0.05 },
          qualityNotes: ["Firm and fresh"],
          cropMatch: true,
          modelVersion: "mock-1.0",
          provider: "mock",
          degraded: false,
          assessedAt,
          imageHashes: ["hash123"],
        },
        aiPriceGuidance: {
          lowPerKg: 4000,
          expectedPerKg: 5000,
          highPerKg: 6000,
          trend: "UP",
          confidence: 0.85,
          explanation: ["Test guidance"],
          modelVersion: "mock-1.0",
          provider: "mock",
          degraded: false,
          generatedAt: now,
          suggestedFloorPerKg: 4500,
        },
        floorPricePerKg: 4500,
        minIncrementPerKg: 100,
        startsAt: new Date(now.getTime() - 24 * 3600 * 1000),
        endsAt: new Date(now.getTime() - 1000),
        originalEndsAt: new Date(now.getTime() - 1000),
        extensionCount: 0,
        status: ListingStatus.EXPIRED_UNSOLD,
        bidCount: 0,
        location: { division: "dhaka", district: "dhaka" },
        pickupNote: "Farm gate collection",
        closedAt: new Date(now.getTime() - 1000),
        relistedToListingId: options?.relistedToListingId
          ? new ObjectId(options.relistedToListingId)
          : undefined,
      });

      return listingId;
    }

    it("successfully relists an EXPIRED_UNSOLD listing: re-checks and reserves stock, recomputes guidance, sets relistedFromId", async () => {
      // Farmer has 500 kg available stock initially
      let inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(500);
      expect(inventory?.listedKg).toBe(0);

      const unsoldListingId = await createUnsoldListing();

      const res = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          floorPricePerKg: 4200, // new floor
          durationMinutes: 180, // 3 hours
          pickupNote: "Relisted lot, farm gate",
        });

      expect(res.status).toBe(201);
      expect(farmerListingResponseSchema.safeParse(res.body).success).toBe(true);

      const newListing = res.body.data;
      expect(newListing.id).toBeDefined();
      expect(newListing.id).not.toBe(unsoldListingId);
      expect(newListing.status).toBe(ListingStatus.ACTIVE);
      expect(newListing.floorPricePerKg).toBe(4200);
      expect(newListing.relistedFromId).toBe(unsoldListingId);
      expect(newListing.aiAssessment.grade).toBe("A"); // Preserves grade

      // Verify stock state: 500 - 50 = 450 available, 50 listed
      inventory = await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId });
      expect(inventory?.availableKg).toBe(450);
      expect(inventory?.listedKg).toBe(50);

      // Verify source listing was marked with relistedToListingId
      const sourceDb = await Listing.findById(unsoldListingId);
      expect(sourceDb?.relistedToListingId?.toString()).toBe(newListing.id);
    });

    it("rejects relist from non-unsold statuses (ACTIVE, SOLD, CANCELLED) with 400 INVALID_TRANSITION", async () => {
      // 1. ACTIVE listing
      const activeId = await createActiveListing();
      const activeRes = await request(app)
        .post(`/api/v1/listings/${activeId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(activeRes.status).toBe(400);
      expect(activeRes.body.error.code).toBe("INVALID_TRANSITION");

      // 2. CANCELLED listing
      await Listing.updateOne({ _id: activeId }, { status: ListingStatus.CANCELLED });
      const cancelRes = await request(app)
        .post(`/api/v1/listings/${activeId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error.code).toBe("INVALID_TRANSITION");

      // 3. SOLD listing
      await Listing.updateOne({ _id: activeId }, { status: ListingStatus.SOLD });
      const soldRes = await request(app)
        .post(`/api/v1/listings/${activeId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(soldRes.status).toBe(400);
      expect(soldRes.body.error.code).toBe("INVALID_TRANSITION");
    });

    it("rejects relisting twice on the same unsold listing with 409 CONFLICT", async () => {
      const unsoldListingId = await createUnsoldListing();

      // First relist succeeds
      const firstRes = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });
      expect(firstRes.status).toBe(201);

      // Second relist on same listing fails
      const secondRes = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4100, durationMinutes: 180 });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe("CONFLICT");
      expect(secondRes.body.error.message).toContain("already been relisted");
    });

    it("rejects relist when assessment is stale with 400 GRADE_STALE", async () => {
      // Bitter Gourd shelf life is 120 hours. Set assessedAt to 150 hours ago.
      const staleDate = new Date(Date.now() - 150 * 3600 * 1000);
      const unsoldListingId = await createUnsoldListing({ assessedAt: staleDate });

      const res = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GRADE_STALE");
      expect(res.body.error.message).toContain("stale");
    });

    it("rejects relist with 409 INSUFFICIENT_STOCK if farmer does not have enough available stock", async () => {
      const unsoldListingId = await createUnsoldListing({ quantityKg: 600 }); // Farmer only has 500 kg

      const res = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");

      // Verify relistedToListingId was unlocked / not retained
      const sourceDb = await Listing.findById(unsoldListingId);
      expect(sourceDb?.relistedToListingId).toBeUndefined();
    });

    it("negative authorization: rejects relist by another farmer with 403 FORBIDDEN", async () => {
      const unsoldListingId = await createUnsoldListing();

      const res = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("farmerB"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("negative authorization: rejects relist by a buyer with 403 FORBIDDEN", async () => {
      const unsoldListingId = await createUnsoldListing();

      const res = await request(app)
        .post(`/api/v1/listings/${unsoldListingId}/relist`)
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ floorPricePerKg: 4200, durationMinutes: 180 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});

import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type PublicUser, farmerListingResponseSchema } from "@bazarbeat/shared";

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
import { addStock } from "../inventory/inventory.service.js";
import { AiAssessmentRecord } from "../ai/ai-assessment-record.model.js";
import { hashAssessmentToken } from "../ai/ai.service.js";
import { Listing } from "./listing.model.js";

const farmerAId = new Types.ObjectId().toString();
const farmerBId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const activeCropId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmerA: {
    id: farmerAId,
    role: "FARMER",
    name: "Farmer A",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  farmerB: {
    id: farmerBId,
    role: "FARMER",
    name: "Farmer B",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  buyer: {
    id: buyerId,
    role: "BUYER",
    name: "Buyer",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
};

let mongoReplicaSet: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplicaSet.getUri());
  await Promise.all([
    Crop.init(),
    InventoryItem.init(),
    StockMovement.init(),
    AiAssessmentRecord.init(),
    Listing.init(),
  ]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (user === undefined) throw new Error("Unexpected test access token");
    return user;
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplicaSet !== undefined) await mongoReplicaSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Crop.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    AiAssessmentRecord.deleteMany({}),
    Listing.deleteMany({}),
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

  // Seed farmerA with 500 kg available stock
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

async function createTestAssessmentRecord(
  farmerId: string = farmerAId,
  cropId: string = activeCropId,
  isConsumed: boolean = false,
  expiresAt: Date = new Date(Date.now() + 30 * 60 * 1000),
): Promise<{ rawToken: string; recordId: string }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashAssessmentToken(rawToken);

  const record = await AiAssessmentRecord.create({
    farmerId: new ObjectId(farmerId),
    cropId: new ObjectId(cropId),
    assessmentTokenHash: tokenHash,
    grade: "A",
    confidence: 0.92,
    confidenceBand: "HIGH",
    classProbabilities: { A: 0.8, B: 0.15, C: 0.05 },
    qualityNotes: ["Uniform size and defined ridges", "No blemishes"],
    cropMatch: true,
    modelVersion: "mock-1.0",
    provider: "mock",
    degraded: false,
    assessedAt: new Date(),
    images: [{ url: "/uploads/img1.jpg", width: 800, height: 600, hash: "hash123" }],
    imageHashes: ["hash123"],
    isConsumed,
    expiresAt,
  });

  return { rawToken, recordId: record._id.toString() };
}

describe("POST /api/v1/listings (Task 3.6)", () => {
  it("creates and publishes an ACTIVE listing, consumes token, computes server guidance, and updates inventory ledger", async () => {
    const { rawToken } = await createTestAssessmentRecord();

    const requestBody = {
      cropId: activeCropId,
      assessmentToken: rawToken,
      quantityKg: 50,
      floorPricePerKg: 4500, // 45.00 BDT
      durationMinutes: 360, // 6 hours
      pickupNote: "Farm gate collection in Gazipur",
    };

    const res = await request(app)
      .post("/api/v1/listings")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send(requestBody);

    expect(res.status).toBe(201);
    expect(farmerListingResponseSchema.safeParse(res.body).success).toBe(true);

    const listing = res.body.data;
    expect(listing.status).toBe("ACTIVE");
    expect(listing.cropId).toBe(activeCropId);
    expect(listing.quantityKg).toBe(50);
    expect(listing.floorPricePerKg).toBe(4500);
    expect(listing.minIncrementPerKg).toBe(100);
    expect(listing.pickupNote).toBe("Farm gate collection in Gazipur");
    expect(listing.images).toHaveLength(1);
    expect(listing.images[0]?.url).toBe("/uploads/img1.jpg");

    // Server-computed snapshot verification
    expect(listing.aiAssessment.grade).toBe("A");
    expect(listing.aiAssessment.confidence).toBe(0.92);
    expect(listing.aiPriceGuidance.lowPerKg).toBeGreaterThan(0);
    expect(listing.aiPriceGuidance.expectedPerKg).toBeGreaterThanOrEqual(
      listing.aiPriceGuidance.lowPerKg,
    );
    expect(listing.aiPriceGuidance.highPerKg).toBeGreaterThanOrEqual(
      listing.aiPriceGuidance.expectedPerKg,
    );

    // Verify token was atomically consumed
    const updatedRecord = await AiAssessmentRecord.findOne({
      assessmentTokenHash: hashAssessmentToken(rawToken),
    });
    expect(updatedRecord?.isConsumed).toBe(true);
    expect(updatedRecord?.consumedAt).toBeInstanceOf(Date);

    // Ledger reconciliation check: available stock reduced, listed stock increased
    const inventory = await InventoryItem.findOne({
      farmerId: farmerAId,
      cropId: activeCropId,
    }).lean();
    expect(inventory?.availableKg).toBe(450); // 500 - 50
    expect(inventory?.listedKg).toBe(50);
    expect(inventory?.soldKg).toBe(0);

    // Verify StockMovement entry
    const movements = await StockMovement.find({
      farmerId: farmerAId,
      cropId: activeCropId,
    }).lean();
    expect(movements).toHaveLength(2); // 1 initial ADD, 1 LIST
    const listMovement = movements.find((m) => m.type === "LIST");
    expect(listMovement).toBeDefined();
    expect(listMovement?.quantityKg).toBe(50);
    expect(listMovement?.status).toBe("APPLIED");
    expect(listMovement?.listingId?.toString()).toBe(listing.id);
  });

  it("rejects double-submit with the same token (only one listing created)", async () => {
    const { rawToken } = await createTestAssessmentRecord();

    const requestBody = {
      cropId: activeCropId,
      assessmentToken: rawToken,
      quantityKg: 25,
      floorPricePerKg: 4000,
      durationMinutes: 180,
    };

    // First submit succeeds
    const firstRes = await request(app)
      .post("/api/v1/listings")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send(requestBody);
    expect(firstRes.status).toBe(201);

    // Second submit fails with 409 CONFLICT
    const secondRes = await request(app)
      .post("/api/v1/listings")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send(requestBody);

    expect(secondRes.status).toBe(409);
    expect(secondRes.body).toMatchObject({
      error: { code: "CONFLICT", message: expect.stringMatching(/already been used/i) },
    });

    // Exactly one listing document exists in the database
    expect(await Listing.countDocuments()).toBe(1);
  });

  it("rejects listing creation when farmer has insufficient available stock", async () => {
    const { rawToken } = await createTestAssessmentRecord();

    // Farmer has 500 kg available, attempting to list 600 kg
    const requestBody = {
      cropId: activeCropId,
      assessmentToken: rawToken,
      quantityKg: 600,
      floorPricePerKg: 3500,
      durationMinutes: 60,
    };

    const res = await request(app)
      .post("/api/v1/listings")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send(requestBody);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: { code: "INSUFFICIENT_STOCK", message: expect.any(String) },
    });

    // Token was unconsumed so farmer can adjust quantity
    const record = await AiAssessmentRecord.findOne({
      assessmentTokenHash: hashAssessmentToken(rawToken),
    });
    expect(record?.isConsumed).toBe(false);

    // No listing was created
    expect(await Listing.countDocuments()).toBe(0);
  });

  it("releases reserved stock (compensation) if listing persistence fails", async () => {
    const { rawToken } = await createTestAssessmentRecord();

    // Mock Listing.prototype.save to simulate unexpected database failure
    const saveSpy = vi
      .spyOn(Listing.prototype, "save")
      .mockRejectedValueOnce(new Error("Simulated database failure during listing creation"));

    const requestBody = {
      cropId: activeCropId,
      assessmentToken: rawToken,
      quantityKg: 50,
      floorPricePerKg: 4000,
      durationMinutes: 180,
    };

    const res = await request(app)
      .post("/api/v1/listings")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send(requestBody);

    expect(res.status).toBe(500);

    // Verify compensating stock release restored inventory totals
    const inventory = await InventoryItem.findOne({
      farmerId: farmerAId,
      cropId: activeCropId,
    }).lean();
    expect(inventory?.availableKg).toBe(500); // 500 - 50 + 50
    expect(inventory?.listedKg).toBe(0);

    // Verify token was unconsumed on failure
    const record = await AiAssessmentRecord.findOne({
      assessmentTokenHash: hashAssessmentToken(rawToken),
    });
    expect(record?.isConsumed).toBe(false);

    // No listing was stored
    expect(await Listing.countDocuments()).toBe(0);

    saveSpy.mockRestore();
  });

  describe("Validation rules", () => {
    it("rejects quantity below minLotKg (10 kg for bitter-gourd)", async () => {
      const { rawToken } = await createTestAssessmentRecord();

      const res = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 5, // Below minLotKg of 10
          floorPricePerKg: 4000,
          durationMinutes: 60,
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          message: expect.stringMatching(/Quantity must be between/i),
        },
      });
    });

    it("rejects duration exceeding crop shelf-life", async () => {
      const { rawToken } = await createTestAssessmentRecord();

      // shelfLifeHours is 120 (7200 minutes); 24 hours preset is 1440 min
      // If crop had 1 hour shelf life (60 min) and we asked for 180 min:
      await Crop.updateOne({ _id: activeCropId }, { shelfLifeHours: 2 }); // 120 min max

      const res = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 4000,
          durationMinutes: 180, // Exceeds 120 min shelf life
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: "VALIDATION_ERROR", message: expect.stringMatching(/shelf life/i) },
      });
    });

    it("rejects non-positive or non-integer floor price", async () => {
      const { rawToken } = await createTestAssessmentRecord();

      const res = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 0,
          durationMinutes: 60,
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    });

    it("allows publishing with floor price warning (warnings do not block publishing)", async () => {
      const { rawToken } = await createTestAssessmentRecord();

      // Set a very high floor price that will trigger overpriced warning
      const res = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 50000, // 500 BDT, way above market
          durationMinutes: 60,
        });

      // Floor warning does NOT block publishing; status is 201
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("ACTIVE");
      expect(res.body.data.floorPricePerKg).toBe(50000);
    });

    it("blocks buyers and unauthorized users from publishing listings", async () => {
      const { rawToken } = await createTestAssessmentRecord();

      const buyerRes = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 4000,
          durationMinutes: 60,
        });

      const unauthRes = await request(app)
        .post("/api/v1/listings")
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 4000,
          durationMinutes: 60,
        });

      expect(buyerRes.status).toBe(403);
      expect(unauthRes.status).toBe(401);
    });

    it("prevents another farmer from using the assessment token to create a listing", async () => {
      // Token created for Farmer A
      const { rawToken } = await createTestAssessmentRecord(farmerAId);

      // Farmer B attempts to use it
      const res = await request(app)
        .post("/api/v1/listings")
        .set("Cookie", withAccessToken("farmerB"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          assessmentToken: rawToken,
          quantityKg: 20,
          floorPricePerKg: 4000,
          durationMinutes: 60,
        });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        error: { code: "FORBIDDEN", message: expect.stringMatching(/does not belong to you/i) },
      });
      expect(await Listing.countDocuments()).toBe(0);
    });
  });
});

import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type PublicUser, assessmentResultSchema, priceGuidanceSchema } from "@bazarbeat/shared";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { Crop } from "../crops/crop.model.js";
import { AiAssessmentRecord } from "./ai-assessment-record.model.js";
import { getGradingProvider, getValidAssessmentRecord, hashAssessmentToken } from "./ai.service.js";
import type { MockGradingProvider } from "./mock-grading.provider.js";

const farmerAId = new Types.ObjectId().toString();
const farmerBId = new Types.ObjectId().toString();
const farmerCId = new Types.ObjectId().toString();
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
  farmerC: {
    id: farmerCId,
    role: "FARMER",
    name: "Farmer C",
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
let sampleJpegBuffer: Buffer;
let samplePngBuffer: Buffer;

beforeAll(async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplicaSet.getUri());
  await Promise.all([Crop.init(), AiAssessmentRecord.init()]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (user === undefined) throw new Error("Unexpected test access token");
    return user;
  });

  sampleJpegBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();

  samplePngBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplicaSet !== undefined) await mongoReplicaSet.stop();
});

beforeEach(async () => {
  await Promise.all([Crop.deleteMany({}), AiAssessmentRecord.deleteMany({})]);
  await Crop.create({
    _id: activeCropId,
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 720,
    gradeGuide: { A: "Firm bulbs", B: "Minor marks", C: "Small bulbs" },
    minIncrementPerKg: 100,
    imageUrl: "/images/crops/placeholder.svg",
    isActive: true,
  });
});

function withAccessToken(token: "farmerA" | "farmerB" | "farmerC" | "buyer"): string {
  return `accessToken=${token}`;
}

describe("AI Assessment and Price Prediction endpoints", () => {
  describe("Authentication and Authorization", () => {
    it("blocks requests without an active session", async () => {
      const assessRes = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "sample.jpg");

      const predictRes = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("X-CSRF-Protection", "1")
        .send({ cropId: activeCropId, grade: "A", quantityKg: 50 });

      expect(assessRes.status).toBe(401);
      expect(assessRes.body).toMatchObject({
        error: { code: "UNAUTHENTICATED", message: expect.any(String) },
      });
      expect(predictRes.status).toBe(401);
      expect(predictRes.body).toMatchObject({
        error: { code: "UNAUTHENTICATED", message: expect.any(String) },
      });
    });

    it("blocks buyers from calling farmer-only AI endpoints", async () => {
      const assessRes = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "sample.jpg");

      const predictRes = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ cropId: activeCropId, grade: "A", quantityKg: 50 });

      expect(assessRes.status).toBe(403);
      expect(assessRes.body).toMatchObject({
        error: { code: "FORBIDDEN", message: expect.any(String) },
      });
      expect(predictRes.status).toBe(403);
      expect(predictRes.body).toMatchObject({
        error: { code: "FORBIDDEN", message: expect.any(String) },
      });
    });
  });

  describe("POST /api/v1/ai/assess-quality", () => {
    it("successfully assesses images, processes them, returns contract result, and stores hashed token bound to farmer", async () => {
      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "photo1.jpg")
        .attach("images", samplePngBuffer, "photo2.png");

      expect(res.status).toBe(200);
      expect(assessmentResultSchema.safeParse(res.body.data).success).toBe(true);

      const data = res.body.data;
      expect(["A", "B", "C"]).toContain(data.grade);
      expect(data.confidence).toBeGreaterThanOrEqual(0.55);
      expect(["HIGH", "MEDIUM"]).toContain(data.confidenceBand);
      expect(data.qualityNotes.length).toBeGreaterThan(0);
      expect(data.cropMatch).toBe(true);
      expect(typeof data.assessmentToken).toBe("string");
      expect(data.assessmentToken.length).toBeGreaterThan(16);

      // Verify token is stored HASHED in the database and bound to farmerA
      const rawToken = data.assessmentToken;
      const tokenHash = hashAssessmentToken(rawToken);

      const record = await AiAssessmentRecord.findOne({ assessmentTokenHash: tokenHash });
      expect(record).not.toBeNull();
      expect(record?.farmerId.toString()).toBe(farmerAId);
      expect(record?.cropId.toString()).toBe(activeCropId);
      expect(record?.grade).toBe(data.grade);
      expect(record?.images.length).toBe(2);
      expect(record?.imageHashes.length).toBe(2);
      expect(record?.isConsumed).toBe(false);

      // Verify raw token is NOT in the database
      const rawInDb = await AiAssessmentRecord.findOne({ assessmentTokenHash: rawToken });
      expect(rawInDb).toBeNull();

      // Verify helper retrieves valid record for the same farmer
      const retrieved = await getValidAssessmentRecord(rawToken, farmerAId, activeCropId);
      expect(retrieved.assessmentTokenHash).toBe(record?.assessmentTokenHash);
      expect(retrieved.grade).toBe(record?.grade);
    });

    it("prevents another farmer from using the assessment token", async () => {
      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "photo.jpg");

      expect(res.status).toBe(200);
      const rawToken = res.body.data.assessmentToken;

      // Farmer B attempts to use Farmer A's token
      await expect(
        getValidAssessmentRecord(rawToken, farmerBId, activeCropId),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("rejects expired assessment records", async () => {
      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "photo.jpg");

      expect(res.status).toBe(200);
      const rawToken = res.body.data.assessmentToken;
      const tokenHash = hashAssessmentToken(rawToken);

      // Artificially expire the record
      await AiAssessmentRecord.updateOne(
        { assessmentTokenHash: tokenHash },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      await expect(
        getValidAssessmentRecord(rawToken, farmerAId, activeCropId),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: expect.stringMatching(/expired/i),
      });
    });

    it("returns CROP_MISMATCH (422) when the uploaded photos do not match the crop", async () => {
      const grader = getGradingProvider() as MockGradingProvider;
      grader.setNextOverride({ cropMatch: false });

      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "mismatch.jpg");

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: { code: "CROP_MISMATCH", message: expect.any(String) },
      });

      // No record should be stored on error
      expect(await AiAssessmentRecord.countDocuments()).toBe(0);
    });

    it("returns GRADE_UNAVAILABLE (422) when confidence is below 0.55", async () => {
      const grader = getGradingProvider() as MockGradingProvider;
      grader.setNextOverride({ confidence: 0.45, cropMatch: true });

      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "blurry.jpg");

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: { code: "GRADE_UNAVAILABLE", message: expect.any(String) },
      });

      // No record should be stored on error
      expect(await AiAssessmentRecord.countDocuments()).toBe(0);
    });

    it("rejects fake extension and non-image files by inspecting content", async () => {
      const fakeImageBuffer = Buffer.from("THIS IS NOT A VALID IMAGE BUFFER, JUST PLAIN TEXT");

      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", fakeImageBuffer, "fake.jpg");

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: "VALIDATION_ERROR", message: expect.any(String) },
      });
    });

    it("rejects zero files attached", async () => {
      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: "VALIDATION_ERROR", message: expect.stringMatching(/image/i) },
      });
    });

    it("rejects more than 4 images", async () => {
      const res = await request(app)
        .post("/api/v1/ai/assess-quality")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .field("cropId", activeCropId)
        .attach("images", sampleJpegBuffer, "1.jpg")
        .attach("images", sampleJpegBuffer, "2.jpg")
        .attach("images", sampleJpegBuffer, "3.jpg")
        .attach("images", sampleJpegBuffer, "4.jpg")
        .attach("images", sampleJpegBuffer, "5.jpg");

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: "VALIDATION_ERROR", message: expect.stringMatching(/4 images/i) },
      });
    });
  });

  describe("POST /api/v1/ai/predict-price", () => {
    it("returns price guidance and suggested floor for a valid request", async () => {
      const res = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: activeCropId,
          grade: "A",
          quantityKg: 100,
          localSellingCostPerKg: 200,
        });

      expect(res.status).toBe(200);
      expect(priceGuidanceSchema.safeParse(res.body.data).success).toBe(true);

      const data = res.body.data;
      expect(data.lowPerKg).toBeGreaterThan(0);
      expect(data.expectedPerKg).toBeGreaterThanOrEqual(data.lowPerKg);
      expect(data.highPerKg).toBeGreaterThanOrEqual(data.expectedPerKg);
      expect(data.suggestedFloorPerKg).toBe(data.lowPerKg);
      expect(["UP", "FLAT", "DOWN"]).toContain(data.trend);
    });

    it("rejects non-existent cropId", async () => {
      const fakeCropId = new Types.ObjectId().toString();
      const res = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("Cookie", withAccessToken("farmerA"))
        .set("X-CSRF-Protection", "1")
        .send({
          cropId: fakeCropId,
          grade: "B",
          quantityKg: 50,
        });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
    });
  });

  describe("AiAssessmentRecord schema and model", () => {
    it("indexes token hashes uniquely and expires records at expiresAt with TTL", () => {
      const indexes = AiAssessmentRecord.schema.indexes();

      expect(indexes).toContainEqual([
        { assessmentTokenHash: 1 },
        { unique: true, background: true },
      ]);
      expect(indexes).toContainEqual([
        { expiresAt: 1 },
        { expireAfterSeconds: 0, background: true },
      ]);
      expect(indexes).toContainEqual([{ farmerId: 1 }, { background: true }]);
    });
  });

  describe("Rate limiting (10 per minute per user)", () => {
    it("enforces rate limit of 10 requests per minute per user and allows other users", async () => {
      // Farmer B makes 10 successful price predictions
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post("/api/v1/ai/predict-price")
          .set("Cookie", withAccessToken("farmerB"))
          .set("X-CSRF-Protection", "1")
          .send({ cropId: activeCropId, grade: "B", quantityKg: 10 });
        expect(response.status).toBe(200);
      }

      // 11th request for Farmer B is rate limited
      const rateLimitedRes = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("Cookie", withAccessToken("farmerB"))
        .set("X-CSRF-Protection", "1")
        .send({ cropId: activeCropId, grade: "B", quantityKg: 10 });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body).toMatchObject({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });

      // Farmer C is unaffected because rate limits are per user!
      const farmerCRes = await request(app)
        .post("/api/v1/ai/predict-price")
        .set("Cookie", withAccessToken("farmerC"))
        .set("X-CSRF-Protection", "1")
        .send({ cropId: activeCropId, grade: "A", quantityKg: 20 });

      expect(farmerCRes.status).toBe(200);
    });
  });
});

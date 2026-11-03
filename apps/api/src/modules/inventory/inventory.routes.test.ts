import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PublicUser,
  inventorySummaryItemSchema,
  stockMovementResponseSchema,
} from "@bazarbeat/shared";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { Crop } from "../crops/crop.model.js";
import { InventoryItem } from "./inventory-item.model.js";
import { StockMovement } from "./stock-movement.model.js";

const farmerAId = new Types.ObjectId().toString();
const farmerBId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const activeCropId = new Types.ObjectId().toString();
const inactiveCropId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmerA: { id: farmerAId, role: "FARMER", name: "Farmer A", division: "dhaka", district: "dhaka", language: "en" },
  farmerB: { id: farmerBId, role: "FARMER", name: "Farmer B", division: "dhaka", district: "dhaka", language: "en" },
  buyer: { id: buyerId, role: "BUYER", name: "Buyer", division: "dhaka", district: "dhaka", language: "en" },
};

let mongoReplicaSet: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
  await mongoose.connect(mongoReplicaSet.getUri());
  await Promise.all([Crop.init(), InventoryItem.init(), StockMovement.init()]);
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
  await Promise.all([Crop.deleteMany({}), InventoryItem.deleteMany({}), StockMovement.deleteMany({})]);
  await Crop.create([
    {
      _id: activeCropId,
      slug: "bitter-gourd",
      nameEn: "Bitter Gourd",
      nameBn: "করলা",
      unit: "KG",
      minLotKg: 10,
      maxLotKg: 1_000,
      shelfLifeHours: 120,
      gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Ripe and usable" },
      minIncrementPerKg: 100,
      imageUrl: "/images/crops/placeholder.svg",
      isActive: true,
    },
    {
      _id: inactiveCropId,
      slug: "inactive-crop",
      nameEn: "Inactive Crop",
      nameBn: "নিষ্ক্রিয়",
      unit: "KG",
      minLotKg: 1,
      maxLotKg: 10,
      shelfLifeHours: 48,
      gradeGuide: { A: "A", B: "B", C: "C" },
      minIncrementPerKg: 100,
      imageUrl: "/images/crops/placeholder.svg",
      isActive: false,
    },
  ]);
});

function withAccessToken(token: "farmerA" | "farmerB" | "buyer"): string {
  return `accessToken=${token}`;
}

describe("farmer inventory endpoints", () => {
  it("requires an authenticated session on each inventory route", async () => {
    const responses = await Promise.all([
      request(app).get("/api/v1/inventory"),
      request(app).post("/api/v1/inventory/add").set("X-CSRF-Protection", "1").send({ cropId: activeCropId, quantityKg: 1 }),
      request(app).get(`/api/v1/inventory/movements?cropId=${activeCropId}`),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });

  it("denies buyers access to inventory reads and writes", async () => {
    const responses = await Promise.all([
      request(app).get("/api/v1/inventory").set("Cookie", withAccessToken("buyer")),
      request(app)
        .post("/api/v1/inventory/add")
        .set("Cookie", withAccessToken("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ cropId: activeCropId, quantityKg: 1 }),
      request(app)
        .get(`/api/v1/inventory/movements?cropId=${activeCropId}`)
        .set("Cookie", withAccessToken("buyer")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
    expect(await InventoryItem.countDocuments()).toBe(0);
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it("returns active crops with zero totals and isolates each farmer's stock", async () => {
    const emptyResponse = await request(app).get("/api/v1/inventory").set("Cookie", withAccessToken("farmerA"));
    expect(emptyResponse.status).toBe(200);
    expect(inventorySummaryItemSchema.array().parse(emptyResponse.body.data)).toMatchObject([
      { crop: { id: activeCropId }, availableKg: 0, listedKg: 0, soldKg: 0 },
    ]);
    expect(emptyResponse.body.data).toHaveLength(1);

    const firstAdd = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 2.5, note: "Harvest" });
    expect(firstAdd.status).toBe(201);
    expect(inventorySummaryItemSchema.parse(firstAdd.body.data).availableKg).toBe(2.5);
    expect(await StockMovement.countDocuments({ farmerId: farmerAId })).toBe(1);

    const farmerBInventory = await request(app).get("/api/v1/inventory").set("Cookie", withAccessToken("farmerB"));
    expect(farmerBInventory.body.data[0]).toMatchObject({ availableKg: 0, listedKg: 0, soldKg: 0 });
    const farmerBMovements = await request(app)
      .get(`/api/v1/inventory/movements?cropId=${activeCropId}`)
      .set("Cookie", withAccessToken("farmerB"));
    expect(farmerBMovements.body).toMatchObject({ data: [], meta: { total: 0 } });

    const secondAdd = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerB"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 4 });
    expect(secondAdd.status).toBe(201);
    expect(inventorySummaryItemSchema.parse(secondAdd.body.data).availableKg).toBe(4);
    expect(await InventoryItem.findOne({ farmerId: farmerAId, cropId: activeCropId }).lean()).toMatchObject({ availableKg: 2.5 });
    expect(await InventoryItem.findOne({ farmerId: farmerBId, cropId: activeCropId }).lean()).toMatchObject({ availableKg: 4 });
    expect(await StockMovement.countDocuments({ farmerId: farmerAId })).toBe(1);
    expect(await StockMovement.countDocuments({ farmerId: farmerBId })).toBe(1);
  });

  it("rejects invalid input in the standard error envelope without writing stock", async () => {
    const invalidBody = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 0 });
    const spoofedOwner = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerB"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 1, farmerId: farmerAId });
    const invalidQuery = await request(app)
      .get("/api/v1/inventory/movements?page=0")
      .set("Cookie", withAccessToken("farmerA"));
    const missingCropQuery = await request(app)
      .get("/api/v1/inventory/movements")
      .set("Cookie", withAccessToken("farmerA"));
    const unexpectedQuery = await request(app)
      .post(`/api/v1/inventory/add?farmerId=${farmerAId}`)
      .set("Cookie", withAccessToken("farmerB"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 1 });

    for (const response of [invalidBody, spoofedOwner, invalidQuery, missingCropQuery, unexpectedQuery]) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: "VALIDATION_ERROR", message: expect.any(String) } });
    }
    expect(await StockMovement.countDocuments()).toBe(0);
    expect(await InventoryItem.countDocuments()).toBe(0);
  });

  it("returns a farmer's movement history newest first with pagination metadata", async () => {
    const first = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 1 });
    const second = await request(app)
      .post("/api/v1/inventory/add")
      .set("Cookie", withAccessToken("farmerA"))
      .set("X-CSRF-Protection", "1")
      .send({ cropId: activeCropId, quantityKg: 2 });
    const newest = await request(app)
      .get(`/api/v1/inventory/movements?cropId=${activeCropId}&page=1&limit=1`)
      .set("Cookie", withAccessToken("farmerA"));
    const older = await request(app)
      .get(`/api/v1/inventory/movements?cropId=${activeCropId}&page=2&limit=1`)
      .set("Cookie", withAccessToken("farmerA"));

    expect(newest.status).toBe(200);
    expect(newest.body.meta).toEqual({ page: 1, limit: 1, total: 2 });
    expect(stockMovementResponseSchema.array().parse(newest.body.data)).toHaveLength(1);
    expect(newest.body.data[0].quantityKg).toBe(2);
    expect(older.body.data[0].quantityKg).toBe(1);
    expect(first.body.data.availableKg).toBe(1);
    expect(second.body.data.availableKg).toBe(3);
  });
});

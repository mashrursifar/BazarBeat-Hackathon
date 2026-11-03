import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cropResponseSchema } from "@bazarbeat/shared";

import { app } from "../../app.js";
import { Crop } from "./crop.model.js";

const activeCrop = {
  _id: new mongoose.Types.ObjectId(),
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
  createdAt: new Date("2026-11-03T00:00:00.000Z"),
  updatedAt: new Date("2026-11-03T00:00:00.000Z"),
};

const inactiveCrop = { ...activeCrop, _id: new mongoose.Types.ObjectId(), slug: "inactive-crop", isActive: false };

function stubCropFind(crops: typeof activeCrop[]): ReturnType<typeof vi.spyOn> {
  const find = vi.spyOn(Crop, "find");
  find.mockReturnValue({
    sort: (): { lean: () => Promise<typeof activeCrop[]> } => ({
      lean: async (): Promise<typeof activeCrop[]> => crops.filter((crop) => crop.isActive),
    }),
  } as unknown as ReturnType<typeof Crop.find>);
  return find;
}

describe("GET /api/v1/crops", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns active crops in the shared response shape without raw document fields", async () => {
    const find = stubCropFind([activeCrop]);

    const response = await request(app).get("/api/v1/crops");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({
      id: activeCrop._id.toString(),
      slug: "bitter-gourd",
      nameEn: "Bitter Gourd",
      nameBn: "করলা",
      unit: "KG",
      minLotKg: 10,
      maxLotKg: 1_000,
      shelfLifeHours: 120,
      gradeGuide: activeCrop.gradeGuide,
      minIncrementPerKg: 100,
      imageUrl: "/images/crops/placeholder.svg",
    });
    expect(cropResponseSchema.parse(response.body.data[0])).toBeDefined();
    expect(response.body.data[0]).not.toHaveProperty("isActive");
    expect(response.body.data[0]).not.toHaveProperty("createdAt");
    expect(find).toHaveBeenCalledWith({ isActive: true });
  });

  it("hides inactive crops", async () => {
    const find = stubCropFind([activeCrop, inactiveCrop]);

    const response = await request(app).get("/api/v1/crops");

    expect(response.status).toBe(200);
    expect(response.body.data.map((crop: { slug: string }) => crop.slug)).toEqual(["bitter-gourd"]);
    expect(find).toHaveBeenCalledWith({ isActive: true });
  });
});

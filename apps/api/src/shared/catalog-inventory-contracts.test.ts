import { describe, expect, it } from "vitest";

import { type CropResponse, addStockRequestSchema } from "@bazarbeat/shared";

describe("API shared catalog and inventory contracts", () => {
  it("uses the shared stock request validation and crop response type", () => {
    const crop: Pick<CropResponse, "id" | "minIncrementPerKg"> = {
      id: "0123456789abcdef01234567",
      minIncrementPerKg: 100,
    };

    expect(addStockRequestSchema.safeParse({ cropId: crop.id, quantityKg: 4.5 }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { InventoryItem } from "./inventory-item.model.js";

describe("InventoryItem model", () => {
  it("enforces one inventory item per farmer and crop", () => {
    expect(InventoryItem.schema.indexes()).toContainEqual([
      { farmerId: 1, cropId: 1 },
      { unique: true, background: true },
    ]);
  });
});

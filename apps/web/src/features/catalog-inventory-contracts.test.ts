import { describe, expect, it } from "vitest";

import { type InventorySummaryItem, paginationQuerySchema } from "@bazarbeat/shared";

describe("web shared catalog and inventory contracts", () => {
  it("uses shared pagination parsing and inventory response types", () => {
    const inventory: Pick<InventorySummaryItem, "availableKg" | "listedKg" | "soldKg"> = {
      availableKg: 10,
      listedKg: 2,
      soldKg: 1,
    };

    expect(paginationQuerySchema.parse({ page: "1" }).page).toBe(1);
    expect(inventory.availableKg).toBe(10);
  });
});

import { describe, expect, it } from "vitest";

import { StockMovement } from "./stock-movement.model.js";

describe("StockMovement model", () => {
  it("requires a unique operation ID for safe retries", () => {
    expect(StockMovement.schema.indexes()).toContainEqual([
      { operationId: 1 },
      { unique: true, background: true },
    ]);
  });
});

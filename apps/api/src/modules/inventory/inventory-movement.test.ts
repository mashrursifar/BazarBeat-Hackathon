import { describe, expect, it } from "vitest";

import { getInventoryDeltas } from "./inventory-movement.js";

describe("inventory movement bucket deltas", () => {
  it.each([
    ["ADD", { availableKg: 2, listedKg: 0, soldKg: 0 }],
    ["LIST", { availableKg: -2, listedKg: 2, soldKg: 0, sourceBucket: "availableKg" }],
    ["RELEASE", { availableKg: 2, listedKg: -2, soldKg: 0, sourceBucket: "listedKg" }],
    ["SELL", { availableKg: 0, listedKg: -2, soldKg: 2, sourceBucket: "listedKg" }],
    ["ADJUST", { availableKg: 2, listedKg: 0, soldKg: 0 }],
  ] as const)("maps %s into its documented bucket changes", (type, expected) => {
    expect(getInventoryDeltas(type, 2)).toEqual(expected);
  });
});

import { describe, expect, it } from "vitest";

import { evaluateFloorPrice } from "./floor-price.js";

describe("evaluateFloorPrice", () => {
  it("warns only when the floor is below the low estimate", () => {
    expect(evaluateFloorPrice(999, 1_000, 1_200)).toBe("below-market");
    expect(evaluateFloorPrice(1_000, 1_000, 1_200)).toBe("ok");
  });

  it("allows a floor exactly 30% above high and warns only above that boundary", () => {
    expect(evaluateFloorPrice(1_300, 900, 1_000)).toBe("ok");
    expect(evaluateFloorPrice(1_301, 900, 1_000)).toBe("overpriced");
  });

  it("rejects non-positive or unsafe price inputs", () => {
    expect(() => evaluateFloorPrice(0, 1, 2)).toThrow(RangeError);
    expect(() => evaluateFloorPrice(Number.MAX_SAFE_INTEGER + 1, 1, 2)).toThrow(RangeError);
    expect(() => evaluateFloorPrice(10, 20, 10)).toThrow(RangeError);
  });
});

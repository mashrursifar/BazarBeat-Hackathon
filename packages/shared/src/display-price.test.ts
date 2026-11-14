import { describe, expect, it } from "vitest";
import { formatDisplayPrice, getDisplayPrice, getDisplayPricePerKg } from "./display-price.js";

describe("display-price helper", () => {
  it("returns floor price when listing has 0 bids", () => {
    const listing = {
      floorPricePerKg: 4500,
      currentBidPerKg: null,
      bidCount: 0,
    };
    expect(getDisplayPricePerKg(listing)).toBe(4500);
    const summary = getDisplayPrice({ ...listing, quantityKg: 100 });
    expect(summary).toEqual({
      amountPerKg: 4500,
      isFloor: true,
      totalCost: 450000,
    });
  });

  it("returns floor price when currentBidPerKg is missing or undefined", () => {
    const listing = {
      floorPricePerKg: 6000,
      bidCount: 0,
    };
    expect(getDisplayPricePerKg(listing)).toBe(6000);
    expect(getDisplayPrice(listing)).toEqual({
      amountPerKg: 6000,
      isFloor: true,
    });
  });

  it("returns current bid when listing has active bids", () => {
    const listing = {
      floorPricePerKg: 4500,
      currentBidPerKg: 5200,
      bidCount: 3,
    };
    expect(getDisplayPricePerKg(listing)).toBe(5200);
    const summary = getDisplayPrice({ ...listing, quantityKg: 50 });
    expect(summary).toEqual({
      amountPerKg: 5200,
      isFloor: false,
      totalCost: 260000,
    });
  });

  it("formats display price correctly with /kg suffix", () => {
    expect(formatDisplayPrice(5000)).toBe("৳50.00/kg");
    expect(formatDisplayPrice(1250)).toBe("৳12.50/kg");
  });

  it("throws RangeError on invalid floor price or negative current bid", () => {
    expect(() => getDisplayPricePerKg({ floorPricePerKg: -100 })).toThrow(RangeError);
    expect(() =>
      getDisplayPricePerKg({ floorPricePerKg: 1000, bidCount: 1, currentBidPerKg: -50 }),
    ).toThrow(RangeError);
  });
});

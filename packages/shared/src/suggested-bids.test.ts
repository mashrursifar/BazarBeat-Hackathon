import { describe, expect, it } from "vitest";
import { calculateSuggestedBids } from "./suggested-bids.js";

describe("calculateSuggestedBids", () => {
  it("calculates suggestions when there are no bids", () => {
    // floor: 4000 poisha (৳40.00), minIncrement: 100 poisha (৳1.00), qty: 50 kg
    // minBid: 4000
    // +5%: 4000 * 1.05 = 4200 (multiple of 100) -> 4200
    // +10%: 4000 * 1.10 = 4400 (multiple of 100) -> 4400
    const suggestions = calculateSuggestedBids({
      floorPricePerKg: 4000,
      currentBidPerKg: null,
      minIncrementPerKg: 100,
      bidCount: 0,
      quantityKg: 50,
    });

    expect(suggestions).toEqual([
      { amountPerKg: 4000, totalAmount: 200000, label: "Minimum" },
      { amountPerKg: 4200, totalAmount: 210000, label: "+5%" },
      { amountPerKg: 4400, totalAmount: 220000, label: "+10%" },
    ]);
  });

  it("calculates suggestions when bids exist", () => {
    // currentBid: 5000 poisha, minIncrement: 100 poisha, bidCount: 2, qty: 100 kg
    // minBid: 5000 + 100 = 5100
    // +5%: 5000 * 1.05 = 5250 -> rounded up to multiple of 100 is 5300
    // +10%: 5000 * 1.10 = 5500 -> 5500
    const suggestions = calculateSuggestedBids({
      floorPricePerKg: 4000,
      currentBidPerKg: 5000,
      minIncrementPerKg: 100,
      bidCount: 2,
      quantityKg: 100,
    });

    expect(suggestions).toEqual([
      { amountPerKg: 5100, totalAmount: 510000, label: "Minimum" },
      { amountPerKg: 5300, totalAmount: 530000, label: "+5%" },
      { amountPerKg: 5500, totalAmount: 550000, label: "+10%" },
    ]);
  });

  it("rounds up to the next multiple of minIncrement", () => {
    // floor: 1234 poisha, minIncrement: 50 poisha, bidCount: 0, qty: 25 kg
    // minBid: 1234
    // +5%: 1234 * 1.05 = 1295.7 -> Math.ceil(1295.7 / 50) * 50 = 26 * 50 = 1300
    // +10%: 1234 * 1.10 = 1357.4 -> Math.ceil(1357.4 / 50) * 50 = 28 * 50 = 1400
    const suggestions = calculateSuggestedBids({
      floorPricePerKg: 1234,
      minIncrementPerKg: 50,
      bidCount: 0,
      quantityKg: 25,
    });

    expect(suggestions).toEqual([
      { amountPerKg: 1234, totalAmount: 30850, label: "Minimum" },
      { amountPerKg: 1300, totalAmount: 32500, label: "+5%" },
      { amountPerKg: 1400, totalAmount: 35000, label: "+10%" },
    ]);
  });

  it("ensures percentage suggestions are never below the minimum", () => {
    // If minIncrement is very large relative to price:
    // currentBid: 1000, minIncrement: 200, bidCount: 1, qty: 10
    // minBid: 1000 + 200 = 1200
    // +5%: 1000 * 1.05 = 1050 -> ceil(1050 / 200) * 200 = 1200 -> max(1200, 1200) = 1200
    // +10%: 1000 * 1.10 = 1100 -> ceil(1100 / 200) * 200 = 1200 -> max(1200, 1200) = 1200
    // All 3 equal 1200! Deduplication removes duplicate 1200s.
    const suggestions = calculateSuggestedBids({
      floorPricePerKg: 1000,
      currentBidPerKg: 1000,
      minIncrementPerKg: 200,
      bidCount: 1,
      quantityKg: 10,
    });

    expect(suggestions).toEqual([
      { amountPerKg: 1200, totalAmount: 12000, label: "Minimum" },
    ]);
  });

  it("removes duplicate suggestions when +5% and +10% produce the same rounded value", () => {
    // floor: 1000, minIncrement: 100, bidCount: 0, qty: 10
    // minBid: 1000
    // +5%: 1000 * 1.05 = 1050 -> ceil(10.5) * 100 = 1100
    // +10%: 1000 * 1.10 = 1100 -> ceil(11) * 100 = 1100
    // 1100 appears twice, duplicate is removed
    const suggestions = calculateSuggestedBids({
      floorPricePerKg: 1000,
      minIncrementPerKg: 100,
      bidCount: 0,
      quantityKg: 10,
    });

    expect(suggestions).toEqual([
      { amountPerKg: 1000, totalAmount: 10000, label: "Minimum" },
      { amountPerKg: 1100, totalAmount: 11000, label: "+5%" },
    ]);
  });

  it("throws on invalid inputs", () => {
    expect(() =>
      calculateSuggestedBids({
        floorPricePerKg: 0,
        minIncrementPerKg: 100,
        bidCount: 0,
        quantityKg: 10,
      }),
    ).toThrow(RangeError);

    expect(() =>
      calculateSuggestedBids({
        floorPricePerKg: 1000,
        minIncrementPerKg: 0,
        bidCount: 0,
        quantityKg: 10,
      }),
    ).toThrow(RangeError);

    expect(() =>
      calculateSuggestedBids({
        floorPricePerKg: 1000,
        minIncrementPerKg: 100,
        bidCount: 1,
        currentBidPerKg: null,
        quantityKg: 10,
      }),
    ).toThrow(RangeError);
  });
});

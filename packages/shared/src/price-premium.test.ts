import { describe, expect, it } from "vitest";
import {
  PricePremiumItem,
  calculatePricePremium,
  calculateSinglePricePremium,
} from "./price-premium.js";

describe("calculatePricePremium", () => {
  it("returns 0 for empty array", () => {
    expect(calculatePricePremium([])).toBe(0);
  });

  it("calculates exact positive premium for a single item", () => {
    // 50 kg sold at 5500 poisha/kg vs 5000 expected: +10.0%
    const items: PricePremiumItem[] = [
      { quantityKg: 50, winningPricePerKg: 5500, expectedPricePerKg: 5000 },
    ];
    expect(calculatePricePremium(items)).toBe(10.0);
  });

  it("calculates exact negative premium for a single item", () => {
    // 100 kg sold at 4800 poisha/kg vs 5000 expected: -4.0%
    const items: PricePremiumItem[] = [
      { quantityKg: 100, winningPricePerKg: 4800, expectedPricePerKg: 5000 },
    ];
    expect(calculatePricePremium(items)).toBe(-4.0);
  });

  it("returns 0.0 when winning equals expected", () => {
    const items: PricePremiumItem[] = [
      { quantityKg: 100, winningPricePerKg: 5000, expectedPricePerKg: 5000 },
    ];
    expect(calculatePricePremium(items)).toBe(0);
  });

  it("weights across multiple items by quantity correctly", () => {
    // Lot 1: 100 kg at 6000 vs 5000 expected (Value: 600,000 vs 500,000)
    // Lot 2: 200 kg at 4500 vs 5000 expected (Value: 900,000 vs 1,000,000)
    // Total winning: 1,500,000 poisha
    // Total expected: 1,500,000 poisha
    // Premium should be 0.0%
    const items: PricePremiumItem[] = [
      { quantityKg: 100, winningPricePerKg: 6000, expectedPricePerKg: 5000 },
      { quantityKg: 200, winningPricePerKg: 4500, expectedPricePerKg: 5000 },
    ];
    expect(calculatePricePremium(items)).toBe(0);
  });

  it("calculates weighted average and rounds to 1 decimal place", () => {
    // Lot 1: 100 kg at 5123 vs 5000 (win: 512,300, exp: 500,000)
    // Diff: +12,300 / 500,000 = +2.46% => rounds to 2.5%
    const items: PricePremiumItem[] = [
      { quantityKg: 100, winningPricePerKg: 5123, expectedPricePerKg: 5000 },
    ];
    expect(calculatePricePremium(items)).toBe(2.5);
  });

  it("handles another rounding case correctly (e.g. 5.54% -> 5.5%)", () => {
    // Diff: 5.54%
    // Exp: 100,000 => Win: 105,540
    const items: PricePremiumItem[] = [
      { quantityKg: 10, winningPricePerKg: 10554, expectedPricePerKg: 10000 },
    ];
    expect(calculatePricePremium(items)).toBe(5.5);
  });

  it("ignores items with non-positive quantity or expected price", () => {
    const items: PricePremiumItem[] = [
      { quantityKg: -10, winningPricePerKg: 9000, expectedPricePerKg: 5000 },
      { quantityKg: 100, winningPricePerKg: 5500, expectedPricePerKg: 0 },
      { quantityKg: 50, winningPricePerKg: 5500, expectedPricePerKg: 5000 },
    ];
    // Only the 3rd item is valid: +10.0%
    expect(calculatePricePremium(items)).toBe(10.0);
  });
});

describe("calculateSinglePricePremium", () => {
  it("calculates premium for a single order", () => {
    expect(calculateSinglePricePremium(5500, 5000)).toBe(10.0);
    expect(calculateSinglePricePremium(4500, 5000)).toBe(-10.0);
  });

  it("returns 0 for invalid inputs", () => {
    expect(calculateSinglePricePremium(5000, 0)).toBe(0);
    expect(calculateSinglePricePremium(-100, 5000)).toBe(0);
  });
});

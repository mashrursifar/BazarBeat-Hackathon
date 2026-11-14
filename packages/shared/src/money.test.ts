import { describe, expect, it } from "vitest";

import {
  bdtToPoisha,
  calculateFarmerNet,
  calculateFeeAndNet,
  calculatePlatformFee,
  calculateSubtotal,
  formatPoisha,
} from "./money.js";

describe("money helpers", () => {
  it("converts BDT to poisha and formats for display", () => {
    expect(bdtToPoisha(125)).toBe(12500);
    expect(formatPoisha(12525)).toBe("৳125.25");
  });

  describe("calculateSubtotal", () => {
    it("computes integer poisha total from price per kg and quantity", () => {
      // 5,000 poisha/kg * 10.5 kg = 52,500 poisha
      expect(calculateSubtotal(5000, 10.5)).toBe(52500);
      // 4,125 poisha/kg * 25.3 kg = 104,362.5 -> rounds to 104,363 poisha
      expect(calculateSubtotal(4125, 25.3)).toBe(104363);
    });

    it("validates input ranges", () => {
      expect(() => calculateSubtotal(0, 10)).toThrow(RangeError);
      expect(() => calculateSubtotal(-100, 10)).toThrow(RangeError);
      expect(() => calculateSubtotal(5000, 0)).toThrow(RangeError);
      expect(() => calculateSubtotal(5000, -5)).toThrow(RangeError);
      expect(() => calculateSubtotal(5000.5, 10)).toThrow(RangeError);
    });
  });

  describe("calculatePlatformFee and calculateFarmerNet", () => {
    it("calculates platform fee correctly with default 200 bps (2%)", () => {
      // 100,000 poisha at 200 bps = 2,000 poisha
      const { platformFee, farmerNet } = calculateFeeAndNet(100_000, 200);
      expect(platformFee).toBe(2000);
      expect(farmerNet).toBe(98000);
      expect(platformFee + farmerNet).toBe(100_000);
    });

    it("handles zero fee basis points (0%)", () => {
      const { platformFee, farmerNet } = calculateFeeAndNet(75_000, 0);
      expect(platformFee).toBe(0);
      expect(farmerNet).toBe(75000);
      expect(platformFee + farmerNet).toBe(75000);
    });

    it("handles 100% fee basis points (10,000 bps)", () => {
      const { platformFee, farmerNet } = calculateFeeAndNet(50_000, 10_000);
      expect(platformFee).toBe(50000);
      expect(farmerNet).toBe(0);
      expect(platformFee + farmerNet).toBe(50000);
    });

    it("rounds half-poisha fractions appropriately", () => {
      // 333 poisha * 200 bps / 10,000 = 6.66 -> 7 poisha
      const fee = calculatePlatformFee(333, 200);
      expect(fee).toBe(7);
      const net = calculateFarmerNet(333, fee);
      expect(net).toBe(326);
      expect(fee + net).toBe(333);
    });

    it("rejects invalid amounts or fee bps outside 0-10,000", () => {
      expect(() => calculatePlatformFee(-1, 200)).toThrow(RangeError);
      expect(() => calculatePlatformFee(100, -1)).toThrow(RangeError);
      expect(() => calculatePlatformFee(100, 10_001)).toThrow(RangeError);
      expect(() => calculateFarmerNet(100, 101)).toThrow(RangeError);
    });
  });
});

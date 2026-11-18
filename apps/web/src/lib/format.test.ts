import { describe, expect, it } from "vitest";

import {
  formatBucketDate,
  formatDuration,
  formatLocalizedNumber,
  formatLocalizedPoisha,
  formatPricePerKg,
  formatRelativeTime,
  padZero,
  toBanglaDigits,
} from "./format.js";

describe("format presentation helpers", () => {
  describe("toBanglaDigits", () => {
    it("converts western digits to Bengali numerals correctly", () => {
      expect(toBanglaDigits("0123456789")).toBe("০১২৩৪৫৬৭৮৯");
      expect(toBanglaDigits(45)).toBe("৪৫");
      expect(toBanglaDigits("৳ 120.50")).toBe("৳ ১২০.৫০");
    });

    it("leaves non-digit characters unchanged", () => {
      expect(toBanglaDigits("Hello World! 2026")).toBe("Hello World! ২০২৬");
    });
  });

  describe("padZero", () => {
    it("pads single digits with leading zeroes", () => {
      expect(padZero(5)).toBe("05");
      expect(padZero(0)).toBe("00");
      expect(padZero(12)).toBe("12");
      expect(padZero(7, 3)).toBe("007");
    });

    it("clamps negative numbers to zero", () => {
      expect(padZero(-5)).toBe("00");
    });
  });

  describe("formatDuration", () => {
    it("formats minutes and seconds for durations under 1 hour", () => {
      const result = formatDuration(9 * 60 * 1000 + 45 * 1000);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(9);
      expect(result.seconds).toBe(45);
      expect(result.digital).toBe("09:45");
    });

    it("formats hours, minutes, and seconds for durations over 1 hour", () => {
      const result = formatDuration(2 * 3600 * 1000 + 15 * 60 * 1000 + 8 * 1000);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(2);
      expect(result.minutes).toBe(15);
      expect(result.seconds).toBe(8);
      expect(result.digital).toBe("02:15:08");
    });

    it("formats multi-day durations into total hours digital representation", () => {
      const result = formatDuration(26 * 3600 * 1000 + 30 * 60 * 1000);
      expect(result.days).toBe(1);
      expect(result.hours).toBe(2);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(0);
      expect(result.digital).toBe("26:30:00");
    });

    it("handles zero or negative duration safely", () => {
      const zero = formatDuration(0);
      expect(zero.digital).toBe("00:00");
      const negative = formatDuration(-5000);
      expect(negative.digital).toBe("00:00");
    });
  });

  describe("formatLocalizedPoisha", () => {
    it("formats poisha to BDT in English", () => {
      expect(formatLocalizedPoisha(4500)).toBe("৳45.00");
    });

    it("formats poisha to BDT with Bangla numerals when requested", () => {
      expect(formatLocalizedPoisha(4500, true)).toBe("৳৪৫.০০");
    });
  });

  describe("formatLocalizedNumber", () => {
    it("formats numbers in English and Bangla", () => {
      expect(formatLocalizedNumber(1250)).toBe("1,250");
      expect(formatLocalizedNumber(1250, true)).toBe("১,২৫০");
    });
  });

  describe("formatPricePerKg", () => {
    it("formats price per kg in English (৳/kg) and Bangla (৳/কেজি)", () => {
      expect(formatPricePerKg(4500, false)).toBe("৳45.00/kg");
      expect(formatPricePerKg(4500, true)).toBe("৳৪৫.০০/কেজি");
    });
  });

  describe("formatRelativeTime", () => {
    const baseNow = new Date("2026-11-18T12:00:00Z");

    it("formats past relative times in English and Bangla", () => {
      const past30m = new Date("2026-11-18T11:30:00Z");
      expect(formatRelativeTime(past30m, false, baseNow)).toBe("30 minutes ago");
      expect(formatRelativeTime(past30m, true, baseNow)).toBe("৩০ মিনিট আগে");

      const past2h = new Date("2026-11-18T10:00:00Z");
      expect(formatRelativeTime(past2h, false, baseNow)).toBe("2 hours ago");
      expect(formatRelativeTime(past2h, true, baseNow)).toBe("২ ঘণ্টা আগে");

      const past3d = new Date("2026-11-15T12:00:00Z");
      expect(formatRelativeTime(past3d, false, baseNow)).toBe("3 days ago");
      expect(formatRelativeTime(past3d, true, baseNow)).toBe("৩ দিন আগে");
    });

    it("formats future relative times in English and Bangla", () => {
      const future15m = new Date("2026-11-18T12:15:00Z");
      expect(formatRelativeTime(future15m, false, baseNow)).toBe("15 minutes left");
      expect(formatRelativeTime(future15m, true, baseNow)).toBe("১৫ মিনিট বাকি");
    });

    it("formats recent timestamp as 'just now' / 'এইমাত্র'", () => {
      const justNow = new Date("2026-11-18T11:59:45Z");
      expect(formatRelativeTime(justNow, false, baseNow)).toBe("just now");
      expect(formatRelativeTime(justNow, true, baseNow)).toBe("এইমাত্র");
    });
  });

  describe("formatBucketDate", () => {
    it("formats daily buckets with Bangla month names and numerals", () => {
      expect(formatBucketDate("2026-11-10", false)).toBe("10 Nov");
      expect(formatBucketDate("2026-11-10", true)).toBe("১০ নভে");
    });

    it("formats monthly buckets with Bangla month names and numerals", () => {
      expect(formatBucketDate("2026-11", false)).toBe("Nov '26");
      expect(formatBucketDate("2026-11", true)).toBe("নভে '২৬");
    });
  });
});

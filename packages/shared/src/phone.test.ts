import { describe, expect, it } from "vitest";

import { normalizeBangladeshPhone } from "./phone.js";

describe("normalizeBangladeshPhone", () => {
  it.each(["01712345678", "+8801712345678", "8801712345678", "০১৭১২৩৪৫৬৭৮", "+880 1712-345678"])(
    "normalizes %s",
    (phone) => expect(normalizeBangladeshPhone(phone)).toBe("+8801712345678"),
  );

  it.each(["0171234567", "02123456789", "+12025550123"])("rejects %s", (phone) => {
    expect(() => normalizeBangladeshPhone(phone)).toThrow(RangeError);
  });
});

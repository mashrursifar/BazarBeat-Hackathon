import { describe, expect, it } from "vitest";

import { bdtToPoisha, formatPoisha } from "./money.js";

describe("money helpers", () => {
  it("converts BDT to poisha and formats for display", () => {
    expect(bdtToPoisha(125)).toBe(12500);
    expect(formatPoisha(12525)).toBe("৳125.25");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PriceTag } from "./price-tag.js";

describe("PriceTag component", () => {
  it("formats integer poisha as BDT with ৳ and per kg suffix", () => {
    render(<PriceTag amountPoisha={4500} />);
    const tag = screen.getByTestId("price-tag");

    expect(tag).toHaveTextContent("৳45.00");
    expect(tag).toHaveTextContent("/kg");
  });

  it("supports custom unit", () => {
    render(<PriceTag amountPoisha={12000} unit="bundle" />);
    const tag = screen.getByTestId("price-tag");

    expect(tag).toHaveTextContent("৳120.00");
    expect(tag).toHaveTextContent("/bundle");
  });
});

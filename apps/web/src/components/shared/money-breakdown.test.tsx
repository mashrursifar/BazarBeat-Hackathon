import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { MoneyBreakdown } from "./money-breakdown.js";

describe("MoneyBreakdown component", () => {
  it("renders price per kg, quantity, subtotal, platform fee with rate, and net payout", () => {
    render(
      <MoneyBreakdown
        pricePerKg={5500}
        quantityKg={100}
        subtotal={550000}
        platformFee={11000}
        feeRatePercent={2.0}
        farmerNet={539000}
        role="farmer"
      />,
    );

    expect(screen.getByText(/Price per kg/i)).toBeInTheDocument();
    expect(screen.getByText(/55\.00/i)).toBeInTheDocument();

    expect(screen.getByText(/Quantity/i)).toBeInTheDocument();
    expect(screen.getByText(/100 kg/i)).toBeInTheDocument();

    expect(screen.getByText(/Subtotal/i)).toBeInTheDocument();
    expect(screen.getByText(/5500\.00/i)).toBeInTheDocument();

    expect(screen.getByText(/Platform fee \(2%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/110\.00/i)).toBeInTheDocument();

    expect(screen.getByText(/Net payout/i)).toBeInTheDocument();
    expect(screen.getByText(/5390\.00/i)).toBeInTheDocument();
  });
});

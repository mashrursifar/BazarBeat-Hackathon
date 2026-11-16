import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type CounterpartyDto, UserRole } from "@bazarbeat/shared";

import "../../lib/i18n.js";
import { CounterpartyCard } from "./counterparty-card.js";

describe("CounterpartyCard component", () => {
  it("renders masked counterparty with privacy notice and without phone/address", () => {
    const maskedBuyer: CounterpartyDto = {
      id: "651234567890abcdef123454",
      name: "Buyer",
      role: UserRole.BUYER,
      isMasked: true,
      division: "Dhaka",
      district: "Dhaka",
    };

    render(<CounterpartyCard counterparty={maskedBuyer} />);

    expect(screen.getByTestId("counterparty-masked")).toBeInTheDocument();
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText(/Contact hidden/i)).toBeInTheDocument();
    expect(screen.getByText(/Phone number and full pickup address will be revealed once you confirm/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders revealed counterparty with phone, organization, and full location", () => {
    const revealedBuyer: CounterpartyDto = {
      id: "651234567890abcdef123454",
      name: "Rahim Chowdhury",
      role: UserRole.BUYER,
      isMasked: false,
      phone: "01712345678",
      organizationName: "Chowdhury Wholesale",
      location: {
        division: "Dhaka",
        district: "Dhaka",
        upazila: "Dhamrai",
      },
    };

    render(<CounterpartyCard counterparty={revealedBuyer} />);

    expect(screen.getByTestId("counterparty-revealed")).toBeInTheDocument();
    expect(screen.getByText("Rahim Chowdhury")).toBeInTheDocument();
    expect(screen.getByText("Chowdhury Wholesale")).toBeInTheDocument();
    expect(screen.getByText("01712345678")).toBeInTheDocument();
    expect(screen.getByText(/Dhamrai, Dhaka, Dhaka/i)).toBeInTheDocument();

    const phoneLink = screen.getByRole("link");
    expect(phoneLink).toHaveAttribute("href", "tel:01712345678");
  });
});

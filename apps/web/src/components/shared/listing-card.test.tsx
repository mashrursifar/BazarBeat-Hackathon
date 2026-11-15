import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BuyerListingCard,
  CropGrade,
  ListingStatus,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import {
  CompareTrayProvider,
  useCompareTray,
} from "../../features/marketplace/context/compare-tray-context.js";
import { ListingCard } from "./listing-card.js";

const mockListing: BuyerListingCard = {
  id: "507f1f77bcf86cd799439011",
  cropId: "507f1f77bcf86cd799439012",
  crop: {
    id: "507f1f77bcf86cd799439012",
    slug: "potato",
    nameEn: "Diamond Potato",
    nameBn: "ডায়মন্ড আলু",
    unit: "kg",
  },
  grade: CropGrade.A,
  quantityKg: 1200,
  floorPricePerKg: 3500,
  currentBidPerKg: 3800,
  displayPricePerKg: 3800,
  totalDisplayCost: 4560000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 3,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 7200000).toISOString(),
  status: ListingStatus.ACTIVE,
  location: {
    division: "Dhaka",
    district: "Munshiganj",
  },
  thumbnailUrl: "https://example.com/potato.jpg",
  images: [{ url: "https://example.com/potato.jpg", width: 800, height: 600 }],
};

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return (
    <MemoryRouter>
      <CompareTrayProvider>{children}</CompareTrayProvider>
    </MemoryRouter>
  );
}

describe("ListingCard Component", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renders all card elements: photo, crop, grade, quantity, price, bid count hint, countdown, region, compare checkbox", () => {
    render(
      <Wrapper>
        <ListingCard listing={mockListing} />
      </Wrapper>,
    );

    expect(screen.getByTestId(`listing-card-${mockListing.id}`)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Diamond Potato" })).toHaveAttribute(
      "src",
      "https://example.com/potato.jpg",
    );
    expect(screen.getByText("Diamond Potato")).toBeInTheDocument();
    expect(screen.getByText("ডায়মন্ড আলু")).toBeInTheDocument();
    expect(screen.getByTestId("grade-badge-a")).toBeInTheDocument();
    expect(screen.getByText("1,200 kg")).toBeInTheDocument();
    expect(screen.getByTestId("price-tag")).toHaveTextContent("৳38.00/kg");
    expect(screen.getByTestId("listing-card-bid-hint")).toHaveTextContent("3 bids");
    expect(screen.getByText("Munshiganj, Dhaka")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByTestId(`compare-checkbox-${mockListing.id}`)).toBeInTheDocument();
  });

  it("shows 'No bids yet' hint when listing has zero bids", () => {
    const listingWithNoBids: BuyerListingCard = {
      ...mockListing,
      id: "507f1f77bcf86cd799439013",
      bidCount: 0,
      hasBids: false,
      currentBidPerKg: null,
      displayPricePerKg: 3500,
    };

    render(
      <Wrapper>
        <ListingCard listing={listingWithNoBids} />
      </Wrapper>,
    );

    expect(screen.getByTestId("listing-card-bid-hint")).toHaveTextContent("No bids yet");
  });

  it("supports compound composition overriding default children", () => {
    render(
      <Wrapper>
        <ListingCard listing={mockListing}>
          <ListingCard.Header />
          <ListingCard.Price />
        </ListingCard>
      </Wrapper>,
    );

    expect(screen.getByText("Diamond Potato")).toBeInTheDocument();
    expect(screen.getByTestId("price-tag")).toHaveTextContent("৳38.00/kg");
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("toggles compare state when clicking the compare checkbox", () => {
    render(
      <Wrapper>
        <ListingCard listing={mockListing} />
      </Wrapper>,
    );

    const checkbox = screen.getByTestId(`compare-checkbox-${mockListing.id}`);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("disables compare checkbox with explanatory reason when tray has different crop", () => {
    function PreloadedTrayWrapper(): ReactElement {
      const { addItem } = useCompareTray();
      return (
        <div>
          <button
            type="button"
            data-testid="preload-btn"
            onClick={() => addItem(mockListing)}
          >
            Preload
          </button>
          <ListingCard
            listing={{
              ...mockListing,
              id: "507f1f77bcf86cd799439099",
              cropId: "507f1f77bcf86cd799439099",
              crop: {
                id: "507f1f77bcf86cd799439099",
                slug: "onion",
                nameEn: "Red Onion",
                nameBn: "লাল পেঁয়াজ",
                unit: "kg",
              },
            }}
          />
        </div>
      );
    }

    render(
      <Wrapper>
        <PreloadedTrayWrapper />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("preload-btn"));

    const onionCheckbox = screen.getByTestId("compare-checkbox-507f1f77bcf86cd799439099");
    expect(onionCheckbox).toBeDisabled();
    expect(onionCheckbox).toHaveAttribute(
      "aria-description",
      "Compare is limited to listings of the same crop (Diamond Potato)",
    );
  });

  it("maintains layout stability without height jumps when price updates", () => {
    const { rerender } = render(
      <Wrapper>
        <ListingCard listing={mockListing} />
      </Wrapper>,
    );

    const priceSection = screen.getByTestId("listing-card-price-section");
    expect(priceSection).toHaveClass("min-h-[3.25rem]");

    // Rerender with higher price and new bid count
    const updatedListing: BuyerListingCard = {
      ...mockListing,
      currentBidPerKg: 4200,
      displayPricePerKg: 4200,
      bidCount: 4,
    };

    rerender(
      <Wrapper>
        <ListingCard listing={updatedListing} />
      </Wrapper>,
    );

    expect(screen.getByTestId("price-tag")).toHaveTextContent("৳42.00/kg");
    expect(screen.getByTestId("listing-card-bid-hint")).toHaveTextContent("4 bids");
    expect(priceSection).toHaveClass("min-h-[3.25rem]");
  });
});

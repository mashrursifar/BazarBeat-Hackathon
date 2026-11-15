import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type BuyerListingCard,
  CropGrade,
  ListingStatus,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import {
  COMPARE_TRAY_STORAGE_KEY,
  CompareTrayProvider,
  useCompareTray,
} from "../../features/marketplace/context/compare-tray-context.js";
import { CompareTray } from "./compare-tray.js";

const potatoListing1: BuyerListingCard = {
  id: "507f1f77bcf86cd799439001",
  cropId: "507f1f77bcf86cd799439012",
  crop: {
    id: "507f1f77bcf86cd799439012",
    slug: "potato",
    nameEn: "Diamond Potato",
    nameBn: "ডায়মন্ড আলু",
    unit: "kg",
  },
  grade: CropGrade.A,
  quantityKg: 1000,
  floorPricePerKg: 3500,
  currentBidPerKg: 3600,
  displayPricePerKg: 3600,
  totalDisplayCost: 3600000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 2,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 7200000).toISOString(),
  status: ListingStatus.ACTIVE,
  location: { division: "Dhaka", district: "Munshiganj" },
  thumbnailUrl: "https://example.com/potato1.jpg",
};

const potatoListing2: BuyerListingCard = {
  ...potatoListing1,
  id: "507f1f77bcf86cd799439002",
  currentBidPerKg: 3700,
  displayPricePerKg: 3700,
  thumbnailUrl: "https://example.com/potato2.jpg",
};

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return (
    <MemoryRouter>
      <CompareTrayProvider>{children}</CompareTrayProvider>
    </MemoryRouter>
  );
}

function TrayController(): ReactElement {
  const { addItem } = useCompareTray();
  return (
    <div>
      <button
        type="button"
        data-testid="add-item-1"
        onClick={() => addItem(potatoListing1)}
      >
        Add 1
      </button>
      <button
        type="button"
        data-testid="add-item-2"
        onClick={() => addItem(potatoListing2)}
      >
        Add 2
      </button>
      <CompareTray />
    </div>
  );
}

describe("CompareTray Component", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("does not render when compare tray is empty", () => {
    render(
      <Wrapper>
        <CompareTray />
      </Wrapper>,
    );

    expect(screen.queryByTestId("compare-tray")).not.toBeInTheDocument();
  });

  it("renders when items are selected, showing count and crop label", () => {
    render(
      <Wrapper>
        <TrayController />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("add-item-1"));

    expect(screen.getByTestId("compare-tray")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 selected")).toBeInTheDocument();
    expect(screen.getByText("Comparing Diamond Potato")).toBeInTheDocument();
    expect(screen.getByTestId(`compare-tray-item-${potatoListing1.id}`)).toBeInTheDocument();
  });

  it("disables compare button when less than 2 items are selected", () => {
    render(
      <Wrapper>
        <TrayController />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("add-item-1"));

    const submitBtn = screen.getByTestId("compare-tray-submit-disabled");
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveAttribute("title", "Select at least 2 listings to compare");
  });

  it("enables compare link when 2 or more items are selected and links to /buyer/compare", () => {
    render(
      <Wrapper>
        <TrayController />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("add-item-1"));
    fireEvent.click(screen.getByTestId("add-item-2"));

    const submitLink = screen.getByTestId("compare-tray-submit");
    expect(submitLink).toBeInTheDocument();
    expect(submitLink).toHaveAttribute(
      "href",
      `/buyer/compare?ids=${potatoListing1.id},${potatoListing2.id}`,
    );
  });

  it("removes individual item when clicking the remove button", () => {
    render(
      <Wrapper>
        <TrayController />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("add-item-1"));
    fireEvent.click(screen.getByTestId("add-item-2"));

    expect(screen.getByTestId(`compare-tray-item-${potatoListing1.id}`)).toBeInTheDocument();

    const removeBtn = screen.getByTestId(`compare-tray-remove-${potatoListing1.id}`);
    fireEvent.click(removeBtn);

    expect(screen.queryByTestId(`compare-tray-item-${potatoListing1.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`compare-tray-item-${potatoListing2.id}`)).toBeInTheDocument();
    expect(screen.getByText("1 of 4 selected")).toBeInTheDocument();
  });

  it("clears all items when clicking Clear All", () => {
    render(
      <Wrapper>
        <TrayController />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("add-item-1"));
    fireEvent.click(screen.getByTestId("add-item-2"));

    const clearBtn = screen.getByTestId("compare-tray-clear-all-desktop");
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId("compare-tray")).not.toBeInTheDocument();
  });

  it("persists and restores state across page reloads via sessionStorage", () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoListing1, potatoListing2]),
    );

    render(
      <Wrapper>
        <CompareTray />
      </Wrapper>,
    );

    expect(screen.getByTestId("compare-tray")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 selected")).toBeInTheDocument();
    expect(screen.getByTestId(`compare-tray-item-${potatoListing1.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`compare-tray-item-${potatoListing2.id}`)).toBeInTheDocument();
  });
});

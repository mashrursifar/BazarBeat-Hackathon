import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BuyerListingCard,
  type CompareListing,
  type CompareResponse,
  CropGrade,
  ListingStatus,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import {
  COMPARE_TRAY_STORAGE_KEY,
  CompareTrayProvider,
} from "./context/compare-tray-context.js";
import { ComparePage } from "./compare-page.js";
import * as marketplaceApi from "./api/marketplace-api.js";

// Mock the API module
vi.mock("./api/marketplace-api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/marketplace-api.js")>();
  return {
    ...actual,
    getCompareListings: vi.fn(),
  };
});

const getCompareListingsMock = vi.mocked(marketplaceApi.getCompareListings);

const potatoCard1: BuyerListingCard = {
  id: "507f1f77bcf86cd799439001",
  cropId: "507f1f77bcf86cd799439012",
  crop: {
    id: "507f1f77bcf86cd799439012",
    slug: "potato",
    nameEn: "Diamond Potato",
    nameBn: "ডায়মন্ড আলু",
    unit: "kg",
  },
  grade: CropGrade.B,
  quantityKg: 500,
  floorPricePerKg: 3000,
  currentBidPerKg: 3200,
  displayPricePerKg: 3200,
  totalDisplayCost: 1600000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 3,
  startsAt: "2026-11-15T10:00:00.000Z",
  endsAt: "2026-11-15T18:00:00.000Z",
  status: ListingStatus.ACTIVE,
  location: { division: "Dhaka", district: "Munshiganj" },
  thumbnailUrl: "https://example.com/potato1.jpg",
};

const potatoCard2: BuyerListingCard = {
  id: "507f1f77bcf86cd799439002",
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
  floorPricePerKg: 4000,
  currentBidPerKg: 4200,
  displayPricePerKg: 4200,
  totalDisplayCost: 4200000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 5,
  startsAt: "2026-11-15T10:00:00.000Z",
  endsAt: "2026-11-15T20:00:00.000Z",
  status: ListingStatus.ACTIVE,
  location: { division: "Rangpur", district: "Bogra" },
  thumbnailUrl: "https://example.com/potato2.jpg",
};

const compareListing1: CompareListing = {
  id: potatoCard1.id,
  cropId: potatoCard1.cropId,
  cropNameEn: potatoCard1.crop.nameEn,
  cropNameBn: potatoCard1.crop.nameBn,
  grade: CropGrade.B,
  quantityKg: 500,
  floorPricePerKg: 3000,
  currentBidPerKg: 3200,
  displayPricePerKg: 3200,
  displayTotalCost: 1600000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 3,
  startsAt: potatoCard1.startsAt,
  endsAt: potatoCard1.endsAt,
  status: ListingStatus.ACTIVE,
  location: potatoCard1.location,
  farmerRegion: "Dhaka",
  timeLeftSeconds: 3600,
  aiExpectedPricePerKg: 4000,
  percentageVsAiExpected: 80,
  highlights: {
    isLowestPrice: true,
    isBestGrade: false,
    isLargestQuantity: false,
    isBestValue: true,
  },
  thumbnailUrl: potatoCard1.thumbnailUrl,
};

const compareListing2: CompareListing = {
  id: potatoCard2.id,
  cropId: potatoCard2.cropId,
  cropNameEn: potatoCard2.crop.nameEn,
  cropNameBn: potatoCard2.crop.nameBn,
  grade: CropGrade.A,
  quantityKg: 1000,
  floorPricePerKg: 4000,
  currentBidPerKg: 4200,
  displayPricePerKg: 4200,
  displayTotalCost: 4200000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 5,
  startsAt: potatoCard2.startsAt,
  endsAt: potatoCard2.endsAt,
  status: ListingStatus.ACTIVE,
  location: potatoCard2.location,
  farmerRegion: "Rangpur",
  timeLeftSeconds: 7200,
  aiExpectedPricePerKg: 4000,
  percentageVsAiExpected: 105,
  highlights: {
    isLowestPrice: false,
    isBestGrade: true,
    isLargestQuantity: true,
    isBestValue: false,
  },
  thumbnailUrl: potatoCard2.thumbnailUrl,
};

function createMockResponse(
  listings: CompareListing[],
  missingIds: string[] = [],
): CompareResponse {
  const byListingId: Record<
    string,
    {
      isLowestPrice: boolean;
      isBestGrade: boolean;
      isLargestQuantity: boolean;
      isBestValue: boolean;
    }
  > = {};

  for (const l of listings) {
    byListingId[l.id] = l.highlights ?? {
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: false,
      isBestValue: false,
    };
  }

  return {
    data: {
      cropId: listings[0]?.cropId ?? "507f1f77bcf86cd799439012",
      listings,
      highlights: {
        lowestPriceListingIds: listings.filter((l) => l.highlights?.isLowestPrice).map((l) => l.id),
        bestGradeListingIds: listings.filter((l) => l.highlights?.isBestGrade).map((l) => l.id),
        largestQuantityListingIds: listings
          .filter((l) => l.highlights?.isLargestQuantity)
          .map((l) => l.id),
        bestValueListingIds: listings.filter((l) => l.highlights?.isBestValue).map((l) => l.id),
        byListingId,
      },
      missingIds,
    },
    meta: {
      serverTime: new Date().toISOString(),
    },
  };
}

function renderComparePage(initialRoute = "/buyer/compare"): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <CompareTrayProvider>
          <ComparePage />
        </CompareTrayProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ComparePage Component", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders empty state with link to marketplace when tray is empty", async () => {
    renderComparePage();

    expect(screen.getByTestId("compare-empty-state")).toBeInTheDocument();
    expect(screen.getByText(/Your compare tray is empty/i)).toBeInTheDocument();

    const marketplaceLink = screen.getByTestId("compare-empty-marketplace-link");
    expect(marketplaceLink).toBeInTheDocument();
    expect(marketplaceLink).toHaveAttribute("href", "/buyer/marketplace");
  });

  it("renders side-by-side compare table and highlights best cells using flags from server", async () => {
    // Put 2 items in compare tray
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    getCompareListingsMock.mockResolvedValueOnce(
      createMockResponse([compareListing1, compareListing2]),
    );

    renderComparePage();

    // Verify loading or data loaded
    await waitFor(() => {
      expect(screen.getByTestId("compare-table")).toBeInTheDocument();
    });

    // Verify 9 rows exist
    expect(screen.getByText("Photo")).toBeInTheDocument();
    expect(screen.getAllByText("Crop")).toHaveLength(1);
    expect(screen.getByText("Quality Grade")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    expect(screen.getByText("Price per kg")).toBeInTheDocument();
    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.getByText(/vs AI Market/i)).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("Time Left")).toBeInTheDocument();

    // Verify cell highlighting on Listing 1:
    // Listing 1 has isLowestPrice: true and isBestValue: true
    const priceCell1 = screen.getByTestId(`compare-cell-price-${potatoCard1.id}`);
    expect(priceCell1).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId(`badge-lowest-price-${potatoCard1.id}`)).toBeInTheDocument();

    const vsAiCell1 = screen.getByTestId(`compare-cell-vs-ai-${potatoCard1.id}`);
    expect(vsAiCell1).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId(`badge-best-value-${potatoCard1.id}`)).toBeInTheDocument();

    // Listing 1 non-highlighted cells
    const gradeCell1 = screen.getByTestId(`compare-cell-grade-${potatoCard1.id}`);
    expect(gradeCell1).toHaveAttribute("data-highlighted", "false");

    const qtyCell1 = screen.getByTestId(`compare-cell-quantity-${potatoCard1.id}`);
    expect(qtyCell1).toHaveAttribute("data-highlighted", "false");

    // Verify cell highlighting on Listing 2:
    // Listing 2 has isBestGrade: true and isLargestQuantity: true
    const gradeCell2 = screen.getByTestId(`compare-cell-grade-${potatoCard2.id}`);
    expect(gradeCell2).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId(`badge-best-grade-${potatoCard2.id}`)).toBeInTheDocument();

    const qtyCell2 = screen.getByTestId(`compare-cell-quantity-${potatoCard2.id}`);
    expect(qtyCell2).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId(`badge-largest-quantity-${potatoCard2.id}`)).toBeInTheDocument();

    // Listing 2 non-highlighted cells
    const priceCell2 = screen.getByTestId(`compare-cell-price-${potatoCard2.id}`);
    expect(priceCell2).toHaveAttribute("data-highlighted", "false");

    const vsAiCell2 = screen.getByTestId(`compare-cell-vs-ai-${potatoCard2.id}`);
    expect(vsAiCell2).toHaveAttribute("data-highlighted", "false");

    // Verify each column has "Bid now" and "Remove"
    const bidNow1 = screen.getByTestId(`compare-bid-now-${potatoCard1.id}`);
    expect(bidNow1).toBeInTheDocument();
    expect(bidNow1).toHaveAttribute("href", `/buyer/listings/${potatoCard1.id}`);

    const remove1 = screen.getByTestId(`compare-remove-${potatoCard1.id}`);
    expect(remove1).toBeInTheDocument();

    const bidNow2 = screen.getByTestId(`compare-bid-now-${potatoCard2.id}`);
    expect(bidNow2).toBeInTheDocument();
    expect(bidNow2).toHaveAttribute("href", `/buyer/listings/${potatoCard2.id}`);

    const remove2 = screen.getByTestId(`compare-remove-${potatoCard2.id}`);
    expect(remove2).toBeInTheDocument();
  });

  it("handles ties by highlighting all tied columns as indicated by server flags", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    // Both listings tied for lowest price (isLowestPrice: true on both)
    const tiedListing1: CompareListing = {
      ...compareListing1,
      displayPricePerKg: 3500,
      highlights: {
        ...compareListing1.highlights!,
        isLowestPrice: true,
      },
    };

    const tiedListing2: CompareListing = {
      ...compareListing2,
      displayPricePerKg: 3500,
      highlights: {
        ...compareListing2.highlights!,
        isLowestPrice: true,
      },
    };

    getCompareListingsMock.mockResolvedValueOnce(
      createMockResponse([tiedListing1, tiedListing2]),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-table")).toBeInTheDocument();
    });

    // Both listings' price cells must be highlighted with the badge
    const priceCell1 = screen.getByTestId(`compare-cell-price-${tiedListing1.id}`);
    const priceCell2 = screen.getByTestId(`compare-cell-price-${tiedListing2.id}`);

    expect(priceCell1).toHaveAttribute("data-highlighted", "true");
    expect(priceCell2).toHaveAttribute("data-highlighted", "true");

    expect(screen.getByTestId(`badge-lowest-price-${tiedListing1.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`badge-lowest-price-${tiedListing2.id}`)).toBeInTheDocument();
  });

  it("handles ended listings gracefully: shows ended status, no highlights, and non-authoritative time", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    // Listing 1 active, Listing 2 ended (SOLD)
    const endedListing: CompareListing = {
      ...compareListing2,
      status: ListingStatus.SOLD,
      timeLeftSeconds: 0,
      highlights: {
        isLowestPrice: false,
        isBestGrade: false,
        isLargestQuantity: false,
        isBestValue: false,
      },
    };

    getCompareListingsMock.mockResolvedValueOnce(
      createMockResponse([compareListing1, endedListing]),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-table")).toBeInTheDocument();
    });

    // Verify ended badge is displayed on ended listing's time cell
    const endedBadge = screen.getByTestId(`ended-badge-${endedListing.id}`);
    expect(endedBadge).toBeInTheDocument();
    expect(endedBadge).toHaveTextContent(/Auction ended/i);

    // Verify all cells on ended listing have data-highlighted="false"
    const endedPrice = screen.getByTestId(`compare-cell-price-${endedListing.id}`);
    const endedGrade = screen.getByTestId(`compare-cell-grade-${endedListing.id}`);
    const endedQty = screen.getByTestId(`compare-cell-quantity-${endedListing.id}`);
    const endedVsAi = screen.getByTestId(`compare-cell-vs-ai-${endedListing.id}`);

    expect(endedPrice).toHaveAttribute("data-highlighted", "false");
    expect(endedGrade).toHaveAttribute("data-highlighted", "false");
    expect(endedQty).toHaveAttribute("data-highlighted", "false");
    expect(endedVsAi).toHaveAttribute("data-highlighted", "false");

    // Bid now column still present
    const endedBidNow = screen.getByTestId(`compare-bid-now-${endedListing.id}`);
    expect(endedBidNow).toBeInTheDocument();
    expect(endedBidNow).toHaveAttribute("href", `/buyer/listings/${endedListing.id}`);
  });

  it("handles missing listings gracefully with notice and remove option", async () => {
    const missingId = "missing-listing-999";
    const missingCard: BuyerListingCard = {
      ...potatoCard2,
      id: missingId,
    };

    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, missingCard]),
    );

    // Server returns listing 1 and reports missingId in missingIds
    getCompareListingsMock.mockResolvedValueOnce(
      createMockResponse([compareListing1], [missingId]),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-table")).toBeInTheDocument();
    });

    // Notice banner for missing listings
    expect(screen.getByTestId("compare-missing-notice")).toBeInTheDocument();
    expect(
      screen.getByText(/Some listings in your compare tray are no longer available/i),
    ).toBeInTheDocument();

    // Missing column in the table
    expect(screen.getByTestId(`compare-missing-header-${missingId}`)).toBeInTheDocument();
    const missingRemoveBtn = screen.getByTestId(`compare-remove-${missingId}`);
    expect(missingRemoveBtn).toBeInTheDocument();

    // Clicking remove on missing listing removes it from tray
    fireEvent.click(missingRemoveBtn);

    const stored = JSON.parse(
      sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY) || "[]",
    ) as BuyerListingCard[];
    expect(stored.some((item) => item.id === missingId)).toBe(false);
  });

  it("removal updates the tray and renders empty state when all items are removed", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    getCompareListingsMock.mockResolvedValue(
      createMockResponse([compareListing1, compareListing2]),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-table")).toBeInTheDocument();
    });

    // Remove first listing
    const removeBtn1 = screen.getByTestId(`compare-remove-${potatoCard1.id}`);
    fireEvent.click(removeBtn1);

    // Check sessionStorage
    let stored = JSON.parse(
      sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY) || "[]",
    ) as BuyerListingCard[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(potatoCard2.id);

    // When 1 item is left, min-items notice is shown with card
    expect(screen.getByTestId("compare-min-items-notice")).toBeInTheDocument();

    // Remove the remaining listing
    const removeBtn2 = screen.getByTestId(`compare-remove-${potatoCard2.id}`);
    fireEvent.click(removeBtn2);

    // Tray is now empty
    stored = JSON.parse(
      sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY) || "[]",
    ) as BuyerListingCard[];
    expect(stored).toHaveLength(0);

    // Empty state is rendered
    expect(screen.getByTestId("compare-empty-state")).toBeInTheDocument();
    expect(screen.getByText(/Your compare tray is empty/i)).toBeInTheDocument();
  });

  it("table is rendered inside an overflow-x-auto container suitable for 360px viewport", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    getCompareListingsMock.mockResolvedValueOnce(
      createMockResponse([compareListing1, compareListing2]),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-table-container")).toBeInTheDocument();
    });

    const container = screen.getByTestId("compare-table-container");
    expect(container).toHaveClass("overflow-x-auto");
    expect(container).toHaveClass("w-full");
  });

  it("handles COMPARE_MIXED_CROPS error gracefully with clear tray option", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1, potatoCard2]),
    );

    getCompareListingsMock.mockRejectedValueOnce(
      new marketplaceApi.MarketplaceApiError(
        400,
        "COMPARE_MIXED_CROPS",
        "All listings in compare must belong to the same crop",
      ),
    );

    renderComparePage();

    await waitFor(() => {
      expect(screen.getByTestId("compare-mixed-crops-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/All listings in compare must belong to the same crop/i),
    ).toBeInTheDocument();

    const clearBtn = screen.getByTestId("compare-clear-tray-btn");
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    const stored = JSON.parse(
      sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY) || "[]",
    ) as BuyerListingCard[];
    expect(stored).toHaveLength(0);
  });

  it("handles single item in tray initially: displays min-items notice and single item card", async () => {
    sessionStorage.setItem(
      COMPARE_TRAY_STORAGE_KEY,
      JSON.stringify([potatoCard1]),
    );

    renderComparePage();

    expect(screen.getByTestId("compare-min-items-notice")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Select at least 2 listings to compare/i }),
    ).toBeInTheDocument();

    const removeBtn = screen.getByTestId(`compare-remove-${potatoCard1.id}`);
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);

    expect(screen.getByTestId("compare-empty-state")).toBeInTheDocument();
  });
});

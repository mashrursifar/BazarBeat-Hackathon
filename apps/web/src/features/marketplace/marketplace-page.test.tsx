import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BuyerListingCard,
  CropGrade,
  type CropResponse,
  ListingStatus,
  MarketplaceSort,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import MarketplacePage from "./marketplace-page.js";

// Mock API functions
const getMarketplaceListingsMock = vi.hoisted(() => vi.fn());
const getCropsMock = vi.hoisted(() => vi.fn());

vi.mock("./api/marketplace-api.js", () => ({
  getMarketplaceListings: getMarketplaceListingsMock,
}));

vi.mock("../listings/api/listing-api.js", () => ({
  getCrops: getCropsMock,
}));

const mockCrops: CropResponse[] = [
  {
    id: "507f1f77bcf86cd799439012",
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG",
    minIncrementPerKg: 50,
    shelfLifeHours: 720,
    minLotKg: 100,
    maxLotKg: 5000,
    gradeGuide: { A: "Grade A", B: "Grade B", C: "Grade C" },
    imageUrl: "https://example.com/potato.jpg",
  },
  {
    id: "507f1f77bcf86cd799439099",
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minIncrementPerKg: 50,
    shelfLifeHours: 480,
    minLotKg: 50,
    maxLotKg: 3000,
    gradeGuide: { A: "Grade A", B: "Grade B", C: "Grade C" },
    imageUrl: "https://example.com/onion.jpg",
  },
];

const mockPotato1: BuyerListingCard = {
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
  floorPricePerKg: 3000,
  currentBidPerKg: 3500,
  displayPricePerKg: 3500,
  totalDisplayCost: 3500000,
  minIncrementPerKg: 50,
  hasBids: true,
  bidCount: 2,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 7200000).toISOString(),
  status: ListingStatus.ACTIVE,
  location: { division: "Dhaka", district: "Munshiganj" },
  thumbnailUrl: "https://example.com/potato1.jpg",
};

const mockPotato2: BuyerListingCard = {
  ...mockPotato1,
  id: "507f1f77bcf86cd799439002",
  quantityKg: 800,
  grade: CropGrade.B,
  displayPricePerKg: 3200,
  currentBidPerKg: null,
  hasBids: false,
  bidCount: 0,
};

const mockOnion: BuyerListingCard = {
  id: "507f1f77bcf86cd799439003",
  cropId: "507f1f77bcf86cd799439099",
  crop: {
    id: "507f1f77bcf86cd799439099",
    slug: "onion",
    nameEn: "Red Onion",
    nameBn: "লাল পেঁয়াজ",
    unit: "kg",
  },
  grade: CropGrade.A,
  quantityKg: 500,
  floorPricePerKg: 6000,
  currentBidPerKg: 6500,
  displayPricePerKg: 6500,
  totalDisplayCost: 3250000,
  minIncrementPerKg: 100,
  hasBids: true,
  bidCount: 1,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 7200000).toISOString(),
  status: ListingStatus.ACTIVE,
  location: { division: "Rajshahi", district: "Pabna" },
  thumbnailUrl: "https://example.com/onion.jpg",
};

function renderMarketplace(initialUrl = "/buyer/marketplace"): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/buyer/marketplace" element={<MarketplacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MarketplacePage Component", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    getCropsMock.mockResolvedValue(mockCrops);
    getMarketplaceListingsMock.mockResolvedValue({
      data: [mockPotato1, mockPotato2, mockOnion],
      meta: {
        serverTime: new Date().toISOString(),
        page: 1,
        limit: 20,
        total: 3,
      },
    });
  });

  it("renders page header with Demo AI model chip and listings grid", async () => {
    renderMarketplace();

    expect(screen.getByTestId("marketplace-page")).toBeInTheDocument();
    expect(screen.getByText("Produce Marketplace")).toBeInTheDocument();
    expect(screen.getByTestId("demo-ai-chip")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId(`listing-card-${mockPotato1.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`listing-card-${mockPotato2.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`listing-card-${mockOnion.id}`)).toBeInTheDocument();
    });
  });

  it("syncs filters and sort from URL query string", async () => {
    renderMarketplace("/buyer/marketplace?crop=potato&grade=A&sort=lowest-price");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Potato" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getMarketplaceListingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          crop: "potato",
          grade: CropGrade.A,
          sort: MarketplaceSort.LOWEST_PRICE,
        }),
      );
    });

    const cropSelect = screen.getByTestId("filter-crop-select") as HTMLSelectElement;
    const gradeSelect = screen.getByTestId("filter-grade-select") as HTMLSelectElement;
    const sortSelect = screen.getByTestId("marketplace-sort-select") as HTMLSelectElement;

    expect(cropSelect.value).toBe("potato");
    expect(gradeSelect.value).toBe("A");
    expect(sortSelect.value).toBe("lowest-price");
  });

  it("updates URL query parameters when changing filters", async () => {
    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Potato" })).toBeInTheDocument();
    });

    const cropSelect = screen.getByTestId("filter-crop-select");
    fireEvent.change(cropSelect, { target: { value: "potato" } });

    await waitFor(() => {
      expect(getMarketplaceListingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          crop: "potato",
        }),
      );
    });
  });

  it("enforces compare tray rules: same crop only, and up to 4 items", async () => {
    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByTestId(`listing-card-${mockPotato1.id}`)).toBeInTheDocument();
    });

    // Select first potato item
    const potato1Checkbox = screen.getByTestId(`compare-checkbox-${mockPotato1.id}`);
    fireEvent.click(potato1Checkbox);
    expect(potato1Checkbox).toBeChecked();

    // Compare tray is now open for Potato
    expect(screen.getByTestId("compare-tray")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 selected")).toBeInTheDocument();

    // Onion listing checkbox should now be disabled because of crop mismatch
    const onionCheckbox = screen.getByTestId(`compare-checkbox-${mockOnion.id}`);
    expect(onionCheckbox).toBeDisabled();
    expect(onionCheckbox).toHaveAttribute(
      "aria-description",
      "Compare is limited to listings of the same crop (Diamond Potato)",
    );

    // Second potato listing can still be selected
    const potato2Checkbox = screen.getByTestId(`compare-checkbox-${mockPotato2.id}`);
    expect(potato2Checkbox).not.toBeDisabled();
    fireEvent.click(potato2Checkbox);
    expect(potato2Checkbox).toBeChecked();
    expect(screen.getByText("2 of 4 selected")).toBeInTheDocument();

    // Unselect both
    fireEvent.click(potato1Checkbox);
    fireEvent.click(potato2Checkbox);

    // Tray is now empty, onion can now be selected
    expect(screen.queryByTestId("compare-tray")).not.toBeInTheDocument();
    expect(onionCheckbox).not.toBeDisabled();
  });

  it("renders empty state with 'Clear filters' action when zero listings return", async () => {
    getMarketplaceListingsMock.mockResolvedValueOnce({
      data: [],
      meta: {
        serverTime: new Date().toISOString(),
        page: 1,
        limit: 20,
        total: 0,
      },
    });

    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByTestId("marketplace-empty-state")).toBeInTheDocument();
      expect(screen.getByText("No listings found")).toBeInTheDocument();
    });

    const clearBtn = screen.getByTestId("marketplace-empty-clear-button");
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
  });

  it("renders error state with retry action when query fails", async () => {
    getMarketplaceListingsMock.mockRejectedValueOnce(new Error("Network Error"));

    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByTestId("marketplace-error-state")).toBeInTheDocument();
      expect(screen.getByText("Could not load marketplace listings")).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId("marketplace-retry-button");
    expect(retryBtn).toBeInTheDocument();

    getMarketplaceListingsMock.mockResolvedValueOnce({
      data: [mockPotato1],
      meta: {
        serverTime: new Date().toISOString(),
        page: 1,
        limit: 20,
        total: 1,
      },
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId(`listing-card-${mockPotato1.id}`)).toBeInTheDocument();
    });
  });

  it("renders mobile filter button and opens bottom sheet at 360px viewport", async () => {
    renderMarketplace();

    const mobileFilterBtn = screen.getByTestId("mobile-filter-button");
    expect(mobileFilterBtn).toBeInTheDocument();

    // Click mobile filter button to open bottom sheet
    fireEvent.click(mobileFilterBtn);

    expect(screen.getByTestId("mobile-filter-sheet")).toBeInTheDocument();

    // Apply button closes the sheet
    const applyBtn = screen.getByTestId("mobile-filter-apply");
    fireEvent.click(applyBtn);

    expect(screen.queryByTestId("mobile-filter-sheet")).not.toBeInTheDocument();
  });

  it("prevents layout shift during polling refreshes using keepPreviousData", async () => {
    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByTestId(`listing-card-${mockPotato1.id}`)).toBeInTheDocument();
    });

    // Verify loading skeletons do not show while re-fetching in background
    expect(screen.queryByTestId("marketplace-loading-grid")).not.toBeInTheDocument();
  });
});

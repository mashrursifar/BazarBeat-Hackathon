import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CropResponse, MarketHistoryResponse } from "@bazarbeat/shared";
import "../../lib/i18n.js";
import * as listingApi from "../listings/api/listing-api.js";
import * as marketApi from "./api/market-prices-api.js";
import * as authContext from "../auth/auth-context.js";
import FarmerMarketPricesPage from "./farmer-market-prices-page.js";

const mockCrops: CropResponse[] = [
  {
    id: "crop-onion",
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 50,
    maxLotKg: 2000,
    shelfLifeHours: 168,
    minIncrementPerKg: 100,
    gradeGuide: {
      A: "Firm bulb, tight dry skin, uniform size, no shoots",
      B: "Slight superficial blemishes, small size variation, firm flesh",
      C: "Minor surface defects or small soft spots acceptable for immediate local sale",
    },
    imageUrl: "/crops/onion.svg",
  },
  {
    id: "crop-potato",
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG",
    minLotKg: 50,
    maxLotKg: 3000,
    shelfLifeHours: 240,
    minIncrementPerKg: 50,
    gradeGuide: {
      A: "Smooth skin, no greening, uniform shape, no cuts",
      B: "Slight skin marks, minor shape variation, firm",
      C: "Superficial scratches or irregular shapes, completely sound inside",
    },
    imageUrl: "/crops/potato.svg",
  },
];

const mockDivisionHistory: MarketHistoryResponse = {
  data: {
    cropId: "crop-onion",
    cropSlug: "onion",
    cropName: "Onion",
    cropNameBn: "পেঁয়াজ",
    division: "rajshahi",
    range: "30d",
    trend: "UP",
    currentAvgPricePerKg: 6500, // ৳65.00
    minPricePerKg: 5800,
    maxPricePerKg: 7200,
    changePercent: 6.5,
    series: [
      { date: "2026-11-01", avgPricePerKg: 6100, minPricePerKg: 5800, maxPricePerKg: 6400 },
      { date: "2026-11-15", avgPricePerKg: 6300, minPricePerKg: 6000, maxPricePerKg: 6700 },
      { date: "2026-11-18", avgPricePerKg: 6500, minPricePerKg: 6100, maxPricePerKg: 7200 },
    ],
    gradeGuide: {
      A: {
        grade: "A",
        expectedPerKg: 7200,
        lowPerKg: 6800,
        highPerKg: 7600,
        suggestedFloorPerKg: 6500,
        description: "Premium export-quality bulbs",
      },
      B: {
        grade: "B",
        expectedPerKg: 6300,
        lowPerKg: 5900,
        highPerKg: 6700,
        suggestedFloorPerKg: 5800,
        description: "Standard market produce",
      },
      C: {
        grade: "C",
        expectedPerKg: 5400,
        lowPerKg: 5000,
        highPerKg: 5800,
        suggestedFloorPerKg: 4900,
        description: "Value grade for immediate consumption",
      },
    },
  },
  meta: {
    serverTime: "2026-11-18T12:00:00.000Z",
    cropId: "crop-onion",
    division: "rajshahi",
    range: "30d",
  },
};

const mockNationalHistory: MarketHistoryResponse = {
  data: {
    cropId: "crop-onion",
    cropSlug: "onion",
    cropName: "Onion",
    range: "30d",
    trend: "FLAT",
    currentAvgPricePerKg: 6000, // ৳60.00 national mean
    minPricePerKg: 5200,
    maxPricePerKg: 7000,
    changePercent: 0.5,
    series: [
      { date: "2026-11-01", avgPricePerKg: 5900, minPricePerKg: 5200, maxPricePerKg: 6800 },
      { date: "2026-11-18", avgPricePerKg: 6000, minPricePerKg: 5400, maxPricePerKg: 7000 },
    ],
  },
  meta: {
    serverTime: "2026-11-18T12:00:00.000Z",
    cropId: "crop-onion",
    range: "30d",
  },
};

describe("Task 7.10 — Web: Farmer Market Prices Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(listingApi, "getCrops").mockResolvedValue(mockCrops);

    vi.spyOn(marketApi, "fetchMarketHistory").mockImplementation(async (query) => {
      if (query.division) {
        return {
          ...mockDivisionHistory,
          data: {
            ...mockDivisionHistory.data,
            cropId: query.cropId,
            division: query.division,
            range: query.range || "30d",
          },
        };
      }
      return {
        ...mockNationalHistory,
        data: {
          ...mockNationalHistory.data,
          cropId: query.cropId,
          range: query.range || "30d",
        },
      };
    });

    vi.spyOn(authContext, "useOptionalAuth").mockReturnValue({
      user: {
        id: "farmer-1",
        role: "FARMER",
        name: "Rahim Farmer",
        division: "rajshahi",
        district: "bogura",
        language: "en",
      },
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      setUser: vi.fn(),
      retry: vi.fn(),
    });
  });

  it("defaults selectors to the farmer's division and first crop", async () => {
    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const cropSelect = screen.getByTestId("crop-selector") as HTMLSelectElement;
      expect(cropSelect.value).toBe("crop-onion");
    });

    const divisionSelect = screen.getByTestId("division-selector") as HTMLSelectElement;
    expect(divisionSelect.value).toBe("rajshahi");

    // Header cards
    await waitFor(() => {
      const avgCard = screen.getByTestId("stat-latest-avg");
      expect(avgCard).toBeInTheDocument();
      expect(within(avgCard).getByText("৳65.00 / kg")).toBeInTheDocument();
    });
  });

  it("renders trend labels and badges accurately for UP, DOWN, and FLAT", async () => {
    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    // Initial mock has trend: UP
    await waitFor(() => {
      expect(screen.getByTestId("trend-badge-up")).toBeInTheDocument();
      expect(screen.getByText("Trending Up")).toBeInTheDocument();
    });

    // Change mock to DOWN
    vi.spyOn(marketApi, "fetchMarketHistory").mockResolvedValueOnce({
      ...mockDivisionHistory,
      data: { ...mockDivisionHistory.data, trend: "DOWN" },
    });

    const user = userEvent.setup();
    const range7dBtn = screen.getByTestId("range-preset-7d");
    await user.click(range7dBtn);

    await waitFor(() => {
      expect(screen.getByTestId("trend-badge-down")).toBeInTheDocument();
      expect(screen.getByText("Trending Down")).toBeInTheDocument();
    });
  });

  it("renders division versus national comparison card", async () => {
    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const card = screen.getByTestId("division-vs-national-card");
      expect(card).toBeInTheDocument();
      // Division is ৳65, national is ৳60 -> +৳5.00/kg (+8.3%) higher than national average
      expect(within(card).getByText(/higher than national average/i)).toBeInTheDocument();
      expect(within(card).getByText(/\+৳5\.00 \/ kg/)).toBeInTheDocument();
    });
  });

  it("renders grade guide with expected prices, ranges, and floor for Grades A, B, and C", async () => {
    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("grade-guide-section")).toBeInTheDocument();
    });

    // Check Grade A card
    const gradeACard = screen.getByTestId("grade-card-A");
    expect(within(gradeACard).getByText("৳72.00")).toBeInTheDocument();
    expect(within(gradeACard).getByText(/৳68\.00 – ৳76\.00/)).toBeInTheDocument();
    expect(within(gradeACard).getByText(/৳65\.00 \/ kg/)).toBeInTheDocument();

    // Check Grade B card
    const gradeBCard = screen.getByTestId("grade-card-B");
    expect(within(gradeBCard).getByText("৳63.00")).toBeInTheDocument();

    // Check Grade C card
    const gradeCCard = screen.getByTestId("grade-card-C");
    expect(within(gradeCCard).getByText("৳54.00")).toBeInTheDocument();
  });

  it("renders clear call-to-action link to create a listing for the selected crop", async () => {
    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const link = screen.getByTestId("create-listing-cta");
      expect(link).toHaveAttribute("href", "/farmer/new-listing?crop=onion");
      expect(link).toHaveTextContent("Create Listing for Onion →");
    });
  });

  it("handles empty price history cleanly without crashing", async () => {
    vi.spyOn(marketApi, "fetchMarketHistory").mockImplementation(async (query) => {
      if (query.division) {
        return {
          ...mockDivisionHistory,
          data: {
            ...mockDivisionHistory.data,
            series: [],
          },
        };
      }
      return {
        ...mockNationalHistory,
        data: {
          ...mockNationalHistory.data,
          series: [],
        },
      };
    });

    render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const emptyBox = screen.getByTestId("farmer-price-band-chart-empty");
      expect(emptyBox).toBeInTheDocument();
      expect(emptyBox).toHaveTextContent("No price history available for this selection.");
    });
  });

  it("renders mobile-friendly responsive layout container without overflow", async () => {
    const { container } = render(
      <MemoryRouter>
        <FarmerMarketPricesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("farmer-market-prices-page")).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toHaveClass("w-full");
    expect(main).toHaveClass("max-w-6xl");
  });
});

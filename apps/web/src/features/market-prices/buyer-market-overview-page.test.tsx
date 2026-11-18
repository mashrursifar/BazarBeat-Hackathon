import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CropResponse,
  MarketHistoryResponse,
  NationalSummaryResponse,
} from "@bazarbeat/shared";
import "../../lib/i18n.js";
import * as listingApi from "../listings/api/listing-api.js";
import * as marketApi from "./api/market-prices-api.js";
import BuyerMarketOverviewPage from "./buyer-market-overview-page.js";

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
    gradeGuide: { A: "Grade A", B: "Grade B", C: "Grade C" },
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
    gradeGuide: { A: "Grade A", B: "Grade B", C: "Grade C" },
    imageUrl: "/crops/potato.svg",
  },
];

const mockNationalSummary: NationalSummaryResponse = {
  data: {
    divisions: [
      {
        division: "dhaka",
        divisionBn: "ঢাকা",
        crops: [
          {
            cropId: "crop-onion",
            cropSlug: "onion",
            cropName: "Onion",
            cropNameBn: "পেঁয়াজ",
            avgPricePerKg: 6600, // ৳66.00 (above mean ৳60.00)
            minPricePerKg: 6200,
            maxPricePerKg: 7000,
            activeListingsCount: 3,
            completedSalesCount: 12,
            totalQuantityKg: 1500,
          },
          {
            cropId: "crop-potato",
            cropSlug: "potato",
            cropName: "Potato",
            cropNameBn: "আলু",
            avgPricePerKg: 3800,
            minPricePerKg: 3500,
            maxPricePerKg: 4200,
            activeListingsCount: 0, // No active listings -> should render "—"
            completedSalesCount: 4,
            totalQuantityKg: 0,
          },
        ],
      },
      {
        division: "rajshahi",
        divisionBn: "রাজশাহী",
        crops: [
          {
            cropId: "crop-onion",
            cropSlug: "onion",
            cropName: "Onion",
            cropNameBn: "পেঁয়াজ",
            avgPricePerKg: 5500, // ৳55.00 (below mean ৳60.00)
            minPricePerKg: 5000,
            maxPricePerKg: 6000,
            activeListingsCount: 5,
            completedSalesCount: 20,
            totalQuantityKg: 3200,
          },
          {
            cropId: "crop-potato",
            cropSlug: "potato",
            cropName: "Potato",
            cropNameBn: "আলু",
            avgPricePerKg: 4000,
            minPricePerKg: 3700,
            maxPricePerKg: 4300,
            activeListingsCount: 2,
            completedSalesCount: 8,
            totalQuantityKg: 800,
          },
        ],
      },
      {
        division: "chattogram",
        crops: [],
      },
      {
        division: "khulna",
        crops: [],
      },
      {
        division: "barishal",
        crops: [],
      },
      {
        division: "sylhet",
        crops: [],
      },
      {
        division: "rangpur",
        crops: [],
      },
      {
        division: "mymensingh",
        crops: [],
      },
    ],
  },
  meta: {
    serverTime: "2026-11-18T12:00:00.000Z",
    totalDivisions: 8,
  },
};

const mockNationalHistory: MarketHistoryResponse = {
  data: {
    cropId: "crop-onion",
    cropSlug: "onion",
    cropName: "Onion",
    range: "30d",
    trend: "UP",
    currentAvgPricePerKg: 6000,
    minPricePerKg: 5400,
    maxPricePerKg: 6800,
    changePercent: 4.2,
    series: [
      { date: "2026-11-01", avgPricePerKg: 5700, minPricePerKg: 5400, maxPricePerKg: 6100 },
      { date: "2026-11-18", avgPricePerKg: 6000, minPricePerKg: 5600, maxPricePerKg: 6800 },
    ],
  },
  meta: {
    serverTime: "2026-11-18T12:00:00.000Z",
    cropId: "crop-onion",
    range: "30d",
  },
};

describe("Task 7.11 — Web: Buyer Market Overview Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(listingApi, "getCrops").mockResolvedValue(mockCrops);
    vi.spyOn(marketApi, "fetchNationalSummary").mockResolvedValue(mockNationalSummary);
    vi.spyOn(marketApi, "fetchMarketHistory").mockResolvedValue(mockNationalHistory);
  });

  it("renders the crop × division heat table with numeric values and legend", async () => {
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const legend = screen.getByTestId("heat-table-legend");
      expect(legend).toBeInTheDocument();
      expect(within(legend).getByText(/Heat Scale/i)).toBeInTheDocument();
      expect(within(legend).getByText(/Below Avg/i)).toBeInTheDocument();
      expect(within(legend).getByText(/Near Avg/i)).toBeInTheDocument();
      expect(within(legend).getByText(/Above Avg/i)).toBeInTheDocument();
    });

    // Check numeric values in populated cells
    expect(screen.getByText("৳66.00")).toBeInTheDocument();
    expect(screen.getByText("৳55.00")).toBeInTheDocument();
  });

  it("renders empty cells with no active listings as '—'", async () => {
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    // Potato in Dhaka has 0 active listings in mock -> should be "—"
    await waitFor(() => {
      const emptyCell = screen.getByTestId("empty-cell-potato-dhaka");
      expect(emptyCell).toBeInTheDocument();
      expect(emptyCell).toHaveTextContent("—");
    });
  });

  it("links cells with active listings to Marketplace filtered to that crop and division", async () => {
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const cellLink = screen.getByTestId("heat-cell-link-onion-dhaka");
      expect(cellLink).toBeInTheDocument();
      expect(cellLink).toHaveAttribute("href", "/buyer/marketplace?crop=onion&division=dhaka");
    });

    const rajshahiLink = screen.getByTestId("heat-cell-link-onion-rajshahi");
    expect(rajshahiLink).toHaveAttribute("href", "/buyer/marketplace?crop=onion&division=rajshahi");
  });

  it("shows listing counts and volume on hover or tap", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("heat-cell-onion-dhaka")).toBeInTheDocument();
    });

    // Tap / Click cell
    const cell = screen.getByTestId("heat-cell-onion-dhaka");
    await user.click(cell);

    // Detail card should appear
    await waitFor(() => {
      const card = screen.getByTestId("cell-hover-card");
      expect(card).toBeInTheDocument();
      expect(within(card).getByText(/3 listings/i)).toBeInTheDocument();
      expect(within(card).getByText(/1,500 kg/i)).toBeInTheDocument();
      expect(within(card).getByText(/View active listings in Marketplace/i)).toBeInTheDocument();
    });
  });

  it("provides horizontal scroll container with sticky first column for 360px mobile view", async () => {
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const container = screen.getByTestId("heat-table-container");
      expect(container).toHaveClass("overflow-x-auto");
    });

    // Verify first column has sticky positioning
    const cropHeader = screen.getByRole("columnheader", { name: "Crop" });
    expect(cropHeader).toHaveClass("sticky");
    expect(cropHeader).toHaveClass("left-0");
  });

  it("renders national price history chart with crop selector", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BuyerMarketOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("national-history-section")).toBeInTheDocument();
      expect(screen.getByTestId("national-price-band-chart")).toBeInTheDocument();
    });

    const cropSelect = screen.getByTestId("national-chart-crop-selector") as HTMLSelectElement;
    expect(cropSelect.value).toBe("crop-onion");

    // Switch crop to Potato
    await user.selectOptions(cropSelect, "crop-potato");
    expect(cropSelect.value).toBe("crop-potato");

    expect(marketApi.fetchMarketHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        cropId: "crop-potato",
      }),
    );
  });
});

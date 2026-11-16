import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  type CropResponse,
  OrderStatus,
  PaymentStatus,
  type SaleItem,
  type SalesResponse,
  formatDisplayPrice,
  formatPoisha,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as listingApi from "../listings/api/listing-api.js";
import * as salesApi from "./api/sales-api.js";
import SalesPage from "./sales-page.js";

const mockCrops: CropResponse[] = [
  {
    id: "651234567890abcdef123451",
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120,
    gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Small" },
    minIncrementPerKg: 100,
    imageUrl: "/images/crops/onion.jpg",
  },
  {
    id: "651234567890abcdef123452",
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG",
    minLotKg: 20,
    maxLotKg: 2000,
    shelfLifeHours: 140,
    gradeGuide: { A: "Firm", B: "Minor cuts", C: "Small" },
    minIncrementPerKg: 100,
    imageUrl: "/images/crops/potato.jpg",
  },
];

const mockSaleItems: SaleItem[] = [
  {
    id: "sale-1",
    listingId: "listing-1",
    cropId: "crop-1",
    cropName: "Onion",
    cropNameBn: "পেঁয়াজ",
    grade: CropGrade.A,
    quantityKg: 200,
    pricePerKg: 6500, // ৳65.00
    expectedPricePerKg: 6000,
    subtotal: 1300000, // ৳13,000.00
    platformFee: 26000, // ৳260.00
    farmerNet: 1274000, // ৳12,740.00
    pricePremiumPercent: 8.3,
    status: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    buyerName: "Karim Wholesale",
    buyerDivision: "Dhaka",
    soldAt: "2026-11-10T10:00:00.000Z",
    completedAt: "2026-11-12T14:00:00.000Z",
  },
  {
    id: "sale-2",
    listingId: "listing-2",
    cropId: "crop-2",
    cropName: "Potato",
    cropNameBn: "আলু",
    grade: CropGrade.B,
    quantityKg: 500,
    pricePerKg: 3500, // ৳35.00
    expectedPricePerKg: 3200,
    subtotal: 1750000, // ৳17,500.00
    platformFee: 35000, // ৳350.00
    farmerNet: 1715000, // ৳17,150.00
    pricePremiumPercent: 9.4,
    status: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    buyerName: "Rahim Agro",
    buyerDivision: "Chattogram",
    soldAt: "2026-11-08T09:00:00.000Z",
    completedAt: "2026-11-09T11:00:00.000Z",
  },
];

const mockSalesResponse: SalesResponse = {
  data: mockSaleItems,
  meta: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    serverTime: "2026-11-16T12:00:00.000Z",
    totals: {
      totalQuantityKg: 700,
      totalSubtotal: 3050000,
      totalPlatformFee: 61000,
      totalFarmerNet: 2989000,
      totalGross: 3050000,
      totalFees: 61000,
      totalNet: 2989000,
      count: 2,
    },
  },
};

function renderSalesPage(initialUrl = "/farmer/sales"): ReturnType<typeof render> {
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
        <SalesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Task 6.9 — Web: Sales Page", () => {
  let fetchSalesSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(listingApi, "getCrops").mockResolvedValue(mockCrops);
    fetchSalesSpy = vi.spyOn(salesApi, "fetchSales").mockResolvedValue(mockSalesResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders sales table, mobile cards, and totals row with shared formatters", async () => {
    renderSalesPage();

    await waitFor(() => {
      expect(screen.getByTestId("sales-page")).toBeInTheDocument();
    });

    // Check header
    expect(screen.getByRole("heading", { level: 1, name: /Completed Sales/i })).toBeInTheDocument();

    // Check table headers
    expect(screen.getByTestId("sales-desktop-table")).toBeInTheDocument();
    expect(screen.getByTestId("sale-row-sale-1")).toBeInTheDocument();
    expect(screen.getByTestId("sale-row-sale-2")).toBeInTheDocument();

    // Check shared formatters on values
    // Onion row
    expect(screen.getAllByText("Onion")[0]).toBeInTheDocument();
    expect(screen.getAllByText("200 kg")[0]).toBeInTheDocument();
    expect(screen.getAllByText(formatDisplayPrice(6500))[0]).toBeInTheDocument(); // ৳65.00/kg
    expect(screen.getAllByText(formatPoisha(1300000))[0]).toBeInTheDocument(); // ৳13000.00
    expect(screen.getAllByText(formatPoisha(26000))[0]).toBeInTheDocument(); // ৳260.00
    expect(screen.getAllByText(formatPoisha(1274000))[0]).toBeInTheDocument(); // ৳12740.00
    expect(screen.getAllByText("+8.3%")[0]).toBeInTheDocument();

    // Totals row verification (filtered totals)
    const totalsRow = screen.getByTestId("sales-totals-row");
    expect(totalsRow).toHaveTextContent("700 kg");
    expect(totalsRow).toHaveTextContent(formatPoisha(3050000));
    expect(totalsRow).toHaveTextContent(formatPoisha(61000));
    expect(totalsRow).toHaveTextContent(formatPoisha(2989000));

    // Mobile layout verification
    expect(screen.getByTestId("sales-mobile-list")).toBeInTheDocument();
    expect(screen.getByTestId("sales-mobile-totals")).toBeInTheDocument();
    expect(screen.getByTestId("sale-card-sale-1")).toBeInTheDocument();
    expect(screen.getByTestId("sale-card-sale-2")).toBeInTheDocument();
  });

  it("synchronizes filters with URL search params", async () => {
    const user = userEvent.setup();
    renderSalesPage("/farmer/sales?crop=onion&buyerDivision=Dhaka");

    // Expect initial fetch with query params from URL
    await waitFor(() => {
      expect(fetchSalesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          crop: "onion",
          buyerDivision: "Dhaka",
          page: 1,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("sales-crop-filter")).toBeInTheDocument();
    });

    // Check filter selects reflect URL values
    const cropSelect = screen.getByTestId("sales-crop-filter") as HTMLSelectElement;
    const divisionSelect = screen.getByTestId("sales-division-filter") as HTMLSelectElement;
    expect(cropSelect.value).toBe("onion");
    expect(divisionSelect.value).toBe("Dhaka");

    // Clear filters button should be visible
    const clearButton = screen.getByTestId("sales-clear-filters");
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);

    // After clearing, fetch should be called without filters
    await waitFor(() => {
      expect(fetchSalesSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          crop: undefined,
          buyerDivision: undefined,
          page: 1,
        }),
      );
    });
  });

  it("handles date range and division filter changes and resets page to 1", async () => {
    const user = userEvent.setup();
    renderSalesPage("/farmer/sales?page=2");

    await waitFor(() => {
      expect(screen.getByTestId("sales-page")).toBeInTheDocument();
    });

    const divisionSelect = screen.getByTestId("sales-division-filter");
    await user.selectOptions(divisionSelect, "Chattogram");

    await waitFor(() => {
      expect(fetchSalesSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          buyerDivision: "Chattogram",
          page: 1, // Page resets to 1 on filter change
        }),
      );
    });

    const startDateInput = screen.getByTestId("sales-start-date");
    await user.type(startDateInput, "2026-11-01");

    await waitFor(() => {
      expect(fetchSalesSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: "2026-11-01",
          page: 1,
        }),
      );
    });
  });

  it("renders empty state when no sales exist", async () => {
    fetchSalesSpy.mockResolvedValueOnce({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    });

    renderSalesPage("/farmer/sales");

    await waitFor(() => {
      expect(screen.getByTestId("sales-empty-state")).toBeInTheDocument();
    });

    const emptyState = screen.getByTestId("sales-empty-state");
    expect(within(emptyState).getByText("No sales found")).toBeInTheDocument();
    expect(within(emptyState).getByRole("link", { name: /Create Listing/i })).toBeInTheDocument();
  });

  it("renders error state on API failure and retries", async () => {
    fetchSalesSpy.mockRejectedValueOnce(new Error("API_ERROR"));

    renderSalesPage("/farmer/sales");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();

    fetchSalesSpy.mockResolvedValueOnce(mockSalesResponse);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByTestId("sales-desktop-table")).toBeInTheDocument();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FarmerDashboardResponse } from "@bazarbeat/shared";
import "../../lib/i18n.js";
import * as dashboardApi from "./api/dashboard-api.js";
import FarmerDashboardPage from "./farmer-dashboard-page.js";

const mockPopulatedResponse: FarmerDashboardResponse = {
  data: {
    kpis: {
      totalSales: {
        value: 12500000, // ৳125,000.00
        previous: 10000000,
        changePercent: 25.0,
      },
      earnings: {
        value: 12250000, // ৳122,500.00
        previous: 9800000,
        changePercent: 25.0,
      },
      activeAuctions: {
        value: 4,
        previous: 0,
        changePercent: null,
      },
      pendingOrders: {
        value: 2,
        previous: 0,
        changePercent: null,
      },
      winRate: {
        value: 82.5,
        previous: null,
        changePercent: null,
      },
      orders: {
        value: 14,
        previous: 10,
        changePercent: 40.0,
      },
      pricePremium: {
        value: 11.8,
        previous: 8.5,
        changePercent: 38.8,
      },
      topCrop: {
        cropId: "crop-onion",
        cropSlug: "onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        quantityKg: 850,
        totalSales: 7500000,
        earnings: 7350000,
        orderCount: 8,
      },
      kgListed: 450,
      nearestDeadline: "2026-11-20T12:00:00.000Z",
    },
    rightNow: {
      activeAuctions: 4,
      ordersNeedingAction: 2,
      kgListed: 450,
      nearestDeadline: "2026-11-20T12:00:00.000Z",
    },
    salesTrend: [
      { bucket: "2026-11-10", date: "2026-11-10", sales: 2500000, quantityKg: 100, orderCount: 2 },
      { bucket: "2026-11-12", date: "2026-11-12", sales: 3000000, quantityKg: 150, orderCount: 3 },
    ],
    earningsByCrop: [
      {
        cropId: "crop-onion",
        cropSlug: "onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        quantityKg: 850,
        totalSales: 7500000,
        earnings: 7350000,
        orderCount: 8,
      },
    ],
    endingSoon: [
      {
        id: "auction-1",
        cropId: "crop-onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        photoUrl: "/uploads/onion.jpg",
        grade: "A",
        quantityKg: 200,
        floorPricePerKg: 6000,
        currentBidPerKg: 6800,
        bidCount: 4,
        endsAt: "2026-11-20T14:30:00.000Z",
        status: "ACTIVE",
      },
      {
        id: "auction-2",
        cropId: "crop-potato",
        cropName: "Potato",
        cropNameBn: "আলু",
        photoUrl: "/uploads/potato.jpg",
        grade: "B",
        quantityKg: 250,
        floorPricePerKg: 3800,
        currentBidPerKg: 3800,
        bidCount: 0,
        endsAt: "2026-11-20T16:00:00.000Z",
        status: "ACTIVE",
      },
    ],
  },
  meta: {
    serverTime: "2026-11-18T10:00:00.000Z",
    range: "30d",
    granularity: "day",
    timezone: "Asia/Dhaka",
  },
};

const mockEmptyResponse: FarmerDashboardResponse = {
  data: {
    kpis: {
      totalSales: { value: 0, previous: 0, changePercent: null },
      earnings: { value: 0, previous: 0, changePercent: null },
      activeAuctions: { value: 0, previous: 0, changePercent: null },
      pendingOrders: { value: 0, previous: 0, changePercent: null },
      winRate: { value: 0, previous: null, changePercent: null },
      orders: { value: 0, previous: 0, changePercent: null },
      pricePremium: { value: 0, previous: null, changePercent: null },
      topCrop: null,
      kgListed: 0,
      nearestDeadline: null,
    },
    rightNow: {
      activeAuctions: 0,
      ordersNeedingAction: 0,
      kgListed: 0,
      nearestDeadline: null,
    },
    salesTrend: [],
    earningsByCrop: [],
    endingSoon: [],
  },
  meta: {
    serverTime: "2026-11-18T10:00:00.000Z",
    range: "30d",
    granularity: "day",
    timezone: "Asia/Dhaka",
  },
};

function renderDashboardPage(initialPath = "/farmer/dashboard"): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/farmer/dashboard" element={<FarmerDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FarmerDashboardPage (Task 7.6)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with accessible skeletons while query is in flight", () => {
    vi.spyOn(dashboardApi, "fetchFarmerDashboard").mockReturnValue(new Promise(() => {}));

    renderDashboardPage();

    const loader = screen.getByRole("status", { name: /loading dashboard/i });
    expect(loader).toBeInTheDocument();
  });

  it("renders error state with retry button when query fails, and retries on click", async () => {
    const fetchSpy = vi
      .spyOn(dashboardApi, "fetchFarmerDashboard")
      .mockRejectedValueOnce(new Error("API_ERROR"))
      .mockResolvedValueOnce(mockPopulatedResponse);

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry|try again/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Farmer Dashboard")).toBeInTheDocument();
    });
  });

  it("renders friendly first-listing empty state for new farmer with zero data", async () => {
    vi.spyOn(dashboardApi, "fetchFarmerDashboard").mockResolvedValue(mockEmptyResponse);

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByTestId("farmer-dashboard-empty-state")).toBeInTheDocument();
    });

    expect(screen.getByText("Welcome to BazarBeat!")).toBeInTheDocument();
    expect(screen.getByText(/Zero risk: if your floor price is not met/i)).toBeInTheDocument();

    const firstListingBtn = screen.getByTestId("create-first-listing-btn");
    expect(firstListingBtn).toHaveAttribute("href", "/farmer/new-listing");
  });

  it("renders populated dashboard with all KPI StatCards, groups, premium card, and top crop", async () => {
    vi.spyOn(dashboardApi, "fetchFarmerDashboard").mockResolvedValue(mockPopulatedResponse);

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Farmer Dashboard")).toBeInTheDocument();
    });

    // 1. Header action
    expect(screen.getByTestId("new-listing-header-btn")).toHaveAttribute(
      "href",
      "/farmer/new-listing",
    );

    // 2. Performance group (Last 30 days)
    expect(screen.getByText(/Performance \(Last 30 days\)/i)).toBeInTheDocument();
    expect(screen.getByText("৳125000.00")).toBeInTheDocument(); // total sales
    expect(screen.getByText("৳122500.00")).toBeInTheDocument(); // net earnings
    expect(screen.getByText("14")).toBeInTheDocument(); // orders
    expect(screen.getByText("82.5%")).toBeInTheDocument(); // win rate
    expect(screen.getByText("+11.8%")).toBeInTheDocument(); // price premium

    const topCropCard = screen.getByTestId("stat-top-crop");
    expect(within(topCropCard).getByText("Onion")).toBeInTheDocument();

    // 3. Right now group
    expect(screen.getByText("Right Now")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // active auctions
    expect(screen.getByText("450 kg")).toBeInTheDocument(); // kg listed

    // 4. Orders needing action banner and link
    expect(screen.getByTestId("orders-needing-action-banner")).toBeInTheDocument();
    expect(screen.getByTestId("view-pending-orders-link")).toHaveAttribute(
      "href",
      "/farmer/orders?status=PENDING",
    );

    // 5. Ending soon auctions
    expect(screen.getByTestId("ending-soon-list")).toBeInTheDocument();
    expect(screen.getByTestId("ending-soon-card-auction-1")).toBeInTheDocument();
    expect(screen.getByTestId("ending-soon-card-auction-2")).toBeInTheDocument();
    expect(screen.getByText("৳68.00/kg")).toBeInTheDocument();
  });

  it("verifies change indicators use arrows and text (not color alone)", async () => {
    vi.spyOn(dashboardApi, "fetchFarmerDashboard").mockResolvedValue(mockPopulatedResponse);

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("৳125000.00")).toBeInTheDocument();
    });

    const positiveIndicators = screen.getAllByTestId("change-indicator-positive");
    expect(positiveIndicators.length).toBeGreaterThan(0);
    for (const indicator of positiveIndicators) {
      expect(indicator).toHaveTextContent("↑");
      expect(indicator).toHaveTextContent("%");
      expect(indicator).toHaveTextContent("vs previous period");
    }
  });

  it("syncs range tabs control with URL search params and refetches on change", async () => {
    const fetchSpy = vi
      .spyOn(dashboardApi, "fetchFarmerDashboard")
      .mockResolvedValue(mockPopulatedResponse);

    renderDashboardPage("/farmer/dashboard?range=30d");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({ range: "30d" });
      expect(screen.getByTestId("range-tab-30d")).toBeInTheDocument();
    });

    expect(screen.getByTestId("range-tab-30d")).toHaveAttribute("aria-selected", "true");

    // Click 7d range preset tab
    await userEvent.click(screen.getByTestId("range-tab-7d"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({ range: "7d" });
      expect(screen.getByTestId("range-tab-7d")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("range-tab-30d")).toHaveAttribute("aria-selected", "false");
    });

    // Click 90d range preset tab
    await userEvent.click(screen.getByTestId("range-tab-90d"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({ range: "90d" });
      expect(screen.getByTestId("range-tab-90d")).toHaveAttribute("aria-selected", "true");
    });
  });
});

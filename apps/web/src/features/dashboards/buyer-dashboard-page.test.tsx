import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type BuyerDashboardResponse,
  CropGrade,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";
import "../../lib/i18n.js";
import * as dashboardApi from "./api/dashboard-api.js";
import BuyerDashboardPage from "./buyer-dashboard-page.js";

const mockPopulatedResponse: BuyerDashboardResponse = {
  data: {
    kpis: {
      totalSpend: {
        value: 17200000, // ৳172,000.00
        previous: 14000000,
        changePercent: 22.86,
      },
      kgPurchased: {
        value: 2850,
        previous: 2200,
        changePercent: 29.55,
      },
      activeBids: {
        value: 3,
        previous: 0,
        changePercent: null,
      },
      winRate: {
        value: 75.0,
        previous: null,
        changePercent: null,
      },
      avgPriceVsMarket: {
        value: -6.4,
        previous: -4.2,
        changePercent: 52.38,
      },
      pendingOrders: {
        value: 1,
        previous: 0,
        changePercent: null,
      },
      orders: {
        value: 12,
        previous: 9,
        changePercent: 33.33,
      },
      nearestDeadline: "2026-11-20T12:00:00.000Z",
    },
    rightNow: {
      activeBids: 3,
      winningBids: 2,
      outbidBids: 1,
      ordersNeedingAction: 1,
      nearestDeadline: "2026-11-20T12:00:00.000Z",
    },
    spendTrend: [
      { bucket: "2026-11-10", date: "2026-11-10", spend: 3500000, quantityKg: 500, orderCount: 2 },
      { bucket: "2026-11-12", date: "2026-11-12", spend: 4200000, quantityKg: 650, orderCount: 3 },
    ],
    purchasesByCrop: [
      {
        cropId: "crop-onion",
        cropSlug: "onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        quantityKg: 1500,
        totalSpend: 9500000,
        orderCount: 6,
      },
    ],
    activeBidsList: [
      {
        listingId: "listing-101",
        cropId: "crop-onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        photoUrl: "/uploads/onion.jpg",
        grade: "A",
        myBidPerKg: 6500,
        currentBidPerKg: 6500,
        bidCount: 5,
        endsAt: "2026-11-20T14:30:00.000Z",
        status: "WINNING",
      },
      {
        listingId: "listing-102",
        cropId: "crop-potato",
        cropName: "Potato",
        cropNameBn: "আলু",
        photoUrl: "/uploads/potato.jpg",
        grade: "B",
        myBidPerKg: 3600,
        currentBidPerKg: 3900,
        bidCount: 3,
        endsAt: "2026-11-20T16:00:00.000Z",
        status: "OUTBID",
      },
    ],
    recentOrders: [
      {
        id: "order-201",
        listingId: "listing-99",
        cropId: "crop-onion",
        cropName: "Onion",
        cropNameBn: "পেঁয়াজ",
        grade: CropGrade.A,
        quantityKg: 500,
        pricePerKg: 6200,
        subtotal: 3100000,
        totalAmount: 3100000,
        status: OrderStatus.PENDING,
        payment: {
          status: PaymentStatus.UNPAID,
        },
        fulfilment: {
          method: FulfilmentMethod.PICKUP,
        },
        farmer: {
          id: "farmer-1",
          name: "Rahim Farmer",
          role: UserRole.FARMER,
          phone: "01711111111",
          isMasked: false,
        },
        createdAt: "2026-11-18T08:00:00.000Z",
        autoCancelDeadline: "2026-11-19T08:00:00.000Z",
      },
      {
        id: "order-202",
        listingId: "listing-98",
        cropId: "crop-potato",
        cropName: "Potato",
        cropNameBn: "আলু",
        grade: CropGrade.B,
        quantityKg: 800,
        pricePerKg: 3500,
        subtotal: 2800000,
        totalAmount: 2800000,
        status: OrderStatus.CONFIRMED,
        payment: {
          status: PaymentStatus.PAID,
          method: PaymentMethod.WALLET_SIM,
          paidAt: "2026-11-17T12:00:00.000Z",
        },
        fulfilment: {
          method: FulfilmentMethod.PICKUP,
        },
        farmer: {
          id: "farmer-2",
          name: "Karim Farmer",
          role: UserRole.FARMER,
          phone: "01722222222",
          isMasked: false,
        },
        createdAt: "2026-11-17T10:00:00.000Z",
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

const mockEmptyResponse: BuyerDashboardResponse = {
  data: {
    kpis: {
      totalSpend: { value: 0, previous: 0, changePercent: null },
      kgPurchased: { value: 0, previous: 0, changePercent: null },
      activeBids: { value: 0, previous: 0, changePercent: null },
      winRate: { value: 0, previous: null, changePercent: null },
      avgPriceVsMarket: { value: 0, previous: null, changePercent: null },
      pendingOrders: { value: 0, previous: 0, changePercent: null },
      orders: { value: 0, previous: 0, changePercent: null },
      nearestDeadline: null,
    },
    rightNow: {
      activeBids: 0,
      winningBids: 0,
      outbidBids: 0,
      ordersNeedingAction: 0,
      nearestDeadline: null,
    },
    spendTrend: [],
    purchasesByCrop: [],
    activeBidsList: [],
    nearestEndingBids: [],
    recentOrders: [],
  },
  meta: {
    serverTime: "2026-11-18T10:00:00.000Z",
    range: "30d",
    granularity: "day",
    timezone: "Asia/Dhaka",
  },
};

function renderBuyerDashboardPage(initialPath = "/buyer/dashboard"): ReturnType<typeof render> {
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
          <Route path="/buyer/dashboard" element={<BuyerDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BuyerDashboardPage (Task 7.7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with accessible skeletons while query is in flight", () => {
    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockReturnValue(new Promise(() => {}));

    renderBuyerDashboardPage();

    const loader = screen.getByRole("status", { name: /loading dashboard/i });
    expect(loader).toBeInTheDocument();
  });

  it("renders error state with retry button when query fails, and retries on click", async () => {
    const fetchSpy = vi
      .spyOn(dashboardApi, "fetchBuyerDashboard")
      .mockRejectedValueOnce(new Error("API_ERROR"))
      .mockResolvedValueOnce(mockPopulatedResponse);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry|try again/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Buyer Dashboard")).toBeInTheDocument();
    });
  });

  it("renders friendly empty state for new buyer with button linking to Marketplace", async () => {
    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockResolvedValue(mockEmptyResponse);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByTestId("buyer-dashboard-empty-state")).toBeInTheDocument();
    });

    expect(screen.getByText("Welcome to BazarBeat Marketplace!")).toBeInTheDocument();

    const exploreFirstBtn = screen.getByTestId("explore-first-marketplace-btn");
    expect(exploreFirstBtn).toHaveAttribute("href", "/buyer/marketplace");
  });

  it("renders populated dashboard with all KPI StatCards, right-now cards, active bids, and recent orders", async () => {
    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockResolvedValue(mockPopulatedResponse);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Buyer Dashboard")).toBeInTheDocument();
    });

    // 1. Header action
    expect(screen.getByTestId("explore-marketplace-header-btn")).toHaveAttribute(
      "href",
      "/buyer/marketplace",
    );

    // 2. Performance group (Last 30 days)
    expect(screen.getByText(/Performance \(Last 30 days\)/i)).toBeInTheDocument();
    expect(screen.getByText("৳172000.00")).toBeInTheDocument(); // Booked spend
    expect(screen.getByText("2,850 kg")).toBeInTheDocument(); // Kg purchased
    expect(screen.getByText("75.0%")).toBeInTheDocument(); // Win rate
    expect(screen.getByText("-6.4%")).toBeInTheDocument(); // Savings vs market

    // 3. Right now group
    expect(screen.getByText("Right Now")).toBeInTheDocument();
    const activeBidsCard = screen.getByTestId("stat-active-bids");
    expect(within(activeBidsCard).getByText("3")).toBeInTheDocument();
    expect(within(activeBidsCard).getByText("2 winning • 1 outbid")).toBeInTheDocument();
    expect(screen.getByTestId("active-bids-link")).toHaveAttribute("href", "/buyer/my-bids");

    // Orders needing action
    const ordersNeedingActionCard = screen.getByTestId("stat-orders-needing-action");
    expect(within(ordersNeedingActionCard).getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("pending-orders-link")).toHaveAttribute(
      "href",
      "/buyer/orders?status=PENDING",
    );

    // Banner for orders needing action
    expect(screen.getByTestId("orders-needing-action-banner")).toBeInTheDocument();
    expect(screen.getByTestId("view-pending-orders-link")).toHaveAttribute(
      "href",
      "/buyer/orders?status=PENDING",
    );

    // 4. Bids ending soon list
    expect(screen.getByTestId("active-bids-list")).toBeInTheDocument();
    expect(screen.getByTestId("active-bid-card-listing-101")).toBeInTheDocument();
    expect(screen.getByTestId("active-bid-card-listing-102")).toBeInTheDocument();
    expect(screen.getByTestId("bid-status-winning")).toHaveTextContent("Winning");
    expect(screen.getByTestId("bid-status-outbid")).toHaveTextContent("Outbid");
    expect(screen.getByTestId("view-listing-link-listing-101")).toHaveAttribute(
      "href",
      "/buyer/listings/listing-101",
    );

    // 5. Recent orders list
    expect(screen.getByTestId("recent-orders-list")).toBeInTheDocument();
    expect(screen.getByTestId("recent-order-card-order-201")).toBeInTheDocument();
    expect(screen.getByTestId("recent-order-card-order-202")).toBeInTheDocument();
    expect(screen.getByTestId("view-order-detail-link-order-201")).toHaveAttribute(
      "href",
      "/buyer/orders/order-201",
    );
    expect(screen.getByTestId("view-all-orders-link")).toHaveAttribute("href", "/buyer/orders");
    expect(screen.getByTestId("view-all-my-bids-link")).toHaveAttribute("href", "/buyer/my-bids");
  });

  it("verifies change indicators use arrows and text (not color alone)", async () => {
    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockResolvedValue(mockPopulatedResponse);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("৳172000.00")).toBeInTheDocument();
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
      .spyOn(dashboardApi, "fetchBuyerDashboard")
      .mockResolvedValue(mockPopulatedResponse);

    renderBuyerDashboardPage("/buyer/dashboard?range=30d");

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

  it("Task 7.9: renders spend trend and purchases by crop charts with endpoint data", async () => {
    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockResolvedValue(mockPopulatedResponse);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByTestId("buyer-spend-trend-chart")).toBeInTheDocument();
      expect(screen.getByTestId("buyer-crop-breakdown-chart")).toBeInTheDocument();
    });

    // Check spend trend accessible summary reflects total spend from endpoint data: 35k + 42k = 77k poisha (৳77000.00)
    const spendSummary = screen.getByTestId("buyer-spend-trend-chart-text-summary");
    expect(spendSummary).toHaveTextContent("৳77000.00");
    expect(spendSummary).toHaveTextContent("1,150 kg");
    expect(spendSummary).toHaveTextContent("5 orders");

    // Check purchases by crop accessible summary reflects endpoint data: Onion ৳95000.00 (1,500 kg, 6 orders)
    const cropSummary = screen.getByTestId("buyer-crop-breakdown-chart-text-summary");
    expect(cropSummary).toHaveTextContent("Onion: ৳95000.00 (1,500 kg, 6 Orders)");

    // Toggle to accessible table on the spend trend chart and verify numbers match endpoint
    await userEvent.click(screen.getByTestId("buyer-spend-trend-chart-tab-table"));
    const spendTable = screen.getByTestId("buyer-spend-trend-chart-table");
    expect(spendTable).toHaveTextContent("10 Nov");
    expect(spendTable).toHaveTextContent("৳35000.00");
    expect(spendTable).toHaveTextContent("500 kg");
    expect(spendTable).toHaveTextContent("12 Nov");
    expect(spendTable).toHaveTextContent("৳42000.00");
    expect(spendTable).toHaveTextContent("650 kg");
    expect(spendTable).toHaveTextContent("৳77000.00"); // Total
  });

  it("Task 7.9: renders empty chart states when spend trend and purchases by crop have no purchases", async () => {
    const responseWithActiveBidsNoSpend: BuyerDashboardResponse = {
      ...mockPopulatedResponse,
      data: {
        ...mockPopulatedResponse.data,
        kpis: {
          ...mockPopulatedResponse.data.kpis,
          totalSpend: { value: 0, previous: 0, changePercent: null },
        },
        spendTrend: [],
        purchasesByCrop: [],
      },
    };

    vi.spyOn(dashboardApi, "fetchBuyerDashboard").mockResolvedValue(responseWithActiveBidsNoSpend);

    renderBuyerDashboardPage();

    await waitFor(() => {
      expect(screen.getByTestId("buyer-spend-trend-chart")).toBeInTheDocument();
      expect(screen.getByTestId("buyer-crop-breakdown-chart")).toBeInTheDocument();
    });

    expect(screen.getByTestId("buyer-spend-trend-chart-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("buyer-crop-breakdown-chart-empty-state")).toBeInTheDocument();
  });
});

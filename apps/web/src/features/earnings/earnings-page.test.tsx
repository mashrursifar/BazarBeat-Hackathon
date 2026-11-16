import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import {
  type EarningsData,
  PaymentStatus,
  formatDisplayPrice,
  formatPoisha,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as earningsApi from "./api/earnings-api.js";
import EarningsPage from "./earnings-page.js";

const fixedEarningsDataset: EarningsData = {
  summary: {
    gross: 12500000, // ৳125,000.00
    fees: 250000, // ৳2,500.00 (2.0%)
    settledNet: 12250000, // ৳122,500.00
    expectedNet: 4500000, // ৳45,000.00
    activeNet: 4500000,
    totalExpectedNet: 16750000,
    feeRateBps: 200,
    feeRatePercent: 2.0,
    totalEarnings: 12250000,
    totalSubtotal: 12500000,
    totalPlatformFees: 250000,
    completedOrdersCount: 8,
    pendingPayout: 2500000,
    paidPayout: 9750000,
    averagePricePremiumPercent: 14.2,
    averagePremiumPercent: 14.2,
  },
  byCrop: [
    {
      cropId: "crop-onion",
      cropName: "Onion",
      cropNameBn: "পেঁয়াজ",
      totalKg: 1200,
      totalEarnings: 7056000, // ৳70,560.00
      averagePricePerKg: 6000, // ৳60.00/kg
      orderCount: 5,
      averagePricePremiumPercent: 16.5,
    },
    {
      cropId: "crop-potato",
      cropName: "Potato",
      cropNameBn: "আলু",
      totalKg: 1800,
      totalEarnings: 5194000, // ৳51,940.00
      averagePricePerKg: 2950, // ৳29.50/kg
      orderCount: 3,
      averagePricePremiumPercent: 11.8,
    },
  ],
  recentPayouts: [
    {
      orderId: "order-1",
      cropName: "Onion",
      amount: 1470000,
      status: PaymentStatus.PAID,
      method: "WALLET_SIM",
      date: "2026-11-14T10:00:00.000Z",
    },
  ],
  monthlySeries: [
    { month: "2026-06", year: 2026, monthIndex: 6, gross: 1000000, fees: 20000, net: 980000, orderCount: 1, totalKg: 150 },
    { month: "2026-07", year: 2026, monthIndex: 7, gross: 1500000, fees: 30000, net: 1470000, orderCount: 1, totalKg: 200 },
    { month: "2026-08", year: 2026, monthIndex: 8, gross: 2000000, fees: 40000, net: 1960000, orderCount: 2, totalKg: 300 },
    { month: "2026-09", year: 2026, monthIndex: 9, gross: 2500000, fees: 50000, net: 2450000, orderCount: 2, totalKg: 400 },
    { month: "2026-10", year: 2026, monthIndex: 10, gross: 2500000, fees: 50000, net: 2450000, orderCount: 1, totalKg: 350 },
    { month: "2026-11", year: 2026, monthIndex: 11, gross: 3000000, fees: 60000, net: 2940000, orderCount: 1, totalKg: 400 },
  ],
  feeRate: {
    bps: 200,
    percent: 2.0,
  },
};

function renderEarningsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/farmer/earnings"]}>
        <EarningsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Task 6.10 — Web: Earnings Page", () => {
  let fetchEarningsSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchEarningsSpy = vi.spyOn(earningsApi, "fetchEarnings").mockResolvedValue(fixedEarningsDataset);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page matching the exact endpoint figures with a fixed dataset", async () => {
    renderEarningsPage();

    await waitFor(() => {
      expect(screen.getByTestId("earnings-page")).toBeInTheDocument();
    });

    // 1. Highlighted "Average premium over AI market estimate" pitch card
    const pitchCard = screen.getByTestId("pitch-premium-card");
    expect(pitchCard).toBeInTheDocument();
    expect(screen.getByTestId("pitch-premium-value")).toHaveTextContent("+14.2%");
    expect(pitchCard).toHaveTextContent("Average Premium Over AI Market Estimate");

    // 2. KPI Cards verification
    // Settled Net: labeled "Settled (simulated)"
    const settledCard = screen.getByTestId("kpi-settled-net");
    expect(settledCard).toBeInTheDocument();
    expect(settledCard).toHaveTextContent("Settled (simulated)");
    expect(settledCard).toHaveTextContent(formatPoisha(fixedEarningsDataset.summary.settledNet!)); // ৳122500.00

    // Expected Net
    const expectedCard = screen.getByTestId("kpi-expected-net");
    expect(expectedCard).toBeInTheDocument();
    expect(expectedCard).toHaveTextContent("Expected Net");
    expect(expectedCard).toHaveTextContent(formatPoisha(fixedEarningsDataset.summary.expectedNet!)); // ৳45000.00

    // Gross Sales
    const grossCard = screen.getByTestId("kpi-gross-sales");
    expect(grossCard).toBeInTheDocument();
    expect(grossCard).toHaveTextContent("Gross Sales");
    expect(grossCard).toHaveTextContent(formatPoisha(fixedEarningsDataset.summary.gross!)); // ৳125000.00

    // Platform Fees
    const feesCard = screen.getByTestId("kpi-platform-fees");
    expect(feesCard).toBeInTheDocument();
    expect(feesCard).toHaveTextContent("Platform Fees");
    expect(feesCard).toHaveTextContent(formatPoisha(fixedEarningsDataset.summary.fees!)); // ৳2500.00

    // 3. Clear fee-rate note
    const feeRateNote = screen.getByTestId("fee-rate-note");
    expect(feeRateNote).toBeInTheDocument();
    expect(feeRateNote).toHaveTextContent("2.0%");
    expect(feeRateNote).toHaveTextContent("200 bps");

    // 4. 6-Month Chart
    const chartSection = screen.getByTestId("earnings-chart-section");
    expect(chartSection).toBeInTheDocument();
    expect(screen.getByTestId("earnings-six-month-chart")).toBeInTheDocument();
    for (const item of fixedEarningsDataset.monthlySeries!) {
      expect(screen.getByTestId(`earnings-bar-${item.month}`)).toBeInTheDocument();
    }

    // 5. Per-crop breakdown
    const cropSection = screen.getByTestId("earnings-by-crop-section");
    expect(cropSection).toBeInTheDocument();

    // Onion row
    const onionRow = screen.getByTestId("crop-row-crop-onion");
    expect(onionRow).toHaveTextContent("Onion");
    expect(onionRow).toHaveTextContent("1200 kg");
    expect(onionRow).toHaveTextContent(formatPoisha(7056000));
    expect(onionRow).toHaveTextContent(formatDisplayPrice(6000));
    expect(onionRow).toHaveTextContent("+16.5%");

    // Potato row
    const potatoRow = screen.getByTestId("crop-row-crop-potato");
    expect(potatoRow).toHaveTextContent("Potato");
    expect(potatoRow).toHaveTextContent("1800 kg");
    expect(potatoRow).toHaveTextContent(formatPoisha(5194000));
    expect(potatoRow).toHaveTextContent(formatDisplayPrice(2950));
    expect(potatoRow).toHaveTextContent("+11.8%");
  });

  it("renders empty state when farmer has zero earnings", async () => {
    fetchEarningsSpy.mockResolvedValueOnce({
      summary: {
        gross: 0,
        fees: 0,
        settledNet: 0,
        expectedNet: 0,
        totalEarnings: 0,
        totalSubtotal: 0,
        totalPlatformFees: 0,
        completedOrdersCount: 0,
        pendingPayout: 0,
        paidPayout: 0,
        averagePricePremiumPercent: 0,
        feeRateBps: 200,
        feeRatePercent: 2.0,
      },
      byCrop: [],
      recentPayouts: [],
      monthlySeries: [],
      feeRate: { bps: 200, percent: 2.0 },
    });

    renderEarningsPage();

    await waitFor(() => {
      expect(screen.getByTestId("earnings-empty-state")).toBeInTheDocument();
    });

    const emptyState = screen.getByTestId("earnings-empty-state");
    expect(within(emptyState).getByText("No earnings recorded yet")).toBeInTheDocument();
    expect(within(emptyState).getByRole("link", { name: /Create Listing/i })).toBeInTheDocument();
  });

  it("renders error state when fetch fails and retries on click", async () => {
    fetchEarningsSpy.mockRejectedValueOnce(new Error("API_ERROR"));

    renderEarningsPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();

    fetchEarningsSpy.mockResolvedValueOnce(fixedEarningsDataset);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByTestId("pitch-premium-card")).toBeInTheDocument();
    });
  });
});

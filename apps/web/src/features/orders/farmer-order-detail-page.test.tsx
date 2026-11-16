import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  type FarmerOrderDetail,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as ordersApi from "./api/orders-api.js";
import FarmerOrderDetailPage from "./farmer-order-detail-page.js";

const sampleDisputedFarmerDetail: FarmerOrderDetail = {
  id: "651234567890abcdef123461",
  listingId: "651234567890abcdef123462",
  cropId: "651234567890abcdef123463",
  cropName: "Potato",
  cropNameBn: "আলু",
  imageUrl: "https://example.com/potato.jpg",
  grade: CropGrade.A,
  quantityKg: 200,
  pricePerKg: 3000,
  subtotal: 600000,
  platformFee: 12000,
  farmerNet: 588000,
  status: OrderStatus.DISPUTED,
  payment: { status: PaymentStatus.PAID, method: "WALLET_SIM" },
  fulfilment: { method: "PICKUP" },
  availableActions: [],
  buyer: {
    id: "651234567890abcdef123464",
    name: "Kamal Hossain",
    role: UserRole.BUYER,
    phone: "01712345678",
    isMasked: false,
    location: {
      division: "Dhaka",
      district: "Gazipur",
    },
  },
  dispute: {
    reason: "QUANTITY_SHORT",
    note: "Bag had 180kg instead of 200kg",
    raisedAt: "2026-11-16T14:30:00.000Z",
  },
  timeline: [
    {
      status: OrderStatus.PENDING,
      at: "2026-11-16T10:00:00.000Z",
    },
    {
      status: OrderStatus.CONFIRMED,
      at: "2026-11-16T11:00:00.000Z",
    },
    {
      status: OrderStatus.DELIVERED,
      at: "2026-11-16T12:00:00.000Z",
    },
    {
      status: OrderStatus.DISPUTED,
      at: "2026-11-16T14:30:00.000Z",
      note: "QUANTITY_SHORT: Bag had 180kg instead of 200kg",
    },
  ],
  createdAt: "2026-11-16T10:00:00.000Z",
};

describe("Task 6.11 — FarmerOrderDetailPage Disputed State", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays prominent disputed banner with farmer hold notice and reason details", async () => {
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleDisputedFarmerDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/farmer/orders/${sampleDisputedFarmerDetail.id}`]}>
          <Routes>
            <Route path="/farmer/orders/:id" element={<FarmerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const banner = await screen.findByTestId("order-disputed-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Order In Dispute");
    expect(banner).toHaveTextContent(
      "The buyer has reported an issue with this order. Payout is on hold pending resolution.",
    );
    expect(banner).toHaveTextContent("Quantity is short");
    expect(banner).toHaveTextContent("Bag had 180kg instead of 200kg");

    // Status badge shows Disputed
    const statusBadges = screen.getAllByTestId("order-status-badge");
    expect(statusBadges[0]).toHaveAttribute("data-status", OrderStatus.DISPUTED);
    expect(statusBadges[0]).toHaveTextContent("Disputed");
  });
});

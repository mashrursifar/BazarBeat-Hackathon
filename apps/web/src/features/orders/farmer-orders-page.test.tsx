import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  type FarmerOrderCard,
  OrderStatus,
  PaymentStatus,
  StockReturnDecision,
  UserRole,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as ordersApi from "./api/orders-api.js";
import FarmerOrdersPage from "./farmer-orders-page.js";

const samplePendingOrder: FarmerOrderCard = {
  id: "651234567890abcdef123451",
  listingId: "651234567890abcdef123452",
  cropId: "651234567890abcdef123453",
  cropName: "Onion",
  cropNameBn: "পেঁয়াজ",
  imageUrl: "https://example.com/onion.jpg",
  grade: CropGrade.A,
  quantityKg: 100,
  pricePerKg: 5000,
  subtotal: 500000,
  platformFee: 10000,
  farmerNet: 490000,
  status: OrderStatus.PENDING,
  payment: { status: PaymentStatus.UNPAID },
  fulfilment: { method: "PICKUP", note: "Call 1h before arriving" },
  buyer: {
    id: "651234567890abcdef123454",
    name: "Buyer",
    role: UserRole.BUYER,
    isMasked: true,
    division: "Dhaka",
    district: "Dhaka",
  },
  autoCancelDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  createdAt: "2026-11-16T10:00:00.000Z",
};

const sampleConfirmedOrder: FarmerOrderCard = {
  ...samplePendingOrder,
  id: "651234567890abcdef123455",
  status: OrderStatus.CONFIRMED,
  autoCancelDeadline: undefined,
  deadline: undefined,
  buyer: {
    id: "651234567890abcdef123454",
    name: "Hasan Traders",
    role: UserRole.BUYER,
    isMasked: false,
    phone: "01712345678",
    organizationName: "Hasan Agro Ltd",
    location: {
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Savar",
    },
  },
};

const sampleDeliveredOrder: FarmerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123456",
  status: OrderStatus.DELIVERED,
};

const sampleCompletedOrder: FarmerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123457",
  status: OrderStatus.COMPLETED,
  payment: { status: PaymentStatus.PAID },
};

const sampleCancelledOrder: FarmerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123458",
  status: OrderStatus.CANCELLED,
  stockReturn: undefined,
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("Task 6.7 — Web: Order Building Blocks and Farmer Orders Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("renders 5 tabs with server counts and displays pending orders with visible actions", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
        statusCounts: {
          [OrderStatus.PENDING]: 2,
          [OrderStatus.CONFIRMED]: 3,
          [OrderStatus.DELIVERED]: 1,
          [OrderStatus.COMPLETED]: 5,
          [OrderStatus.CANCELLED]: 1,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Verify 5 tabs and their counts after data loads
    expect(await screen.findByText(/123451/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("badge-count-needs_action")).toHaveTextContent("2");
    });
    expect(screen.getByTestId("badge-count-in_progress")).toHaveTextContent("3");
    expect(screen.getByTestId("badge-count-delivered")).toHaveTextContent("1");
    expect(screen.getByTestId("badge-count-completed")).toHaveTextContent("5");
    expect(screen.getByTestId("badge-count-cancelled")).toHaveTextContent("1");

    // Pending order visible actions: Confirm & Cancel
    expect(screen.getByTestId("order-action-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("order-action-cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("order-action-deliver")).not.toBeInTheDocument();

    // Auto-cancel countdown displayed
    expect(screen.getByTestId("auto-cancel-countdown")).toBeInTheDocument();

    // Buyer contact is masked
    expect(screen.getByTestId("counterparty-masked")).toBeInTheDocument();
    expect(screen.queryByText("01712345678")).not.toBeInTheDocument();
  });

  it("renders visible actions for CONFIRMED order and revealed buyer card", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleConfirmedOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
        statusCounts: {
          [OrderStatus.CONFIRMED]: 1,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Confirmed order visible actions: Mark delivered & Cancel
    expect(await screen.findByTestId("order-action-deliver")).toBeInTheDocument();
    expect(screen.getByTestId("order-action-cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("order-action-confirm")).not.toBeInTheDocument();

    // Buyer card is revealed: contains phone, name, and Savar upazila
    const revealedCard = screen.getByTestId("counterparty-revealed");
    expect(revealedCard).toBeInTheDocument();
    expect(within(revealedCard).getByText("Hasan Traders")).toBeInTheDocument();
    expect(within(revealedCard).getByText("Hasan Agro Ltd")).toBeInTheDocument();
    expect(within(revealedCard).getByText("01712345678")).toBeInTheDocument();
    expect(within(revealedCard).getByText(/Savar/)).toBeInTheDocument();
  });

  it("renders DELIVERED and COMPLETED orders with zero actionable modify buttons", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleDeliveredOrder, sampleCompletedOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const orderCards = await screen.findAllByText(/Order: #/i);
    expect(orderCards).toHaveLength(2);
    expect(screen.queryByTestId("order-action-confirm")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-action-deliver")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-action-cancel")).not.toBeInTheDocument();
  });

  it("validates confirm dialog: prefilled note, 72h max boundary, and submittal", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    });

    const confirmSpy = vi.spyOn(ordersApi, "confirmOrder").mockResolvedValue({
      data: { ...sampleConfirmedOrder, timeline: [], availableActions: [] },
      meta: { serverTime: "2026-11-16T12:00:00.000Z" },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Click Confirm button on order
    const confirmBtn = await screen.findByTestId("order-action-confirm");
    await user.click(confirmBtn);

    // Dialog opens
    const dialog = screen.getByRole("dialog");
    const noteInput = within(dialog).getByLabelText(/Pickup Note/i);
    // Prefilled from listing's pickup note
    expect(noteInput).toHaveValue("Call 1h before arriving");

    const timeInput = within(dialog).getByLabelText(/Handover Date & Time/i);

    // Test validation: time > 72 hours in future (e.g. 5 days ahead)
    const farFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const pad = (n: number): string => String(n).padStart(2, "0");
    const farFutureStr = `${farFuture.getFullYear()}-${pad(farFuture.getMonth() + 1)}-${pad(farFuture.getDate())}T12:00`;

    await user.clear(timeInput);
    await user.type(timeInput, farFutureStr);

    const submitBtn = within(dialog).getByRole("button", { name: /Confirm Order/i });
    await user.click(submitBtn);

    // Should display validation error
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/within 72 hours/i);
    expect(confirmSpy).not.toHaveBeenCalled();

    // Now set valid time within 24 hours
    const validTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const validTimeStr = `${validTime.getFullYear()}-${pad(validTime.getMonth() + 1)}-${pad(validTime.getDate())}T14:00`;

    await user.clear(timeInput);
    await user.type(timeInput, validTimeStr);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        samplePendingOrder.id,
        expect.objectContaining({
          handoverAt: expect.any(String),
          note: "Call 1h before arriving",
        }),
      );
    });
  });

  it("handles CANCELLED order stock return prompt with Yes and No decisions", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleCancelledOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    });

    const stockReturnSpy = vi.spyOn(ordersApi, "decideStockReturn").mockResolvedValue({
      data: { ...sampleCancelledOrder, timeline: [], availableActions: [] },
      meta: { serverTime: "2026-11-16T12:00:00.000Z" },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Prompt is visible
    expect(await screen.findByTestId("stock-return-prompt")).toBeInTheDocument();
    expect(screen.getByText(/Add this stock back to your inventory\?/i)).toBeInTheDocument();

    const yesBtn = screen.getByTestId("stock-return-yes");
    const noBtn = screen.getByTestId("stock-return-no");

    expect(yesBtn).toBeInTheDocument();
    expect(noBtn).toBeInTheDocument();

    // Click Yes (add back)
    await user.click(yesBtn);

    expect(stockReturnSpy).toHaveBeenCalledWith(
      sampleCancelledOrder.id,
      { decision: StockReturnDecision.RETURNED },
    );
  });

  it("renders decided badge when stock return decision was already made", async () => {
    const decidedCancelledOrder: FarmerOrderCard = {
      ...sampleCancelledOrder,
      stockReturn: {
        decision: StockReturnDecision.RETURNED,
        decidedAt: "2026-11-16T11:00:00.000Z",
        note: "Returned 100 kg to warehouse",
      },
    };

    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [decidedCancelledOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FarmerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("stock-return-decided")).toBeInTheDocument();
    expect(screen.getByText(/Stock returned to your available inventory/i)).toBeInTheDocument();
    expect(screen.queryByTestId("stock-return-yes")).not.toBeInTheDocument();
  });
});

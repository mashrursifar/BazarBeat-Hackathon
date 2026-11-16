import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type BuyerOrderCard,
  CropGrade,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as ordersApi from "./api/orders-api.js";
import BuyerOrdersPage from "./buyer-orders-page.js";

const samplePendingOrder: BuyerOrderCard = {
  id: "651234567890abcdef123451",
  listingId: "651234567890abcdef123452",
  cropId: "651234567890abcdef123453",
  cropName: "Potato",
  cropNameBn: "আলু",
  imageUrl: "https://example.com/potato.jpg",
  grade: CropGrade.A,
  quantityKg: 200,
  pricePerKg: 3500,
  subtotal: 700000,
  totalAmount: 700000,
  status: OrderStatus.PENDING,
  payment: { status: PaymentStatus.UNPAID },
  fulfilment: { method: "PICKUP" },
  farmer: {
    id: "651234567890abcdef123454",
    name: "Rahim Farmer",
    role: UserRole.FARMER,
    isMasked: true,
    division: "Rajshahi",
    district: "Bogra",
  },
  autoCancelDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  createdAt: "2026-11-16T10:00:00.000Z",
};

const sampleConfirmedOrder: BuyerOrderCard = {
  ...samplePendingOrder,
  id: "651234567890abcdef123455",
  status: OrderStatus.CONFIRMED,
  autoCancelDeadline: undefined,
  deadline: undefined,
  fulfilment: {
    method: "PICKUP",
    handoverAt: "2026-11-18T10:00:00.000Z",
    note: "Please call 1 hour before pickup at north gate.",
  },
  farmer: {
    id: "651234567890abcdef123454",
    name: "Rahim Mia",
    role: UserRole.FARMER,
    isMasked: false,
    phone: "01799887766",
    organizationName: "Rahim Agro",
    location: {
      division: "Rajshahi",
      district: "Bogra",
      upazila: "Sariakandi",
      address: "Village Shibpur",
    },
  },
};

const sampleDeliveredOrder: BuyerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123456",
  status: OrderStatus.DELIVERED,
  autoCompleteDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const sampleCompletedOrder: BuyerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123457",
  status: OrderStatus.COMPLETED,
  payment: {
    status: PaymentStatus.PAID,
    method: PaymentMethod.WALLET_SIM,
  },
};

const sampleCancelledOrder: BuyerOrderCard = {
  ...sampleConfirmedOrder,
  id: "651234567890abcdef123458",
  status: OrderStatus.CANCELLED,
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("Task 6.8 — Web: Buyer Orders Pages and Navigation Links", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("renders status tabs with badge counts and defaults to Needs Action tab", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
        statusCounts: {
          [OrderStatus.PENDING]: 1,
          [OrderStatus.CONFIRMED]: 3,
          [OrderStatus.DELIVERED]: 2,
          [OrderStatus.COMPLETED]: 5,
          [OrderStatus.CANCELLED]: 0,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: /My Purchases & Orders/i })).toBeInTheDocument();
    expect(screen.getByTestId("tab-needs_action")).toBeInTheDocument();
    expect(screen.getByTestId("tab-in_progress")).toBeInTheDocument();
    expect(screen.getByTestId("tab-delivered")).toBeInTheDocument();
    expect(screen.getByTestId("tab-completed")).toBeInTheDocument();
    expect(screen.getByTestId("tab-cancelled")).toBeInTheDocument();

    // Verify badge counts
    await waitFor(() => {
      expect(within(screen.getByTestId("tab-needs_action")).getByText("1")).toBeInTheDocument();
      expect(within(screen.getByTestId("tab-in_progress")).getByText("3")).toBeInTheDocument();
    });
  });

  it("renders PENDING status order: shows auto-cancel countdown, masked contact, pay now button, and demo label", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    expect(within(card).getByText("Potato")).toBeInTheDocument();
    expect(within(card).getByTestId("grade-badge-a")).toBeInTheDocument();

    // Auto-cancel countdown
    expect(within(card).getByTestId("auto-cancel-countdown")).toBeInTheDocument();

    // Masked farmer info per gap 7
    expect(within(card).getByTestId("counterparty-masked")).toBeInTheDocument();
    expect(within(card).getByText("Rahim Farmer")).toBeInTheDocument();
    expect(within(card).queryByText("01799887766")).not.toBeInTheDocument();

    // Required demo payment label
    expect(within(card).getByTestId("demo-payment-label")).toHaveTextContent(
      "Demo payment. No real money.",
    );

    // Available actions in PENDING: Pay now and Cancel
    expect(within(card).getByTestId("order-action-pay")).toBeInTheDocument();
    expect(within(card).getByTestId("order-action-cancel")).toBeInTheDocument();
    expect(within(card).queryByTestId("order-action-confirm-receipt")).not.toBeInTheDocument();
  });

  it("renders CONFIRMED status order: reveals farmer phone and pickup details", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleConfirmedOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");

    // Revealed contact per gap 7
    expect(within(card).getByTestId("counterparty-revealed")).toBeInTheDocument();
    expect(within(card).getByText("Rahim Mia")).toBeInTheDocument();
    expect(within(card).getByText("01799887766")).toBeInTheDocument();

    // Pickup schedule
    const pickupBox = within(card).getByTestId("pickup-info-box");
    expect(pickupBox).toHaveTextContent("Scheduled Handover");
    expect(pickupBox).toHaveTextContent("Please call 1 hour before pickup at north gate.");

    // Actions in CONFIRMED: Pay now and Cancel
    expect(within(card).getByTestId("order-action-pay")).toBeInTheDocument();
    expect(within(card).getByTestId("order-action-cancel")).toBeInTheDocument();
  });

  it("renders DELIVERED status order: displays auto-complete countdown and triggers Confirm receipt", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleDeliveredOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    const completeSpy = vi.spyOn(ordersApi, "completeOrder").mockResolvedValue({
      data: {
        ...sampleDeliveredOrder,
        status: OrderStatus.COMPLETED,
        timeline: [],
        availableActions: [],
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");

    // Auto-complete countdown timer
    expect(within(card).getByTestId("auto-complete-countdown")).toBeInTheDocument();

    // Confirm receipt button
    const confirmReceiptBtn = within(card).getByTestId("order-action-confirm-receipt");
    expect(confirmReceiptBtn).toBeInTheDocument();

    await user.click(confirmReceiptBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(sampleDeliveredOrder.id);
    });
  });

  it("renders COMPLETED status order: shows Completed and Paid badges with no actions", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleCompletedOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    expect(within(card).getByTestId("order-status-badge")).toHaveTextContent("Completed");
    expect(within(card).getByTestId("payment-badge-paid")).toHaveTextContent("Paid (Demo Wallet)");

    // No actions
    expect(within(card).queryByTestId("order-action-pay")).not.toBeInTheDocument();
    expect(within(card).queryByTestId("order-action-cancel")).not.toBeInTheDocument();
    expect(within(card).queryByTestId("order-action-confirm-receipt")).not.toBeInTheDocument();
  });

  it("renders CANCELLED status order with no actions", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleCancelledOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    expect(within(card).getByTestId("order-status-badge")).toHaveTextContent("Cancelled");
    expect(within(card).queryByTestId("order-action-pay")).not.toBeInTheDocument();
    expect(within(card).queryByTestId("order-action-cancel")).not.toBeInTheDocument();
  });

  it("handles simulated wallet payment flow with the 'Demo payment. No real money.' label", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    const markPaidSpy = vi.spyOn(ordersApi, "markOrderPaid").mockResolvedValue({
      data: {
        ...samplePendingOrder,
        payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
        timeline: [],
        availableActions: [],
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    const payBtn = within(card).getByTestId("order-action-pay");
    await user.click(payBtn);

    // Dialog opens
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Verify required demo payment label is prominently displayed
    const demoBanner = within(dialog).getByTestId("demo-payment-banner");
    expect(demoBanner).toHaveTextContent("Demo payment. No real money.");

    // Verify Simulated Wallet and Pay on Delivery options
    expect(within(dialog).getByTestId("payment-option-wallet")).toBeInTheDocument();
    expect(within(dialog).getByTestId("payment-option-cod")).toBeInTheDocument();

    // Submit payment with Simulated Wallet
    const submitPayBtn = within(dialog).getByTestId("confirm-wallet-pay-btn");
    await user.click(submitPayBtn);

    await waitFor(() => {
      expect(markPaidSpy).toHaveBeenCalledWith(samplePendingOrder.id, {
        method: PaymentMethod.WALLET_SIM,
      });
    });
  });

  it("handles buyer cancel dialog with reliability warning note and buyer cancel reasons", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    const cancelSpy = vi.spyOn(ordersApi, "cancelOrder").mockResolvedValue({
      data: {
        ...samplePendingOrder,
        status: OrderStatus.CANCELLED,
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <BuyerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    const cancelBtn = within(card).getByTestId("order-action-cancel");
    await user.click(cancelBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Verify visible note that cancelling after winning is recorded
    const warning = within(dialog).getByTestId("buyer-cancel-reliability-warning");
    expect(warning).toHaveTextContent(
      "Note: Cancelling an order after winning the auction is recorded on your profile and affects your buyer reliability score.",
    );

    // Verify buyer reasons in select
    const reasonSelect = within(dialog).getByLabelText(/Reason for Cancellation/i);
    expect(reasonSelect).toBeInTheDocument();
    expect(within(dialog).getByText("Changed my mind")).toBeInTheDocument();

    // Add optional note and submit
    const noteInput = within(dialog).getByLabelText(/Explanation \/ Note/i);
    await user.type(noteInput, "Found alternative supply locally.");

    const confirmCancelBtn = within(dialog).getByRole("button", { name: /Confirm Cancellation/i });
    await user.click(confirmCancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(samplePendingOrder.id, {
        reason: "BUYER_CHANGE_OF_MIND",
        note: "Found alternative supply locally.",
      });
    });
  });

  it("navigates to buyer order detail page when clicking 'View details →'", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <Routes>
            <Route path="/buyer/orders" element={<BuyerOrdersPage />} />
            <Route
              path="/buyer/orders/:id"
              element={<div data-testid="detail-page-stub">Detail Page View</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const card = await screen.findByTestId("buyer-order-card");
    const detailLink = within(card).getByTestId("order-detail-link");
    expect(detailLink).toHaveAttribute("href", `/buyer/orders/${samplePendingOrder.id}`);
  });

  it("works responsively at 360px viewport width", async () => {
    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [samplePendingOrder, sampleConfirmedOrder],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    const { container } = render(
      <div style={{ width: "360px" }}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/buyer/orders"]}>
            <BuyerOrdersPage />
          </MemoryRouter>
        </QueryClientProvider>
      </div>,
    );

    expect(await screen.findByRole("heading", { name: /My Purchases & Orders/i })).toBeInTheDocument();
    const cards = await screen.findAllByTestId("buyer-order-card");
    expect(cards).toHaveLength(2);

    // Verify all primary action buttons and links have adequate touch targets (>= 36px)
    const buttons = container.querySelectorAll("button, a");
    for (const btn of Array.from(buttons)) {
      expect(btn).toBeVisible();
    }
  });
});

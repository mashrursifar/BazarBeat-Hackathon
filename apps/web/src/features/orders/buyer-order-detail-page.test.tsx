import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type BuyerOrderDetail,
  CropGrade,
  OrderAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as ordersApi from "./api/orders-api.js";
import BuyerOrderDetailPage from "./buyer-order-detail-page.js";

const samplePendingDetail: BuyerOrderDetail = {
  id: "651234567890abcdef123451",
  listingId: "651234567890abcdef123452",
  cropId: "651234567890abcdef123453",
  cropName: "Tomato",
  cropNameBn: "টমেটো",
  imageUrl: "https://example.com/tomato.jpg",
  grade: CropGrade.A,
  quantityKg: 150,
  pricePerKg: 4000,
  subtotal: 600000,
  totalAmount: 600000,
  status: OrderStatus.PENDING,
  payment: { status: PaymentStatus.UNPAID },
  fulfilment: { method: "PICKUP" },
  farmer: {
    id: "651234567890abcdef123454",
    name: "Alim Uddin",
    role: UserRole.FARMER,
    isMasked: true,
    division: "Rangpur",
    district: "Dinajpur",
  },
  autoCancelDeadline: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
  deadline: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
  timeline: [
    {
      status: OrderStatus.PENDING,
      at: "2026-11-16T12:00:00.000Z",
      note: "Auction closed with winning bid.",
    },
  ],
  availableActions: [OrderAction.MARK_PAID, OrderAction.CANCEL],
  createdAt: "2026-11-16T12:00:00.000Z",
};

const sampleConfirmedDetail: BuyerOrderDetail = {
  ...samplePendingDetail,
  id: "651234567890abcdef123455",
  status: OrderStatus.CONFIRMED,
  autoCancelDeadline: undefined,
  deadline: undefined,
  fulfilment: {
    method: "PICKUP",
    handoverAt: "2026-11-18T14:30:00.000Z",
    note: "Bring sturdy crates. Loading assistance available.",
  },
  farmer: {
    id: "651234567890abcdef123454",
    name: "Alim Uddin",
    role: UserRole.FARMER,
    isMasked: false,
    phone: "01811223344",
    organizationName: "Alim Agro Farm",
    location: {
      division: "Rangpur",
      district: "Dinajpur",
      upazila: "Birganj",
      address: "Krishi Khamar Road",
    },
  },
  timeline: [
    {
      status: OrderStatus.PENDING,
      at: "2026-11-16T12:00:00.000Z",
      note: "Auction closed with winning bid.",
    },
    {
      status: OrderStatus.CONFIRMED,
      at: "2026-11-16T13:00:00.000Z",
      note: "Farmer confirmed order and scheduled handover.",
    },
  ],
  availableActions: [OrderAction.MARK_PAID, OrderAction.CANCEL],
};

const sampleDeliveredDetail: BuyerOrderDetail = {
  ...sampleConfirmedDetail,
  id: "651234567890abcdef123456",
  status: OrderStatus.DELIVERED,
  autoCompleteDeadline: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
  deadline: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
  timeline: [
    ...sampleConfirmedDetail.timeline,
    {
      status: OrderStatus.DELIVERED,
      at: "2026-11-17T09:00:00.000Z",
      note: "Produce handed over at farm gate.",
    },
  ],
  availableActions: [OrderAction.COMPLETE, OrderAction.MARK_PAID],
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("BuyerOrderDetailPage Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("renders PENDING order detail with masked counterparty, auto-cancel timer, and demo payment label", async () => {
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: samplePendingDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/orders/${samplePendingDetail.id}`]}>
          <Routes>
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Tomato" })).toBeInTheDocument();
    expect(screen.getByTestId("grade-badge-a")).toBeInTheDocument();
    expect(screen.getAllByTestId("order-status-badge")[0]).toHaveTextContent("Needs action");

    // Auto-cancel countdown
    expect(screen.getByTestId("auto-cancel-countdown")).toBeInTheDocument();

    // Masked farmer info per gap 7
    expect(screen.getByTestId("counterparty-masked")).toBeInTheDocument();
    expect(screen.getByText("Alim Uddin")).toBeInTheDocument();
    expect(screen.queryByText("01811223344")).not.toBeInTheDocument();

    // Pending pickup message
    expect(screen.getByTestId("pickup-info-pending")).toHaveTextContent(
      "The farmer will schedule the handover time",
    );

    // Required demo payment label
    expect(screen.getByTestId("demo-payment-note")).toHaveTextContent(
      "Demo payment. No real money.",
    );

    // Actions in PENDING: Pay now and Cancel
    expect(screen.getByTestId("detail-action-pay")).toBeInTheDocument();
    expect(screen.getByTestId("detail-action-cancel")).toBeInTheDocument();

    // Back link
    expect(screen.getByTestId("back-to-orders-link")).toHaveAttribute("href", "/buyer/orders");
  });

  it("renders CONFIRMED order detail with revealed farmer details, phone, and pickup instructions", async () => {
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleConfirmedDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/orders/${sampleConfirmedDetail.id}`]}>
          <Routes>
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Tomato" })).toBeInTheDocument();

    // Revealed farmer info per gap 7
    expect(screen.getByTestId("counterparty-revealed")).toBeInTheDocument();
    expect(screen.getByText("01811223344")).toBeInTheDocument();
    expect(screen.getByText("Alim Agro Farm")).toBeInTheDocument();

    // Revealed pickup schedule & notes
    const pickupSection = screen.getByTestId("pickup-info-revealed");
    expect(pickupSection).toHaveTextContent("Bring sturdy crates. Loading assistance available.");

    // Timeline entries
    expect(screen.getByText("Farmer confirmed order and scheduled handover.")).toBeInTheDocument();
  });

  it("renders DELIVERED order detail: auto-complete timer and confirm receipt action", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleDeliveredDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    const completeSpy = vi.spyOn(ordersApi, "completeOrder").mockResolvedValue({
      data: {
        ...sampleDeliveredDetail,
        status: OrderStatus.COMPLETED,
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/orders/${sampleDeliveredDetail.id}`]}>
          <Routes>
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Tomato" })).toBeInTheDocument();

    // Auto-complete countdown
    expect(screen.getByTestId("auto-complete-countdown")).toBeInTheDocument();

    // Confirm receipt button
    const confirmBtn = screen.getByTestId("detail-action-confirm-receipt");
    expect(confirmBtn).toBeInTheDocument();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(sampleDeliveredDetail.id);
    });
  });

  it("handles pay now dialog from detail page with 'Demo payment. No real money.' label", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: samplePendingDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    const paySpy = vi.spyOn(ordersApi, "markOrderPaid").mockResolvedValue({
      data: {
        ...samplePendingDetail,
        payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/orders/${samplePendingDetail.id}`]}>
          <Routes>
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const payBtn = await screen.findByTestId("detail-action-pay");
    await user.click(payBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByTestId("demo-payment-banner")).toHaveTextContent(
      "Demo payment. No real money.",
    );

    const submitBtn = within(dialog).getByTestId("confirm-wallet-pay-btn");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(paySpy).toHaveBeenCalledWith(samplePendingDetail.id, {
        method: PaymentMethod.WALLET_SIM,
      });
    });
  });

  it("handles cancel action from detail page with visible buyer reliability note", async () => {
    const user = userEvent.setup();
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: samplePendingDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    const cancelSpy = vi.spyOn(ordersApi, "cancelOrder").mockResolvedValue({
      data: {
        ...samplePendingDetail,
        status: OrderStatus.CANCELLED,
      },
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/orders/${samplePendingDetail.id}`]}>
          <Routes>
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const cancelBtn = await screen.findByTestId("detail-action-cancel");
    await user.click(cancelBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Verify visible note that cancelling after winning is recorded
    expect(within(dialog).getByTestId("buyer-cancel-reliability-warning")).toHaveTextContent(
      "Note: Cancelling an order after winning the auction is recorded on your profile and affects your buyer reliability score.",
    );

    const confirmCancelBtn = within(dialog).getByRole("button", { name: /Confirm Cancellation/i });
    await user.click(confirmCancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(samplePendingDetail.id, {
        reason: "BUYER_CHANGE_OF_MIND",
      });
    });
  });

  it("works responsively at 360px viewport width", async () => {
    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleConfirmedDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    const { container } = render(
      <div style={{ width: "360px" }}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/buyer/orders/${sampleConfirmedDetail.id}`]}>
            <Routes>
              <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </div>,
    );

    expect(await screen.findByRole("heading", { name: "Tomato" })).toBeInTheDocument();
    expect(screen.getByTestId("counterparty-revealed")).toBeInTheDocument();
    expect(screen.getByTestId("money-breakdown")).toBeInTheDocument();

    const buttons = container.querySelectorAll("button, a");
    for (const btn of Array.from(buttons)) {
      expect(btn).toBeVisible();
    }
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  CropGrade,
  type CropResponse,
  type FarmerListing,
  type FarmerOrderCard,
  ListingStatus,
  type MyBidsRow,
  OrderAction,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import * as bidsApi from "../bids/api/bids-api.js";
import * as listingsApi from "../listings/api/listing-api.js";
import * as ordersApi from "./api/orders-api.js";
import BuyerOrderDetailPage from "./buyer-order-detail-page.js";
import BuyerOrdersPage from "./buyer-orders-page.js";
import FarmerOrdersPage from "./farmer-orders-page.js";
import MyBidsPage from "../bids/my-bids-page.js";
import CropBiddingPage from "../listings/crop-bidding-page.js";

// Mock auth context for CropBiddingPage
vi.mock("../auth/auth-context.js", () => ({
  useAuth: (): {
    user: {
      id: string;
      role: UserRole;
      name: string;
      phone: string;
      division: string;
      district: string;
    };
    isAuthenticated: boolean;
  } => ({
    user: {
      id: "651234567890abcdef123454",
      role: UserRole.FARMER,
      name: "Tariqul Islam",
      phone: "01755443322",
      division: "Dhaka",
      district: "Dhaka",
    },
    isAuthenticated: true,
  }),
}));

const sampleWonBidRow: MyBidsRow = {
  listingId: "651234567890abcdef123499",
  cropId: "651234567890abcdef123453",
  cropNameEn: "Wheat",
  cropNameBn: "গম",
  grade: CropGrade.A,
  quantityKg: 100,
  myBidPerKg: 3200,
  myTotalAmount: 320000,
  currentBidPerKg: 3200,
  currentTotalAmount: 320000,
  bidCount: 4,
  status: "WON",
  listingStatus: ListingStatus.SOLD,
  endsAt: "2026-11-16T12:00:00.000Z",
  bidId: "651234567890abcdef123498",
  orderId: "651234567890abcdef123451",
  placedAt: "2026-11-16T11:58:00.000Z",
  gapToCurrentPerKg: 0,
  gap: 0,
};

const sampleSoldFarmerListing: FarmerListing = {
  id: "651234567890abcdef123499",
  cropId: "651234567890abcdef123453",
  quantityKg: 100,
  floorPricePerKg: 2800,
  currentBidPerKg: 3200,
  minIncrementPerKg: 50,
  startsAt: "2026-11-16T08:00:00.000Z",
  endsAt: "2026-11-16T12:00:00.000Z",
  originalEndsAt: "2026-11-16T12:00:00.000Z",
  status: ListingStatus.SOLD,
  bidCount: 4,
  extensionCount: 0,
  images: [{ url: "https://example.com/wheat.jpg", width: 400, height: 400 }],
  location: { division: "Dhaka", district: "Dhaka" },
  aiAssessment: {
    grade: CropGrade.A,
    confidence: 0.95,
    qualityNotes: [],
    cropMatch: true,
    modelVersion: "1.0",
    provider: "mock",
    assessedAt: "2026-11-16T08:00:00.000Z",
    degraded: false,
    classProbabilities: { A: 0.95, B: 0.05, C: 0 },
  },
  aiPriceGuidance: {
    lowPerKg: 2600,
    expectedPerKg: 3000,
    highPerKg: 3400,
    suggestedFloorPerKg: 2800,
    trend: "UP",
    confidence: 0.9,
    explanation: [],
    modelVersion: "1.0",
    provider: "mock",
    generatedAt: "2026-11-16T08:00:00.000Z",
    degraded: false,
  },
  createdAt: "2026-11-16T08:00:00.000Z",
};

const sampleCropResponse: CropResponse = {
  id: "651234567890abcdef123453",
  slug: "wheat",
  nameEn: "Wheat",
  nameBn: "গম",
  unit: "KG",
  minLotKg: 10,
  maxLotKg: 1000,
  shelfLifeHours: 2160,
  gradeGuide: { A: "Top quality", B: "Standard quality", C: "Fair quality" },
  minIncrementPerKg: 50,
  imageUrl: "https://example.com/wheat.jpg",
};

const sampleBuyerDetail: BuyerOrderDetail = {
  id: "651234567890abcdef123451",
  listingId: "651234567890abcdef123499",
  cropId: "651234567890abcdef123453",
  cropName: "Wheat",
  cropNameBn: "গম",
  imageUrl: "https://example.com/wheat.jpg",
  grade: CropGrade.A,
  quantityKg: 100,
  pricePerKg: 3200,
  subtotal: 320000,
  totalAmount: 320000,
  status: OrderStatus.CONFIRMED,
  payment: { status: PaymentStatus.UNPAID },
  fulfilment: {
    method: "PICKUP",
    handoverAt: "2026-11-18T10:00:00.000Z",
    note: "Pickup at warehouse gate.",
  },
  farmer: {
    id: "651234567890abcdef123454",
    name: "Tariqul Islam",
    role: UserRole.FARMER,
    isMasked: false,
    phone: "01755443322",
    location: { division: "Dhaka", district: "Dhaka" },
  },
  timeline: [
    {
      status: OrderStatus.PENDING,
      at: "2026-11-16T12:00:00.000Z",
    },
    {
      status: OrderStatus.CONFIRMED,
      at: "2026-11-16T12:30:00.000Z",
    },
  ],
  availableActions: [OrderAction.MARK_PAID, OrderAction.CANCEL],
  createdAt: "2026-11-16T12:00:00.000Z",
};

const sampleFarmerOrder: FarmerOrderCard = {
  id: "651234567890abcdef123451",
  listingId: "651234567890abcdef123499",
  cropId: "651234567890abcdef123453",
  cropName: "Wheat",
  cropNameBn: "গম",
  grade: CropGrade.A,
  quantityKg: 100,
  pricePerKg: 3200,
  subtotal: 320000,
  platformFee: 6400,
  farmerNet: 313600,
  status: OrderStatus.CONFIRMED,
  payment: { status: PaymentStatus.UNPAID },
  fulfilment: { method: "PICKUP" },
  buyer: {
    id: "651234567890abcdef123488",
    name: "Akash Traders",
    role: UserRole.BUYER,
    isMasked: false,
    phone: "01822334455",
  },
  createdAt: "2026-11-16T12:00:00.000Z",
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("Order Navigation Links: My Bids Won Tab, Crop Bidding Ended Tab, and Orders Pages", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("links My Bids (won tab) directly to the real BuyerOrderDetailPage", async () => {
    const user = userEvent.setup();

    vi.spyOn(bidsApi, "getMyBidsGrouped").mockResolvedValue({
      data: {
        active: [],
        won: [sampleWonBidRow],
        lost: [],
      },
      meta: {
        serverTime: new Date().toISOString(),
        total: 1,
      },
    });

    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleBuyerDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/my-bids"]}>
          <Routes>
            <Route path="/buyer/my-bids" element={<MyBidsPage />} />
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Switch to Won tab
    const wonTab = await screen.findByTestId("tab-won");
    await user.click(wonTab);

    // Find View order link
    const viewOrderLink = await screen.findByTestId("view-order-link");
    expect(viewOrderLink).toHaveAttribute("href", `/buyer/orders/${sampleWonBidRow.orderId}`);

    // Click View order link and verify navigation to BuyerOrderDetailPage
    await user.click(viewOrderLink);

    expect(await screen.findByRole("heading", { name: "Wheat" })).toBeInTheDocument();
    expect(screen.getByTestId("grade-badge-a")).toBeInTheDocument();
    expect(screen.getByTestId("counterparty-revealed")).toBeInTheDocument();
    expect(screen.getByText("Tariqul Islam")).toBeInTheDocument();
  });

  it("links farmer's Crop Bidding Ended tab directly to the real FarmerOrdersPage", async () => {
    const user = userEvent.setup();

    vi.spyOn(listingsApi, "getCrops").mockResolvedValue([sampleCropResponse]);

    vi.spyOn(listingsApi, "getMyListings").mockResolvedValue({
      data: [sampleSoldFarmerListing],
      meta: {
        serverTime: new Date().toISOString(),
        page: 1,
        limit: 50,
        total: 1,
      },
    });

    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [sampleFarmerOrder],
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
        <MemoryRouter initialEntries={["/farmer/crop-bidding"]}>
          <Routes>
            <Route path="/farmer/crop-bidding" element={<CropBiddingPage />} />
            <Route path="/farmer/orders" element={<FarmerOrdersPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Switch to Ended Auctions tab
    const endedTab = await screen.findByTestId("bidding-tab-ended");
    await user.click(endedTab);

    // Find View Order link
    const viewOrderLink = await screen.findByTestId(`view-order-link-${sampleSoldFarmerListing.id}`);
    expect(viewOrderLink).toHaveAttribute("href", "/farmer/orders");

    // Click link and verify navigation to FarmerOrdersPage
    await user.click(viewOrderLink);

    expect(await screen.findByRole("heading", { name: /^Orders$/i })).toBeInTheDocument();
    expect(screen.getByTestId("tab-needs_action")).toBeInTheDocument();
  });

  it("navigates back and forth between BuyerOrdersPage and BuyerOrderDetailPage", async () => {
    const user = userEvent.setup();

    const buyerOrderCard: BuyerOrderCard = {
      id: sampleBuyerDetail.id,
      listingId: sampleBuyerDetail.listingId,
      cropId: sampleBuyerDetail.cropId,
      cropName: sampleBuyerDetail.cropName,
      cropNameBn: sampleBuyerDetail.cropNameBn,
      imageUrl: sampleBuyerDetail.imageUrl,
      grade: sampleBuyerDetail.grade,
      quantityKg: sampleBuyerDetail.quantityKg,
      pricePerKg: sampleBuyerDetail.pricePerKg,
      subtotal: sampleBuyerDetail.subtotal,
      totalAmount: sampleBuyerDetail.totalAmount,
      status: sampleBuyerDetail.status,
      payment: sampleBuyerDetail.payment,
      fulfilment: sampleBuyerDetail.fulfilment,
      farmer: sampleBuyerDetail.farmer,
      createdAt: sampleBuyerDetail.createdAt,
    };

    vi.spyOn(ordersApi, "fetchOrders").mockResolvedValue({
      data: [buyerOrderCard],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: new Date().toISOString(),
      },
    });

    vi.spyOn(ordersApi, "fetchOrderDetail").mockResolvedValue({
      data: sampleBuyerDetail,
      meta: { serverTime: new Date().toISOString() },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buyer/orders"]}>
          <Routes>
            <Route path="/buyer/orders" element={<BuyerOrdersPage />} />
            <Route path="/buyer/orders/:id" element={<BuyerOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // On BuyerOrdersPage, click View details
    const viewDetailsLink = await screen.findByTestId("order-detail-link");
    await user.click(viewDetailsLink);

    // Now on BuyerOrderDetailPage
    expect(await screen.findByRole("heading", { name: "Wheat" })).toBeInTheDocument();
    const backLink = screen.getByTestId("back-to-orders-link");
    expect(backLink).toBeInTheDocument();

    // Click Back to Orders
    await user.click(backLink);

    // Back on BuyerOrdersPage
    expect(await screen.findByRole("heading", { name: /My Purchases & Orders/i })).toBeInTheDocument();
  });
});

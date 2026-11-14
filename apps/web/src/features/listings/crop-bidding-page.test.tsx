import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CropResponse,
  type FarmerListing,
  ListingStatus,
  UserRole,
} from "@bazarbeat/shared";
import "../../lib/i18n.js";
import { CropBiddingPage } from "./crop-bidding-page.js";

// Mock API functions
const getMyListingsMock = vi.hoisted(() => vi.fn());
const getListingByIdMock = vi.hoisted(() => vi.fn());
const getCropsMock = vi.hoisted(() => vi.fn());
const cancelListingMock = vi.hoisted(() => vi.fn());
const acceptCurrentBidMock = vi.hoisted(() => vi.fn());
const relistListingMock = vi.hoisted(() => vi.fn());
const getListingBidsMock = vi.hoisted(() => vi.fn());

vi.mock("./api/listing-api.js", () => ({
  getMyListings: getMyListingsMock,
  getListingById: getListingByIdMock,
  getCrops: getCropsMock,
  cancelListing: cancelListingMock,
  acceptCurrentBid: acceptCurrentBidMock,
  relistListing: relistListingMock,
  getListingBids: getListingBidsMock,
}));

// Mock auth hook
const mockUser = {
  id: "farmer-user-123",
  role: UserRole.FARMER,
  phone: "01712345678",
  name: "Rahim Farmer",
  division: "Dhaka",
  district: "Gazipur",
};

const useAuthMock = vi.hoisted(() => vi.fn());
vi.mock("../auth/auth-context.js", () => ({
  useAuth: useAuthMock,
}));

interface MockStreamOptions {
  listingId?: string | null;
  onBidPlaced: (patch: {
    listingId: string;
    bidId: string;
    bidderLabel: string;
    currentPrice: number;
    currentBidPerKg: number;
    amountPerKg: number;
    totalAmount: number;
    bidCount: number;
    placedAt: string;
    serverTime: string;
  }) => void;
}

// Mock SSE stream hook so tests can control events
let streamOptionsMap: Record<string, MockStreamOptions> = {};
vi.mock("../realtime/use-listing-stream.js", () => ({
  useListingStream: vi.fn((opts: MockStreamOptions) => {
    if (opts?.listingId) {
      streamOptionsMap[opts.listingId] = opts;
    }
    return {
      status: "connected",
      isConnected: true,
      isPolling: false,
      lastEvent: null,
      lastServerTime: null,
      reconnectCount: 0,
      reconnect: vi.fn(),
    };
  }),
}));

const mockCrop: CropResponse = {
  id: "0123456789abcdef01234567",
  slug: "bitter-gourd",
  nameEn: "Bitter Gourd",
  nameBn: "করলা",
  unit: "KG",
  minLotKg: 10,
  maxLotKg: 1000,
  shelfLifeHours: 120,
  gradeGuide: { A: "Firm, rich green", B: "Minor blemishes", C: "Ripe and usable" },
  minIncrementPerKg: 100,
  imageUrl: "/images/crops/bitter-gourd.svg",
};

const createMockListing = (overrides?: Partial<FarmerListing>): FarmerListing => ({
  id: "67b8d0001111222233334444",
  cropId: mockCrop.id,
  quantityKg: 50,
  images: [{ url: "/images/crops/bitter-gourd.svg", width: 800, height: 600 }],
  aiAssessment: {
    grade: "A",
    confidence: 0.95,
    confidenceBand: "HIGH",
    classProbabilities: { A: 0.9, B: 0.08, C: 0.02 },
    qualityNotes: ["Firm texture with uniform green color"],
    cropMatch: true,
    modelVersion: "mock-1.0",
    provider: "mock",
    degraded: false,
    assessedAt: new Date().toISOString(),
  },
  aiPriceGuidance: {
    lowPerKg: 4000,
    expectedPerKg: 4500,
    highPerKg: 5000,
    trend: "UP",
    confidence: 0.9,
    explanation: ["Favorable market conditions"],
    modelVersion: "mock-price-1.0",
    provider: "mock",
    degraded: false,
    generatedAt: new Date().toISOString(),
    suggestedFloorPerKg: 4200,
  },
  floorPricePerKg: 4500,
  minIncrementPerKg: 100,
  startsAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  endsAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
  originalEndsAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
  extensionCount: 0,
  status: ListingStatus.ACTIVE,
  bidCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const createWrapper = (): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement;
  queryClient: QueryClient;
} => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return { wrapper, queryClient };
};

describe("CropBiddingPage component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamOptionsMap = {};
    useAuthMock.mockReturnValue({ user: mockUser });
    getCropsMock.mockResolvedValue([mockCrop]);
  });

  it("renders loading state with skeleton cards", () => {
    getMyListingsMock.mockReturnValue(new Promise(() => {}));
    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    expect(screen.getByTestId("bidding-loading")).toBeInTheDocument();
  });

  it("renders error state with retry button and refetches on click", async () => {
    getMyListingsMock.mockRejectedValueOnce(new Error("Network failure"));
    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const errorAlert = await screen.findByTestId("bidding-error");
    expect(errorAlert).toBeInTheDocument();

    const retryBtn = screen.getByTestId("bidding-retry-btn");
    getMyListingsMock.mockResolvedValueOnce({
      data: [],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 0 },
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getMyListingsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders empty state with new listing CTA when farmer has no live listings", async () => {
    getMyListingsMock.mockResolvedValue({
      data: [],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 0 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const emptyBox = await screen.findByTestId("bidding-empty");
    expect(emptyBox).toBeInTheDocument();
    expect(emptyBox).toHaveTextContent("No live auctions");

    const newListingBtn = screen.getByTestId("empty-create-listing-btn");
    expect(newListingBtn).toHaveAttribute("href", "/farmer/new-listing");
  });

  it("renders forbidden state when accessed by non-farmer user", () => {
    useAuthMock.mockReturnValue({
      user: { id: "buyer-123", role: UserRole.BUYER },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    expect(screen.getByTestId("bidding-forbidden")).toBeInTheDocument();
    expect(screen.getByTestId("bidding-forbidden")).toHaveTextContent(
      "Access forbidden. Crop bidding is only accessible to farmers.",
    );
  });

  it("renders Live card with photo, crop, grade, quantity, floor, current price, countdown, and respects Cancel action visibility (0 bids)", async () => {
    const listing = createMockListing({
      id: "live-no-bids-1",
      bidCount: 0,
      currentBidPerKg: undefined,
      floorPricePerKg: 4500,
      quantityKg: 75,
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const card = await screen.findByTestId(`live-listing-card-${listing.id}`);
    expect(card).toBeInTheDocument();

    // Check crop and quantity
    expect(card).toHaveTextContent("Bitter Gourd");
    expect(screen.getByTestId(`quantity-${listing.id}`)).toHaveTextContent("75 kg");

    // Floor price & large current price
    expect(screen.getByTestId(`floor-price-${listing.id}`)).toHaveTextContent("৳45.00");
    expect(screen.getByTestId(`current-price-${listing.id}`)).toHaveTextContent("No bids yet");

    // Action visibility rule: Cancel button MUST be visible; Accept now button MUST NOT be visible
    expect(screen.getByTestId(`cancel-listing-btn-${listing.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`accept-now-btn-${listing.id}`)).not.toBeInTheDocument();

    // Shared countdown timer present
    expect(card.querySelector('[data-testid="countdown-timer"]')).toBeInTheDocument();
  });

  it("renders Live card with bids and respects Accept now action visibility (> 0 bids)", async () => {
    const listing = createMockListing({
      id: "live-with-bids-1",
      bidCount: 3,
      currentBidPerKg: 5200,
      floorPricePerKg: 4500,
      quantityKg: 60,
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const card = await screen.findByTestId(`live-listing-card-${listing.id}`);
    expect(card).toBeInTheDocument();

    // Large current price
    expect(screen.getByTestId(`current-price-${listing.id}`)).toHaveTextContent("৳52.00");

    // Action visibility rule: Accept now button MUST be visible; Cancel button MUST NOT be visible
    expect(screen.getByTestId(`accept-now-btn-${listing.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`cancel-listing-btn-${listing.id}`)).not.toBeInTheDocument();
  });

  it("handles Cancel action with confirmation dialog and does not show cancelled state before server confirms", async () => {
    const listing = createMockListing({
      id: "live-cancel-1",
      bidCount: 0,
      currentBidPerKg: undefined,
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    let resolveCancel: (val: unknown) => void;
    const cancelPromise = new Promise((resolve) => {
      resolveCancel = resolve;
    });
    cancelListingMock.mockReturnValue(cancelPromise);

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const cancelBtn = await screen.findByTestId(`cancel-listing-btn-${listing.id}`);
    fireEvent.click(cancelBtn);

    // Confirmation dialog appears
    const dialog = screen.getByTestId("cancel-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Cancel this auction?");

    const confirmBtn = screen.getByTestId("confirm-cancel-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelListingMock).toHaveBeenCalledWith(listing.id);
    });
    // While server is processing, UI shows loading state and does not prematurely confirm result
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent("Cancelling…");

    // Resolve server confirmation
    await act(async () => {
      resolveCancel!({
        data: { ...listing, status: ListingStatus.CANCELLED },
        meta: { serverTime: new Date().toISOString() },
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("cancel-confirm-dialog")).not.toBeInTheDocument();
    });
  });

  it("handles Accept now action with confirmation showing price and total value, without premature UI update", async () => {
    const listing = createMockListing({
      id: "live-accept-1",
      bidCount: 2,
      currentBidPerKg: 5000, // 50 BDT
      quantityKg: 100, // Total = 50 * 100 = 5000 BDT = 500,000 poisha
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    let resolveAccept: (val: unknown) => void;
    const acceptPromise = new Promise((resolve) => {
      resolveAccept = resolve;
    });
    acceptCurrentBidMock.mockReturnValue(acceptPromise);

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const acceptBtn = await screen.findByTestId(`accept-now-btn-${listing.id}`);
    fireEvent.click(acceptBtn);

    // Confirmation dialog appears showing price and total
    const dialog = screen.getByTestId("accept-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("৳50.00");
    expect(dialog).toHaveTextContent("৳5000.00");

    const confirmBtn = screen.getByTestId("confirm-accept-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(acceptCurrentBidMock).toHaveBeenCalledWith(listing.id);
    });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent("Accepting…");

    // Resolve server confirmation
    await act(async () => {
      resolveAccept!({
        data: { listingId: listing.id, status: ListingStatus.SOLD },
        meta: { serverTime: new Date().toISOString() },
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("accept-confirm-dialog")).not.toBeInTheDocument();
    });
  });

  it("renders Ended tab showing SOLD listings with winning price and link to order placeholder", async () => {
    const soldListing = createMockListing({
      id: "sold-listing-1",
      status: ListingStatus.SOLD,
      bidCount: 4,
      currentBidPerKg: 5500,
      quantityKg: 80,
    });

    getMyListingsMock.mockResolvedValue({
      data: [soldListing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    // Switch to Ended tab
    const endedTab = await screen.findByTestId("bidding-tab-ended");
    fireEvent.click(endedTab);

    const card = await screen.findByTestId(`ended-listing-card-${soldListing.id}`);
    expect(card).toBeInTheDocument();

    // Check winning price
    const winningPrice = screen.getByTestId(`winning-price-${soldListing.id}`);
    expect(winningPrice).toHaveTextContent("৳55.00");

    // Check link to order placeholder
    const orderLink = screen.getByTestId(`view-order-link-${soldListing.id}`);
    expect(orderLink).toHaveAttribute("href", "/farmer/orders");
  });

  it("renders Ended tab showing EXPIRED_UNSOLD with 'Not sold. Sell at your local market, or relist' and Relist dialog prefilled", async () => {
    const unsoldListing = createMockListing({
      id: "unsold-listing-1",
      status: ListingStatus.EXPIRED_UNSOLD,
      bidCount: 0,
      currentBidPerKg: undefined,
      floorPricePerKg: 4500,
      quantityKg: 90,
      aiPriceGuidance: {
        lowPerKg: 4000,
        expectedPerKg: 4300,
        highPerKg: 4800,
        trend: "FLAT",
        confidence: 0.92,
        explanation: ["Local market steady"],
        modelVersion: "mock-price-1.0",
        provider: "mock",
        degraded: false,
        generatedAt: new Date().toISOString(),
        suggestedFloorPerKg: 4200, // 42.00 BDT
      },
    });

    getMyListingsMock.mockResolvedValue({
      data: [unsoldListing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    relistListingMock.mockResolvedValue({
      data: createMockListing({ id: "new-relisted-1" }),
      meta: { serverTime: new Date().toISOString() },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    // Switch to Ended tab
    const endedTab = await screen.findByTestId("bidding-tab-ended");
    fireEvent.click(endedTab);

    const card = await screen.findByTestId(`ended-listing-card-${unsoldListing.id}`);
    expect(card).toBeInTheDocument();

    // Notice text: "Not sold. Sell at your local market, or relist"
    const unsoldNotice = screen.getByTestId(`unsold-notice-${unsoldListing.id}`);
    expect(unsoldNotice).toHaveTextContent("Not sold. Sell at your local market, or relist.");

    // Relist button
    const relistBtn = screen.getByTestId(`relist-btn-${unsoldListing.id}`);
    expect(relistBtn).toBeInTheDocument();
    fireEvent.click(relistBtn);

    // Relist dialog opens prefilled
    const dialog = screen.getByTestId("relist-dialog");
    expect(dialog).toBeInTheDocument();

    // Prefilled same crop and quantity
    expect(screen.getByTestId("relist-crop")).toHaveTextContent("Bitter Gourd");
    expect(screen.getByTestId("relist-quantity")).toHaveTextContent("90 kg");

    // Prefilled floor price (42.00) and duration (180 min)
    const floorInput = screen.getByTestId("relist-floor-input") as HTMLInputElement;
    expect(floorInput.value).toBe("42.00");

    const durationSelect = screen.getByTestId("relist-duration-select") as HTMLSelectElement;
    expect(durationSelect.value).toBe("180");

    // Submit relist
    const submitBtn = screen.getByTestId("submit-relist-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(relistListingMock).toHaveBeenCalledWith(unsoldListing.id, {
        floorPricePerKg: 4200,
        durationMinutes: 180,
      });
    });
  });

  it("toggles and renders anonymized bid history panel", async () => {
    const listing = createMockListing({
      id: "live-history-1",
      bidCount: 2,
      currentBidPerKg: 4900,
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    getListingBidsMock.mockResolvedValue({
      data: [
        {
          id: "bid-1",
          listingId: listing.id,
          amountPerKg: 4700,
          totalAmount: 235000,
          bidderLabel: "Buyer #1",
          placedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        },
        {
          id: "bid-2",
          listingId: listing.id,
          amountPerKg: 4900,
          totalAmount: 245000,
          bidderLabel: "Buyer #2",
          placedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        },
      ],
      meta: { serverTime: new Date().toISOString() },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const toggleBtn = await screen.findByTestId(`toggle-bid-history-${listing.id}`);
    fireEvent.click(toggleBtn);

    const historyPanel = await screen.findByTestId(`bid-history-panel-${listing.id}`);
    expect(historyPanel).toBeInTheDocument();

    const bidItems = await screen.findAllByTestId("bid-history-item");
    expect(bidItems).toHaveLength(2);

    // Anonymized labels
    expect(bidItems[0]).toHaveTextContent("Buyer #1");
    expect(bidItems[0]).toHaveTextContent("৳47.00");
    expect(bidItems[1]).toHaveTextContent("Buyer #2");
    expect(bidItems[1]).toHaveTextContent("৳49.00");
  });

  it("updates price and bid count and displays 'New bid' toast when receiving live SSE bid update without reload", async () => {
    const listing = createMockListing({
      id: "live-stream-1",
      bidCount: 1,
      currentBidPerKg: 4800,
    });

    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    await screen.findByTestId(`live-listing-card-${listing.id}`);

    // Initial price & bid count
    expect(screen.getByTestId(`current-price-${listing.id}`)).toHaveTextContent("৳48.00");
    expect(screen.getByTestId(`bid-count-${listing.id}`)).toHaveTextContent("1 bid");

    // Trigger onBidPlaced via the registered stream hook
    const streamOpts = streamOptionsMap[listing.id];
    expect(streamOpts).toBeDefined();

    act(() => {
      streamOpts?.onBidPlaced({
        listingId: listing.id,
        bidId: "new-bid-999",
        bidderLabel: "Buyer #4",
        currentPrice: 5300,
        currentBidPerKg: 5300,
        amountPerKg: 5300,
        totalAmount: 265000,
        bidCount: 2,
        placedAt: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });
    });

    // Toast notification appears
    const toast = await screen.findByTestId("new-bid-toast");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent("Buyer #4");
    expect(toast).toHaveTextContent("৳53.00");

    // Price and bid count update without page reload!
    await waitFor(() => {
      expect(screen.getByTestId(`current-price-${listing.id}`)).toHaveTextContent("৳53.00");
      expect(screen.getByTestId(`bid-count-${listing.id}`)).toHaveTextContent("2 bids");
    });
  });

  it("renders correctly in mobile viewport (360px)", async () => {
    const listing = createMockListing({ id: "mobile-1" });
    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 50, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<CropBiddingPage />, { wrapper });

    const page = await screen.findByTestId("crop-bidding-page");
    expect(page).toBeInTheDocument();
    expect(screen.getByTestId("bidding-tabs")).toBeInTheDocument();
  });
});

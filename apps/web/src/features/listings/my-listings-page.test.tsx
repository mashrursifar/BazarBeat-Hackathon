import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CropResponse,
  FarmerListing,
  FarmerListingListResponse,
  FarmerListingResponse,
} from "@bazarbeat/shared";
import "../../lib/i18n.js";
import { MyListingsPage } from "./my-listings-page.js";

const getMyListingsMock = vi.hoisted(() => vi.fn());
const getListingByIdMock = vi.hoisted(() => vi.fn());
const getCropsMock = vi.hoisted(() => vi.fn());

vi.mock("./api/listing-api.js", () => ({
  getMyListings: getMyListingsMock,
  getListingById: getListingByIdMock,
  getCrops: getCropsMock,
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
    qualityNotes: ["Firm texture with uniform green color", "No harvest cuts"],
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
  endsAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(), // 5 hours left
  originalEndsAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
  extensionCount: 0,
  status: "ACTIVE",
  currentBidPerKg: 4800,
  bidCount: 3,
  pickupNote: "Storage shed #2 near gate",
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

describe("MyListingsPage component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCropsMock.mockResolvedValue([mockCrop]);
  });

  it("renders loading state with skeleton cards", () => {
    getMyListingsMock.mockReturnValue(new Promise(() => {})); // Never resolves
    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    expect(screen.getByTestId("my-listings-loading")).toBeInTheDocument();
  });

  it("renders error state with retry button and refetches on click", async () => {
    getMyListingsMock.mockRejectedValueOnce(new Error("Network failure"));
    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    const errorAlert = await screen.findByTestId("my-listings-error");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("Could not load listings");

    // Click retry
    const listing = createMockListing();
    const successList: FarmerListingListResponse = {
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
    };
    getMyListingsMock.mockResolvedValueOnce(successList);

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByTestId(`listing-card-${listing.id}`)).toBeInTheDocument();
  });

  it("renders empty state with new listing CTA when farmer has no listings", async () => {
    const emptyList: FarmerListingListResponse = {
      data: [],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 0 },
    };
    getMyListingsMock.mockResolvedValue(emptyList);

    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    const emptyBox = await screen.findByTestId("my-listings-empty");
    expect(emptyBox).toBeInTheDocument();
    expect(emptyBox).toHaveTextContent("No listings found");

    const newListingBtn = screen.getByTestId("empty-create-listing-btn");
    expect(newListingBtn).toHaveAttribute("href", "/farmer/new-listing");
  });

  it("renders listing cards with photo, crop, grade badge, quantity, floor, and plain text time left", async () => {
    const listing = createMockListing({
      endsAt: new Date(Date.now() + 2 * 3600 * 1000 + 15 * 60 * 1000).toISOString(), // ~2h 15m
    });
    const listResponse: FarmerListingListResponse = {
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
    };
    getMyListingsMock.mockResolvedValue(listResponse);

    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    const card = await screen.findByTestId(`listing-card-${listing.id}`);
    expect(card).toBeInTheDocument();

    // Crop name & quantity
    expect(card).toHaveTextContent("Bitter Gourd");
    expect(card).toHaveTextContent("50 kg");

    // Grade badge
    expect(screen.getByTestId("grade-badge-a")).toHaveTextContent("A");

    // Status badge
    expect(screen.getByTestId("status-badge-ACTIVE")).toHaveTextContent("Active");

    // Floor price & highest bid
    expect(card).toHaveTextContent("৳45.00");
    expect(card).toHaveTextContent("৳48.00");

    // Plain text time left
    const timeLeft = screen.getByTestId(`time-left-${listing.id}`);
    expect(timeLeft).toBeInTheDocument();
    expect(timeLeft).toHaveTextContent(/2h 1[45]m left/);
  });

  it("filters listings by status tabs", async () => {
    const activeListing = createMockListing({ id: "active-1", status: "ACTIVE" });
    const soldListing = createMockListing({ id: "sold-1", status: "SOLD" });

    getMyListingsMock.mockImplementation((query?: { status?: string }) => {
      if (query?.status === "SOLD") {
        return Promise.resolve({
          data: [soldListing],
          meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
        });
      }
      return Promise.resolve({
        data: [activeListing, soldListing],
        meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 2 },
      });
    });

    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    // Initially "All" tab is active
    expect(await screen.findByTestId("listing-card-active-1")).toBeInTheDocument();
    expect(screen.getByTestId("listing-card-sold-1")).toBeInTheDocument();

    // Click "Sold" tab
    const soldTab = screen.getByTestId("status-tab-sold");
    fireEvent.click(soldTab);

    await waitFor(() => {
      expect(getMyListingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "SOLD" }),
      );
    });
  });

  it("opens detail drawer with GET /listings/:id and closes it", async () => {
    const listing = createMockListing();
    const listResponse: FarmerListingListResponse = {
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
    };
    const detailResponse: FarmerListingResponse = {
      data: listing,
      meta: { serverTime: new Date().toISOString() },
    };

    getMyListingsMock.mockResolvedValue(listResponse);
    getListingByIdMock.mockResolvedValue(detailResponse);

    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    // Click "View details" button on the card
    const viewDetailsBtn = await screen.findByTestId(`view-details-${listing.id}`);
    fireEvent.click(viewDetailsBtn);

    // Detail drawer should open and fetch details
    const drawer = await screen.findByTestId("listing-detail-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent("Listing Details");
    await waitFor(() => {
      expect(drawer).toHaveTextContent("ID: 67b8d0001111222233334444");
    });
    expect(drawer).toHaveTextContent("Firm texture with uniform green color");
    expect(drawer).toHaveTextContent("Storage shed #2 near gate");

    // Close drawer
    const closeBtn = screen.getByTestId("close-drawer-btn");
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId("listing-detail-drawer")).not.toBeInTheDocument();
  });

  it("displays newly published listing without page reload when cache invalidates", async () => {
    const initialList: FarmerListingListResponse = {
      data: [],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 0 },
    };
    getMyListingsMock.mockResolvedValueOnce(initialList);

    const { wrapper, queryClient } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    expect(await screen.findByTestId("my-listings-empty")).toBeInTheDocument();

    // Simulate publication: mock returns list with the new listing, and invalidate query
    const newListing = createMockListing({ id: "newly-created-listing" });
    getMyListingsMock.mockResolvedValueOnce({
      data: [newListing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
    });

    // Invalidate query in cache (same as useCreateListing onSuccess)
    await queryClient.invalidateQueries({ queryKey: ["listings", "mine"] });

    // New listing appears without page reload
    expect(await screen.findByTestId("listing-card-newly-created-listing")).toBeInTheDocument();
  });

  it("renders correctly in mobile viewport (360px)", async () => {
    const listing = createMockListing();
    getMyListingsMock.mockResolvedValue({
      data: [listing],
      meta: { serverTime: new Date().toISOString(), page: 1, limit: 30, total: 1 },
    });

    const { wrapper } = createWrapper();
    render(<MyListingsPage />, { wrapper });

    expect(await screen.findByTestId("my-listings-page")).toBeInTheDocument();
    expect(screen.getByTestId("status-filter-tabs")).toBeInTheDocument();
    expect(await screen.findByTestId(`listing-card-${listing.id}`)).toBeInTheDocument();
  });
});

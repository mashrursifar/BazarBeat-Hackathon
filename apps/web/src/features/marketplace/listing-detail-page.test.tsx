import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AnonymizedBidHistoryResponse,
  type BuyerListingDetail,
  type BuyerListingDetailResponse,
  BuyerListingStatus,
  ListingStatus,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import BuyerListingDetailPage from "./listing-detail-page.js";

const mockListing: BuyerListingDetail = {
  id: "507f1f77bcf86cd799439011",
  cropId: "507f1f77bcf86cd799439012",
  crop: {
    id: "507f1f77bcf86cd799439012",
    slug: "potato",
    nameEn: "Diamond Potato",
    nameBn: "ডায়মন্ড আলু",
    unit: "kg",
    minIncrementPerKg: 100,
  },
  grade: "A",
  confidenceBand: "HIGH",
  reasons: ["Uniform oval shape", "Smooth golden skin", "No blight defects"],
  aiPriceSnapshot: {
    lowPerKg: 4000,
    expectedPerKg: 4500,
    highPerKg: 5000,
    trend: "UP",
  },
  provider: "mock",
  degraded: false,
  quantityKg: 500,
  images: [
    { url: "/images/potato-1.jpg", width: 800, height: 600 },
    { url: "/images/potato-2.jpg", width: 800, height: 600 },
  ],
  floorPricePerKg: 4000,
  minIncrementPerKg: 100,
  currentBidPerKg: 4500,
  displayPricePerKg: 4500,
  displayTotalCost: 2250000,
  bidCount: 2,
  startsAt: "2026-11-15T10:00:00.000Z",
  endsAt: "2026-11-15T18:00:00.000Z",
  extensionCount: 0,
  status: ListingStatus.ACTIVE,
  location: {
    division: "dhaka",
    district: "gazipur",
  },
  myStatus: BuyerListingStatus.NONE,
  myHighestBidPerKg: null,
  highestBidPerKg: 4500,
  createdAt: "2026-11-15T10:00:00.000Z",
};

const mockBids: AnonymizedBidHistoryResponse = {
  data: [
    {
      id: "bid-2",
      listingId: "507f1f77bcf86cd799439011",
      amountPerKg: 4500,
      totalAmount: 2250000,
      bidderLabel: "Buyer #2",
      placedAt: "2026-11-15T11:00:00.000Z",
      isMine: false,
    },
    {
      id: "bid-1",
      listingId: "507f1f77bcf86cd799439011",
      amountPerKg: 4200,
      totalAmount: 2100000,
      bidderLabel: "Buyer #1",
      placedAt: "2026-11-15T10:30:00.000Z",
      isMine: true,
      isMyBid: true,
    },
  ],
  meta: {
    serverTime: "2026-11-15T11:05:00.000Z",
  },
};

// Mock EventSource
class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public readyState: number = 0;
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  public addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  public simulateEvent(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }
  }

  public close(): void {
    this.readyState = 2;
  }
}

describe("BuyerListingDetailPage Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  function renderPage(listingDetail: BuyerListingDetail = mockListing, bids = mockBids): ReturnType<typeof render> {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/bids")) {
          return new Response(JSON.stringify(bids), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        const responseData: BuyerListingDetailResponse = {
          data: listingDetail,
          meta: { serverTime: "2026-11-15T11:05:00.000Z" },
        };
        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/buyer/listings/${listingDetail.id}`]}>
          <Routes>
            <Route path="/buyer/listings/:id" element={<BuyerListingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("renders all key detail sections: gallery, grade badge, tooltip, demo AI chip, range visual, countdown, quantity, region, and bid history", async () => {
    renderPage();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("buyer-listing-detail-page")).toBeInTheDocument();
    });

    // 1. Photo gallery with thumbnails
    expect(screen.getByTestId("photo-gallery")).toBeInTheDocument();
    expect(screen.getByTestId("main-photo")).toBeInTheDocument();
    expect(screen.getByTestId("thumbnail-0")).toBeInTheDocument();
    expect(screen.getByTestId("thumbnail-1")).toBeInTheDocument();

    // 2. Grade badge with confidence band and reasons
    expect(screen.getByTestId("grade-badge-a")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-band-badge")).toHaveTextContent("High confidence");
    expect(screen.getByTestId("quality-reasons-list")).toHaveTextContent("Uniform oval shape");
    expect(screen.getByTestId("quality-reasons-list")).toHaveTextContent("Smooth golden skin");

    // 3. AI-assessed tooltip & Demo AI model chip
    expect(screen.getByTestId("ai-assessed-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("demo-ai-chip")).toBeInTheDocument();

    // 4. AI Market Range visual
    expect(screen.getByTestId("ai-market-range-visual")).toBeInTheDocument();
    expect(screen.getByTestId("market-trend-badge")).toHaveTextContent("Rising trend");
    expect(screen.getByTestId("market-position-badge")).toHaveTextContent("Within expected market range");

    // 5. Countdown timer with Phase 4 states
    expect(screen.getByRole("timer")).toBeInTheDocument();

    // 6. Quantity and Farmer Region
    expect(screen.getByTestId("lot-quantity-text")).toHaveTextContent("500 kg");
    expect(screen.getByTestId("farmer-region-text")).toHaveTextContent(/gazipur,\s*dhaka/i);

    // 7. Anonymized bid history marking buyer's own bid as "You"
    expect(screen.getByTestId("anonymized-bid-history")).toBeInTheDocument();
    expect(screen.getByTestId("you-bidder-tag")).toHaveTextContent("You");
    expect(screen.getByTestId("bid-row-bid-1")).toHaveTextContent("(Buyer #1)");
    expect(screen.getByTestId("bid-row-bid-2")).toHaveTextContent("Buyer #2");

    // 8. Bid panel is rendered
    expect(screen.getByTestId("bid-panel")).toBeInTheDocument();

    // 9. Sticky bid bar for mobile viewports
    expect(screen.getByTestId("sticky-bid-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sticky-bid-btn")).toHaveTextContent("Place Bid");
  });

  it("handles photo gallery thumbnail navigation", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("main-photo")).toBeInTheDocument();
    });

    const mainPhoto = screen.getByTestId("main-photo") as HTMLImageElement;
    expect(mainPhoto.src).toContain("/images/potato-1.jpg");

    // Click second thumbnail
    await user.click(screen.getByTestId("thumbnail-1"));
    expect(mainPhoto.src).toContain("/images/potato-2.jpg");
  });

  it("announces live price updates via aria-live polite region upon SSE bid.placed event", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("buyer-listing-detail-page")).toBeInTheDocument();
    });

    expect(MockEventSource.instances.length).toBeGreaterThan(0);
    const sseInstance = MockEventSource.instances[0];
    if (!sseInstance) throw new Error("Expected SSE instance");

    // Simulate bid.placed event
    sseInstance.simulateEvent("bid.placed", {
      listingId: mockListing.id,
      bidId: "507f1f77bcf86cd799439033",
      bidderLabel: "Buyer #3",
      currentPrice: 4700,
      currentBidPerKg: 4700,
      amountPerKg: 4700,
      totalAmount: 4700 * 500,
      bidCount: 3,
      placedAt: "2026-11-15T11:10:00.000Z",
      serverTime: "2026-11-15T11:10:00.000Z",
    });

    // Check polite live announcement
    await waitFor(() => {
      expect(screen.getByTestId("live-price-polite-announcement")).toHaveTextContent(
        /New bid placed: ৳47\.00\/kg/i,
      );
    });
  });

  describe("Auction Result States", () => {
    it("renders result state when listing is SOLD and buyer is winner (WON)", async () => {
      const wonListing: BuyerListingDetail = {
        ...mockListing,
        status: ListingStatus.SOLD,
        myStatus: BuyerListingStatus.WON,
        currentBidPerKg: 4800,
        displayPricePerKg: 4800,
        displayTotalCost: 4800 * 500,
      };

      renderPage(wonListing);

      await waitFor(() => {
        expect(screen.getByTestId("auction-result-card")).toBeInTheDocument();
      });

      expect(screen.getByTestId("result-won-state")).toBeInTheDocument();
      expect(screen.getByText("You won this auction!")).toBeInTheDocument();
      expect(screen.getByTestId("view-won-order-btn")).toBeInTheDocument();
    });

    it("renders result state when listing is SOLD to another buyer (LOST)", async () => {
      const lostListing: BuyerListingDetail = {
        ...mockListing,
        status: ListingStatus.SOLD,
        myStatus: BuyerListingStatus.LOST,
      };

      renderPage(lostListing);

      await waitFor(() => {
        expect(screen.getByTestId("auction-result-card")).toBeInTheDocument();
      });

      expect(screen.getByTestId("result-sold-state")).toBeInTheDocument();
      expect(screen.getByText("Auction Ended — Sold")).toBeInTheDocument();
      expect(screen.getByText("This lot was won by another buyer.")).toBeInTheDocument();
    });

    it("renders result state when listing is EXPIRED_UNSOLD", async () => {
      const unsoldListing: BuyerListingDetail = {
        ...mockListing,
        status: ListingStatus.EXPIRED_UNSOLD,
        myStatus: BuyerListingStatus.NONE,
      };

      renderPage(unsoldListing);

      await waitFor(() => {
        expect(screen.getByTestId("auction-result-card")).toBeInTheDocument();
      });

      expect(screen.getByTestId("result-unsold-state")).toBeInTheDocument();
      expect(screen.getByText("Auction Ended — Unsold")).toBeInTheDocument();
    });

    it("renders result state when listing is CANCELLED", async () => {
      const cancelledListing: BuyerListingDetail = {
        ...mockListing,
        status: ListingStatus.CANCELLED,
      };

      renderPage(cancelledListing);

      await waitFor(() => {
        expect(screen.getByTestId("auction-result-card")).toBeInTheDocument();
      });

      expect(screen.getByTestId("result-cancelled-state")).toBeInTheDocument();
      expect(screen.getByText("Auction Cancelled")).toBeInTheDocument();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BuyerListingDetail,
  BuyerListingStatus,
  ListingStatus,
} from "@bazarbeat/shared";

import "../../../lib/i18n.js";
import { BidPanel } from "./bid-panel.js";

function createMockListing(overrides?: Partial<BuyerListingDetail>): BuyerListingDetail {
  return {
    id: "507f1f77bcf86cd799439011",
    cropId: "507f1f77bcf86cd799439012",
    crop: {
      id: "507f1f77bcf86cd799439012",
      slug: "potato",
      nameEn: "Diamond Potato",
      nameBn: "ডায়মন্ড আলু",
      unit: "kg",
      minIncrementPerKg: 100, // ৳1.00
    },
    grade: "A",
    confidenceBand: "HIGH",
    reasons: ["Uniform oval shape", "Smooth skin", "No blight defects"],
    aiPriceSnapshot: {
      lowPerKg: 4000,
      expectedPerKg: 4500,
      highPerKg: 5000,
      trend: "UP",
    },
    provider: "mock",
    degraded: false,
    quantityKg: 500,
    images: [{ url: "/images/potato1.jpg", width: 800, height: 600 }],
    floorPricePerKg: 4000, // ৳40.00
    minIncrementPerKg: 100, // ৳1.00
    currentBidPerKg: 4500, // ৳45.00
    displayPricePerKg: 4500,
    displayTotalCost: 2250000,
    bidCount: 3,
    startsAt: "2026-11-15T10:00:00.000Z",
    endsAt: "2026-11-15T18:00:00.000Z",
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    location: {
      division: "Dhaka",
      district: "Gazipur",
    },
    myStatus: BuyerListingStatus.NONE,
    myHighestBidPerKg: null,
    highestBidPerKg: 4500,
    createdAt: "2026-11-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("BidPanel Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  function renderWithProviders(ui: ReactElement): ReturnType<typeof render> {
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return render(ui, { wrapper });
  }

  it("renders next minimum bid, suggested buttons, custom amount, and total preview", () => {
    const listing = createMockListing({
      currentBidPerKg: 4500,
      minIncrementPerKg: 100,
      bidCount: 3,
      quantityKg: 500,
    });

    renderWithProviders(<BidPanel listing={listing} />);

    // Next minimum bid should be current (4500) + increment (100) = 4600 (৳46.00)
    expect(screen.getByTestId("min-next-bid-amount")).toHaveTextContent("৳46.00/kg");

    // Suggested buttons from calculateSuggestedBids: Minimum, +5%, +10%
    expect(screen.getByTestId("suggested-bid-btn-minimum")).toBeInTheDocument();
    expect(screen.getByTestId("suggested-bid-btn-minimum")).toHaveTextContent("৳46.00");
    expect(screen.getByTestId("suggested-bid-btn-5")).toBeInTheDocument();
    expect(screen.getByTestId("suggested-bid-btn-10")).toBeInTheDocument();

    // Custom input initially populated with minimum bid (46.00)
    const input = screen.getByTestId("custom-bid-input") as HTMLInputElement;
    expect(input.value).toBe("46.00");

    // Live total preview: 4600 * 500 = 2,300,000 poisha = ৳23000.00
    expect(screen.getByTestId("live-total-cost-preview")).toHaveTextContent("৳23000.00");
  });

  it("updates custom input and live total preview when clicking suggested buttons", async () => {
    const user = userEvent.setup();
    const listing = createMockListing({
      floorPricePerKg: 4000,
      currentBidPerKg: 4000,
      minIncrementPerKg: 100,
      bidCount: 1,
      quantityKg: 200,
    });

    renderWithProviders(<BidPanel listing={listing} />);

    // Click +10% suggested button
    const plus10Btn = screen.getByTestId("suggested-bid-btn-10");
    await user.click(plus10Btn);

    const input = screen.getByTestId("custom-bid-input") as HTMLInputElement;
    // Current price is 4000, 4000 * 1.10 = 4400 (44.00)
    expect(input.value).toBe("44.00");

    // Total preview: 4400 * 200 = 880,000 poisha = ৳8800.00
    expect(screen.getByTestId("live-total-cost-preview")).toHaveTextContent("৳8800.00");
  });

  it("converts typed Taka decimals into poisha and updates live total preview at the edge", async () => {
    const user = userEvent.setup();
    const listing = createMockListing({
      quantityKg: 100,
      floorPricePerKg: 4000,
      bidCount: 0,
    });

    renderWithProviders(<BidPanel listing={listing} />);

    const input = screen.getByTestId("custom-bid-input");
    await user.clear(input);
    await user.type(input, "45.75");

    // 45.75 * 100 kg = ৳4575.00 (457500 poisha)
    expect(screen.getByTestId("live-total-cost-preview")).toHaveTextContent("৳4575.00");

    // Enter invalid decimal with 3 decimal digits: live preview becomes —
    await user.clear(input);
    await user.type(input, "45.755");
    expect(screen.getByTestId("live-total-cost-preview")).toHaveTextContent("—");
  });

  describe("Bid Panel status banners", () => {
    it("renders 'not bidding' banner when user has never bid (myStatus: NONE)", () => {
      const listing = createMockListing({ myStatus: BuyerListingStatus.NONE });
      renderWithProviders(<BidPanel listing={listing} />);

      expect(screen.getByTestId("status-not-bidding-banner")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't placed a bid on this listing yet."),
      ).toBeInTheDocument();
    });

    it("renders 'You're winning' banner and disables place bid when user is highest bidder (myStatus: WINNING)", () => {
      const listing = createMockListing({
        myStatus: BuyerListingStatus.WINNING,
        myHighestBidPerKg: 4600,
      });
      renderWithProviders(<BidPanel listing={listing} />);

      expect(screen.getByTestId("status-winning-banner")).toBeInTheDocument();
      expect(screen.getByTestId("status-winning-banner")).toHaveTextContent(
        "You're winning! You currently hold the highest bid.",
      );

      const submitBtn = screen.getByTestId("place-bid-submit-btn");
      expect(submitBtn).toBeDisabled();
    });

    it("renders 'You were outbid by ৳X' banner when outbid (myStatus: OUTBID)", () => {
      const listing = createMockListing({
        myStatus: BuyerListingStatus.OUTBID,
        myHighestBidPerKg: 4200,
        currentBidPerKg: 4500,
        highestBidPerKg: 4500,
      });
      renderWithProviders(<BidPanel listing={listing} />);

      // Outbid gap = 4500 - 4200 = 300 poisha = ৳3.00
      expect(screen.getByTestId("status-outbid-banner")).toBeInTheDocument();
      expect(screen.getByText(/You were outbid by ৳3\.00/i)).toBeInTheDocument();
    });

    it("renders closed banner when auction is ended (SOLD, EXPIRED, CANCELLED)", () => {
      const listing = createMockListing({
        status: ListingStatus.SOLD,
        myStatus: BuyerListingStatus.LOST,
      });
      renderWithProviders(<BidPanel listing={listing} />);

      expect(screen.getByTestId("status-closed-banner")).toBeInTheDocument();
      expect(screen.queryByTestId("custom-bid-input")).not.toBeInTheDocument();
    });
  });

  describe("Binding Confirmation Dialog", () => {
    it("opens confirmation dialog with price per kg, quantity, total and binding statement", async () => {
      const user = userEvent.setup();
      const listing = createMockListing({
        currentBidPerKg: 4500,
        minIncrementPerKg: 100,
        quantityKg: 250,
      });

      renderWithProviders(<BidPanel listing={listing} />);

      const input = screen.getByTestId("custom-bid-input");
      await user.clear(input);
      await user.type(input, "48.00");

      const submitBtn = screen.getByTestId("place-bid-submit-btn");
      await user.click(submitBtn);

      // Dialog opens
      expect(screen.getByTestId("binding-bid-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("binding-dialog-title")).toHaveTextContent(
        "Confirm Your Binding Bid",
      );
      expect(screen.getByTestId("binding-disclaimer")).toHaveTextContent(
        /legally binding commitments/i,
      );

      // Price per kg: ৳48.00/kg
      expect(screen.getByTestId("confirm-price-per-kg")).toHaveTextContent("৳48.00/kg");
      // Quantity: 250 kg
      expect(screen.getByTestId("confirm-quantity")).toHaveTextContent("250 kg");
      // Total: 4800 * 250 = 1,200,000 poisha = ৳12000.00
      expect(screen.getByTestId("confirm-total-cost")).toHaveTextContent("৳12000.00");

      // Cancel closes dialog
      await user.click(screen.getByTestId("cancel-bid-btn"));
      expect(screen.queryByTestId("binding-bid-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Idempotency-Key and Retry behavior", () => {
    it("generates an Idempotency-Key and reuses the exact same key on retries of the same intent", async () => {
      const user = userEvent.setup();
      const listing = createMockListing({
        currentBidPerKg: 4500,
        minIncrementPerKg: 100,
      });

      const sentHeaders: string[] = [];
      let callCount = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          callCount++;
          const headers = (init?.headers as Record<string, string>) ?? {};
          const idempKey = headers["Idempotency-Key"] ?? "";
          sentHeaders.push(idempKey);

          if (callCount === 1) {
            // First attempt fails with 500 network/server error
            return new Response(
              JSON.stringify({ error: { code: "INTERNAL", message: "Temporary failure" } }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          // Second attempt succeeds
          return new Response(
            JSON.stringify({
              data: {
                id: "bid-123",
                listingId: listing.id,
                buyerId: "buyer-1",
                amountPerKg: 4600,
                totalAmount: 4600 * listing.quantityKg,
                status: "ACCEPTED",
                placedAt: new Date().toISOString(),
              },
              meta: { serverTime: new Date().toISOString() },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      // Open dialog
      await user.click(screen.getByTestId("place-bid-submit-btn"));

      // Confirm first attempt -> fails
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("dialog-error-banner")).toBeInTheDocument();
      });

      expect(callCount).toBe(1);
      expect(sentHeaders[0]).toBeDefined();

      // Retry the SAME intent (without changing amount)
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.queryByTestId("binding-bid-dialog")).not.toBeInTheDocument();
      });

      expect(callCount).toBe(2);
      // Critical check: both requests used the EXACT same Idempotency-Key!
      expect(sentHeaders[1]).toBe(sentHeaders[0]);
    });

    it("generates a new Idempotency-Key when user edits the bid amount", async () => {
      const user = userEvent.setup();
      const listing = createMockListing({
        currentBidPerKg: 4500,
        minIncrementPerKg: 100,
      });

      const sentHeaders: string[] = [];

      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          const headers = (init?.headers as Record<string, string>) ?? {};
          sentHeaders.push(headers["Idempotency-Key"] ?? "");
          return new Response(
            JSON.stringify({
              data: {
                id: "bid-1",
                listingId: listing.id,
                buyerId: "buyer-1",
                amountPerKg: 4600,
                totalAmount: 4600 * listing.quantityKg,
                status: "ACCEPTED",
                placedAt: new Date().toISOString(),
              },
              meta: { serverTime: new Date().toISOString() },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      // First intent: 46.00
      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(sentHeaders.length).toBe(1);
      });

      // User changes amount to 47.00
      const input = screen.getByTestId("custom-bid-input");
      await user.clear(input);
      await user.type(input, "47.00");

      // Place bid for new amount
      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(sentHeaders.length).toBe(2);
      });

      // Keys must be different for different intents
      expect(sentHeaders[0]).not.toBe(sentHeaders[1]);
    });
  });

  describe("No Optimistic Update", () => {
    it("displays pending state on submit button while request is in-flight and waits for server response", async () => {
      const user = userEvent.setup();
      const listing = createMockListing({
        currentBidPerKg: 4500,
        minIncrementPerKg: 100,
        myStatus: BuyerListingStatus.NONE,
      });

      let resolveFetch!: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      vi.stubGlobal("fetch", vi.fn(() => fetchPromise));

      renderWithProviders(<BidPanel listing={listing} />);

      await user.click(screen.getByTestId("place-bid-submit-btn"));
      const confirmBtn = screen.getByTestId("confirm-bid-btn");
      await user.click(confirmBtn);

      // Button is pending / disabled
      expect(confirmBtn).toBeDisabled();
      expect(confirmBtn).toHaveTextContent("Submitting bid…");

      // No optimistic update: status banner in background is still not winning!
      expect(screen.getByTestId("status-not-bidding-banner")).toBeInTheDocument();

      // Resolve server response
      resolveFetch(
        new Response(
          JSON.stringify({
            data: {
              id: "bid-1",
              listingId: listing.id,
              buyerId: "buyer-1",
              amountPerKg: 4600,
              totalAmount: 4600 * listing.quantityKg,
              status: "ACCEPTED",
              placedAt: new Date().toISOString(),
            },
            meta: { serverTime: new Date().toISOString() },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

      await waitFor(() => {
        expect(screen.queryByTestId("binding-bid-dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Error Mapping & One-Tap Bid Minimum", () => {
    it("maps BID_TOO_LOW to friendly message and offers one-tap 'bid the minimum' button", async () => {
      const user = userEvent.setup();
      const listing = createMockListing({
        currentBidPerKg: 4500,
        minIncrementPerKg: 100,
      });

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "BID_TOO_LOW",
                message: "Bid amount must be at least 4700 poisha",
                details: {
                  minimumRequiredPerKg: 4700,
                  currentBidPerKg: 4600,
                  floorPricePerKg: 4000,
                  minIncrementPerKg: 100,
                },
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      // Submit
      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("bid-error-banner")).toBeInTheDocument();
      });

      // Friendly error message mentions ৳47.00/kg
      expect(screen.getByTestId("bid-error-banner")).toHaveTextContent(
        "Your bid is too low. The minimum required bid is ৳47.00/kg.",
      );

      // One-tap bid minimum button is offered
      const bidMinBtn = screen.getByTestId("bid-minimum-btn");
      expect(bidMinBtn).toBeInTheDocument();
      expect(bidMinBtn).toHaveTextContent("Bid minimum (৳47.00/kg)");

      // Click the one-tap button
      await user.click(bidMinBtn);

      // Input value is automatically updated to 47.00 and error is cleared
      const input = screen.getByTestId("custom-bid-input") as HTMLInputElement;
      expect(input.value).toBe("47.00");
      expect(screen.queryByTestId("bid-error-banner")).not.toBeInTheDocument();
    });

    it("maps AUCTION_CLOSED to friendly message", async () => {
      const user = userEvent.setup();
      const listing = createMockListing();

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "AUCTION_CLOSED",
                message: "Listing is closed",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("bid-error-banner")).toBeInTheDocument();
      });

      expect(screen.getByTestId("bid-error-banner")).toHaveTextContent(
        "This auction has closed and is no longer accepting bids.",
      );
    });

    it("maps OWN_LISTING and FORBIDDEN to friendly message", async () => {
      const user = userEvent.setup();
      const listing = createMockListing();

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "OWN_LISTING",
                message: "Farmer cannot bid on own listing",
              },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("bid-error-banner")).toBeInTheDocument();
      });

      expect(screen.getByTestId("bid-error-banner")).toHaveTextContent(
        "You cannot bid on your own listing.",
      );
    });

    it("maps CONFLICT (outbidding self) to friendly message", async () => {
      const user = userEvent.setup();
      const listing = createMockListing();

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "CONFLICT",
                message: "Cannot outbid yourself",
              },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

      renderWithProviders(<BidPanel listing={listing} />);

      await user.click(screen.getByTestId("place-bid-submit-btn"));
      await user.click(screen.getByTestId("confirm-bid-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("bid-error-banner")).toBeInTheDocument();
      });

      expect(screen.getByTestId("bid-error-banner")).toHaveTextContent(
        "You are already the highest bidder.",
      );
    });
  });
});

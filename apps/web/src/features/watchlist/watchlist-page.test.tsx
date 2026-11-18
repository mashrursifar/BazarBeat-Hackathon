// @vitest-environment jsdom
import "../../test-setup.js";
import "../../lib/i18n.js";

import {
  type BuyerListingCard,
  CropGrade,
  ListingStatus,
} from "@bazarbeat/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompareTrayProvider } from "../marketplace/context/compare-tray-context.js";
import { WatchlistButton } from "./components/watchlist-button.js";
import { EndedWatchlistCard, WatchlistPage } from "./watchlist-page.js";

const mockActiveListing: BuyerListingCard = {
  id: "listing-active-1",
  cropId: "crop-1",
  crop: {
    id: "crop-1",
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "kg",
  },
  grade: CropGrade.A,
  quantityKg: 200,
  images: [{ url: "/sample-potato.jpg", width: 800, height: 600 }],
  floorPricePerKg: 3000,
  minIncrementPerKg: 50,
  currentBidPerKg: 3500,
  displayPricePerKg: 3500,
  totalDisplayCost: 700000,
  bidCount: 4,
  hasBids: true,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
  status: ListingStatus.ACTIVE,
  location: { division: "Dhaka", district: "Gazipur" },
  isWatched: true,
};

const mockSoldListing: BuyerListingCard = {
  id: "listing-sold-1",
  cropId: "crop-2",
  crop: {
    id: "crop-2",
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "kg",
  },
  grade: CropGrade.B,
  quantityKg: 500,
  images: [{ url: "/sample-onion.jpg", width: 800, height: 600 }],
  floorPricePerKg: 5000,
  minIncrementPerKg: 100,
  currentBidPerKg: 6200,
  displayPricePerKg: 6200,
  totalDisplayCost: 3100000,
  bidCount: 8,
  hasBids: true,
  startsAt: new Date(Date.now() - 7200000).toISOString(),
  endsAt: new Date(Date.now() - 3600000).toISOString(),
  status: ListingStatus.SOLD,
  location: { division: "Rajshahi", district: "Pabna" },
  isWatched: true,
};

const mockUnsoldListing: BuyerListingCard = {
  id: "listing-unsold-1",
  cropId: "crop-3",
  crop: {
    id: "crop-3",
    slug: "green-chilli",
    nameEn: "Green Chilli",
    nameBn: "কাঁচা মরিচ",
    unit: "kg",
  },
  grade: CropGrade.C,
  quantityKg: 100,
  images: [{ url: "/sample-chilli.jpg", width: 800, height: 600 }],
  floorPricePerKg: 12000,
  minIncrementPerKg: 100,
  currentBidPerKg: null,
  displayPricePerKg: 12000,
  totalDisplayCost: 1200000,
  bidCount: 0,
  hasBids: false,
  startsAt: new Date(Date.now() - 10800000).toISOString(),
  endsAt: new Date(Date.now() - 7200000).toISOString(),
  status: ListingStatus.EXPIRED_UNSOLD,
  location: { division: "Rangpur", district: "Bogura" },
  isWatched: true,
};

describe("Watchlist UI & Components (Task 8.7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("WatchlistButton & useWatchlistToggle", () => {
    it("optimistically toggles state and calls POST when saving an unwatched listing", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true, listingId: "list-1", isWatched: true } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const onWatchlistChanged = vi.fn();
      render(
        <WatchlistButton
          listingId="list-1"
          initialIsWatched={false}
          onWatchlistChanged={onWatchlistChanged}
        />,
      );

      const button = screen.getByTestId("watchlist-toggle-list-1");
      expect(button).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(button);

      // Optimistic update
      expect(button).toHaveAttribute("aria-pressed", "true");

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/watchlist",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ listingId: "list-1" }),
          }),
        );
      });

      await waitFor(() => {
        expect(onWatchlistChanged).toHaveBeenCalledWith(true);
      });
    });

    it("optimistically toggles state and calls DELETE when removing a watched listing", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true, listingId: "list-2", isWatched: false } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const onWatchlistChanged = vi.fn();
      render(
        <WatchlistButton
          listingId="list-2"
          initialIsWatched={true}
          onWatchlistChanged={onWatchlistChanged}
        />,
      );

      const button = screen.getByTestId("watchlist-toggle-list-2");
      expect(button).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(button);

      // Optimistic update
      expect(button).toHaveAttribute("aria-pressed", "false");

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/watchlist/list-2",
          expect.objectContaining({ method: "DELETE" }),
        );
      });

      await waitFor(() => {
        expect(onWatchlistChanged).toHaveBeenCalledWith(false);
      });
    });

    it("rolls back optimistic update and displays cap exceeded error message when WATCHLIST_CAP_EXCEEDED is returned", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "WATCHLIST_CAP_EXCEEDED",
            message: "Watchlist limit reached (maximum 50 items)",
          },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <WatchlistButton
          listingId="list-3"
          initialIsWatched={false}
        />,
      );

      const button = screen.getByTestId("watchlist-toggle-list-3");
      expect(button).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(button);

      // Momentary optimistic state
      expect(button).toHaveAttribute("aria-pressed", "true");

      // Rolls back and displays error alert
      await waitFor(() => {
        expect(button).toHaveAttribute("aria-pressed", "false");
        const alert = screen.getByTestId("watchlist-error-message");
        expect(alert).toHaveTextContent(/maximum 50 items/i);
      });
    });

    it("rolls back optimistic update on network error", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network failed"));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <WatchlistButton
          listingId="list-4"
          initialIsWatched={false}
        />,
      );

      const button = screen.getByTestId("watchlist-toggle-list-4");
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-pressed", "false");
      });
    });
  });

  describe("EndedWatchlistCard", () => {
    it("renders sold outcome with final price and remove button", () => {
      const onRemove = vi.fn();
      render(
        <MemoryRouter>
          <EndedWatchlistCard listing={mockSoldListing} onRemove={onRemove} />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("ended-watchlist-card")).toBeInTheDocument();
      expect(screen.getByText(/Onion/i)).toBeInTheDocument();
      expect(screen.getByTestId("ended-status-badge")).toHaveTextContent(/Sold for/i);

      const removeBtn = screen.getByTestId("remove-watchlist-listing-sold-1");
      fireEvent.click(removeBtn);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("renders unsold outcome with appropriate badge", () => {
      render(
        <MemoryRouter>
          <EndedWatchlistCard listing={mockUnsoldListing} />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("ended-status-badge")).toHaveTextContent(
        /Ended without sale/i,
      );
    });
  });

  describe("WatchlistPage", () => {
    it("renders empty state with link to marketplace when watchlist has no items", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ data: [], meta: { total: 0 } }),
        }),
      );

      render(
        <MemoryRouter>
          <CompareTrayProvider>
            <WatchlistPage />
          </CompareTrayProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("watchlist-empty-state")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("heading", { name: /Your watchlist is empty/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("browse-marketplace-link")).toHaveAttribute(
        "href",
        "/buyer/marketplace",
      );
    });

    it("renders active listings and ended listings", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [mockActiveListing, mockSoldListing],
            meta: { total: 2 },
          }),
        }),
      );

      render(
        <MemoryRouter>
          <CompareTrayProvider>
            <WatchlistPage />
          </CompareTrayProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("listing-card-listing-active-1"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("ended-watchlist-card")).toBeInTheDocument();
      });
    });

    it("renders correctly in a 360px mobile viewport", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [mockActiveListing],
            meta: { total: 1 },
          }),
        }),
      );

      const { container } = render(
        <MemoryRouter>
          <CompareTrayProvider>
            <div style={{ width: 360 }}>
              <WatchlistPage />
            </div>
          </CompareTrayProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("listing-card-listing-active-1"),
        ).toBeInTheDocument();
      });

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

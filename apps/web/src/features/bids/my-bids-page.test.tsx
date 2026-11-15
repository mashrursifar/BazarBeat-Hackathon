import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CropGrade,
  type GroupedMyBidsResponse,
  ListingStatus,
  type MyBidsRow,
} from "@bazarbeat/shared";

import "../../lib/i18n.js";
import { bidKeys } from "./api/use-my-bids.js";
import { MyBidsPage } from "./my-bids-page.js";

const sampleWinningBid: MyBidsRow = {
  bidId: "507f1f77bcf86cd799439001",
  listingId: "507f1f77bcf86cd799439002",
  cropId: "507f1f77bcf86cd799439003",
  cropNameEn: "Diamond Potato",
  cropNameBn: "ডায়মন্ড আলু",
  grade: CropGrade.A,
  quantityKg: 500,
  myBidPerKg: 5000,
  myTotalAmount: 2500000,
  currentBidPerKg: 5000,
  currentTotalAmount: 2500000,
  bidCount: 3,
  status: "WINNING",
  listingStatus: ListingStatus.ACTIVE,
  endsAt: "2026-11-20T12:00:00.000Z",
  placedAt: "2026-11-16T08:00:00.000Z",
  thumbnailUrl: "/photos/potato.jpg",
  gapToCurrentPerKg: 0,
  gap: 0,
  orderId: null,
};

const sampleOutbidBid: MyBidsRow = {
  bidId: "507f1f77bcf86cd799439004",
  listingId: "507f1f77bcf86cd799439005",
  cropId: "507f1f77bcf86cd799439006",
  cropNameEn: "Red Tomato",
  cropNameBn: "লাল টমেটো",
  grade: CropGrade.B,
  quantityKg: 300,
  myBidPerKg: 4000,
  myTotalAmount: 1200000,
  currentBidPerKg: 4200,
  currentTotalAmount: 1260000,
  bidCount: 5,
  status: "OUTBID",
  listingStatus: ListingStatus.ACTIVE,
  endsAt: "2026-11-20T15:00:00.000Z",
  placedAt: "2026-11-16T08:30:00.000Z",
  thumbnailUrl: null,
  gapToCurrentPerKg: 200,
  gap: 200,
  orderId: null,
};

const sampleWonBid: MyBidsRow = {
  bidId: "507f1f77bcf86cd799439007",
  listingId: "507f1f77bcf86cd799439008",
  cropId: "507f1f77bcf86cd799439009",
  cropNameEn: "Green Chilli",
  cropNameBn: "কাঁচা মরিচ",
  grade: CropGrade.A,
  quantityKg: 100,
  myBidPerKg: 8000,
  myTotalAmount: 800000,
  currentBidPerKg: 8000,
  currentTotalAmount: 800000,
  bidCount: 4,
  status: "WON",
  listingStatus: ListingStatus.SOLD,
  endsAt: "2026-11-15T12:00:00.000Z",
  placedAt: "2026-11-15T10:00:00.000Z",
  thumbnailUrl: "/photos/chilli.jpg",
  gapToCurrentPerKg: 0,
  gap: 0,
  orderId: "507f1f77bcf86cd799439010",
};

const sampleLostBid: MyBidsRow = {
  bidId: "507f1f77bcf86cd799439011",
  listingId: "507f1f77bcf86cd799439012",
  cropId: "507f1f77bcf86cd799439013",
  cropNameEn: "Onion",
  cropNameBn: "পেঁয়াজ",
  grade: CropGrade.C,
  quantityKg: 1000,
  myBidPerKg: 3500,
  myTotalAmount: 3500000,
  currentBidPerKg: 3800,
  currentTotalAmount: 3800000,
  bidCount: 7,
  status: "LOST",
  listingStatus: ListingStatus.SOLD,
  endsAt: "2026-11-14T12:00:00.000Z",
  placedAt: "2026-11-14T09:00:00.000Z",
  thumbnailUrl: null,
  gapToCurrentPerKg: 300,
  gap: 300,
  orderId: null,
};

const fullGroupedResponse: GroupedMyBidsResponse = {
  data: {
    active: [sampleWinningBid, sampleOutbidBid],
    won: [sampleWonBid],
    lost: [sampleLostBid],
  },
  meta: {
    serverTime: "2026-11-16T10:00:00.000Z",
    total: 4,
  },
};

const emptyGroupedResponse: GroupedMyBidsResponse = {
  data: {
    active: [],
    won: [],
    lost: [],
  },
  meta: {
    serverTime: "2026-11-16T10:00:00.000Z",
    total: 0,
  },
};

const createWrapper = (initialEntries = ["/buyer/my-bids"]): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement;
  queryClient: QueryClient;
} => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/buyer/my-bids" element={children} />
          <Route path="/buyer/marketplace" element={<div>Marketplace Page</div>} />
          <Route path="/buyer/listings/:id" element={<div>Listing Detail Page</div>} />
          <Route path="/buyer/orders" element={<div>Orders Page</div>} />
          <Route path="/buyer/orders/:id" element={<div>Order Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { wrapper, queryClient };
};

describe("MyBidsPage Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeleton while fetching data", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
    );

    const { wrapper } = createWrapper();
    render(<MyBidsPage />, { wrapper });

    expect(screen.getByRole("status")).toHaveAttribute("data-testid", "bids-loading");
    expect(screen.getByRole("tab", { name: /active/i })).toBeInTheDocument();
  });

  it("renders error state when fetch fails, and retries on button click", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(fullGroupedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { wrapper } = createWrapper();
    render(<MyBidsPage />, { wrapper });

    const errorAlert = await screen.findByTestId("bids-error");
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByText(/failed to load your bids/i)).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retryButton);

    expect(await screen.findByTestId("my-bids-list")).toBeInTheDocument();
  });

  describe("Active Tab", () => {
    it("renders empty state when there are no active bids", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(emptyGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      const emptyState = await screen.findByTestId("bids-empty-active");
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText(/no active bids/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /explore marketplace/i })).toBeInTheDocument();
    });

    it("renders active bids with winning badge, prices, countdown, and Raise bid button", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      const list = await screen.findByTestId("my-bids-list");
      expect(list).toBeInTheDocument();

      // Check winning row
      const winningRow = screen.getByTestId(`my-bid-row-${sampleWinningBid.listingId}`);
      expect(winningRow).toBeInTheDocument();
      expect(within(winningRow).getByTestId("bid-status-winning")).toBeInTheDocument();
      expect(within(winningRow).getByText("Winning")).toBeInTheDocument();
      expect(within(winningRow).getByText("Diamond Potato")).toBeInTheDocument();
      expect(within(winningRow).getByTestId("countdown-timer")).toBeInTheDocument();

      const raiseButtons = screen.getAllByTestId("raise-bid-button");
      expect(raiseButtons.length).toBe(2);
      expect(raiseButtons[0]).toHaveAttribute("href", `/buyer/listings/${sampleWinningBid.listingId}`);
    });

    it("renders outbid badge with gap when outbid", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      await screen.findByTestId("my-bids-list");

      const outbidRow = screen.getByTestId(`my-bid-row-${sampleOutbidBid.listingId}`);
      expect(outbidRow).toBeInTheDocument();
      expect(within(outbidRow).getByTestId("bid-status-outbid")).toBeInTheDocument();
      expect(within(outbidRow).getByText("Outbid")).toBeInTheDocument();

      // Check gap calculation
      const gapBadge = within(outbidRow).getByTestId("outbid-gap");
      expect(gapBadge).toBeInTheDocument();
      expect(gapBadge).toHaveTextContent(/Behind by ৳2\.00\/kg/i);
    });
  });

  describe("Won Tab", () => {
    it("renders empty state when there are no won auctions", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(emptyGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper(["/buyer/my-bids?tab=won"]);
      render(<MyBidsPage />, { wrapper });

      const emptyWon = await screen.findByTestId("bids-empty-won");
      expect(emptyWon).toBeInTheDocument();
      expect(screen.getByText(/no won auctions yet/i)).toBeInTheDocument();
    });

    it("renders won rows with won badge, final price, and View order link", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper(["/buyer/my-bids?tab=won"]);
      render(<MyBidsPage />, { wrapper });

      const wonRow = await screen.findByTestId(`my-bid-row-${sampleWonBid.listingId}`);
      expect(wonRow).toBeInTheDocument();
      expect(within(wonRow).getByTestId("bid-status-won")).toBeInTheDocument();
      expect(within(wonRow).getByText("Won")).toBeInTheDocument();
      expect(within(wonRow).getByText("Green Chilli")).toBeInTheDocument();

      const viewOrderLink = within(wonRow).getByTestId("view-order-link");
      expect(viewOrderLink).toBeInTheDocument();
      expect(viewOrderLink).toHaveAttribute("href", `/buyer/orders/${sampleWonBid.orderId}`);
    });
  });

  describe("Lost Tab", () => {
    it("renders empty state when there are no lost bids", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(emptyGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper(["/buyer/my-bids?tab=lost"]);
      render(<MyBidsPage />, { wrapper });

      const emptyLost = await screen.findByTestId("bids-empty-lost");
      expect(emptyLost).toBeInTheDocument();
      expect(screen.getByText(/no lost bids/i)).toBeInTheDocument();
    });

    it("renders lost rows with lost badge and final price", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper(["/buyer/my-bids?tab=lost"]);
      render(<MyBidsPage />, { wrapper });

      const lostRow = await screen.findByTestId(`my-bid-row-${sampleLostBid.listingId}`);
      expect(lostRow).toBeInTheDocument();
      expect(within(lostRow).getByTestId("bid-status-lost")).toBeInTheDocument();
      expect(within(lostRow).getByText("Lost")).toBeInTheDocument();
      expect(within(lostRow).getByText("Onion")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("allows switching between Active, Won, and Lost tabs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      await screen.findByTestId("my-bids-list");

      // Initially active tab
      expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("Diamond Potato")).toBeInTheDocument();

      // Click Won tab
      const wonTab = screen.getByTestId("tab-won");
      await userEvent.click(wonTab);
      expect(wonTab).toHaveAttribute("aria-selected", "true");
      expect(await screen.findByText("Green Chilli")).toBeInTheDocument();
      expect(screen.queryByText("Diamond Potato")).not.toBeInTheDocument();

      // Click Lost tab
      const lostTab = screen.getByTestId("tab-lost");
      await userEvent.click(lostTab);
      expect(lostTab).toHaveAttribute("aria-selected", "true");
      expect(await screen.findByText("Onion")).toBeInTheDocument();
      expect(screen.queryByText("Green Chilli")).not.toBeInTheDocument();
    });
  });

  describe("Polling Behavior", () => {
    it("updates an outbid row after the next poll without a reload", async () => {
      // 1. Initial response: Listing 1 is WINNING
      const initialResponse: GroupedMyBidsResponse = {
        data: {
          active: [sampleWinningBid],
          won: [],
          lost: [],
        },
        meta: {
          serverTime: "2026-11-16T10:00:00.000Z",
          total: 1,
        },
      };

      // 2. Poll response: Listing 1 was outbid!
      const updatedOutbidRow: MyBidsRow = {
        ...sampleWinningBid,
        currentBidPerKg: 5200,
        currentTotalAmount: 2600000,
        bidCount: 4,
        status: "OUTBID",
        gapToCurrentPerKg: 200,
        gap: 200,
      };

      const polledResponse: GroupedMyBidsResponse = {
        data: {
          active: [updatedOutbidRow],
          won: [],
          lost: [],
        },
        meta: {
          serverTime: "2026-11-16T10:00:15.000Z",
          total: 1,
        },
      };

      let fetchCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          fetchCount++;
          const body = fetchCount === 1 ? initialResponse : polledResponse;
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      const { wrapper, queryClient } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      // Check initial state: WINNING badge is present
      const initialRow = await screen.findByTestId(`my-bid-row-${sampleWinningBid.listingId}`);
      expect(within(initialRow).getByTestId("bid-status-winning")).toBeInTheDocument();
      expect(within(initialRow).queryByTestId("outbid-gap")).not.toBeInTheDocument();

      // Trigger the next poll by invalidating / refetching the query
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: bidKeys.mineGrouped });
      });

      // Verification: Without reload, the same row now displays OUTBID badge and gap
      await waitFor(() => {
        const updatedRow = screen.getByTestId(`my-bid-row-${sampleWinningBid.listingId}`);
        expect(within(updatedRow).getByTestId("bid-status-outbid")).toBeInTheDocument();
        expect(within(updatedRow).getByTestId("outbid-gap")).toBeInTheDocument();
        expect(within(updatedRow).getByTestId("outbid-gap")).toHaveTextContent(/Behind by ৳2\.00\/kg/i);
      });
    });

    it("automatically triggers refetch on 15s timer interval", async () => {
      vi.useFakeTimers();

      let fetchCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          fetchCount++;
          return new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      // First fetch triggered on mount
      expect(fetchCount).toBe(1);

      // Advance by 15,000ms (15 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      // Verification: Poll occurred
      expect(fetchCount).toBeGreaterThanOrEqual(2);

      vi.useRealTimers();
    });
  });

  describe("Localization and Mobile layout", () => {
    it("renders Bangla crop names and status texts when language is set to bn", async () => {
      const { i18n } = await import("../../lib/i18n.js");
      await i18n.changeLanguage("bn");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      // In Bangla: Diamond Potato -> ডায়মন্ড আলু
      expect(await screen.findByText("ডায়মন্ড আলু")).toBeInTheDocument();
      // Status badge in Bangla: Winning -> সর্বোচ্চ দরদাতা
      expect(screen.getByTestId("bid-status-winning")).toHaveTextContent("সর্বোচ্চ দরদাতা");

      // Switch back to en
      await i18n.changeLanguage("en");
    });

    it("renders properly formatted cards suited for 360px mobile viewports", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(fullGroupedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createWrapper();
      render(<MyBidsPage />, { wrapper });

      const list = await screen.findByTestId("my-bids-list");
      expect(list).toBeInTheDocument();

      // Check articles have responsive flex wrapping classes
      const rows = screen.getAllByRole("article");
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(row.className).toContain("flex-col");
        expect(row.className).toContain("sm:flex-row");
      }
    });
  });
});

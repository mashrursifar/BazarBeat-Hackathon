import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FarmerListing,
  type FarmerListingResponse,
  ListingStatus,
  type ListingStreamAuctionClosedPatch,
  type ListingStreamAuctionExtendedPatch,
  type ListingStreamBidPlacedPatch,
  ListingStreamEventName,
  type ListingStreamSnapshot,
} from "@bazarbeat/shared";

import * as listingApi from "../listings/api/listing-api.js";
import { listingKeys } from "../listings/api/use-listing-wizard-api.js";
import { getServerOffsetMs, resetServerClock } from "../../lib/server-clock.js";
import { useListingStream } from "./use-listing-stream.js";

// Mock EventSource implementation for Vitest
class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public withCredentials?: boolean;
  public readyState: number = 0; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials;
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

  public simulateOpen(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  public simulateError(): void {
    this.readyState = 2;
    this.onerror?.(new Event("error"));
  }

  public simulateEvent(type: string, data: unknown): void {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });
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

describe("useListingStream hook", () => {
  const listingId = "507f1f77bcf86cd799439011";
  const baseNow = 1_700_000_000_000;
  let queryClient: QueryClient;

  const mockListing: FarmerListing = {
    id: listingId,
    cropId: "507f1f77bcf86cd799439012",
    quantityKg: 500,
    images: [{ url: "/uploads/crop1.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: "A",
      confidence: 0.95,
      classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
      qualityNotes: ["Uniform size"],
      cropMatch: true,
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      assessedAt: new Date(baseNow).toISOString(),
    },
    aiPriceGuidance: {
      lowPerKg: 4000,
      expectedPerKg: 4500,
      highPerKg: 5000,
      trend: "UP",
      confidence: 0.9,
      explanation: ["High seasonal demand"],
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      generatedAt: new Date(baseNow).toISOString(),
      suggestedFloorPerKg: 4200,
    },
    floorPricePerKg: 4200,
    minIncrementPerKg: 100,
    startsAt: new Date(baseNow).toISOString(),
    endsAt: new Date(baseNow + 3600 * 1000).toISOString(),
    originalEndsAt: new Date(baseNow + 3600 * 1000).toISOString(),
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    currentBidPerKg: 4300,
    bidCount: 1,
    createdAt: new Date(baseNow).toISOString(),
  };

  const initialResponse: FarmerListingResponse = {
    data: mockListing,
    meta: { serverTime: new Date(baseNow).toISOString() },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetServerClock();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    queryClient.setQueryData(listingKeys.detail(listingId), initialResponse);
  });

  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }): React.ReactElement =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("connects to SSE endpoint with credentials and transitions to connected on open", () => {
    const { result } = renderHook(() => useListingStream({ listingId }), { wrapper });

    expect(result.current.status).toBe("connecting");
    expect(MockEventSource.instances.length).toBe(1);

    const es = MockEventSource.instances[0]!;
    expect(es.url).toContain(`/listings/${listingId}/stream`);
    expect(es.withCredentials).toBe(true);

    act(() => {
      es.simulateOpen();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isPolling).toBe(false);
  });

  it("merges initial snapshot event into React Query cache and syncs server clock", () => {
    const onSnapshotMock = vi.fn();
    const { result } = renderHook(
      () => useListingStream({ listingId, onSnapshot: onSnapshotMock }),
      { wrapper },
    );

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateOpen();
    });

    const serverTimeStr = new Date(baseNow + 5000).toISOString(); // 5s ahead
    const snapshotPayload: ListingStreamSnapshot = {
      listingId,
      currentPrice: 4600,
      currentBidPerKg: 4600,
      floorPricePerKg: 4200,
      bidCount: 3,
      endTime: new Date(baseNow + 3600 * 1000).toISOString(),
      endsAt: new Date(baseNow + 3600 * 1000).toISOString(),
      status: ListingStatus.ACTIVE,
      serverTime: serverTimeStr,
    };

    act(() => {
      es.simulateEvent(ListingStreamEventName.SNAPSHOT, snapshotPayload);
    });

    expect(result.current.lastEvent).toBe(ListingStreamEventName.SNAPSHOT);
    expect(result.current.lastServerTime).toBe(serverTimeStr);
    expect(onSnapshotMock).toHaveBeenCalledWith(snapshotPayload);

    // Cache updated
    const cached = queryClient.getQueryData<FarmerListingResponse>(
      listingKeys.detail(listingId),
    );
    expect(cached?.data.currentBidPerKg).toBe(4600);
    expect(cached?.data.bidCount).toBe(3);
    expect(cached?.meta.serverTime).toBe(serverTimeStr);

    // Clock offset updated
    expect(getServerOffsetMs()).toBe(5000);
  });

  it("merges bid.placed patch into React Query cache", () => {
    const onBidPlacedMock = vi.fn();
    renderHook(() => useListingStream({ listingId, onBidPlaced: onBidPlacedMock }), {
      wrapper,
    });

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateOpen();
    });

    const bidPlacedPayload: ListingStreamBidPlacedPatch = {
      listingId,
      bidId: "507f1f77bcf86cd799439099",
      bidderLabel: "Buyer #2",
      currentPrice: 4800,
      currentBidPerKg: 4800,
      amountPerKg: 4800,
      totalAmount: 2_400_000,
      bidCount: 4,
      placedAt: new Date(baseNow + 1000).toISOString(),
      serverTime: new Date(baseNow + 1000).toISOString(),
    };

    act(() => {
      es.simulateEvent(ListingStreamEventName.BID_PLACED, bidPlacedPayload);
    });

    expect(onBidPlacedMock).toHaveBeenCalledWith(bidPlacedPayload);

    const cached = queryClient.getQueryData<FarmerListingResponse>(
      listingKeys.detail(listingId),
    );
    expect(cached?.data.currentBidPerKg).toBe(4800);
    expect(cached?.data.bidCount).toBe(4);
  });

  it("merges auction.extended patch into React Query cache", () => {
    const onAuctionExtendedMock = vi.fn();
    renderHook(
      () => useListingStream({ listingId, onAuctionExtended: onAuctionExtendedMock }),
      { wrapper },
    );

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateOpen();
    });

    const newEndsAt = new Date(baseNow + 3600 * 1000 + 120_000).toISOString();
    const extendedPayload: ListingStreamAuctionExtendedPatch = {
      listingId,
      endsAt: newEndsAt,
      endTime: newEndsAt,
      extensionCount: 1,
      extendedAt: new Date(baseNow + 2000).toISOString(),
      serverTime: new Date(baseNow + 2000).toISOString(),
    };

    act(() => {
      es.simulateEvent(ListingStreamEventName.AUCTION_EXTENDED, extendedPayload);
    });

    expect(onAuctionExtendedMock).toHaveBeenCalledWith(extendedPayload);

    const cached = queryClient.getQueryData<FarmerListingResponse>(
      listingKeys.detail(listingId),
    );
    expect(cached?.data.endsAt).toBe(newEndsAt);
    expect(cached?.data.extensionCount).toBe(1);
  });

  it("merges auction.closed patch into React Query cache", () => {
    const onAuctionClosedMock = vi.fn();
    renderHook(
      () => useListingStream({ listingId, onAuctionClosed: onAuctionClosedMock }),
      { wrapper },
    );

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateOpen();
    });

    const closedPayload: ListingStreamAuctionClosedPatch = {
      listingId,
      status: ListingStatus.SOLD,
      closedAt: new Date(baseNow + 3000).toISOString(),
      winningBidId: "507f1f77bcf86cd799439099",
      winningAmountPerKg: 4800,
      totalAmount: 2_400_000,
      serverTime: new Date(baseNow + 3000).toISOString(),
    };

    act(() => {
      es.simulateEvent(ListingStreamEventName.AUCTION_CLOSED, closedPayload);
    });

    expect(onAuctionClosedMock).toHaveBeenCalledWith(closedPayload);

    const cached = queryClient.getQueryData<FarmerListingResponse>(
      listingKeys.detail(listingId),
    );
    expect(cached?.data.status).toBe(ListingStatus.SOLD);
    expect(cached?.data.closedAt).toBe(closedPayload.closedAt);
  });

  it("reconnects with exponential backoff and activates polling fallback on error", async () => {
    const getListingSpy = vi
      .spyOn(listingApi, "getListingById")
      .mockResolvedValue(initialResponse);

    const { result } = renderHook(() => useListingStream({ listingId }), { wrapper });

    const initialEs = MockEventSource.instances[0]!;
    act(() => {
      initialEs.simulateOpen();
    });

    expect(result.current.status).toBe("connected");

    // Connection drops
    act(() => {
      initialEs.simulateError();
    });

    // Reconnecting state + fallback polling starts
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.isPolling).toBe(true);
    expect(result.current.reconnectCount).toBe(1);

    // Initial fallback fetch triggered
    expect(getListingSpy).toHaveBeenCalledTimes(1);

    // Exponential backoff: attempt 1 delay is 1000ms (1000 * 2^0)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second EventSource instance created
    expect(MockEventSource.instances.length).toBe(2);
    const secondEs = MockEventSource.instances[1]!;

    // Second connection also drops -> backoff increases to 2000ms
    act(() => {
      secondEs.simulateError();
    });

    expect(result.current.reconnectCount).toBe(2);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Third EventSource instance created
    expect(MockEventSource.instances.length).toBe(3);
    const thirdEs = MockEventSource.instances[2]!;

    // Third connection succeeds!
    act(() => {
      thirdEs.simulateOpen();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.reconnectCount).toBe(0);
    expect(result.current.isPolling).toBe(false);
  });

  it("polls every 5 seconds when stream is disconnected", async () => {
    const updatedResponse: FarmerListingResponse = {
      data: {
        ...mockListing,
        currentBidPerKg: 5200,
        bidCount: 5,
      },
      meta: { serverTime: new Date(baseNow + 10_000).toISOString() },
    };

    const getListingSpy = vi
      .spyOn(listingApi, "getListingById")
      .mockResolvedValue(updatedResponse);

    renderHook(() => useListingStream({ listingId }), { wrapper });

    const es = MockEventSource.instances[0]!;
    // Stream fails immediately
    act(() => {
      es.simulateError();
    });

    expect(getListingSpy).toHaveBeenCalledTimes(1);

    // Advance 5 seconds (CLIENT_POLLING_FALLBACK_MS)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(getListingSpy).toHaveBeenCalledTimes(2);

    // Verify cache updated from polling fallback
    const cached = queryClient.getQueryData<FarmerListingResponse>(
      listingKeys.detail(listingId),
    );
    expect(cached?.data.currentBidPerKg).toBe(5200);
    expect(cached?.data.bidCount).toBe(5);
  });

  it("cleans up active EventSource and timers on unmount", () => {
    const { unmount } = renderHook(() => useListingStream({ listingId }), { wrapper });

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateOpen();
    });

    unmount();

    expect(es.readyState).toBe(2); // CLOSED
  });
});

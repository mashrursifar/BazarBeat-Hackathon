import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AUCTION_TIMING,
  type BuyerListingDetailResponse,
  type FarmerListingResponse,
  type ListingStreamAuctionClosedPatch,
  type ListingStreamAuctionExtendedPatch,
  type ListingStreamBidPlacedPatch,
  ListingStreamEventName,
  type ListingStreamSnapshot,
  calculateSubtotal,
  listingStreamAuctionClosedPatchSchema,
  listingStreamAuctionExtendedPatchSchema,
  listingStreamBidPlacedPatchSchema,
  listingStreamSnapshotSchema,
} from "@bazarbeat/shared";

import { getListingById } from "../listings/api/listing-api.js";
import { listingKeys } from "../listings/api/use-listing-wizard-api.js";
import { syncServerTime } from "../../lib/server-clock.js";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export type StreamConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "polling"
  | "disconnected";

export interface UseListingStreamOptions {
  listingId: string | null | undefined;
  enabled?: boolean;
  pollingFallbackIntervalMs?: number;
  maxReconnectDelayMs?: number;
  onSnapshot?: (snapshot: ListingStreamSnapshot) => void;
  onBidPlaced?: (patch: ListingStreamBidPlacedPatch) => void;
  onAuctionExtended?: (patch: ListingStreamAuctionExtendedPatch) => void;
  onAuctionClosed?: (patch: ListingStreamAuctionClosedPatch) => void;
  onError?: (error: Event | unknown) => void;
}

export interface UseListingStreamResult {
  status: StreamConnectionStatus;
  isConnected: boolean;
  isPolling: boolean;
  lastEvent: ListingStreamEventName | null;
  lastServerTime: string | null;
  reconnectCount: number;
  reconnect: () => void;
}

/**
 * Manages a real-time Server-Sent Events (SSE) connection to a listing's live stream.
 *
 * Requirements (ARCHITECTURE §5, DESIGN_PATTERNS frontend #4, UI_UX_GUIDELINES §5):
 * 1. SSE with credentials (withCredentials: true).
 * 2. Reconnect with exponential backoff on failure.
 * 3. Fallback polling every 5 seconds (AUCTION_TIMING.CLIENT_POLLING_FALLBACK_MS) when the stream is down.
 * 4. Merges lightweight state patches into React Query cache (listingKeys.detail).
 * 5. Synchronizes server clock offset on every event carrying serverTime.
 * 6. Clean lifecycle teardown (closes EventSource, clears reconnect/polling timers).
 */
export function useListingStream(
  options: UseListingStreamOptions,
): UseListingStreamResult {
  const {
    listingId,
    enabled = true,
    pollingFallbackIntervalMs = AUCTION_TIMING.CLIENT_POLLING_FALLBACK_MS,
    maxReconnectDelayMs = 15_000,
    onSnapshot,
    onBidPlaced,
    onAuctionExtended,
    onAuctionClosed,
    onError,
  } = options;

  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StreamConnectionStatus>("idle");
  const [lastEvent, setLastEvent] = useState<ListingStreamEventName | null>(null);
  const [lastServerTime, setLastServerTime] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Keep latest callbacks in refs to avoid reconnecting on callback identity change
  const callbacksRef = useRef({
    onSnapshot,
    onBidPlaced,
    onAuctionExtended,
    onAuctionClosed,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSnapshot,
      onBidPlaced,
      onAuctionExtended,
      onAuctionClosed,
      onError,
    };
  }, [onSnapshot, onBidPlaced, onAuctionExtended, onAuctionClosed, onError]);

  // Polling fallback fetcher
  const executePollingFetch = useCallback(async (): Promise<void> => {
    if (!listingId || !isMountedRef.current) return;
    try {
      const response = await getListingById(listingId);
      if (!isMountedRef.current) return;

      if (response?.meta?.serverTime) {
        syncServerTime(response.meta.serverTime);
        setLastServerTime(response.meta.serverTime);
      }

      // Update React Query cache
      queryClient.setQueryData<FarmerListingResponse | BuyerListingDetailResponse>(
        listingKeys.detail(listingId),
        response,
      );
    } catch (err: unknown) {
      if (isMountedRef.current) {
        callbacksRef.current.onError?.(err);
      }
    }
  }, [listingId, queryClient]);

  // Starts polling fallback interval if not already running
  const startPollingFallback = useCallback((): void => {
    if (pollingTimerRef.current || !listingId || !isMountedRef.current) return;

    // Trigger one immediate fetch, then run periodically
    void executePollingFetch();
    pollingTimerRef.current = setInterval(() => {
      void executePollingFetch();
    }, pollingFallbackIntervalMs);
  }, [listingId, pollingFallbackIntervalMs, executePollingFetch]);

  // Stops polling fallback interval
  const stopPollingFallback = useCallback((): void => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Cleanup EventSource connection
  const closeEventSource = useCallback((): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Forward state patch into React Query cache
  const mergeSnapshotIntoCache = useCallback(
    (snapshot: ListingStreamSnapshot): void => {
      syncServerTime(snapshot.serverTime);
      setLastServerTime(snapshot.serverTime);

      queryClient.setQueryData<FarmerListingResponse | BuyerListingDetailResponse>(
        listingKeys.detail(snapshot.listingId),
        (old) => {
          if (!old) return old;
          if ("reasons" in old.data) {
            const currentPrice = snapshot.currentBidPerKg ?? snapshot.floorPricePerKg;
            return {
              meta: {
                ...old.meta,
                serverTime: snapshot.serverTime,
              },
              data: {
                ...old.data,
                currentBidPerKg: snapshot.currentBidPerKg,
                bidCount: snapshot.bidCount,
                endsAt: snapshot.endsAt,
                status: snapshot.status,
                displayPricePerKg: currentPrice,
                displayTotalCost: calculateSubtotal(currentPrice, old.data.quantityKg),
              },
            };
          }
          return {
            meta: {
              ...old.meta,
              serverTime: snapshot.serverTime,
            },
            data: {
              ...old.data,
              currentBidPerKg: snapshot.currentBidPerKg ?? undefined,
              bidCount: snapshot.bidCount,
              endsAt: snapshot.endsAt,
              status: snapshot.status,
            },
          };
        },
      );
    },
    [queryClient],
  );

  const mergeBidPlacedIntoCache = useCallback(
    (patch: ListingStreamBidPlacedPatch): void => {
      syncServerTime(patch.serverTime);
      setLastServerTime(patch.serverTime);

      queryClient.setQueryData<FarmerListingResponse | BuyerListingDetailResponse>(
        listingKeys.detail(patch.listingId),
        (old) => {
          if (!old) return old;
          if ("reasons" in old.data) {
            return {
              meta: {
                ...old.meta,
                serverTime: patch.serverTime,
              },
              data: {
                ...old.data,
                currentBidPerKg: patch.currentBidPerKg,
                bidCount: patch.bidCount,
                displayPricePerKg: patch.currentBidPerKg,
                displayTotalCost: calculateSubtotal(patch.currentBidPerKg, old.data.quantityKg),
              },
            };
          }
          return {
            meta: {
              ...old.meta,
              serverTime: patch.serverTime,
            },
            data: {
              ...old.data,
              currentBidPerKg: patch.currentBidPerKg,
              bidCount: patch.bidCount,
            },
          };
        },
      );
    },
    [queryClient],
  );

  const mergeAuctionExtendedIntoCache = useCallback(
    (patch: ListingStreamAuctionExtendedPatch): void => {
      syncServerTime(patch.serverTime);
      setLastServerTime(patch.serverTime);

      queryClient.setQueryData<FarmerListingResponse | BuyerListingDetailResponse>(
        listingKeys.detail(patch.listingId),
        (old) => {
          if (!old) return old;
          if ("reasons" in old.data) {
            return {
              meta: {
                ...old.meta,
                serverTime: patch.serverTime,
              },
              data: {
                ...old.data,
                endsAt: patch.endsAt,
                extensionCount: patch.extensionCount,
              },
            };
          }
          return {
            meta: {
              ...old.meta,
              serverTime: patch.serverTime,
            },
            data: {
              ...old.data,
              endsAt: patch.endsAt,
              extensionCount: patch.extensionCount,
            },
          };
        },
      );
    },
    [queryClient],
  );

  const mergeAuctionClosedIntoCache = useCallback(
    (patch: ListingStreamAuctionClosedPatch): void => {
      syncServerTime(patch.serverTime);
      setLastServerTime(patch.serverTime);

      queryClient.setQueryData<FarmerListingResponse | BuyerListingDetailResponse>(
        listingKeys.detail(patch.listingId),
        (old) => {
          if (!old) return old;
          if ("reasons" in old.data) {
            return {
              meta: {
                ...old.meta,
                serverTime: patch.serverTime,
              },
              data: {
                ...old.data,
                status: patch.status,
                closedAt: patch.closedAt,
              },
            };
          }
          return {
            meta: {
              ...old.meta,
              serverTime: patch.serverTime,
            },
            data: {
              ...old.data,
              status: patch.status,
              closedAt: patch.closedAt,
            },
          };
        },
      );
    },
    [queryClient],
  );

  // Connects to SSE
  const connect = useCallback((): void => {
    if (!enabled || !listingId || !isMountedRef.current) return;

    closeEventSource();

    if (typeof EventSource === "undefined") {
      // Environment without SSE: rely on polling fallback
      setStatus("polling");
      startPollingFallback();
      return;
    }

    setStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

    const streamUrl = `${API_BASE_URL}/listings/${encodeURIComponent(listingId)}/stream`;
    const es = new EventSource(streamUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = (): void => {
      if (!isMountedRef.current) return;
      reconnectAttemptRef.current = 0;
      setReconnectCount(0);
      setStatus("connected");
      stopPollingFallback();
    };

    es.addEventListener(ListingStreamEventName.SNAPSHOT, (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const snapshot = listingStreamSnapshotSchema.parse(raw);
        setLastEvent(ListingStreamEventName.SNAPSHOT);
        mergeSnapshotIntoCache(snapshot);
        callbacksRef.current.onSnapshot?.(snapshot);
      } catch (err: unknown) {
        callbacksRef.current.onError?.(err);
      }
    });

    es.addEventListener(ListingStreamEventName.BID_PLACED, (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const patch = listingStreamBidPlacedPatchSchema.parse(raw);
        setLastEvent(ListingStreamEventName.BID_PLACED);
        mergeBidPlacedIntoCache(patch);
        callbacksRef.current.onBidPlaced?.(patch);
      } catch (err: unknown) {
        callbacksRef.current.onError?.(err);
      }
    });

    es.addEventListener(ListingStreamEventName.AUCTION_EXTENDED, (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const patch = listingStreamAuctionExtendedPatchSchema.parse(raw);
        setLastEvent(ListingStreamEventName.AUCTION_EXTENDED);
        mergeAuctionExtendedIntoCache(patch);
        callbacksRef.current.onAuctionExtended?.(patch);
      } catch (err: unknown) {
        callbacksRef.current.onError?.(err);
      }
    });

    es.addEventListener(ListingStreamEventName.AUCTION_CLOSED, (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const patch = listingStreamAuctionClosedPatchSchema.parse(raw);
        setLastEvent(ListingStreamEventName.AUCTION_CLOSED);
        mergeAuctionClosedIntoCache(patch);
        callbacksRef.current.onAuctionClosed?.(patch);
      } catch (err: unknown) {
        callbacksRef.current.onError?.(err);
      }
    });

    es.onerror = (err: Event): void => {
      if (!isMountedRef.current) return;
      callbacksRef.current.onError?.(err);

      // Close current broken stream
      closeEventSource();

      // Initiate polling fallback immediately while stream is broken
      setStatus("reconnecting");
      startPollingFallback();

      // Schedule reconnection with exponential backoff
      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;
      setReconnectCount(attempt);

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), maxReconnectDelayMs);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [
    enabled,
    listingId,
    closeEventSource,
    startPollingFallback,
    stopPollingFallback,
    maxReconnectDelayMs,
    mergeSnapshotIntoCache,
    mergeBidPlacedIntoCache,
    mergeAuctionExtendedIntoCache,
    mergeAuctionClosedIntoCache,
  ]);

  // Main lifecycle effect
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && listingId) {
      connect();
    } else {
      setStatus("idle");
      closeEventSource();
      stopPollingFallback();
    }

    return (): void => {
      isMountedRef.current = false;
      closeEventSource();
      stopPollingFallback();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [enabled, listingId, connect, closeEventSource, stopPollingFallback]);

  const manualReconnect = useCallback((): void => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return {
    status,
    isConnected: status === "connected",
    isPolling: status === "polling" || (status === "reconnecting" && !!pollingTimerRef.current),
    lastEvent,
    lastServerTime,
    reconnectCount,
    reconnect: manualReconnect,
  };
}

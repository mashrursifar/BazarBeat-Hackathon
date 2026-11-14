import { useSyncExternalStore } from "react";

type Listener = () => void;

let serverOffsetMs = 0;
let lastSyncedServerTime: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Returns current calculated offset between server clock and client clock in milliseconds.
 * (serverOffsetMs = serverTime - localClientTime)
 */
export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

/**
 * Returns the estimated current timestamp (in milliseconds) according to the server's clock.
 * AUCTION_RULES §1: The server is the only authority on time.
 */
export function getServerNow(): number {
  return Date.now() + serverOffsetMs;
}

/**
 * Returns the most recent serverTime string synced from the server, if any.
 */
export function getLastSyncedServerTime(): string | null {
  return lastSyncedServerTime;
}

/**
 * Updates the server clock offset using an authoritative serverTime value.
 * Accepts ISO string, Date object, or numeric epoch timestamp.
 */
export function syncServerTime(serverTime: string | Date | number): number {
  let serverTimestamp: number;

  if (typeof serverTime === "number") {
    serverTimestamp = serverTime;
  } else if (typeof serverTime === "string") {
    serverTimestamp = Date.parse(serverTime);
  } else {
    serverTimestamp = serverTime.getTime();
  }

  if (Number.isFinite(serverTimestamp)) {
    serverOffsetMs = serverTimestamp - Date.now();
    lastSyncedServerTime = new Date(serverTimestamp).toISOString();
    notify();
  }

  return serverOffsetMs;
}

/**
 * Resets the server clock offset to 0. Intended primarily for testing teardown.
 */
export function resetServerClock(): void {
  serverOffsetMs = 0;
  lastSyncedServerTime = null;
  notify();
}

/**
 * Subscribes to changes in server clock offset.
 */
export function subscribeServerClock(listener: Listener): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/**
 * React hook returning the current server clock offset in milliseconds.
 * Re-renders automatically when a new serverTime is synchronized.
 */
export function useServerClockOffset(): number {
  return useSyncExternalStore(subscribeServerClock, getServerOffsetMs, () => 0);
}

export interface UseServerClockResult {
  serverOffsetMs: number;
  getServerNow: () => number;
  syncServerTime: (serverTime: string | Date | number) => number;
  lastSyncedServerTime: string | null;
}

/**
 * React hook providing the current clock offset, server now calculator, and sync function.
 */
export function useServerClock(): UseServerClockResult {
  const offset = useServerClockOffset();

  return {
    serverOffsetMs: offset,
    getServerNow,
    syncServerTime,
    lastSyncedServerTime,
  };
}

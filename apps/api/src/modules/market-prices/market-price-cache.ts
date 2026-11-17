import { getClock } from "../../shared/clock.js";

export const MARKET_PRICE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MarketPriceCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs = MARKET_PRICE_CACHE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  public buildKey(
    cropId: string,
    division: string | undefined,
    dateKey: string,
    suffix?: string,
  ): string {
    const normalizedDivision = division ? division.toLowerCase().trim() : "national";
    return `${cropId}:${normalizedDivision}:${dateKey}${suffix ? `:${suffix}` : ""}`;
  }

  public get<T>(key: string, nowMs?: number): T | undefined {
    const currentMs = nowMs ?? getClock().now().getTime();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= currentMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  public set<T>(key: string, data: T, nowMs?: number, ttlMs?: number): void {
    const currentMs = nowMs ?? getClock().now().getTime();
    const validFor = ttlMs ?? this.ttlMs;
    this.store.set(key, {
      data,
      expiresAt: currentMs + validFor,
    });
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}

export const marketPriceCache = new MarketPriceCache();
export function getMarketPriceCache(): MarketPriceCache {
  return marketPriceCache;
}

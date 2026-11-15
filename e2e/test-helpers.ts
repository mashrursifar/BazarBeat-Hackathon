import type { Page } from "@playwright/test";

export interface PlaceBidOptions {
  listingId: string;
  amountPerKg: number;
  isLateBid?: boolean;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

/**
 * Stable test helper for placing buyer bids through the API.
 * Submits POST /api/v1/listings/:id/bids with custom CSRF protection header,
 * and triggers deterministic real-time SSE stream events in the browser context.
 */
export async function placeBidViaApi(
  page: Page,
  options: PlaceBidOptions,
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ listingId, amountPerKg, isLateBid }) => {
      const response = await fetch(`/api/v1/listings/${listingId}/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify({ amountPerKg, isLateBid }),
      });
      const data = await response.json().catch(() => null);

      // Dispatch SSE events to any open MockEventSource listeners
      const win = window as unknown as {
        __dispatchMockSse?: (id: string, ev: string, payload: unknown) => void;
      };
      if (response.ok && win.__dispatchMockSse && data?.data) {
        if (data.data.extended) {
          win.__dispatchMockSse(listingId, "auction.extended", data.data.extended);
        }
        if (data.data.patch) {
          win.__dispatchMockSse(listingId, "bid.placed", data.data.patch);
        }
      }

      return { status: response.status, body: data };
    },
    options,
  );
}

/**
 * Stable test helper for cancelling a listing through the API.
 * Submits POST /api/v1/listings/:id/cancel with custom CSRF protection header.
 */
export async function cancelListingViaApi(
  page: Page,
  listingId: string,
): Promise<ApiResponse> {
  return await page.evaluate(
    async (id) => {
      const response = await fetch(`/api/v1/listings/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    listingId,
  );
}

/**
 * Stable test helper for simulating auction closing in tests.
 * Transitions status to SOLD or EXPIRED_UNSOLD and dispatches real-time SSE event.
 */
export async function closeAuctionViaMock(
  page: Page,
  options: {
    listingId: string;
    status: "SOLD" | "EXPIRED_UNSOLD";
  },
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ listingId, status }) => {
      const response = await fetch(`/api/v1/listings/${listingId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);

      const win = window as unknown as {
        __dispatchMockSse?: (id: string, ev: string, payload: unknown) => void;
      };
      if (response.ok && win.__dispatchMockSse && data?.data?.patch) {
        win.__dispatchMockSse(listingId, "auction.closed", data.data.patch);
      }

      return { status: response.status, body: data };
    },
    options,
  );
}

export {
  DEV_SEED_CREDENTIALS,
  SEED_BUYER_DEFINITIONS,
  SEED_FARMER_DEFINITIONS,
  LISTING_SEED_PLAN,
  seedDevListings,
  verifyFarmerCropLedger,
  type SeedDevListingsOptions,
  type SeedDevListingsResult,
  type UserSeedDefinition,
} from "../apps/api/src/seed/dev-listings.js";


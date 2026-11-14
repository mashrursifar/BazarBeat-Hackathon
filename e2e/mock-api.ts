import type { Page, Route } from "@playwright/test";
import type { FarmerListing } from "@bazarbeat/shared";

export const CROP_BITTER_GOURD_ID = "507f191e810c19729de86001";
export const CROP_POTATO_ID = "507f191e810c19729de86002";
export const CROP_ONION_ID = "507f191e810c19729de86003";

export interface MockBid {
  id: string;
  listingId: string;
  buyerId: string;
  amountPerKg: number;
  totalAmount: number;
  seq: number;
  status: string;
  placedAt: string;
  bidderLabel?: string;
}

export interface MockState {
  authenticated: boolean;
  inventory: Array<{
    crop: {
      id: string;
      slug: string;
      nameEn: string;
      nameBn: string;
      unit: "KG";
      minLotKg: number;
      maxLotKg: number;
      shelfLifeHours: number;
      gradeGuide: { A: string; B: string; C: string };
      minIncrementPerKg: number;
      imageUrl: string;
    };
    availableKg: number;
    listedKg: number;
    soldKg: number;
  }>;
  listings: FarmerListing[];
  bids: MockBid[];
}

export interface SetupMockApiOptions {
  initialAuthenticated?: boolean;
  initialAvailableKg?: number;
  initialListings?: FarmerListing[];
  initialBids?: MockBid[];
}

export async function setupMockApi(
  page: Page,
  options?: SetupMockApiOptions,
): Promise<MockState> {
  const bitterGourdCrop = {
    id: CROP_BITTER_GOURD_ID,
    slug: "bitter-gourd",
    nameEn: "Bitter Gourd",
    nameBn: "করলা",
    unit: "KG" as const,
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Firm ridges", B: "Minor marks", C: "Slight yellowing" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const potatoCrop = {
    id: CROP_POTATO_ID,
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG" as const,
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 720,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Firm tubers", B: "Minor scuffs", C: "Uneven" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const onionCrop = {
    id: CROP_ONION_ID,
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG" as const,
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 720,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Dry bulbs", B: "Minor marks", C: "Small" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const crops = [bitterGourdCrop, potatoCrop, onionCrop];

  const state: MockState = {
    authenticated: options?.initialAuthenticated ?? true,
    inventory: [
      {
        crop: bitterGourdCrop,
        availableKg: options?.initialAvailableKg ?? 200,
        listedKg: 0,
        soldKg: 0,
      },
      {
        crop: potatoCrop,
        availableKg: 500,
        listedKg: 0,
        soldKg: 0,
      },
    ],
    listings: options?.initialListings ? [...options.initialListings] : [],
    bids: options?.initialBids ? [...options.initialBids] : [],
  };

  // Adjust inventory if initialListings were provided
  if (options?.initialListings) {
    for (const listing of options.initialListings) {
      const inv = state.inventory.find((i) => i.crop.id === listing.cropId);
      if (inv) {
        if (listing.status === "ACTIVE") {
          inv.availableKg = Math.max(0, inv.availableKg - listing.quantityKg);
          inv.listedKg += listing.quantityKg;
        } else if (listing.status === "SOLD") {
          inv.availableKg = Math.max(0, inv.availableKg - listing.quantityKg);
          inv.soldKg += listing.quantityKg;
        }
      }
    }
  }

  const farmerUser = {
    id: "farmer-user-1",
    role: "FARMER",
    name: "Rahim Farmer",
    division: "dhaka",
    district: "dhaka",
    upazila: "Savar",
    language: "en",
  };

  // Inject in-memory MockEventSource for deterministic SSE delivery
  await page.addInitScript(() => {
    class MockEventSource extends EventTarget {
      url: string;
      withCredentials?: boolean;
      readyState: number = 0; // CONNECTING
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string, init?: EventSourceInit) {
        super();
        this.url = url;
        this.withCredentials = init?.withCredentials;
        if (!(window as unknown as { __mockEventSources?: MockEventSource[] }).__mockEventSources) {
          (window as unknown as { __mockEventSources: MockEventSource[] }).__mockEventSources = [];
        }
        (window as unknown as { __mockEventSources: MockEventSource[] }).__mockEventSources.push(this);

        setTimeout(() => {
          this.readyState = 1; // OPEN
          const ev = new Event("open");
          this.onopen?.(ev);
          this.dispatchEvent(ev);
        }, 20);
      }

      close(): void {
        this.readyState = 2; // CLOSED
        const win = window as unknown as { __mockEventSources?: MockEventSource[] };
        const sources = win.__mockEventSources || [];
        const idx = sources.indexOf(this);
        if (idx !== -1) sources.splice(idx, 1);
      }
    }

    (window as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;

    (window as unknown as {
      __dispatchMockSse?: (listingId: string, eventName: string, payload: unknown) => void;
    }).__dispatchMockSse = (
      listingId: string,
      eventName: string,
      payload: unknown,
    ): void => {
      const win = window as unknown as { __mockEventSources?: MockEventSource[] };
      const sources = win.__mockEventSources || [];
      for (const es of sources) {
        if (es.url && es.url.includes(`/listings/${listingId}/stream`)) {
          const msgEvent = new MessageEvent(eventName, {
            data: JSON.stringify(payload),
          });
          es.dispatchEvent(msgEvent);
          if (eventName === "message" && es.onmessage) {
            es.onmessage(msgEvent);
          }
        }
      }
    };
  });

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    // 1. Auth routes
    if (path === "/api/v1/me") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAUTHENTICATED", message: "Not logged in" },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: farmerUser }),
      });
    }

    if (path === "/api/v1/auth/login" && method === "POST") {
      state.authenticated = true;
      return route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": "bazarbeat-session=1; Path=/; SameSite=Lax; Max-Age=604800",
        },
        contentType: "application/json",
        body: JSON.stringify({ data: farmerUser }),
      });
    }

    if (path === "/api/v1/auth/logout") {
      state.authenticated = false;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }

    // 2. Config route
    if (path === "/api/v1/config") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            demoMode: true,
            durationPresets: {
              "1h": 60,
              "3h": 180,
              "6h": 360,
              "12h": 720,
              "24h": 1440,
            },
            platformFeeBps: 200,
          },
        }),
      });
    }

    // 3. Crops route
    if (path === "/api/v1/crops") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: crops }),
      });
    }

    // 4. Inventory movements
    if (path.startsWith("/api/v1/inventory/movements")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { page: 1, limit: 10, total: 0 },
        }),
      });
    }

    // 5. Add stock
    if (path === "/api/v1/inventory/add" && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      let item = state.inventory.find((inv) => inv.crop.id === body.cropId);
      if (!item) {
        const crop = crops.find((c) => c.id === body.cropId) ?? crops[0];
        item = {
          crop,
          availableKg: 0,
          listedKg: 0,
          soldKg: 0,
        };
        state.inventory.push(item);
      }
      item.availableKg += Number(body.quantityKg);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: item }),
      });
    }

    // 6. Inventory list
    if (path === "/api/v1/inventory" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: state.inventory }),
      });
    }

    // 7. AI Assess Quality
    if (path === "/api/v1/ai/assess-quality" && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            grade: "A",
            confidence: 0.95,
            confidenceBand: "HIGH",
            classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
            qualityNotes: [
              "Uniform deep green color across the sample",
              "Optimal ribbing structure and firm texture",
              "No visible mechanical injury, blemishes, or pest damage",
            ],
            cropMatch: true,
            modelVersion: "mock-v1",
            provider: "mock",
            degraded: false,
            assessedAt: new Date().toISOString(),
            assessmentToken: "mock-token-grade-a-" + Date.now(),
          },
        }),
      });
    }

    // 8. AI Predict Price
    if (path === "/api/v1/ai/predict-price" && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            lowPerKg: 3800,
            expectedPerKg: 4600,
            highPerKg: 5200,
            trend: "UP",
            confidence: 0.88,
            explanation: [
              "Historical wholesale benchmark at Dhaka Division",
              "Grade A quality premium applied (+15%)",
              "Market arrivals down 8% this week across regional hubs",
            ],
            modelVersion: "mock-v1",
            provider: "mock",
            degraded: false,
            generatedAt: new Date().toISOString(),
            suggestedFloorPerKg: 4200,
          },
        }),
      });
    }

    // 9. Listings creation
    if (path === "/api/v1/listings" && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      const crop = crops.find((c) => c.id === body.cropId) ?? crops[0];

      // Update inventory stock atomically
      const inventoryItem = state.inventory.find((inv) => inv.crop.id === crop.id);
      if (inventoryItem) {
        inventoryItem.availableKg = Math.max(0, inventoryItem.availableKg - body.quantityKg);
        inventoryItem.listedKg += body.quantityKg;
      }

      const durationMinutes = body.durationMinutes ?? 120;
      const now = new Date();
      const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const listingId = `507f191e810c19729de8${String(state.listings.length + 1).padStart(4, "0")}`;

      const listing: FarmerListing = {
        id: listingId,
        cropId: crop.id,
        quantityKg: body.quantityKg,
        images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
        aiAssessment: {
          grade: "A",
          confidence: 0.95,
          confidenceBand: "HIGH",
          classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
          qualityNotes: [
            "Uniform deep green color across the sample",
            "Optimal ribbing structure and firm texture",
          ],
          cropMatch: true,
          modelVersion: "mock-v1",
          provider: "mock",
          degraded: false,
          assessedAt: now.toISOString(),
        },
        aiPriceGuidance: {
          lowPerKg: 3800,
          expectedPerKg: 4600,
          highPerKg: 5200,
          trend: "UP",
          confidence: 0.88,
          explanation: ["Historical wholesale benchmark"],
          modelVersion: "mock-v1",
          provider: "mock",
          degraded: false,
          generatedAt: now.toISOString(),
          suggestedFloorPerKg: 4200,
        },
        floorPricePerKg: body.floorPricePerKg,
        minIncrementPerKg: 100,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        originalEndsAt: endsAt.toISOString(),
        extensionCount: 0,
        status: "ACTIVE",
        bidCount: 0,
        location: {
          division: "dhaka",
          district: "dhaka",
          upazila: "Savar",
        },
        pickupNote: body.pickupNote,
        createdAt: now.toISOString(),
      };

      state.listings.unshift(listing);

      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: listing,
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 10. My Listings
    if (path.startsWith("/api/v1/listings/mine")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: state.listings,
          meta: {
            serverTime: new Date().toISOString(),
            page: 1,
            limit: 20,
            total: state.listings.length,
          },
        }),
      });
    }

    // 11. SSE Stream fallback/handshake
    if (path.match(/\/api\/v1\/listings\/[^/]+\/stream$/) && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: ": heartbeat\n\n",
      });
    }

    // 12. Submit Bid (POST /api/v1/listings/:id/bids)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/bids$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Listing not found" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const amountPerKg = Number(body.amountPerKg);
      const minRequired = listing.currentBidPerKg
        ? listing.currentBidPerKg + (listing.minIncrementPerKg || 100)
        : listing.floorPricePerKg;

      if (amountPerKg < minRequired) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "BID_TOO_LOW",
              message: `Bid must be at least ${minRequired} poisha`,
            },
          }),
        });
      }

      const now = new Date();
      const bidId = `507f191e810c19729de8b${String(state.bids.length + 1).padStart(3, "0")}`;
      const bidSeq = (listing.bidCount || 0) + 1;
      const bid: MockBid = {
        id: bidId,
        listingId: listing.id,
        buyerId: "buyer-user-1",
        bidderLabel: `Buyer #${bidSeq}`,
        amountPerKg,
        totalAmount: amountPerKg * listing.quantityKg,
        seq: bidSeq,
        status: "ACCEPTED",
        placedAt: now.toISOString(),
      };
      state.bids.push(bid);

      listing.bidCount = bidSeq;
      listing.currentBidPerKg = amountPerKg;

      let extendedPatch = undefined;
      if (body.isLateBid) {
        listing.extensionCount = (listing.extensionCount || 0) + 1;
        const newEndsAt = new Date(now.getTime() + 120_000);
        listing.endsAt = newEndsAt.toISOString();
        extendedPatch = {
          listingId: listing.id,
          endsAt: listing.endsAt,
          endTime: listing.endsAt,
          extensionCount: listing.extensionCount,
          extendedAt: now.toISOString(),
          serverTime: now.toISOString(),
        };
      }

      const bidPlacedPatch = {
        listingId: listing.id,
        bidId,
        bidderLabel: `Buyer #${bidSeq}`,
        currentPrice: amountPerKg,
        currentBidPerKg: amountPerKg,
        amountPerKg,
        totalAmount: amountPerKg * listing.quantityKg,
        bidCount: bidSeq,
        placedAt: now.toISOString(),
        serverTime: now.toISOString(),
      };

      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            bid,
            patch: bidPlacedPatch,
            extended: extendedPatch,
          },
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 13. Get Bids (GET /api/v1/listings/:id/bids)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/bids$/) && method === "GET") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listingBids = state.bids
        .filter((b) => b.listingId === listingId)
        .map((b) => ({
          id: b.id,
          listingId: b.listingId,
          bidderLabel: b.bidderLabel || `Buyer #${b.seq}`,
          amountPerKg: b.amountPerKg,
          totalAmount: b.totalAmount,
          seq: b.seq,
          status: b.status,
          placedAt: b.placedAt,
        }))
        .reverse();

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: listingBids,
          meta: {
            serverTime: new Date().toISOString(),
            total: listingBids.length,
          },
        }),
      });
    }

    // 14. Cancel Listing (POST /api/v1/listings/:id/cancel)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/cancel$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Listing not found" } }),
        });
      }

      if (listing.bidCount > 0) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "HAS_BIDS",
              message: "Cannot cancel listing with existing bids",
            },
          }),
        });
      }

      listing.status = "CANCELLED";
      listing.closedAt = new Date().toISOString();

      // Restore inventory
      const item = state.inventory.find((inv) => inv.crop.id === listing.cropId);
      if (item) {
        item.availableKg += listing.quantityKg;
        item.listedKg = Math.max(0, item.listedKg - listing.quantityKg);
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: listing,
          meta: { serverTime: new Date().toISOString() },
        }),
      });
    }

    // 15. Relist Listing (POST /api/v1/listings/:id/relist)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/relist$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const oldListing = state.listings.find((l) => l.id === listingId);
      if (!oldListing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Listing not found" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const now = new Date();
      const durationMinutes = body.durationMinutes ?? 120;
      const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const newId = `507f191e810c19729de8${String(state.listings.length + 1).padStart(4, "0")}`;
      const newListing: FarmerListing = {
        id: newId,
        cropId: oldListing.cropId,
        quantityKg: oldListing.quantityKg,
        images: oldListing.images,
        aiAssessment: oldListing.aiAssessment,
        aiPriceGuidance: oldListing.aiPriceGuidance,
        floorPricePerKg: body.floorPricePerKg ?? oldListing.floorPricePerKg,
        minIncrementPerKg: oldListing.minIncrementPerKg || 100,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        originalEndsAt: endsAt.toISOString(),
        extensionCount: 0,
        status: "ACTIVE",
        bidCount: 0,
        currentBidPerKg: undefined,
        location: oldListing.location,
        pickupNote: body.pickupNote ?? oldListing.pickupNote,
        closedAt: undefined,
        relistedFromId: oldListing.id,
        createdAt: now.toISOString(),
      };

      // Deduct inventory stock for new active listing
      const item = state.inventory.find((inv) => inv.crop.id === newListing.cropId);
      if (item) {
        item.availableKg = Math.max(0, item.availableKg - newListing.quantityKg);
        item.listedKg += newListing.quantityKg;
      }

      state.listings.unshift(newListing);

      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: newListing,
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 16. Accept Current Bid (POST /api/v1/listings/:id/accept-current-bid)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/accept-current-bid$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Listing not found" } }),
        });
      }

      const now = new Date();
      listing.status = "SOLD";
      listing.closedAt = now.toISOString();

      const item = state.inventory.find((inv) => inv.crop.id === listing.cropId);
      if (item) {
        item.listedKg = Math.max(0, item.listedKg - listing.quantityKg);
        item.soldKg += listing.quantityKg;
      }

      const closedPatch = {
        listingId: listing.id,
        status: "SOLD" as const,
        closedAt: now.toISOString(),
        winningAmountPerKg: listing.currentBidPerKg,
        totalAmount: listing.currentBidPerKg ? listing.currentBidPerKg * listing.quantityKg : undefined,
        serverTime: now.toISOString(),
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            listing,
            patch: closedPatch,
          },
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 17. Close Auction simulation (POST /api/v1/listings/:id/close)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/close$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Listing not found" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const targetStatus = body.status as "SOLD" | "EXPIRED_UNSOLD";
      const now = new Date();
      listing.status = targetStatus;
      listing.closedAt = now.toISOString();

      const item = state.inventory.find((inv) => inv.crop.id === listing.cropId);
      if (item) {
        if (targetStatus === "SOLD") {
          item.listedKg = Math.max(0, item.listedKg - listing.quantityKg);
          item.soldKg += listing.quantityKg;
        } else if (targetStatus === "EXPIRED_UNSOLD") {
          item.listedKg = Math.max(0, item.listedKg - listing.quantityKg);
          item.availableKg += listing.quantityKg;
        }
      }

      const closedPatch = {
        listingId: listing.id,
        status: targetStatus,
        closedAt: now.toISOString(),
        winningAmountPerKg: listing.currentBidPerKg,
        totalAmount: listing.currentBidPerKg ? listing.currentBidPerKg * listing.quantityKg : undefined,
        serverTime: now.toISOString(),
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            listing,
            patch: closedPatch,
          },
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 18. Listing by ID (GET /api/v1/listings/:id)
    if (path.startsWith("/api/v1/listings/") && method === "GET") {
      const id = path.replace("/api/v1/listings/", "");
      const listing = state.listings.find((l) => l.id === id) ?? state.listings[0];
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: listing,
          meta: { serverTime: new Date().toISOString() },
        }),
      });
    }

    // Fallback pass-through for anything else
    return route.continue();
  });

  return state;
}

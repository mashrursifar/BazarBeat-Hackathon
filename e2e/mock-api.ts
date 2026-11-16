import type { Page, Route } from "@playwright/test";
import {
  CropGrade,
  type FarmerListing,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

import {
  DEV_SEED_CREDENTIALS,
  LISTING_SEED_PLAN,
  SEED_BUYER_DEFINITIONS,
  SEED_FARMER_DEFINITIONS,
} from "../apps/api/src/seed/dev-listings.js";

export const CROP_BITTER_GOURD_ID = "507f191e810c19729de86001";
export const CROP_POTATO_ID = "507f191e810c19729de86002";
export const CROP_ONION_ID = "507f191e810c19729de86003";
export const CROP_GREEN_CHILLI_ID = "507f191e810c19729de86004";
export const CROP_EGGPLANT_ID = "507f191e810c19729de86005";

export interface MockCrop {
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
}

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
  currentUser: PublicUser;
  inventory: Array<{
    crop: MockCrop;
    availableKg: number;
    listedKg: number;
    soldKg: number;
  }>;
  listings: FarmerListing[];
  bids: MockBid[];
  registeredPages: Page[];
  dispatchSse: (listingId: string, eventName: string, payload: unknown) => Promise<void>;
}

export interface SetupMockApiOptions {
  initialAuthenticated?: boolean;
  initialRole?: "FARMER" | "BUYER" | "BUYER_TWO";
  initialAvailableKg?: number;
  initialListings?: FarmerListing[];
  initialBids?: MockBid[];
  sharedState?: MockState;
}

export async function setupMockApi(
  page: Page,
  options?: SetupMockApiOptions,
): Promise<MockState> {
  const bitterGourdCrop: MockCrop = {
    id: CROP_BITTER_GOURD_ID,
    slug: "bitter-gourd",
    nameEn: "Bitter Gourd",
    nameBn: "করলা",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Firm ridges", B: "Minor marks", C: "Slight yellowing" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const potatoCrop: MockCrop = {
    id: CROP_POTATO_ID,
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 720,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Firm tubers", B: "Minor scuffs", C: "Uneven" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const onionCrop: MockCrop = {
    id: CROP_ONION_ID,
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 720,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Dry bulbs", B: "Minor marks", C: "Small" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const greenChilliCrop: MockCrop = {
    id: CROP_GREEN_CHILLI_ID,
    slug: "green-chilli",
    nameEn: "Green Chilli",
    nameBn: "কাঁচা মরিচ",
    unit: "KG",
    minLotKg: 5,
    maxLotKg: 500,
    shelfLifeHours: 72,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Fresh green pods", B: "Minor bends", C: "Mixed sizes" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const eggplantCrop: MockCrop = {
    id: CROP_EGGPLANT_ID,
    slug: "eggplant",
    nameEn: "Eggplant",
    nameBn: "বেগুন",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1000,
    shelfLifeHours: 120,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Glossy firm caps", B: "Minor marks", C: "Uneven sizes" },
    imageUrl: "/images/crops/placeholder.svg",
  };

  const crops: MockCrop[] = [
    bitterGourdCrop,
    potatoCrop,
    onionCrop,
    greenChilliCrop,
    eggplantCrop,
  ];

  const farmerUser: PublicUser = {
    id: "farmer-user-1",
    role: UserRole.FARMER,
    name: DEV_SEED_CREDENTIALS.farmer.name,
    division: DEV_SEED_CREDENTIALS.farmer.division,
    district: DEV_SEED_CREDENTIALS.farmer.district,
    upazila: DEV_SEED_CREDENTIALS.farmer.upazila,
    language: "en",
  };

  const buyerUser: PublicUser = {
    id: "buyer-user-1",
    role: UserRole.BUYER,
    name: DEV_SEED_CREDENTIALS.buyer.name,
    division: DEV_SEED_CREDENTIALS.buyer.division,
    district: DEV_SEED_CREDENTIALS.buyer.district,
    upazila: DEV_SEED_CREDENTIALS.buyer.upazila,
    organization: DEV_SEED_CREDENTIALS.buyer.organization,
    language: "en",
  };

  const buyerTwoUser: PublicUser = {
    id: "buyer-user-2",
    role: UserRole.BUYER,
    name: SEED_BUYER_DEFINITIONS[1]?.name ?? "Chittagong Fresh Mart",
    division: SEED_BUYER_DEFINITIONS[1]?.division ?? "chattogram",
    district: SEED_BUYER_DEFINITIONS[1]?.district ?? "chattogram",
    upazila: SEED_BUYER_DEFINITIONS[1]?.upazila ?? "Kotwali",
    organization: SEED_BUYER_DEFINITIONS[1]?.organization ?? "Chattogram Fresh Mart",
    language: "en",
  };

  // Determine current user based on initialRole
  let defaultUser = farmerUser;
  if (options?.initialRole === "BUYER") {
    defaultUser = buyerUser;
  } else if (options?.initialRole === "BUYER_TWO") {
    defaultUser = buyerTwoUser;
  }

  let pageUser: PublicUser = defaultUser;
  let state: MockState;

  if (options?.sharedState) {
    state = options.sharedState;
    if (!state.registeredPages.includes(page)) {
      state.registeredPages.push(page);
    }
    if (options.initialRole) {
      pageUser = defaultUser;
    }
    if (options.initialAuthenticated !== undefined) {
      state.authenticated = options.initialAuthenticated;
    }
  } else {
    // Generate seeded listings from LISTING_SEED_PLAN
    const seededListings: FarmerListing[] = [];
    const seededBids: MockBid[] = [];
    const now = new Date();

    for (let index = 0; index < LISTING_SEED_PLAN.length; index += 1) {
      const plan = LISTING_SEED_PLAN[index];
      if (!plan) continue;
      const crop = crops.find((c) => c.slug === plan.cropSlug) ?? crops[0];
      const farmerDef =
        SEED_FARMER_DEFINITIONS[plan.farmerIndex] ?? DEV_SEED_CREDENTIALS.farmer;
      const listingId = `507f191e810c19729de8${String(index + 1).padStart(4, "0")}`;
      const endsAt = new Date(now.getTime() + plan.durationMinutes * 60 * 1000);

      let currentBidPerKg: number | undefined = undefined;
      let bidCount = 0;

      if (plan.bids && plan.bids.length > 0) {
        for (let bIdx = 0; bIdx < plan.bids.length; bIdx += 1) {
          const bSpec = plan.bids[bIdx];
          if (!bSpec) continue;
          const bidderDef =
            SEED_BUYER_DEFINITIONS[bSpec.buyerIndex] ?? DEV_SEED_CREDENTIALS.buyer;
          const bidderId = bSpec.buyerIndex === 1 ? buyerTwoUser.id : buyerUser.id;
          const bidAmount = plan.floorPricePerKg + bSpec.markupPerKg;
          const bidId = `507f191e810c19729de8b${String(seededBids.length + 1).padStart(3, "0")}`;
          bidCount += 1;
          currentBidPerKg = bidAmount;

          seededBids.push({
            id: bidId,
            listingId,
            buyerId: bidderId,
            bidderLabel: bidderDef.name,
            amountPerKg: bidAmount,
            totalAmount: bidAmount * plan.quantityKg,
            seq: bidCount,
            status: "ACCEPTED",
            placedAt: now.toISOString(),
          });
        }
      }

      seededListings.push({
        id: listingId,
        cropId: crop.id,
        quantityKg: plan.quantityKg,
        images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
        aiAssessment: {
          grade: plan.grade,
          confidence: 0.95,
          confidenceBand: "HIGH",
          classProbabilities: {
            A: plan.grade === CropGrade.A ? 0.95 : 0.05,
            B: plan.grade === CropGrade.B ? 0.95 : 0.05,
            C: plan.grade === CropGrade.C ? 0.95 : 0.05,
          },
          qualityNotes: [
            `Evaluated Grade ${plan.grade} quality for ${crop.nameEn}`,
            "Sound skin, optimal firmness, and uniform texture",
          ],
          cropMatch: true,
          modelVersion: "mock-v1",
          provider: "mock",
          degraded: false,
          assessedAt: now.toISOString(),
        },
        aiPriceGuidance: {
          lowPerKg: Math.round(plan.floorPricePerKg * 0.9),
          expectedPerKg: Math.round(plan.floorPricePerKg * 1.1),
          highPerKg: Math.round(plan.floorPricePerKg * 1.25),
          trend: "UP",
          confidence: 0.88,
          explanation: ["Wholesale benchmark in region"],
          modelVersion: "mock-v1",
          provider: "mock",
          degraded: false,
          generatedAt: now.toISOString(),
          suggestedFloorPerKg: plan.floorPricePerKg,
        },
        floorPricePerKg: plan.floorPricePerKg,
        minIncrementPerKg: 100,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        originalEndsAt: endsAt.toISOString(),
        extensionCount: 0,
        status: "ACTIVE",
        bidCount,
        currentBidPerKg,
        location: {
          division: farmerDef.division,
          district: farmerDef.district,
          upazila: farmerDef.upazila,
        },
        pickupNote: "Warehouse pickup",
        createdAt: now.toISOString(),
      });
    }

    state = {
      authenticated: options?.initialAuthenticated ?? true,
      currentUser: defaultUser,
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
      listings: options?.initialListings ? [...options.initialListings] : seededListings,
      bids: options?.initialBids ? [...options.initialBids] : seededBids,
      registeredPages: [page],
      dispatchSse: async (
        listingId: string,
        eventName: string,
        payload: unknown,
      ): Promise<void> => {
        for (const p of state.registeredPages) {
          try {
            if (!p.isClosed()) {
              await p.evaluate(
                ({ id, ev, data }) => {
                  const win = window as unknown as {
                    __dispatchMockSse?: (lid: string, e: string, d: unknown) => void;
                  };
                  win.__dispatchMockSse?.(id, ev, data);
                },
                { id: listingId, ev: eventName, data: payload },
              );
            }
          } catch {
            // Ignore evaluation errors on closed or transitioning pages
          }
        }
      },
    };
  }

  // Adjust inventory if initialListings were explicitly provided
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
        if (
          !(window as unknown as { __mockEventSources?: MockEventSource[] })
            .__mockEventSources
        ) {
          (
            window as unknown as { __mockEventSources: MockEventSource[] }
          ).__mockEventSources = [];
        }
        (
          window as unknown as { __mockEventSources: MockEventSource[] }
        ).__mockEventSources.push(this);

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

    (window as unknown as { EventSource: typeof MockEventSource }).EventSource =
      MockEventSource;

    (
      window as unknown as {
        __dispatchMockSse?: (
          listingId: string,
          eventName: string,
          payload: unknown,
        ) => void;
      }
    ).__dispatchMockSse = (
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
        body: JSON.stringify({ data: pageUser }),
      });
    }

    if (path === "/api/v1/auth/login" && method === "POST") {
      state.authenticated = true;
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.phone === "01800000002") {
        pageUser = buyerTwoUser;
      } else if (body.phone === "01712345678") {
        pageUser = options?.initialRole === "FARMER" ? farmerUser : buyerUser;
      } else if (body.phone === "01700000001") {
        pageUser = farmerUser;
      } else {
        pageUser = options?.initialRole === "BUYER" ? buyerUser : farmerUser;
      }
      state.currentUser = pageUser;

      return route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": "bazarbeat-session=1; Path=/; SameSite=Lax; Max-Age=604800",
        },
        contentType: "application/json",
        body: JSON.stringify({ data: pageUser }),
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

    // 10. Compare Listings (GET /api/v1/listings/compare)
    if (path === "/api/v1/listings/compare" && method === "GET") {
      const idsParam = url.searchParams.get("ids") || "";
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

      const foundListings = ids
        .map((id) => state.listings.find((l) => l.id === id))
        .filter((l): l is FarmerListing => Boolean(l));

      // Mixed crops check
      const cropSlugs = new Set(
        foundListings.map((l) => {
          const crop = crops.find((c) => c.id === l.cropId);
          return crop?.slug || l.cropId;
        }),
      );

      if (cropSlugs.size > 1) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "COMPARE_MIXED_CROPS",
              message: "All listings in compare must belong to the same crop.",
            },
          }),
        });
      }

      // Highlights calculation
      const lowestPrice = Math.min(
        ...foundListings.map((l) => l.currentBidPerKg ?? l.floorPricePerKg),
      );
      const gradeRank: Record<string, number> = { A: 3, B: 2, C: 1 };
      const maxGradeRank = Math.max(
        ...foundListings.map((l) => gradeRank[l.aiAssessment.grade] ?? 0),
      );
      const maxQuantity = Math.max(...foundListings.map((l) => l.quantityKg));

      const firstCrop = crops.find((c) => c.id === foundListings[0]?.cropId);
      const compareListings = foundListings.map((l) => {
        const crop = crops.find((c) => c.id === l.cropId) ?? crops[0];
        const displayPrice = l.currentBidPerKg ?? l.floorPricePerKg;
        const isLowestPrice = displayPrice === lowestPrice;
        const isBestGrade = (gradeRank[l.aiAssessment.grade] ?? 0) === maxGradeRank;
        const isLargestQuantity = l.quantityKg === maxQuantity;
        const expectedPrice = l.aiPriceGuidance?.expectedPerKg ?? 4600;
        const itemHighlights = {
          isLowestPrice,
          isBestGrade,
          isLargestQuantity,
          isBestValue: isLowestPrice,
        };

        return {
          id: l.id,
          cropId: l.cropId,
          cropNameEn: crop.nameEn,
          cropNameBn: crop.nameBn,
          grade: l.aiAssessment.grade,
          quantityKg: l.quantityKg,
          displayPricePerKg: displayPrice,
          displayTotalCost: displayPrice * l.quantityKg,
          totalDisplayCost: displayPrice * l.quantityKg,
          floorPricePerKg: l.floorPricePerKg,
          currentBidPerKg: l.currentBidPerKg ?? null,
          minIncrementPerKg: 100,
          hasBids: (l.bidCount || 0) > 0,
          bidCount: l.bidCount || 0,
          startsAt: l.startsAt,
          endsAt: l.endsAt,
          status: l.status,
          location: {
            division: l.location?.division || "Dhaka",
            district: l.location?.district || "Dhaka",
          },
          farmerRegion: l.location?.division || "Dhaka",
          timeLeftSeconds: Math.max(
            0,
            Math.floor((new Date(l.endsAt).getTime() - Date.now()) / 1000),
          ),
          aiExpectedPricePerKg: expectedPrice,
          aiRange: {
            lowPerKg: l.aiPriceGuidance?.lowPerKg ?? 3800,
            expectedPerKg: expectedPrice,
            highPerKg: l.aiPriceGuidance?.highPerKg ?? 5200,
          },
          percentageVsAiExpected: Math.round((displayPrice / expectedPrice) * 100),
          highlights: itemHighlights,
          thumbnailUrl: l.images?.[0]?.url || "/images/crops/placeholder.svg",
          images:
            l.images && l.images.length > 0
              ? l.images.map((img) => ({
                  url: img.url,
                  width: img.width ?? 800,
                  height: img.height ?? 600,
                }))
              : [
                  {
                    url: "/images/crops/placeholder.svg",
                    width: 800,
                    height: 600,
                  },
                ],
        };
      });

      const highlights = {
        lowestPriceListingIds: compareListings
          .filter((c) => c.highlights.isLowestPrice)
          .map((c) => c.id),
        bestGradeListingIds: compareListings
          .filter((c) => c.highlights.isBestGrade)
          .map((c) => c.id),
        largestQuantityListingIds: compareListings
          .filter((c) => c.highlights.isLargestQuantity)
          .map((c) => c.id),
        bestValueListingIds: compareListings
          .filter((c) => c.highlights.isBestValue)
          .map((c) => c.id),
        byListingId: Object.fromEntries(
          compareListings.map((c) => [c.id, c.highlights]),
        ),
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            cropId: firstCrop?.id ?? null,
            listings: compareListings,
            highlights,
            missingIds: [],
          },
          meta: { serverTime: new Date().toISOString() },
        }),
      });
    }

    // 11. Marketplace Search Query (GET /api/v1/listings)
    if (
      (path === "/api/v1/listings" || path === "/api/v1/marketplace/listings") &&
      method === "GET"
    ) {
      let filtered = [...state.listings].filter((l) => l.status === "ACTIVE");

      const cropParam = url.searchParams.get("crop");
      if (cropParam) {
        const crop = crops.find((c) => c.slug === cropParam || c.id === cropParam);
        if (crop) {
          filtered = filtered.filter((l) => l.cropId === crop.id);
        }
      }

      const gradeParam = url.searchParams.get("grade");
      if (gradeParam) {
        filtered = filtered.filter((l) => l.aiAssessment.grade === gradeParam);
      }

      const divisionParam = url.searchParams.get("division");
      if (divisionParam) {
        filtered = filtered.filter(
          (l) => l.location?.division.toLowerCase() === divisionParam.toLowerCase(),
        );
      }

      const districtParam = url.searchParams.get("district");
      if (districtParam) {
        filtered = filtered.filter(
          (l) => l.location?.district.toLowerCase() === districtParam.toLowerCase(),
        );
      }

      const minPriceParam = url.searchParams.get("minPrice");
      if (minPriceParam) {
        filtered = filtered.filter(
          (l) => (l.currentBidPerKg ?? l.floorPricePerKg) >= Number(minPriceParam),
        );
      }

      const maxPriceParam = url.searchParams.get("maxPrice");
      if (maxPriceParam) {
        filtered = filtered.filter(
          (l) => (l.currentBidPerKg ?? l.floorPricePerKg) <= Number(maxPriceParam),
        );
      }

      const cards = filtered.map((l) => {
        const crop = crops.find((c) => c.id === l.cropId) ?? crops[0];
        const displayPrice = l.currentBidPerKg ?? l.floorPricePerKg;
        return {
          id: l.id,
          cropId: l.cropId,
          crop: {
            id: crop.id,
            slug: crop.slug,
            nameEn: crop.nameEn,
            nameBn: crop.nameBn,
            unit: crop.unit,
          },
          grade: l.aiAssessment.grade,
          quantityKg: l.quantityKg,
          floorPricePerKg: l.floorPricePerKg,
          currentBidPerKg: l.currentBidPerKg ?? null,
          displayPricePerKg: displayPrice,
          totalDisplayCost: displayPrice * l.quantityKg,
          minIncrementPerKg: l.minIncrementPerKg || 100,
          hasBids: (l.bidCount || 0) > 0,
          bidCount: l.bidCount || 0,
          startsAt: l.startsAt,
          endsAt: l.endsAt,
          status: l.status,
          location: {
            division: l.location?.division || "dhaka",
            district: l.location?.district || "dhaka",
          },
          thumbnailUrl: l.images?.[0]?.url || "/images/crops/placeholder.svg",
          images: l.images,
          aiExpectedPricePerKg: l.aiPriceGuidance?.expectedPerKg,
        };
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: cards,
          meta: {
            serverTime: new Date().toISOString(),
            page: 1,
            limit: 20,
            total: cards.length,
          },
        }),
      });
    }

    // 12. My Listings
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

    // 13. SSE Stream fallback/handshake
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

    // 14. Submit Bid (POST /api/v1/listings/:id/bids)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/bids$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
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
              details: {
                minimumRequiredPerKg: minRequired,
                currentBidPerKg: listing.currentBidPerKg ?? listing.floorPricePerKg,
                floorPricePerKg: listing.floorPricePerKg,
                minIncrementPerKg: listing.minIncrementPerKg || 100,
              },
            },
          }),
        });
      }

      const mockBuyerHeader = route.request().headers()["x-mock-buyer"];
      const bidder =
        mockBuyerHeader === "buyer-2" || mockBuyerHeader === "buyer-user-2"
          ? buyerTwoUser
          : pageUser.role === UserRole.BUYER
            ? pageUser
            : buyerUser;

      const now = new Date();
      const bidId = `507f191e810c19729de8b${String(state.bids.length + 1).padStart(3, "0")}`;
      const bidSeq = (listing.bidCount || 0) + 1;
      const bid: MockBid = {
        id: bidId,
        listingId: listing.id,
        buyerId: bidder.id,
        bidderLabel: bidder.name,
        amountPerKg,
        totalAmount: amountPerKg * listing.quantityKg,
        seq: bidSeq,
        status: "ACCEPTED",
        placedAt: now.toISOString(),
      };
      state.bids.push(bid);

      listing.bidCount = bidSeq;
      listing.currentBidPerKg = amountPerKg;
      (listing as unknown as { currentBidderId: string }).currentBidderId = bidder.id;

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
        bidderLabel: bidder.name,
        currentPrice: amountPerKg,
        currentBidPerKg: amountPerKg,
        amountPerKg,
        totalAmount: amountPerKg * listing.quantityKg,
        bidCount: bidSeq,
        placedAt: now.toISOString(),
        serverTime: now.toISOString(),
      };

      if (extendedPatch) {
        void state.dispatchSse(listing.id, "auction.extended", extendedPatch);
      }
      void state.dispatchSse(listing.id, "bid.placed", bidPlacedPatch);

      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...bid,
            patch: bidPlacedPatch,
            extended: extendedPatch,
          },
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // 15. Get Bids (GET /api/v1/listings/:id/bids)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/bids$/) && method === "GET") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listingBids = state.bids
        .filter((b) => b.listingId === listingId)
        .map((b) => ({
          id: b.id,
          listingId: b.listingId,
          bidderLabel:
            b.buyerId === pageUser.id
              ? "You"
              : b.bidderLabel || `Buyer #${b.seq}`,
          isMine: b.buyerId === pageUser.id,
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

    // 16. Cancel Listing (POST /api/v1/listings/:id/cancel)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/cancel$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
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

    // 17. Relist Listing (POST /api/v1/listings/:id/relist)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/relist$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const oldListing = state.listings.find((l) => l.id === listingId);
      if (!oldListing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
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

    // 18. Accept Current Bid (POST /api/v1/listings/:id/accept-current-bid)
    if (
      path.match(/\/api\/v1\/listings\/[^/]+\/accept-current-bid$/) &&
      method === "POST"
    ) {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
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
        totalAmount: listing.currentBidPerKg
          ? listing.currentBidPerKg * listing.quantityKg
          : undefined,
        serverTime: now.toISOString(),
      };

      void state.dispatchSse(listing.id, "auction.closed", closedPatch);

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

    // 19. Close Auction simulation (POST /api/v1/listings/:id/close)
    if (path.match(/\/api\/v1\/listings\/[^/]+\/close$/) && method === "POST") {
      const parts = path.split("/");
      const listingId = parts[parts.length - 2];
      const listing = state.listings.find((l) => l.id === listingId);
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
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
        totalAmount: listing.currentBidPerKg
          ? listing.currentBidPerKg * listing.quantityKg
          : undefined,
        serverTime: now.toISOString(),
      };

      void state.dispatchSse(listing.id, "auction.closed", closedPatch);

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

    // 20. Listing by ID (GET /api/v1/listings/:id)
    if (path.startsWith("/api/v1/listings/") && method === "GET") {
      const id = path.replace("/api/v1/listings/", "");
      const listing =
        state.listings.find((l) => l.id === id) ?? state.listings[0];
      if (!listing) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "NOT_FOUND", message: "Listing not found" },
          }),
        });
      }

      const crop = crops.find((c) => c.id === listing.cropId) ?? crops[0];

      // If buyer or non-owner farmer, return BuyerListingDetail
      if (pageUser.role === UserRole.BUYER) {
        const listingBids = state.bids.filter((b) => b.listingId === listing.id);
        const myBids = listingBids.filter((b) => b.buyerId === pageUser.id);
        const myHighest =
          myBids.length > 0
            ? Math.max(...myBids.map((b) => b.amountPerKg))
            : null;

        let myStatus: "NONE" | "WINNING" | "OUTBID" | "WON" | "LOST" = "NONE";
        if (myBids.length > 0) {
          const currentWinningBid = listingBids[listingBids.length - 1];
          if (currentWinningBid && currentWinningBid.buyerId === pageUser.id) {
            myStatus = listing.status === "ACTIVE" ? "WINNING" : "WON";
          } else {
            myStatus = listing.status === "ACTIVE" ? "OUTBID" : "LOST";
          }
        }

        const displayPrice = listing.currentBidPerKg ?? listing.floorPricePerKg;

        const buyerDetail = {
          id: listing.id,
          cropId: listing.cropId,
          crop: {
            id: crop.id,
            slug: crop.slug,
            nameEn: crop.nameEn,
            nameBn: crop.nameBn,
            unit: crop.unit,
            minIncrementPerKg: listing.minIncrementPerKg || 100,
          },
          grade: listing.aiAssessment.grade,
          confidenceBand: listing.aiAssessment.confidenceBand || "HIGH",
          reasons: listing.aiAssessment.qualityNotes || [
            "Uniform size",
            "Good texture",
          ],
          aiPriceSnapshot: {
            lowPerKg: listing.aiPriceGuidance?.lowPerKg ?? 3800,
            expectedPerKg: listing.aiPriceGuidance?.expectedPerKg ?? 4600,
            highPerKg: listing.aiPriceGuidance?.highPerKg ?? 5200,
            trend: listing.aiPriceGuidance?.trend ?? "UP",
          },
          provider: "mock",
          degraded: false,
          quantityKg: listing.quantityKg,
          images: listing.images,
          floorPricePerKg: listing.floorPricePerKg,
          minIncrementPerKg: listing.minIncrementPerKg || 100,
          currentBidPerKg: listing.currentBidPerKg ?? null,
          displayPricePerKg: displayPrice,
          displayTotalCost: displayPrice * listing.quantityKg,
          bidCount: listing.bidCount || 0,
          startsAt: listing.startsAt,
          endsAt: listing.endsAt,
          originalEndsAt: listing.originalEndsAt || listing.endsAt,
          extensionCount: listing.extensionCount || 0,
          status: listing.status,
          location: {
            division: listing.location?.division || "dhaka",
            district: listing.location?.district || "dhaka",
          },
          myStatus,
          myHighestBidPerKg: myHighest,
          highestBidPerKg: myHighest,
          createdAt: listing.createdAt,
        };

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: buyerDetail,
            meta: { serverTime: new Date().toISOString() },
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

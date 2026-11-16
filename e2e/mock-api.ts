import type { Page, Route } from "@playwright/test";
import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  type CounterpartyDto,
  CropGrade,
  type FarmerListing,
  type FarmerOrderCard,
  type FarmerOrderDetail,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type PublicUser,
  type SaleItem,
  type SalesTotals,
  StockReturnDecision,
  UserRole,
  getOrderActions,
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

export interface MockOrder {
  id: string;
  listingId: string;
  farmerId: string;
  buyerId: string;
  cropId: string;
  quantityKg: number;
  grade: CropGrade;
  pricePerKg: number;
  subtotal: number;
  platformFee: number;
  farmerNet: number;
  status: OrderStatus;
  payment: {
    status: PaymentStatus;
    method?: PaymentMethod;
    paidAt?: string;
    refundedAt?: string;
  };
  fulfilment?: {
    method: "PICKUP";
    note?: string;
    handoverAt?: string;
  };
  dispute?: {
    reason: string;
    note?: string;
    raisedAt: string;
    resolution?: string;
  };
  statusHistory?: Array<{
    status: OrderStatus;
    at: string;
    byUserId?: string;
    note?: string;
  }>;
  confirmedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  cancelNote?: string;
  stockReturn?: {
    decision: StockReturnDecision;
    decidedAt: string;
    note?: string;
  };
  createdAt: string;
  updatedAt?: string;
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
  orders: MockOrder[];
  registeredPages: Page[];
  dispatchSse: (listingId: string, eventName: string, payload: unknown) => Promise<void>;
}

export interface SetupMockApiOptions {
  initialAuthenticated?: boolean;
  initialRole?: "FARMER" | "BUYER" | "BUYER_TWO";
  initialAvailableKg?: number;
  initialListings?: FarmerListing[];
  initialBids?: MockBid[];
  initialOrders?: MockOrder[];
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
      orders: options?.initialOrders ? [...options.initialOrders] : [],
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

          // Create order if one does not already exist for this listing
          let existingOrder = state.orders.find((o) => o.listingId === listing.id);
          if (!existingOrder) {
            const winningPrice = listing.currentBidPerKg ?? listing.floorPricePerKg;
            const subtotal = winningPrice * listing.quantityKg;
            const platformFee = Math.round((subtotal * 200) / 10000);
            const farmerNet = subtotal - platformFee;

            const winningBid = state.bids
              .filter((b) => b.listingId === listing.id)
              .sort((a, b) => b.amountPerKg - a.amountPerKg)[0];

            const buyerId = winningBid?.buyerId ?? buyerUser.id;
            const orderId = `507f191e810c19729de8f${String(state.orders.length + 1).padStart(3, "0")}`;

            existingOrder = {
              id: orderId,
              listingId: listing.id,
              farmerId: farmerUser.id,
              buyerId,
              cropId: listing.cropId,
              quantityKg: listing.quantityKg,
              grade: listing.aiAssessment?.grade ?? CropGrade.A,
              pricePerKg: winningPrice,
              subtotal,
              platformFee,
              farmerNet,
              status: OrderStatus.PENDING,
              payment: {
                status: PaymentStatus.UNPAID,
                method: PaymentMethod.COD,
              },
              statusHistory: [
                {
                  status: OrderStatus.PENDING,
                  at: now.toISOString(),
                  byUserId: farmerUser.id,
                  note: "Auction closed sold",
                },
              ],
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
            state.orders.push(existingOrder);
          }
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

    // 21. Orders list (GET /api/v1/orders)
    if (path === "/api/v1/orders" && method === "GET") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }

      const statusQuery = url.searchParams.get("status");
      const groupQuery = url.searchParams.get("group");
      const pageNum = parseInt(url.searchParams.get("page") || "1", 10) || 1;
      const limitNum = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

      const isFarmer = pageUser.role === UserRole.FARMER;
      const roleOrders = state.orders.filter((o) =>
        isFarmer ? o.farmerId === pageUser.id : o.buyerId === pageUser.id,
      );

      // Status tab counts
      const statusCounts = {
        needs_action: roleOrders.filter((o) => o.status === OrderStatus.PENDING).length,
        in_progress: roleOrders.filter((o) => o.status === OrderStatus.CONFIRMED).length,
        delivered: roleOrders.filter((o) => o.status === OrderStatus.DELIVERED).length,
        completed: roleOrders.filter((o) => o.status === OrderStatus.COMPLETED).length,
        disputed: roleOrders.filter((o) => o.status === OrderStatus.DISPUTED).length,
        cancelled: roleOrders.filter((o) => o.status === OrderStatus.CANCELLED).length,
      };

      let filtered = roleOrders;
      if (statusQuery) {
        filtered = filtered.filter((o) => o.status === statusQuery);
      } else if (groupQuery === "cancelled") {
        filtered = filtered.filter((o) => o.status === OrderStatus.CANCELLED);
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limitNum) || 1;
      const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const mappedCards = paginated.map((order) => {
        const crop = crops.find((c) => c.id === order.cropId) ?? crops[0];
        const isPending = order.status === OrderStatus.PENDING;

        if (isFarmer) {
          const buyerCounterparty: CounterpartyDto = isPending
            ? {
                id: order.buyerId,
                name: "Buyer",
                role: UserRole.BUYER,
                isMasked: true,
                division: buyerUser.division,
                district: buyerUser.district,
              }
            : {
                id: order.buyerId,
                name: buyerUser.name,
                role: UserRole.BUYER,
                phone: buyerUser.phone,
                isMasked: false,
                organizationName: buyerUser.organization,
                location: {
                  division: buyerUser.division,
                  district: buyerUser.district,
                  upazila: buyerUser.upazila,
                },
              };

          const card: FarmerOrderCard = {
            id: order.id,
            listingId: order.listingId,
            cropId: order.cropId,
            cropName: crop.nameEn,
            cropNameBn: crop.nameBn,
            imageUrl: crop.imageUrl,
            grade: order.grade,
            quantityKg: order.quantityKg,
            pricePerKg: order.pricePerKg,
            subtotal: order.subtotal,
            platformFee: order.platformFee,
            farmerNet: order.farmerNet,
            status: order.status,
            payment: order.payment,
            fulfilment: order.fulfilment ?? { method: "PICKUP" },
            buyer: buyerCounterparty,
            autoCancelDeadline: isPending
              ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
              : undefined,
            deadline: isPending
              ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
              : undefined,
            stockReturn: order.stockReturn,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          };
          return card;
        } else {
          const farmerCounterparty: CounterpartyDto = isPending
            ? {
                id: order.farmerId,
                name: "Farmer",
                role: UserRole.FARMER,
                isMasked: true,
                division: farmerUser.division,
                district: farmerUser.district,
              }
            : {
                id: order.farmerId,
                name: farmerUser.name,
                role: UserRole.FARMER,
                phone: farmerUser.phone,
                isMasked: false,
                organizationName: farmerUser.organization,
                location: {
                  division: farmerUser.division,
                  district: farmerUser.district,
                  upazila: farmerUser.upazila,
                },
              };

          const card: BuyerOrderCard = {
            id: order.id,
            listingId: order.listingId,
            cropId: order.cropId,
            cropName: crop.nameEn,
            cropNameBn: crop.nameBn,
            imageUrl: crop.imageUrl,
            grade: order.grade,
            quantityKg: order.quantityKg,
            pricePerKg: order.pricePerKg,
            subtotal: order.subtotal,
            totalAmount: order.subtotal,
            status: order.status,
            payment: order.payment,
            fulfilment: order.fulfilment ?? { method: "PICKUP" },
            farmer: farmerCounterparty,
            autoCancelDeadline: isPending
              ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
              : undefined,
            autoCompleteDeadline: order.status === OrderStatus.DELIVERED
              ? new Date(new Date(order.deliveredAt ?? order.createdAt).getTime() + 120000).toISOString()
              : undefined,
            deadline: isPending
              ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
              : undefined,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          };
          return card;
        }
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: mappedCards,
          meta: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            serverTime: new Date().toISOString(),
            statusCounts,
            counts: statusCounts,
          },
        }),
      });
    }

    // 22. Order Detail (GET /api/v1/orders/:id)
    if (path.match(/\/api\/v1\/orders\/[^/]+$/) && method === "GET") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }

      const orderId = path.split("/").pop()!;
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }

      const isFarmer = pageUser.role === UserRole.FARMER;
      // Negative authorization: participants only!
      if (isFarmer && order.farmerId !== pageUser.id) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Access forbidden" } }),
        });
      }
      if (!isFarmer && order.buyerId !== pageUser.id) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Access forbidden" } }),
        });
      }

      const crop = crops.find((c) => c.id === order.cropId) ?? crops[0];
      const listing = state.listings.find((l) => l.id === order.listingId);
      const isPending = order.status === OrderStatus.PENDING;

      const timeline = (order.statusHistory ?? []).map((h) => ({
        status: h.status,
        at: h.at,
        byUserId: h.byUserId,
        note: h.note,
      }));

      if (isFarmer) {
        const buyerCounterparty: CounterpartyDto = isPending
          ? {
              id: order.buyerId,
              name: "Buyer",
              role: UserRole.BUYER,
              isMasked: true,
              division: buyerUser.division,
              district: buyerUser.district,
            }
          : {
              id: order.buyerId,
              name: buyerUser.name,
              role: UserRole.BUYER,
              phone: buyerUser.phone,
              isMasked: false,
              organizationName: buyerUser.organization,
              location: {
                division: buyerUser.division,
                district: buyerUser.district,
                upazila: buyerUser.upazila,
              },
            };

        const detail: FarmerOrderDetail = {
          id: order.id,
          listingId: order.listingId,
          cropId: order.cropId,
          cropName: crop.nameEn,
          cropNameBn: crop.nameBn,
          imageUrl: crop.imageUrl,
          grade: order.grade,
          quantityKg: order.quantityKg,
          pricePerKg: order.pricePerKg,
          subtotal: order.subtotal,
          platformFee: order.platformFee,
          farmerNet: order.farmerNet,
          status: order.status,
          payment: order.payment,
          fulfilment: order.fulfilment ?? { method: "PICKUP" },
          buyer: buyerCounterparty,
          autoCancelDeadline: isPending
            ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
            : undefined,
          deadline: isPending
            ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
            : undefined,
          stockReturn: order.stockReturn,
          timeline,
          statusHistory: timeline,
          availableActions: getOrderActions(UserRole.FARMER, {
            status: order.status,
            payment: order.payment,
          }),
          dispute: order.dispute,
          listingSummary: listing
            ? {
                id: listing.id,
                title: crop.nameEn,
                imageUrl: listing.images?.[0]?.url,
                division: listing.location?.division || "dhaka",
                district: listing.location?.district || "dhaka",
              }
            : undefined,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: detail, meta: { serverTime: new Date().toISOString() } }),
        });
      } else {
        const farmerCounterparty: CounterpartyDto = isPending
          ? {
              id: order.farmerId,
              name: "Farmer",
              role: UserRole.FARMER,
              isMasked: true,
              division: farmerUser.division,
              district: farmerUser.district,
            }
          : {
              id: order.farmerId,
              name: farmerUser.name,
              role: UserRole.FARMER,
              phone: farmerUser.phone,
              isMasked: false,
              organizationName: farmerUser.organization,
              location: {
                division: farmerUser.division,
                district: farmerUser.district,
                upazila: farmerUser.upazila,
              },
            };

        const detail: BuyerOrderDetail = {
          id: order.id,
          listingId: order.listingId,
          cropId: order.cropId,
          cropName: crop.nameEn,
          cropNameBn: crop.nameBn,
          imageUrl: crop.imageUrl,
          grade: order.grade,
          quantityKg: order.quantityKg,
          pricePerKg: order.pricePerKg,
          subtotal: order.subtotal,
          totalAmount: order.subtotal,
          status: order.status,
          payment: order.payment,
          fulfilment: order.fulfilment ?? { method: "PICKUP" },
          farmer: farmerCounterparty,
          autoCancelDeadline: isPending
            ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
            : undefined,
          autoCompleteDeadline: order.status === OrderStatus.DELIVERED
            ? new Date(new Date(order.deliveredAt ?? order.createdAt).getTime() + 120000).toISOString()
            : undefined,
          deadline: isPending
            ? new Date(new Date(order.createdAt).getTime() + 60000).toISOString()
            : undefined,
          timeline,
          statusHistory: timeline,
          availableActions: getOrderActions(UserRole.BUYER, {
            status: order.status,
            payment: order.payment,
          }),
          dispute: order.dispute,
          listingSummary: listing
            ? {
                id: listing.id,
                title: crop.nameEn,
                imageUrl: listing.images?.[0]?.url,
                division: listing.location?.division || "dhaka",
                district: listing.location?.district || "dhaka",
              }
            : undefined,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: detail, meta: { serverTime: new Date().toISOString() } }),
        });
      }
    }

    // 23. Confirm Order (POST /api/v1/orders/:id/confirm)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/confirm$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.FARMER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only farmers can confirm orders" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }
      if (order.status !== OrderStatus.PENDING) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_TRANSITION", message: "Cannot confirm non-pending order" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const now = new Date();
      order.status = OrderStatus.CONFIRMED;
      order.confirmedAt = now.toISOString();
      order.updatedAt = now.toISOString();
      order.fulfilment = {
        method: "PICKUP",
        handoverAt: body.handoverAt,
        note: body.note,
      };
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: OrderStatus.CONFIRMED,
        at: now.toISOString(),
        byUserId: pageUser.id,
        note: body.note,
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 24. Mark Order Paid (POST /api/v1/orders/:id/mark-paid)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/mark-paid$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.BUYER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only buyers can pay for orders" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const now = new Date();
      order.payment = {
        status: PaymentStatus.PAID,
        method: body.method ?? PaymentMethod.WALLET_SIM,
        paidAt: now.toISOString(),
      };
      order.updatedAt = now.toISOString();

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 25. Mark Delivered (POST /api/v1/orders/:id/mark-delivered)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/mark-delivered$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.FARMER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only farmers can mark delivered" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }
      if (order.status !== OrderStatus.CONFIRMED) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_TRANSITION", message: "Cannot mark non-confirmed order delivered" } }),
        });
      }

      const now = new Date();
      order.status = OrderStatus.DELIVERED;
      order.deliveredAt = now.toISOString();
      order.updatedAt = now.toISOString();
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: OrderStatus.DELIVERED,
        at: now.toISOString(),
        byUserId: pageUser.id,
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 26. Complete Order (POST /api/v1/orders/:id/complete)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/complete$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.BUYER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only buyers can complete orders" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }
      if (order.status !== OrderStatus.DELIVERED) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_TRANSITION", message: "Cannot complete non-delivered order" } }),
        });
      }

      const now = new Date();
      order.status = OrderStatus.COMPLETED;
      order.completedAt = now.toISOString();
      order.updatedAt = now.toISOString();
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: OrderStatus.COMPLETED,
        at: now.toISOString(),
        byUserId: pageUser.id,
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 27. Cancel Order (POST /api/v1/orders/:id/cancel)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/cancel$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }

      const isFarmer = pageUser.role === UserRole.FARMER;
      const allowed = isFarmer
        ? [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)
        : [OrderStatus.PENDING].includes(order.status);

      if (!allowed) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_TRANSITION", message: "Cannot cancel order in current status" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const now = new Date();
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = now.toISOString();
      order.cancelledBy = pageUser.id;
      order.cancelReason = body.reason || "CANCELLED_BY_USER";
      order.cancelNote = body.note;
      order.updatedAt = now.toISOString();
      if (order.payment.status === PaymentStatus.PAID) {
        order.payment.status = PaymentStatus.REFUNDED;
        order.payment.refundedAt = now.toISOString();
      }
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: OrderStatus.CANCELLED,
        at: now.toISOString(),
        byUserId: pageUser.id,
        note: body.reason,
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 28. Stock Return Decision (POST /api/v1/orders/:id/stock-return)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/stock-return$/) && method === "POST") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.FARMER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only farmers can decide stock return" } }),
        });
      }

      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }
      if (order.status !== OrderStatus.CANCELLED) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_TRANSITION", message: "Order must be cancelled" } }),
        });
      }
      if (order.stockReturn) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "CONFLICT", message: "Stock return already decided" } }),
        });
      }

      const body = JSON.parse(route.request().postData() || "{}");
      const decision = body.decision as StockReturnDecision;
      const now = new Date();
      order.stockReturn = {
        decision,
        decidedAt: now.toISOString(),
        note: body.note,
      };
      order.updatedAt = now.toISOString();

      if (
        decision === StockReturnDecision.RETURNED ||
        (decision as string) === "RETURNED" ||
        (decision as string) === "RETURN_TO_STOCK"
      ) {
        const item = state.inventory.find((inv) => inv.crop.id === order.cropId);
        if (item) {
          item.availableKg += order.quantityKg;
          item.soldKg = Math.max(0, item.soldKg - order.quantityKg);
        }
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 29. Auto Cancel Order (POST /api/v1/orders/:id/auto-cancel)
    if (path.match(/\/api\/v1\/orders\/[^/]+\/auto-cancel$/) && method === "POST") {
      const parts = path.split("/");
      const orderId = parts[parts.length - 2];
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Order not found" } }),
        });
      }

      const now = new Date();
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = now.toISOString();
      order.cancelReason = "AUTO_CANCEL_EXPIRED";
      order.updatedAt = now.toISOString();
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: OrderStatus.CANCELLED,
        at: now.toISOString(),
        note: "Auto-cancelled after deadline",
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: order, meta: { serverTime: now.toISOString() } }),
      });
    }

    // 30. Farmer Sales (GET /api/v1/sales)
    if (path === "/api/v1/sales" && method === "GET") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.FARMER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only farmers can view sales" } }),
        });
      }

      const completedOrders = state.orders.filter(
        (o) => o.farmerId === pageUser.id && o.status === OrderStatus.COMPLETED,
      );

      const cropParam = url.searchParams.get("crop");
      const divisionParam = url.searchParams.get("buyerDivision");

      let filtered = completedOrders;
      if (cropParam) {
        filtered = filtered.filter((o) => {
          const c = crops.find((cr) => cr.id === o.cropId);
          return c?.slug === cropParam || o.cropId === cropParam;
        });
      }
      if (divisionParam) {
        filtered = filtered.filter(() => buyerUser.division.toLowerCase() === divisionParam.toLowerCase());
      }

      let totalQuantityKg = 0;
      let totalSubtotal = 0;
      let totalPlatformFee = 0;
      let totalFarmerNet = 0;

      for (const o of filtered) {
        totalQuantityKg += o.quantityKg;
        totalSubtotal += o.subtotal;
        totalPlatformFee += o.platformFee;
        totalFarmerNet += o.farmerNet;
      }

      const totals: SalesTotals = {
        totalQuantityKg: Math.round(totalQuantityKg * 10) / 10,
        totalSubtotal,
        totalPlatformFee,
        totalFarmerNet,
        totalGross: totalSubtotal,
        totalFees: totalPlatformFee,
        totalNet: totalFarmerNet,
        count: filtered.length,
      };

      const items: SaleItem[] = filtered.map((o) => {
        const c = crops.find((cr) => cr.id === o.cropId) ?? crops[0];
        return {
          id: o.id,
          orderId: o.id,
          listingId: o.listingId,
          cropId: o.cropId,
          cropName: c.nameEn,
          cropNameBn: c.nameBn,
          imageUrl: c.imageUrl,
          grade: o.grade,
          quantityKg: o.quantityKg,
          pricePerKg: o.pricePerKg,
          subtotal: o.subtotal,
          grossAmount: o.subtotal,
          platformFee: o.platformFee,
          farmerNet: o.farmerNet,
          status: o.status,
          buyerName: buyerUser.name,
          buyerDivision: buyerUser.division,
          soldAt: o.confirmedAt ?? o.createdAt,
          completedAt: o.completedAt ?? o.createdAt,
          paymentStatus: o.payment.status,
          paymentMethod: o.payment.method,
          pricePremiumPercent: 10,
        };
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: items,
          meta: {
            page: 1,
            limit: 20,
            total: items.length,
            totalPages: 1,
            serverTime: new Date().toISOString(),
            totals,
          },
        }),
      });
    }

    // 31. Farmer Earnings (GET /api/v1/earnings)
    if (path === "/api/v1/earnings" && method === "GET") {
      if (!state.authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Not logged in" } }),
        });
      }
      if (pageUser.role !== UserRole.FARMER) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Only farmers can view earnings" } }),
        });
      }

      const farmerOrders = state.orders.filter((o) => o.farmerId === pageUser.id);
      const completed = farmerOrders.filter((o) => o.status === OrderStatus.COMPLETED);
      const active = farmerOrders.filter((o) =>
        [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.DELIVERED].includes(o.status),
      );

      const settledNet = completed.reduce((sum, o) => sum + o.farmerNet, 0);
      const expectedNet = active.reduce((sum, o) => sum + o.farmerNet, 0);
      const gross = completed.reduce((sum, o) => sum + o.subtotal, 0);
      const fees = completed.reduce((sum, o) => sum + o.platformFee, 0);

      const byCrop = crops.map((crop) => {
        const cropOrders = completed.filter((o) => o.cropId === crop.id);
        const cropTotalNet = cropOrders.reduce((sum, o) => sum + o.farmerNet, 0);
        const cropTotalKg = cropOrders.reduce((sum, o) => sum + o.quantityKg, 0);
        const avgPrice =
          cropTotalKg > 0
            ? Math.round(cropOrders.reduce((sum, o) => sum + o.subtotal, 0) / cropTotalKg)
            : 0;
        return {
          cropId: crop.id,
          cropName: crop.nameEn,
          cropNameBn: crop.nameBn,
          totalKg: cropTotalKg,
          totalEarnings: cropTotalNet,
          averagePricePerKg: avgPrice,
          orderCount: cropOrders.length,
          averagePricePremiumPercent: cropOrders.length > 0 ? 10 : 0,
          averagePremiumPercent: cropOrders.length > 0 ? 10 : 0,
        };
      });

      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const seriesItem = {
        month: currentYearMonth,
        year: now.getFullYear(),
        monthIndex: now.getMonth() + 1,
        gross,
        fees,
        net: settledNet,
        totalKg: completed.reduce((sum, o) => sum + o.quantityKg, 0),
        orderCount: completed.length,
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            summary: {
              settledNet,
              expectedNet,
              activeNet: expectedNet,
              disputedNet: 0,
              disputedOrdersCount: 0,
              gross,
              fees,
              totalEarnings: settledNet,
              totalSubtotal: gross,
              totalPlatformFees: fees,
              pendingPayout: expectedNet,
              paidPayout: settledNet,
              averagePricePremiumPercent: 10,
              averagePremiumPercent: 10,
              completedOrdersCount: completed.length,
              feeRateBps: 200,
              feeRatePercent: 2.0,
            },
            byCrop,
            last6MonthsSeries: [seriesItem],
            monthlySeries: [seriesItem],
            recentPayouts: [],
            feeRate: { bps: 200, percent: 2.0 },
          },
          meta: { serverTime: now.toISOString() },
        }),
      });
    }

    // Fallback pass-through for anything else
    return route.continue();
  });

  return state;
}

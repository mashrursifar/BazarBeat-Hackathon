import type { Page, Route } from "@playwright/test";
import type { FarmerListing } from "@bazarbeat/shared";

export const CROP_BITTER_GOURD_ID = "507f191e810c19729de86001";
export const CROP_POTATO_ID = "507f191e810c19729de86002";
export const CROP_ONION_ID = "507f191e810c19729de86003";

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
}

export async function setupMockApi(
  page: Page,
  options?: {
    initialAuthenticated?: boolean;
    initialAvailableKg?: number;
  },
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
    listings: [],
  };

  const farmerUser = {
    id: "farmer-user-1",
    role: "FARMER",
    name: "Rahim Farmer",
    division: "dhaka",
    district: "dhaka",
    upazila: "Savar",
    language: "en",
  };

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

      const listing = {
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

    // 11. Listing by ID
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

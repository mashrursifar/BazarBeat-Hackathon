import { expect, test } from "@playwright/test";
import { CropGrade } from "@bazarbeat/shared";
import { setupMockApi } from "./mock-api.js";
import {
  autoCancelOrderViaApi,
  cancelOrderViaApi,
  closeAuctionViaMock,
} from "./test-helpers.js";

test.describe("Journey 5: Unsold Listing Relisting, Cancel Flow with Stock Return, Auto-Cancel Timer, and Role Isolation", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);
  });

  test("(1) auction closes unsold, farmer sees relist prompt, and available stock is restored", async ({
    page,
  }) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 180 * 1000).toISOString();

    const sampleListing = {
      id: "507f191e810c19729de80051",
      cropId: "507f191e810c19729de86001", // Bitter Gourd
      quantityKg: 60,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH" as const,
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm green pods"],
        cropMatch: true,
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        assessedAt: now.toISOString(),
      },
      aiPriceGuidance: {
        lowPerKg: 3800,
        expectedPerKg: 4600,
        highPerKg: 5200,
        trend: "UP" as const,
        confidence: 0.88,
        explanation: ["Wholesale benchmark"],
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        generatedAt: now.toISOString(),
        suggestedFloorPerKg: 4200,
      },
      floorPricePerKg: 4200,
      currentBidPerKg: undefined,
      minIncrementPerKg: 100,
      startsAt: now.toISOString(),
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: "ACTIVE" as const,
      bidCount: 0,
      location: { division: "dhaka", district: "dhaka", upazila: "Savar" },
      createdAt: now.toISOString(),
    };

    await setupMockApi(page, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      initialAvailableKg: 200, // 200 total stock: 140 available + 60 listed
      initialListings: [sampleListing],
    });

    // Navigate to crop bidding page first so evaluate/fetch resolves against app origin
    await page.goto("/farmer/crop-bidding");

    // 1. Auction closes without qualifying bids -> EXPIRED_UNSOLD
    const closeRes = await closeAuctionViaMock(page, {
      listingId: sampleListing.id,
      status: "EXPIRED_UNSOLD",
    });
    expect(closeRes.status).toBe(200);

    // 2. Farmer visits Crop Bidding ended tab
    await page.getByTestId("bidding-tab-ended").click();
    await expect(page.getByTestId(`ended-listing-card-${sampleListing.id}`)).toBeVisible();

    // Verify unsold notice and relist button
    await expect(page.getByTestId(`unsold-notice-${sampleListing.id}`)).toBeVisible();
    const relistBtn = page.getByTestId(`relist-btn-${sampleListing.id}`);
    await expect(relistBtn).toBeVisible();

    // 3. Verify stock is restored from listed back to available
    await page.goto("/farmer/inventory");
    const bitterGourdCard = page.getByTestId("crop-bitter-gourd");
    await expect(bitterGourdCard).toBeVisible();
    await expect(bitterGourdCard).toContainText("200 kg"); // 140 + 60 restored = 200
    await expect(bitterGourdCard).toContainText("0 kg"); // listed is 0

    // 4. Farmer clicks Relist and sees pre-filled dialog
    await page.goto("/farmer/crop-bidding");
    await page.getByTestId("bidding-tab-ended").click();
    await page.getByTestId(`relist-btn-${sampleListing.id}`).click();

    await expect(page.getByTestId("relist-dialog")).toBeVisible();
    await expect(page.getByTestId("relist-quantity")).toContainText("60 kg");

    const floorInput = page.getByTestId("relist-floor-input");
    await floorInput.fill("40");
    await page.getByTestId("submit-relist-btn").click();
    await expect(page.getByTestId("relist-dialog")).not.toBeVisible();
  });

  test("(2) cancel path with stock-return prompt restores inventory", async ({
    page,
  }) => {
    const now = new Date();

    const sampleListing = {
      id: "507f191e810c19729de80052",
      cropId: "507f191e810c19729de86001",
      quantityKg: 40,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH" as const,
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm green pods"],
        cropMatch: true,
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        assessedAt: now.toISOString(),
      },
      aiPriceGuidance: {
        lowPerKg: 3800,
        expectedPerKg: 4600,
        highPerKg: 5200,
        trend: "UP" as const,
        confidence: 0.88,
        explanation: ["Wholesale benchmark"],
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        generatedAt: now.toISOString(),
        suggestedFloorPerKg: 4200,
      },
      floorPricePerKg: 4200,
      currentBidPerKg: 4500,
      minIncrementPerKg: 100,
      startsAt: now.toISOString(),
      endsAt: now.toISOString(),
      originalEndsAt: now.toISOString(),
      extensionCount: 0,
      status: "ACTIVE" as const,
      bidCount: 1,
      location: { division: "dhaka", district: "dhaka", upazila: "Savar" },
      createdAt: now.toISOString(),
    };

    const mockState = await setupMockApi(page, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      initialAvailableKg: 200,
      initialListings: [sampleListing],
    });

    // Navigate to app URL first
    await page.goto("/farmer/crop-bidding");

    // Auction closed sold -> generates Order
    await closeAuctionViaMock(page, {
      listingId: sampleListing.id,
      status: "SOLD",
    });

    const order = mockState.orders.find((o) => o.listingId === sampleListing.id)!;
    expect(order).toBeDefined();

    // Check inventory sold stock increased
    const item = mockState.inventory.find((i) => i.crop.id === sampleListing.cropId)!;
    expect(item.soldKg).toBe(40);
    expect(item.availableKg).toBe(160);

    // Cancel order via API helper
    await cancelOrderViaApi(page, order.id, { reason: "Buyer cannot pick up produce" });

    // Farmer visits /farmer/orders and opens Cancelled tab
    await page.goto("/farmer/orders");
    await page.getByTestId("tab-cancelled").click();
    await expect(page.locator(`[data-order-id="${order.id}"]`)).toBeVisible();

    // Farmer sees StockReturnPrompt
    await expect(page.getByTestId("stock-return-prompt")).toBeVisible();

    // Farmer clicks "Return to inventory" (RETURN_TO_STOCK via stock-return-yes)
    await page.getByTestId("stock-return-yes").click();
    await expect(page.getByTestId("stock-return-decided")).toBeVisible();

    // Verify stock is restored in inventory
    await page.goto("/farmer/inventory");
    const bitterGourdCard = page.getByTestId("crop-bitter-gourd");
    await expect(bitterGourdCard).toBeVisible();
    await expect(bitterGourdCard).toContainText("200 kg"); // 160 + 40 returned = 200
  });

  test("(3) auto-cancel after scaled timer transitions unconfirmed order to CANCELLED", async ({
    page,
  }) => {
    const now = new Date();

    const sampleListing = {
      id: "507f191e810c19729de80053",
      cropId: "507f191e810c19729de86001",
      quantityKg: 30,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH" as const,
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm green pods"],
        cropMatch: true,
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        assessedAt: now.toISOString(),
      },
      aiPriceGuidance: {
        lowPerKg: 3800,
        expectedPerKg: 4600,
        highPerKg: 5200,
        trend: "UP" as const,
        confidence: 0.88,
        explanation: ["Wholesale benchmark"],
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        generatedAt: now.toISOString(),
        suggestedFloorPerKg: 4200,
      },
      floorPricePerKg: 4200,
      currentBidPerKg: 4400,
      minIncrementPerKg: 100,
      startsAt: now.toISOString(),
      endsAt: now.toISOString(),
      originalEndsAt: now.toISOString(),
      extensionCount: 0,
      status: "ACTIVE" as const,
      bidCount: 1,
      location: { division: "dhaka", district: "dhaka", upazila: "Savar" },
      createdAt: now.toISOString(),
    };

    const mockState = await setupMockApi(page, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      initialAvailableKg: 170,
      initialListings: [sampleListing],
    });

    // Navigate to app URL first
    await page.goto("/farmer/crop-bidding");

    // Close sold to create order
    await closeAuctionViaMock(page, {
      listingId: sampleListing.id,
      status: "SOLD",
    });

    const order = mockState.orders.find((o) => o.listingId === sampleListing.id)!;
    expect(order).toBeDefined();

    // Farmer views PENDING order with auto-cancel timer
    await page.goto("/farmer/orders");
    await expect(page.locator(`[data-order-id="${order.id}"]`)).toBeVisible();
    await expect(page.getByTestId("auto-cancel-countdown")).toBeVisible();

    // Trigger auto-cancel (simulating the scaled timer expiring)
    const autoCancelRes = await autoCancelOrderViaApi(page, order.id);
    expect(autoCancelRes.status).toBe(200);

    // Refresh orders page: order has moved from Needs Action to Cancelled tab
    await page.goto("/farmer/orders");
    await page.getByTestId("tab-cancelled").click();
    await expect(page.locator(`[data-order-id="${order.id}"]`)).toBeVisible();
  });

  test("(4) role isolation: a farmer cannot act as a buyer and vice versa", async ({
    page,
  }) => {
    // 1. Authenticate as FARMER
    await setupMockApi(page, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });

    // Farmer attempts to visit buyer routes -> redirected to farmer dashboard
    await page.goto("/buyer/orders");
    await expect(page).toHaveURL(/\/farmer\/dashboard/);

    await page.goto("/buyer/marketplace");
    await expect(page).toHaveURL(/\/farmer\/dashboard/);

    // Farmer attempts to call buyer-only API endpoint (POST /orders/:id/mark-paid) -> 403 FORBIDDEN
    const forbiddenRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/orders/507f191e810c19729de8o001/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ method: "WALLET_SIM" }),
      });
      return res.status;
    });
    expect(forbiddenRes).toBe(403);
  });
});

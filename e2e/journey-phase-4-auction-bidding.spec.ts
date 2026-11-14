import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";
import {
  cancelListingViaApi,
  closeAuctionViaMock,
  placeBidViaApi,
} from "./test-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Phase 4 End-to-End: Real-Time Bidding, Anti-Sniping, Closing, Relisting, and Cancel", () => {
  test.beforeEach(async ({ context }) => {
    // Authenticate farmer session cookie for all tests
    await context.addCookies([
      {
        name: "bazarbeat-session",
        value: "1",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
  });

  test("(1) farmer publishes a short listing, a buyer bids through API, and Crop Bidding page updates without refresh", async ({
    page,
  }) => {
    // 1. Setup mock API with 200 kg Bitter Gourd available
    await setupMockApi(page, { initialAuthenticated: true, initialAvailableKg: 200 });

    // 2. Publish a listing via the wizard
    await page.goto("/farmer/new-listing");
    await expect(page.getByTestId("step-1-crop")).toBeVisible();
    await page.getByTestId("crop-card-bitter-gourd").click();
    await page.getByTestId("step-1-continue").click();

    await expect(page.getByTestId("step-2-photos")).toBeVisible();
    const fixturePath = path.resolve(__dirname, "./fixtures/bitter-gourd-grade-a.jpg");
    await page.getByTestId("uploader-gallery-input").setInputFiles(fixturePath);
    await page.getByTestId("step-2-assess").click();

    await expect(page.getByTestId("step-3-ai-result")).toBeVisible();
    await page.getByTestId("step-3-continue").click();

    await expect(page.getByTestId("step-4-price")).toBeVisible();
    await page.getByTestId("use-suggested-floor-btn").click();
    await page.getByTestId("step-4-continue").click();

    await expect(page.getByTestId("step-5-quantity-timer")).toBeVisible();
    await page.getByTestId("lot-quantity-input").fill("50");
    await page.getByTestId("step-5-continue").click();

    await expect(page.getByTestId("step-6-review-publish")).toBeVisible();
    await page.getByTestId("publish-listing-btn").click();
    await expect(page.getByTestId("publish-success-screen")).toBeVisible();

    // 3. Navigate to Crop Bidding page
    await page.goto("/farmer/crop-bidding");
    await expect(page.getByTestId("crop-bidding-page")).toBeVisible();
    await expect(page.getByTestId("bidding-tab-live")).toHaveAttribute("aria-selected", "true");

    const listingCard = page.locator('[data-testid^="live-listing-card-"]').first();
    await expect(listingCard).toBeVisible();

    // Extract listing ID from card testid
    const cardTestId = await listingCard.getAttribute("data-testid");
    const listingId = cardTestId?.replace("live-listing-card-", "") || "";
    expect(listingId).toBeTruthy();

    // Verify initial card state (0 bids, floor price ৳42.00)
    await expect(page.getByTestId(`bid-count-${listingId}`)).toContainText(/no bids/i);
    await expect(page.getByTestId(`floor-price-${listingId}`)).toContainText("42.00");

    // 4. Buyer places a bid via API helper (৳45.00/kg -> 4500 poisha)
    const bidResponse = await placeBidViaApi(page, {
      listingId,
      amountPerKg: 4500,
    });
    expect(bidResponse.status).toBe(201);

    // 5. Verify Crop Bidding page updates in real time WITHOUT page refresh
    // - New bid toast appears
    await expect(page.getByTestId("new-bid-toast")).toBeVisible();

    // - Bid count increments to 1
    await expect(page.getByTestId(`bid-count-${listingId}`)).toContainText("1");

    // - Current price updates to ৳45.00
    await expect(page.getByTestId(`current-price-${listingId}`)).toContainText("45.00");

    // - Toggle bid history and verify new bid appears in history panel
    await page.getByTestId(`toggle-bid-history-${listingId}`).click();
    const historyPanel = page.getByTestId(`bid-history-panel-${listingId}`);
    await expect(historyPanel).toBeVisible();
    await expect(historyPanel).toContainText("45.00");
  });

  test("(2) a late bid triggers the 'Extended' state", async ({ page }) => {
    // 1. Setup mock API with an active listing that has an upcoming endsAt (e.g. 60 seconds left)
    const now = new Date();
    const shortEndsAt = new Date(now.getTime() + 60 * 1000).toISOString();

    const sampleListing = {
      id: "507f191e810c19729de80010",
      cropId: "507f191e810c19729de86001", // Bitter Gourd
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: "A" as const,
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
      minIncrementPerKg: 100,
      startsAt: now.toISOString(),
      endsAt: shortEndsAt,
      originalEndsAt: shortEndsAt,
      extensionCount: 0,
      status: "ACTIVE" as const,
      bidCount: 0,
      location: { division: "dhaka", district: "dhaka", upazila: "Savar" },
      createdAt: now.toISOString(),
    };

    await setupMockApi(page, {
      initialAuthenticated: true,
      initialAvailableKg: 200,
      initialListings: [sampleListing],
    });

    // 2. Open Crop Bidding page
    await page.goto("/farmer/crop-bidding");
    const listingCard = page.getByTestId(`live-listing-card-${sampleListing.id}`);
    await expect(listingCard).toBeVisible();

    // 3. Buyer places a late bid within the anti-sniping window
    const bidResponse = await placeBidViaApi(page, {
      listingId: sampleListing.id,
      amountPerKg: 4600,
      isLateBid: true,
    });
    expect(bidResponse.status).toBe(201);

    // 4. Verify countdown timer triggers "Extended" flash and updates
    await expect(page.getByTestId("countdown-extended-flash")).toBeVisible();
    await expect(page.getByTestId(`current-price-${sampleListing.id}`)).toContainText("46.00");
    await expect(page.getByTestId(`bid-count-${sampleListing.id}`)).toContainText("1");
  });

  test("(3) the auction ends sold and the farmer sees the result and inventory changes", async ({
    page,
  }) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 300 * 1000).toISOString();

    const sampleListing = {
      id: "507f191e810c19729de80020",
      cropId: "507f191e810c19729de86001",
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: "A" as const,
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
      currentBidPerKg: 4600,
      minIncrementPerKg: 100,
      startsAt: now.toISOString(),
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: "ACTIVE" as const,
      bidCount: 1,
      location: { division: "dhaka", district: "dhaka", upazila: "Savar" },
      createdAt: now.toISOString(),
    };

    await setupMockApi(page, {
      initialAuthenticated: true,
      initialAvailableKg: 200,
      initialListings: [sampleListing],
    });

    // 1. Open Crop Bidding page
    await page.goto("/farmer/crop-bidding");
    await expect(page.getByTestId(`live-listing-card-${sampleListing.id}`)).toBeVisible();

    // 2. Simulate auction closing as SOLD
    await closeAuctionViaMock(page, {
      listingId: sampleListing.id,
      status: "SOLD",
    });

    // 3. Switch to Ended tab
    await page.getByTestId("bidding-tab-ended").click();
    await expect(page.getByTestId(`ended-listing-card-${sampleListing.id}`)).toBeVisible();

    // Verify SOLD badge and winning price
    await expect(page.getByTestId("status-badge-SOLD")).toBeVisible();
    await expect(page.getByTestId(`winning-price-${sampleListing.id}`)).toContainText("46.00");

    // 4. Check Inventory: listed stock decreased by 50 kg, sold stock increased by 50 kg
    await page.goto("/farmer/inventory");
    await expect(page.getByTestId("inventory-page")).toBeVisible();

    // Bitter Gourd row: 150 kg available, 0 kg listed, 50 kg sold
    const bitterGourdCard = page.getByTestId("crop-bitter-gourd");
    await expect(bitterGourdCard).toBeVisible();
    await expect(bitterGourdCard).toContainText("150 kg");
    await expect(bitterGourdCard).toContainText("0 kg");
    await expect(bitterGourdCard).toContainText("50 kg");
  });

  test("(4) the auction ends unsold, the farmer sees the relist prompt and relists", async ({
    page,
  }) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 300 * 1000).toISOString();

    const sampleListing = {
      id: "507f191e810c19729de80030",
      cropId: "507f191e810c19729de86001",
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: "A" as const,
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
      initialAuthenticated: true,
      initialAvailableKg: 200,
      initialListings: [sampleListing],
    });

    // 1. Open Crop Bidding page
    await page.goto("/farmer/crop-bidding");
    await expect(page.getByTestId(`live-listing-card-${sampleListing.id}`)).toBeVisible();

    // 2. Simulate auction closing as EXPIRED_UNSOLD
    await closeAuctionViaMock(page, {
      listingId: sampleListing.id,
      status: "EXPIRED_UNSOLD",
    });

    // 3. Switch to Ended tab
    await page.getByTestId("bidding-tab-ended").click();
    await expect(page.getByTestId(`ended-listing-card-${sampleListing.id}`)).toBeVisible();

    // Verify unsold notice and relist button
    await expect(page.getByTestId(`unsold-notice-${sampleListing.id}`)).toBeVisible();
    const relistBtn = page.getByTestId(`relist-btn-${sampleListing.id}`);
    await expect(relistBtn).toBeVisible();

    // 4. Click Relist button to open Relist Dialog
    await relistBtn.click();
    await expect(page.getByTestId("relist-dialog")).toBeVisible();
    await expect(page.getByTestId("relist-quantity")).toContainText("50 kg");

    // Enter revised floor price (e.g. ৳40.00)
    const floorInput = page.getByTestId("relist-floor-input");
    await floorInput.fill("40");

    // Submit relist
    await page.getByTestId("submit-relist-btn").click();

    // 5. Verify relist succeeds, dialog closes, and tab switches to LIVE with new active auction
    await expect(page.getByTestId("relist-dialog")).not.toBeVisible();
    await expect(page.getByTestId("bidding-tab-live")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("bidding-cards-grid")).toBeVisible();
    await expect(page.locator('[data-testid^="live-listing-card-"]').first()).toBeVisible();
  });

  test("(5) cancel with no bids succeeds, but cancel is blocked once a bid exists", async ({
    page,
  }) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 300 * 1000).toISOString();

    const sampleListing = {
      id: "507f191e810c19729de80040",
      cropId: "507f191e810c19729de86001",
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: "A" as const,
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

    const sampleListingNoBids = {
      ...sampleListing,
      id: "507f191e810c19729de80040",
      bidCount: 0,
      currentBidPerKg: undefined,
    };

    const sampleListingWithBid = {
      ...sampleListing,
      id: "507f191e810c19729de80050",
      bidCount: 1,
      currentBidPerKg: 4500,
    };

    await setupMockApi(page, {
      initialAuthenticated: true,
      initialAvailableKg: 200,
      initialListings: [sampleListingNoBids, sampleListingWithBid],
    });

    // -------------------------------------------------------------
    // Part A: Cancel with no bids succeeds
    // -------------------------------------------------------------
    await page.goto("/farmer/crop-bidding");
    const listingCard = page.getByTestId(`live-listing-card-${sampleListingNoBids.id}`);
    await expect(listingCard).toBeVisible();

    // Cancel button is visible when bidCount is 0
    const cancelBtn = page.getByTestId(`cancel-listing-btn-${sampleListingNoBids.id}`);
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Confirm dialog opens
    await expect(page.getByTestId("cancel-confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-cancel-btn").click();

    // Dialog closes and card moves out of live grid
    await expect(page.getByTestId("cancel-confirm-dialog")).not.toBeVisible();
    await expect(page.getByTestId(`live-listing-card-${sampleListingNoBids.id}`)).not.toBeVisible();

    // Verify inventory: 50 kg reserved from sampleListingNoBids was restored back to available
    await page.goto("/farmer/inventory");
    await expect(page.getByTestId("inventory-page")).toBeVisible();
    const bitterGourdCard = page.getByTestId("crop-bitter-gourd");
    await expect(bitterGourdCard).toBeVisible();
    await expect(bitterGourdCard).toContainText("150 kg");
    await expect(bitterGourdCard).toContainText("50 kg");

    // -------------------------------------------------------------
    // Part B: Cancel is blocked once a bid is placed
    // -------------------------------------------------------------
    await page.goto("/farmer/crop-bidding");
    const cardWithBid = page.getByTestId(`live-listing-card-${sampleListingWithBid.id}`);
    await expect(cardWithBid).toBeVisible();

    // 1. UI check: Cancel button is hidden; Accept Now button is shown instead
    await expect(page.getByTestId(`cancel-listing-btn-${sampleListingWithBid.id}`)).not.toBeVisible();
    await expect(page.getByTestId(`accept-now-btn-${sampleListingWithBid.id}`)).toBeVisible();

    // 2. API check: Direct call to cancel endpoint is rejected with HTTP 400 HAS_BIDS
    const cancelResult = await cancelListingViaApi(page, sampleListingWithBid.id);
    expect(cancelResult.status).toBe(400);
    expect(cancelResult.body).toMatchObject({
      error: { code: "HAS_BIDS" },
    });
  });
});

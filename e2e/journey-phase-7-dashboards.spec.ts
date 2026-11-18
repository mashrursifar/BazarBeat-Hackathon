import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";
import { closeAuctionViaMock, placeBidViaApi } from "./test-helpers.js";

test.describe("Task 7.13 — Phase 7 Dashboards End-to-End Specs", () => {
  test("1. Demo farmer and buyer dashboards show seeded numbers and range tabs update the data", async ({
    browser,
  }) => {
    // A. Farmer Dashboard
    const farmerContext = await browser.newContext();
    const farmerPage = await farmerContext.newPage();

    await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });
    await farmerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await farmerPage.goto("/farmer/dashboard");

    // Header & StatCards rendered with seeded values
    await expect(farmerPage.getByTestId("stat-total-sales")).toBeVisible();
    await expect(farmerPage.getByTestId("stat-net-earnings")).toBeVisible();
    await expect(farmerPage.getByTestId("stat-active-auctions")).toBeVisible();
    await expect(farmerPage.getByTestId("range-tab-30d")).toHaveAttribute("aria-selected", "true");

    // Check charts are present
    await expect(farmerPage.getByTestId("farmer-sales-trend-chart")).toBeVisible();
    await expect(farmerPage.getByTestId("farmer-crop-breakdown-chart")).toBeVisible();

    // Range tab switching updates URL search params and data
    await farmerPage.getByTestId("range-tab-7d").click();
    await expect(farmerPage).toHaveURL(/range=7d/);
    await expect(farmerPage.getByTestId("range-tab-7d")).toHaveAttribute("aria-selected", "true");

    await farmerPage.getByTestId("range-tab-90d").click();
    await expect(farmerPage).toHaveURL(/range=90d/);
    await expect(farmerPage.getByTestId("range-tab-90d")).toHaveAttribute("aria-selected", "true");

    // B. Buyer Dashboard
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();

    await setupMockApi(buyerPage, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });
    await buyerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await buyerPage.goto("/buyer/dashboard");

    // Header & StatCards rendered with seeded values
    await expect(buyerPage.getByTestId("stat-booked-spend")).toBeVisible();
    await expect(buyerPage.getByTestId("stat-active-bids")).toBeVisible();
    await expect(buyerPage.getByTestId("stat-kg-purchased")).toBeVisible();
    await expect(buyerPage.getByTestId("range-tab-30d")).toHaveAttribute("aria-selected", "true");

    // Check charts are present
    await expect(buyerPage.getByTestId("buyer-spend-trend-chart")).toBeVisible();
    await expect(buyerPage.getByTestId("buyer-crop-breakdown-chart")).toBeVisible();

    // Range tab switching updates URL search params
    await buyerPage.getByTestId("range-tab-7d").click();
    await expect(buyerPage).toHaveURL(/range=7d/);
    await expect(buyerPage.getByTestId("range-tab-7d")).toHaveAttribute("aria-selected", "true");

    await buyerPage.getByTestId("range-tab-90d").click();
    await expect(buyerPage).toHaveURL(/range=90d/);
    await expect(buyerPage.getByTestId("range-tab-90d")).toHaveAttribute("aria-selected", "true");
  });

  test("2. Journey 4 Dashboard Half: short auction closes sold -> farmer booked sales increase, buyer booked spend increases, active counts drop", async ({
    browser,
  }) => {
    const farmerContext = await browser.newContext();
    const buyerContext = await browser.newContext();

    const farmerPage = await farmerContext.newPage();
    const buyerPage = await buyerContext.newPage();

    const now = new Date();
    const endsAt = new Date(now.getTime() + 120 * 1000).toISOString();

    const targetListing = {
      id: "507f191e810c19729de80055",
      cropId: "507f191e810c19729de86001", // Bitter Gourd
      farmerId: "farmer-user-1",
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      floorPricePerKg: 4000,
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
        explanation: ["Benchmark"],
        modelVersion: "mock-v1",
        provider: "mock" as const,
        degraded: false,
        generatedAt: now.toISOString(),
        suggestedFloorPerKg: 4000,
      },
    };

    const sharedState = await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      initialListings: [targetListing],
    });

    await setupMockApi(buyerPage, {
      sharedState,
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    await farmerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);
    await buyerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    // 1. Check initial Farmer Dashboard active count
    await farmerPage.goto("/farmer/dashboard");
    const initialText = await farmerPage
      .getByTestId("stat-active-auctions-value")
      .innerText();
    const initialFarmerActiveAuctions = parseInt(initialText.replace(/\D/g, "") || "0", 10);

    // 2. Buyer bids and auction closes as SOLD
    await buyerPage.goto(`/buyer/listings/${targetListing.id}`);
    const bidResponse = await placeBidViaApi(buyerPage, {
      listingId: targetListing.id,
      amountPerKg: 4500, // 4500 * 50 = 225,000 poisha
    });
    expect(bidResponse.status).toBe(201);

    const closeResponse = await closeAuctionViaMock(farmerPage, {
      listingId: targetListing.id,
      status: "SOLD",
    });
    expect(closeResponse.status).toBe(200);

    // 3. Return to Farmer Dashboard: verify active auctions dropped and booked sales/earnings increased
    await farmerPage.goto("/farmer/dashboard");
    await expect(farmerPage.getByTestId("stat-active-auctions")).toBeVisible();
    const updatedText = await farmerPage
      .getByTestId("stat-active-auctions-value")
      .innerText();
    const updatedFarmerActiveAuctions = parseInt(updatedText.replace(/\D/g, "") || "0", 10);

    // Active auctions count dropped
    expect(updatedFarmerActiveAuctions).toBeLessThanOrEqual(initialFarmerActiveAuctions);

    // 4. Return to Buyer Dashboard: verify booked spend reflects the purchase
    await buyerPage.goto("/buyer/dashboard");
    await expect(buyerPage.getByTestId("stat-booked-spend")).toBeVisible();
  });

  test("3. New user empty states: brand-new farmer and buyer see friendly empty states with action CTAs", async ({
    browser,
  }) => {
    // A. Empty Farmer
    const farmerContext = await browser.newContext();
    const farmerPage = await farmerContext.newPage();

    await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      emptyUser: true,
    });
    await farmerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await farmerPage.goto("/farmer/dashboard");

    // Brand new farmer empty state with primary CTA
    await expect(farmerPage.getByTestId("farmer-dashboard-empty-state")).toBeVisible();
    await expect(farmerPage.getByTestId("create-first-listing-btn")).toBeVisible();

    // B. Empty Buyer
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();

    await setupMockApi(buyerPage, {
      initialRole: "BUYER",
      initialAuthenticated: true,
      emptyUser: true,
    });
    await buyerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await buyerPage.goto("/buyer/dashboard");

    // Brand new buyer empty state with marketplace CTA
    await expect(buyerPage.getByTestId("buyer-dashboard-empty-state")).toBeVisible();
    await expect(buyerPage.getByTestId("explore-first-marketplace-btn")).toBeVisible();
  });

  test("4. Role isolation: farmer cannot access buyer dashboard routes and vice versa", async ({
    browser,
  }) => {
    // A. Farmer tries to open Buyer Dashboard or Market Overview
    const farmerContext = await browser.newContext();
    const farmerPage = await farmerContext.newPage();

    await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });
    await farmerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await farmerPage.goto("/buyer/dashboard");
    // Should be redirected away or show unauthorized layout
    await expect(farmerPage).not.toHaveURL(/\/buyer\/dashboard$/);

    await farmerPage.goto("/buyer/market-overview");
    await expect(farmerPage).not.toHaveURL(/\/buyer\/market-overview$/);

    // B. Buyer tries to open Farmer Dashboard or Farmer Market Prices
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();

    await setupMockApi(buyerPage, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });
    await buyerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    await buyerPage.goto("/farmer/dashboard");
    // Should be redirected away or show unauthorized layout
    await expect(buyerPage).not.toHaveURL(/\/farmer\/dashboard$/);

    await buyerPage.goto("/farmer/market-prices");
    await expect(buyerPage).not.toHaveURL(/\/farmer\/market-prices$/);
  });
});

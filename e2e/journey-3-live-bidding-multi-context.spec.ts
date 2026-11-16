import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";
import { placeBidViaApi } from "./test-helpers.js";

test.describe("Journey 3: Multi-Context Live Bidding and Real-Time Outbid Updates", () => {
  test("farmer on Crop Bidding and buyer on detail page: buyer's bid streams live to farmer, and second buyer outbid alerts first buyer live", async ({
    browser,
  }) => {
    // 1. Create two isolated browser contexts for Farmer and Buyer 1
    const farmerContext = await browser.newContext();
    const buyerContext = await browser.newContext();

    const farmerPage = await farmerContext.newPage();
    const buyerPage = await buyerContext.newPage();

    // 2. Setup mock API with shared state across both pages
    const sharedState = await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });

    await setupMockApi(buyerPage, {
      sharedState,
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    // Inject authenticated session cookies into each context
    await farmerContext.addCookies([
      {
        name: "bazarbeat-session",
        value: "1",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    await buyerContext.addCookies([
      {
        name: "bazarbeat-session",
        value: "1",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    // Choose an active listing with 0 initial bids
    const targetListing =
      sharedState.listings.find((l) => l.bidCount === 0) || sharedState.listings[0]!;
    const listingId = targetListing.id;
    const floorPriceTaka = (targetListing.floorPricePerKg / 100).toFixed(2);

    // 3. Farmer opens Crop Bidding page
    await farmerPage.goto("/farmer/crop-bidding");
    await expect(farmerPage.getByTestId("crop-bidding-page")).toBeVisible();
    await expect(farmerPage.getByTestId(`live-listing-card-${listingId}`)).toBeVisible();
    await expect(farmerPage.getByTestId(`bid-count-${listingId}`)).toContainText(/no bids/i);
    await expect(farmerPage.getByTestId(`floor-price-${listingId}`)).toContainText(floorPriceTaka);

    // 4. Buyer 1 opens the listing detail page in their own browser context
    await buyerPage.goto(`/buyer/listings/${listingId}`);
    await expect(buyerPage.getByTestId("buyer-listing-detail-page")).toBeVisible();
    await expect(buyerPage.getByTestId("status-not-bidding-banner")).toBeVisible();

    // 5. Buyer 1 places a valid bid through the interactive UI
    const customBidInput = buyerPage.getByTestId("custom-bid-input");
    await expect(customBidInput).toBeVisible();

    // Calculate a valid bid higher than floor (e.g. floor + 300 poisha = floor + ৳3.00)
    const buyerBidAmount = targetListing.floorPricePerKg + 300;
    const buyerBidTaka = (buyerBidAmount / 100).toFixed(2);
    await customBidInput.clear();
    await customBidInput.fill(buyerBidTaka);

    // Click submit to open binding bid confirmation dialog
    await buyerPage.getByTestId("place-bid-submit-btn").click();
    const bindingDialog = buyerPage.getByTestId("binding-bid-dialog");
    await expect(bindingDialog).toBeVisible();

    // Confirm bid in dialog
    await buyerPage.getByTestId("confirm-bid-btn").click();
    await expect(bindingDialog).not.toBeVisible();

    // Buyer 1 sees "Winning" status banner on their screen
    await expect(buyerPage.getByTestId("status-winning-banner")).toBeVisible();
    await expect(buyerPage.getByTestId("status-winning-banner")).toContainText(/winning/i);

    // 6. Farmer screen updates LIVE in real time WITHOUT page refresh
    // - New bid toast notification appears
    await expect(farmerPage.getByTestId("new-bid-toast")).toBeVisible();

    // - Bid count increments to 1
    await expect(farmerPage.getByTestId(`bid-count-${listingId}`)).toContainText("1");

    // - Current price updates to the buyer's bid amount
    await expect(farmerPage.getByTestId(`current-price-${listingId}`)).toContainText(buyerBidTaka);

    // 7. Extra spec: A second buyer (Buyer 2) outbids Buyer 1
    // Place a higher bid as Buyer 2 (e.g. buyerBidAmount + 200 poisha)
    const outbidAmount = buyerBidAmount + 200;
    const outbidTaka = (outbidAmount / 100).toFixed(2);

    const outbidResult = await placeBidViaApi(farmerPage, {
      listingId,
      amountPerKg: outbidAmount,
      buyerUser: "buyer-2",
    });
    expect(outbidResult.status).toBe(201);

    // 8. Verify Farmer screen updates with Buyer 2's outbid
    await expect(farmerPage.getByTestId(`bid-count-${listingId}`)).toContainText("2");
    await expect(farmerPage.getByTestId(`current-price-${listingId}`)).toContainText(outbidTaka);

    // 9. Verify Buyer 1 sees "You were outbid" LIVE without page reload
    await expect(buyerPage.getByTestId("status-outbid-banner")).toBeVisible();
    await expect(buyerPage.getByTestId("status-outbid-banner")).toContainText(/outbid/i);

    // Clean up browser contexts
    await farmerContext.close();
    await buyerContext.close();
  });
});

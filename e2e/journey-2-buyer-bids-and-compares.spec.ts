import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";
import { DEV_SEED_CREDENTIALS } from "./test-helpers.js";

test.describe("Journey 2: Buyer Bids, Compares, Filter, and Role Isolation", () => {
  test("buyer logs in, filters marketplace, compares same-crop listings, tests too-low bid validation, confirms binding bid, and verifies role guard", async ({
    page,
  }) => {
    // 1. Setup mock API in demo mode for buyer role
    const mockState = await setupMockApi(page, {
      initialAuthenticated: false,
      initialRole: "BUYER",
    });

    // Extract two bitter gourd listings for comparison assertions
    const bitterGourdListings = mockState.listings.filter(
      (l) => l.cropId === "507f191e810c19729de86001",
    );
    expect(bitterGourdListings.length).toBeGreaterThanOrEqual(2);
    const listingA = bitterGourdListings[0]!;
    const listingB = bitterGourdListings[1]!;

    // Find a potato listing to verify cross-crop compare tray rejection
    const potatoListing = mockState.listings.find(
      (l) => l.cropId === "507f191e810c19729de86002",
    );
    expect(potatoListing).toBeDefined();

    // 2. Buyer logs in with demo credentials
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();

    const phoneInput = page.locator('input[autocomplete="tel-national"]');
    await phoneInput.fill(DEV_SEED_CREDENTIALS.buyer.phone);

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(DEV_SEED_CREDENTIALS.buyer.password);

    await page.getByRole("button", { name: /log in/i }).click();

    // Navigates to buyer dashboard
    await expect(page).toHaveURL(/\/buyer\/dashboard/);

    // 3. Navigate to Marketplace
    await page.goto("/buyer/marketplace");
    await expect(page).toHaveURL(/\/buyer\/marketplace/);
    await expect(page.getByTestId("filter-crop-select")).toBeVisible();

    // 4. Filter marketplace by Crop (Bitter Gourd)
    await page.getByTestId("filter-crop-select").selectOption("bitter-gourd");
    await expect(page).toHaveURL(/crop=bitter-gourd/);

    // Verify filtered listing cards are visible
    const cardA = page.getByTestId(`listing-card-${listingA.id}`);
    const cardB = page.getByTestId(`listing-card-${listingB.id}`);
    await expect(cardA).toBeVisible();
    await expect(cardB).toBeVisible();

    // 5. Add two listings of the same crop to Compare Tray
    const checkboxA = page.getByTestId(`compare-checkbox-${listingA.id}`);
    await expect(checkboxA).toBeVisible();
    await checkboxA.check();

    // Compare tray appears with count 1
    const compareTray = page.getByTestId("compare-tray");
    await expect(compareTray).toBeVisible();
    await expect(page.getByTestId(`compare-tray-item-${listingA.id}`)).toBeVisible();

    // Check second listing
    const checkboxB = page.getByTestId(`compare-checkbox-${listingB.id}`);
    await checkboxB.check();
    await expect(page.getByTestId(`compare-tray-item-${listingB.id}`)).toBeVisible();

    // 6. Extra spec: Verify compare tray refuses a different crop
    // Clear crop filter to reveal potato listings
    await page.getByTestId("filter-crop-select").selectOption("");
    const potatoCardCheckbox = page.getByTestId(`compare-checkbox-${potatoListing!.id}`);
    await expect(potatoCardCheckbox).toBeVisible();
    // The potato checkbox must be disabled because compare tray is locked to Bitter Gourd
    await expect(potatoCardCheckbox).toBeDisabled();

    // 7. Open Compare page
    const compareSubmitBtn = page.getByTestId("compare-tray-submit");
    await expect(compareSubmitBtn).toBeEnabled();
    await compareSubmitBtn.click();

    await expect(page).toHaveURL(/\/buyer\/compare\?ids=/);
    await expect(page.getByRole("heading", { name: /compare produce/i })).toBeVisible();

    // 8. Check highlighted cells in the compare matrix
    // Verify columns for both listings are rendered
    const cellGradeA = page.getByTestId(`compare-cell-grade-${listingA.id}`);
    const cellGradeB = page.getByTestId(`compare-cell-grade-${listingB.id}`);
    await expect(cellGradeA).toBeVisible();
    await expect(cellGradeB).toBeVisible();

    // At least one listing must have highlighted cells (e.g. best grade or lowest price)
    const highlightedCells = page.locator('td[data-highlighted="true"]');
    const highlightCount = await highlightedCells.count();
    expect(highlightCount).toBeGreaterThanOrEqual(1);

    // 9. Open a listing detail page from Compare (click "Bid now" on listingB which has no prior bids)
    const bidNowBtn = page.getByTestId(`compare-bid-now-${listingB.id}`);
    await expect(bidNowBtn).toBeVisible();
    await bidNowBtn.click();

    await expect(page).toHaveURL(new RegExp(`/buyer/listings/${listingB.id}`));
    await expect(page.getByTestId("buyer-listing-detail-page")).toBeVisible();
    await expect(page.getByTestId("bid-panel")).toBeVisible();

    // 10. Test too-low bid validation: shows error with the minimum required
    const customBidInput = page.getByTestId("custom-bid-input");
    await expect(customBidInput).toBeVisible();
    await customBidInput.clear();
    await customBidInput.fill("10.00"); // Far below floor price

    const submitBidBtn = page.getByTestId("place-bid-submit-btn");
    await submitBidBtn.click();

    // Error banner is displayed and states the required minimum
    const errorBanner = page.getByTestId("bid-error-banner");
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/minimum required/i);

    // One-tap "Bid minimum" button is offered
    const bidMinBtn = page.getByTestId("bid-minimum-btn");
    await expect(bidMinBtn).toBeVisible();

    // 11. Click "Bid minimum" to correct amount and submit valid bid
    await bidMinBtn.click();
    await expect(errorBanner).not.toBeVisible();

    // Open binding confirmation dialog
    await submitBidBtn.click();
    const bindingDialog = page.getByTestId("binding-bid-dialog");
    await expect(bindingDialog).toBeVisible();
    await expect(page.getByTestId("binding-disclaimer")).toBeVisible();

    // Confirm binding bid
    const confirmBidBtn = page.getByTestId("confirm-bid-btn");
    await confirmBidBtn.click();

    // Dialog closes
    await expect(bindingDialog).not.toBeVisible();

    // Price updates and buyer sees "Winning" banner
    await expect(page.getByTestId("status-winning-banner")).toBeVisible();
    await expect(page.getByTestId("status-winning-banner")).toContainText(/winning/i);

    // 12. Extra spec: Verify a buyer cannot open farmer routes
    await page.goto("/farmer/crop-bidding");
    await expect(page).toHaveURL(/\/buyer\/dashboard/);

    await page.goto("/farmer/new-listing");
    await expect(page).toHaveURL(/\/buyer\/dashboard/);
  });
});

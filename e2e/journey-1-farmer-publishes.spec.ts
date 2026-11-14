import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Journey 1: Farmer Publishes Listing", () => {
  test("farmer logs in, uploads sample photo, assesses quality, sets floor price, and publishes live listing", async ({
    page,
  }) => {
    // 1. Setup mock API with unauthenticated initial state
    await setupMockApi(page, { initialAuthenticated: false, initialAvailableKg: 200 });

    // 2. Login as farmer
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();

    const phoneInput = page.locator('input[autocomplete="tel-national"]');
    await phoneInput.fill("01712345678");

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("password123");

    await page.getByRole("button", { name: /log in/i }).click();

    // 3. Navigates to farmer dashboard
    await expect(page).toHaveURL(/\/farmer\/dashboard/);

    // 4. Navigate to New Listing wizard
    await page.getByRole("link", { name: /new listing/i }).first().click();
    await expect(page).toHaveURL(/\/farmer\/new-listing/);

    // 5. Step 1: Crop selection
    await expect(page.getByTestId("step-1-crop")).toBeVisible();
    const bitterGourdCard = page.getByTestId("crop-card-bitter-gourd");
    await expect(bitterGourdCard).toBeVisible();
    await bitterGourdCard.click();

    const continueToPhotosBtn = page.getByTestId("step-1-continue");
    await expect(continueToPhotosBtn).toBeEnabled();
    await continueToPhotosBtn.click();

    // 6. Step 2: Upload photo fixture
    await expect(page.getByTestId("step-2-photos")).toBeVisible();
    const fixturePath = path.resolve(__dirname, "./fixtures/bitter-gourd-grade-a.jpg");

    // Upload file via hidden file input
    const fileInput = page.getByTestId("uploader-gallery-input");
    await fileInput.setInputFiles(fixturePath);

    const assessBtn = page.getByTestId("step-2-assess");
    await expect(assessBtn).toBeEnabled();
    await assessBtn.click();

    // 7. Step 3: AI quality assessment result
    await expect(page.getByTestId("step-3-ai-result")).toBeVisible();
    await expect(page.getByTestId("grade-badge-a")).toBeVisible();
    await expect(page.getByTestId("ai-confidence-band")).toContainText(/high/i);
    await expect(page.getByTestId("ai-reasons")).toBeVisible();

    const continueToPriceBtn = page.getByTestId("step-3-continue");
    await expect(continueToPriceBtn).toBeEnabled();
    await continueToPriceBtn.click();

    // 8. Step 4: Price Guidance & Floor Price
    await expect(page.getByTestId("step-4-price")).toBeVisible();
    await expect(page.getByTestId("price-range-visual")).toBeVisible();

    // Use suggested floor price shortcut (৳42.00)
    const useSuggestedFloorBtn = page.getByTestId("use-suggested-floor-btn");
    await expect(useSuggestedFloorBtn).toBeVisible();
    await useSuggestedFloorBtn.click();

    await expect(page.getByTestId("floor-status-ok")).toBeVisible();

    const continueToQtyBtn = page.getByTestId("step-4-continue");
    await expect(continueToQtyBtn).toBeEnabled();
    await continueToQtyBtn.click();

    // 9. Step 5: Quantity & Timer
    await expect(page.getByTestId("step-5-quantity-timer")).toBeVisible();
    await expect(page.getByTestId("available-stock-display")).toContainText("200 kg");

    const quantityInput = page.getByTestId("lot-quantity-input");
    await quantityInput.fill("50");

    // Select 1-hour duration preset
    const preset60 = page.getByTestId("duration-preset-60");
    if (await preset60.isVisible()) {
      await preset60.click();
    }

    const continueToReviewBtn = page.getByTestId("step-5-continue");
    await expect(continueToReviewBtn).toBeEnabled();
    await continueToReviewBtn.click();

    // 10. Step 6: Review & Publish
    await expect(page.getByTestId("step-6-review-publish")).toBeVisible();
    await expect(page.getByTestId("review-summary-card")).toBeVisible();

    const publishBtn = page.getByTestId("publish-listing-btn");
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    // 11. Success Screen confirmation
    await expect(page.getByTestId("publish-success-screen")).toBeVisible();

    // Click "View My Listings"
    await page.getByTestId("success-my-listings-link").click();
    await expect(page).toHaveURL(/\/farmer\/products/);

    // 12. Verified in My Listings page
    await expect(page.getByTestId("my-listings-page")).toBeVisible();
    await expect(page.getByText(/bitter gourd|করলা/i).first()).toBeVisible();
    await expect(page.getByTestId("grade-badge-a").first()).toBeVisible();
    await expect(page.getByText(/50 kg/i).first()).toBeVisible();
  });
});

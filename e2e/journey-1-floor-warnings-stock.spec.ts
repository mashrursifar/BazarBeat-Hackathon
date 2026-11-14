import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Journey 1 (Part 2): Floor Warnings and Stock Deduction Check", () => {
  test("shows below-market and overpriced warnings, and verifies inventory stock deduction on publish", async ({
    page,
    context,
  }) => {
    // 1. Setup mock API and browser session cookie
    await setupMockApi(page, { initialAuthenticated: true, initialAvailableKg: 200 });
    await context.addCookies([
      {
        name: "bazarbeat-session",
        value: "1",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    // 2. Start directly at New Listing page
    await page.goto("/farmer/new-listing");
    await expect(page.getByTestId("step-1-crop")).toBeVisible();

    // Step 1: Select Bitter Gourd
    await page.getByTestId("crop-card-bitter-gourd").click();
    await page.getByTestId("step-1-continue").click();

    // Step 2: Upload photo and assess
    await expect(page.getByTestId("step-2-photos")).toBeVisible();
    const fixturePath = path.resolve(__dirname, "./fixtures/bitter-gourd-grade-a.jpg");
    await page.getByTestId("uploader-gallery-input").setInputFiles(fixturePath);
    await page.getByTestId("step-2-assess").click();

    // Step 3: AI grade result
    await expect(page.getByTestId("step-3-ai-result")).toBeVisible();
    await page.getByTestId("step-3-continue").click();

    // Step 4: Verify Floor Price Warnings
    await expect(page.getByTestId("step-4-price")).toBeVisible();
    const floorInput = page.getByTestId("floor-price-input");

    // Case A: Below market warning (e.g. ৳30/kg < Low ৳38/kg)
    await floorInput.fill("30");
    await expect(page.getByTestId("floor-warning-below-market")).toBeVisible();

    // Case B: Overpriced warning (e.g. ৳75/kg > High ৳52 * 1.3 = ৳67.60/kg)
    await floorInput.fill("75");
    await expect(page.getByTestId("floor-warning-overpriced")).toBeVisible();

    // Case C: Valid floor within market range (e.g. ৳45/kg)
    await floorInput.fill("45");
    await expect(page.getByTestId("floor-status-ok")).toBeVisible();

    await page.getByTestId("step-4-continue").click();

    // Step 5: Quantity & Timer
    await expect(page.getByTestId("step-5-quantity-timer")).toBeVisible();
    await expect(page.getByTestId("available-stock-display")).toContainText("200 kg");

    await page.getByTestId("lot-quantity-input").fill("50");
    await page.getByTestId("step-5-continue").click();

    // Step 6: Review & Publish
    await expect(page.getByTestId("step-6-review-publish")).toBeVisible();
    await page.getByTestId("publish-listing-btn").click();

    // Published successfully!
    await expect(page.getByTestId("publish-success-screen")).toBeVisible();

    // 3. Stock Check: Navigate to Inventory and verify available decreases & listed increases
    await page.goto("/farmer/inventory");
    await expect(page.getByTestId("inventory-page")).toBeVisible();

    // Available was 200 kg, published 50 kg -> Now 150 kg available, 50 kg listed
    await expect(page.getByText("150 kg").first()).toBeVisible();
    await expect(page.getByText("50 kg").first()).toBeVisible();
  });
});

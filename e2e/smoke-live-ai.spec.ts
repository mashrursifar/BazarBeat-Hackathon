import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Task G7 — Opt-In Live Gemini AI Grading Smoke Test
 *
 * Verifies live grading against the deployed stack using a curated demo photo.
 * Ensures the real Gemini model grades the photo correctly, reports High confidence,
 * emits the expected model version, and renders true provider attribution in the UI.
 *
 * To run:
 *   TEST_LIVE_AI=true npx playwright test e2e/smoke-live-ai.spec.ts
 *   or:
 *   E2E_LIVE_AI=true npm run test:smoke:ai
 */

const isLiveAiOptedIn = Boolean(
  process.env.TEST_LIVE_AI === "true" ||
  process.env.TEST_LIVE_AI === "1" ||
  process.env.E2E_LIVE_AI === "true" ||
  process.env.E2E_LIVE_AI === "1",
);

const DEMO_FARMER = {
  phone: process.env.DEV_FARMER_PHONE || "01700000001",
  password: process.env.DEV_FARMER_PASSWORD || "farmerpassword123",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURATED_CROP_SLUG = "onion";
const CURATED_PHOTO_A_PATH = path.resolve(__dirname, "./fixtures/onion-grade-a.jpg");

test.describe("Task G7 — Live AI Grading Deployment Smoke Suite", () => {
  test.beforeEach(() => {
    test.skip(
      !isLiveAiOptedIn,
      "Opt-in test suite: Set TEST_LIVE_AI=true or E2E_LIVE_AI=true to verify live AI grading on deployed stack.",
    );
  });

  test("1. Live AI grading endpoint validates curated photo with Gemini", async ({ request }) => {
    // 1. Authenticate farmer (requires CSRF protection header on mutating POST)
    const loginRes = await request.post("/api/v1/auth/login", {
      headers: {
        "X-CSRF-Protection": "1",
      },
      data: {
        phone: DEMO_FARMER.phone,
        password: DEMO_FARMER.password,
      },
    });
    expect(loginRes.status()).toBe(200);

    // 2. Fetch crop ID
    const cropsRes = await request.get("/api/v1/crops");
    expect(cropsRes.status()).toBe(200);
    const cropsJson = await cropsRes.json();
    const targetCrop = (cropsJson.data || []).find(
      (c: { slug: string }) => c.slug.toLowerCase() === CURATED_CROP_SLUG,
    );
    expect(targetCrop).toBeDefined();

    // 3. Read curated photo buffer
    expect(fs.existsSync(CURATED_PHOTO_A_PATH)).toBe(true);
    const imageBuffer = fs.readFileSync(CURATED_PHOTO_A_PATH);

    // 4. Submit multipart assessment
    const assessRes = await request.post("/api/v1/ai/assess-quality", {
      headers: {
        "X-CSRF-Protection": "1",
      },
      multipart: {
        cropId: targetCrop.id,
        images: {
          name: "onion-curated-a.jpg",
          mimeType: "image/jpeg",
          buffer: imageBuffer,
        },
      },
    });

    expect(assessRes.status()).toBe(200);
    const body = await assessRes.json();
    expect(body.data).toBeDefined();

    // 5. Assert live Gemini grading attributes
    expect(body.data.grade).toBe("A");
    expect(body.data.confidence).toBeGreaterThanOrEqual(0.8);
    expect(body.data.confidenceBand).toBe("HIGH");
    expect(body.data.cropMatch).toBe(true);
    expect(body.data.provider).toBe("gemini");
    expect(body.data.degraded).toBe(false);
    expect(typeof body.data.modelVersion).toBe("string");
    expect(body.data.modelVersion.length).toBeGreaterThan(0);
    expect(body.data.assessmentToken).toBeDefined();
  });

  test("2. Farmer listing wizard live grading flow shows Gemini attribution and Grade A", async ({
    page,
  }) => {
    // 1. Log in as farmer
    await page.goto("/login");
    const phoneInput = page
      .locator("#login-phone")
      .or(page.locator('input[autocomplete="tel-national"]'))
      .first();
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole("button", { name: /log in/i });

    await phoneInput.fill(DEMO_FARMER.phone);
    await passwordInput.fill(DEMO_FARMER.password);
    await submitBtn.click();
    await expect(page).toHaveURL(/\/farmer\/dashboard/, { timeout: 15_000 });

    // 2. Navigate to new listing wizard (/farmer/new-listing)
    await page.goto("/farmer/new-listing");
    await expect(page).toHaveURL(/\/farmer\/new-listing/);

    // 3. Step 1: Select Onion
    await expect(page.getByTestId("step-1-crop")).toBeVisible({ timeout: 15_000 });
    const cropCard = page.getByTestId(`crop-card-${CURATED_CROP_SLUG}`);
    await expect(cropCard).toBeVisible();
    await cropCard.click();

    const continueBtn = page.getByTestId("step-1-continue");
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // 4. Step 2: Upload curated onion photo
    await expect(page.getByTestId("step-2-photos")).toBeVisible({ timeout: 15_000 });
    const fileInput = page
      .getByTestId("uploader-gallery-input")
      .or(page.locator('input[type="file"]'))
      .first();
    await fileInput.setInputFiles(CURATED_PHOTO_A_PATH);

    // Click assess button
    const assessButton = page.getByTestId("step-2-assess");
    await expect(assessButton).toBeEnabled({ timeout: 10_000 });
    await assessButton.click();

    // 5. Step 3: Verify AI result
    await expect(page.getByTestId("step-3-ai-result")).toBeVisible({ timeout: 35_000 });

    // Verify Grade A badge
    await expect(page.getByTestId("grade-badge-a")).toBeVisible();

    // Verify High confidence
    await expect(page.getByTestId("ai-confidence-band")).toContainText(/high/i);

    // Verify Gemini provider chip / badge
    const aiBadge = page.getByTestId("ai-assessed-badge");
    await expect(aiBadge).toBeVisible();
    await expect(aiBadge).toContainText(/Gemini|জেমিনাই/i);

    // Verify no degraded mode notice
    await expect(page.getByTestId("degraded-notice")).toHaveCount(0);
  });
});

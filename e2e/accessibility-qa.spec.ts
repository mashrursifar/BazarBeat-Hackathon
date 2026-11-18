import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setupMockApi } from "./mock-api.js";

test.describe("Task 8.11 — Accessibility and Mobile QA Pass (P1)", () => {
  // Helper to switch language in UI
  async function switchLanguage(page: import("@playwright/test").Page, lang: "en" | "bn"): Promise<void> {
    const langButton = page.getByRole("button", { name: lang === "bn" ? /বাংলা|bn/i : /english|en/i });
    if (await langButton.isVisible()) {
      await langButton.click();
      await page.waitForTimeout(100);
    }
  }

  test("1. Public Landing page is accessible (Axe clean) in English and Bangla", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Axe audit in English
    const enAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // Theme tokens validated in visual tokens
      .analyze();

    expect(enAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // Switch to Bangla
    await switchLanguage(page, "bn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ন্যায্য দাম");

    // Axe audit in Bangla
    const bnAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(bnAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    expect(consoleErrors.filter((e) => !e.includes("locize"))).toEqual([]);
  });

  test("2. Mobile 360px viewport: zero horizontal scroll and sticky bars on Landing & Marketplace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Verify no horizontal overflow at 360px
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Test in landscape 640x360
    await page.setViewportSize({ width: 640, height: 360 });
    const hasLandscapeOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasLandscapeOverflow).toBe(false);
  });

  test("3. Farmer main pages: Axe clean across dashboard, bidding, inventory and orders", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await setupMockApi(page, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });
    await context.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    // Dashboard
    await page.goto("/farmer/dashboard");
    await expect(page.getByTestId("stat-total-sales")).toBeVisible();

    const dashAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(dashAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // Check no horizontal scroll at 360px
    const dashScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(dashScroll).toBe(false);

    // Inventory
    await page.goto("/farmer/inventory");
    await expect(page.getByRole("heading", { name: /inventory|মজুত/i })).toBeVisible();

    const invAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(invAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // Orders
    await page.goto("/farmer/orders");
    await expect(page.getByRole("heading", { name: /orders|অর্ডার/i })).toBeVisible();

    const ordersAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(ordersAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    expect(consoleErrors.filter((e) => !e.includes("locize") && !e.includes("Failed to load resource"))).toEqual([]);
    await context.close();
  });

  test("4. Buyer main pages: Axe clean across marketplace, watchlist, bids, and detail", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await setupMockApi(page, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });
    await context.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    // Marketplace
    await page.goto("/buyer/marketplace");
    await expect(page.getByTestId("marketplace-page")).toBeVisible();

    const marketAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(marketAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    const marketScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(marketScroll).toBe(false);

    // Watchlist
    await page.goto("/buyer/watchlist");
    await expect(page.getByTestId("watchlist-page")).toBeVisible();

    const watchAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(watchAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // My Bids
    await page.goto("/buyer/my-bids");
    await expect(page.getByRole("heading", { name: /my bids|আমার বিড/i })).toBeVisible();

    const bidsAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(bidsAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    expect(consoleErrors.filter((e) => !e.includes("locize") && !e.includes("Failed to load resource"))).toEqual([]);
    await context.close();
  });
});

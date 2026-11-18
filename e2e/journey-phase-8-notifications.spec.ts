import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setupMockApi } from "./mock-api.js";
import {
  addToWatchlistViaApi,
  dispatchMockUserSse,
  placeBidViaApi,
} from "./test-helpers.js";

test.describe("Task 8.13 — Phase 8 End-to-End Suite: Notifications, Watchlist, Bangla & Accessibility", () => {
  test("1. Multi-actor live notifications: bid toast, outbid alert, and unread coalescing", async ({
    browser,
  }) => {
    // Isolated contexts for Farmer, Buyer 1, and Buyer 2
    const farmerContext = await browser.newContext();
    const buyer1Context = await browser.newContext();
    const buyer2Context = await browser.newContext();

    const farmerPage = await farmerContext.newPage();
    const buyer1Page = await buyer1Context.newPage();
    const buyer2Page = await buyer2Context.newPage();

    const sharedState = await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });

    await setupMockApi(buyer1Page, {
      sharedState,
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    await setupMockApi(buyer2Page, {
      sharedState,
      initialRole: "BUYER_TWO",
      initialAuthenticated: true,
    });

    await farmerContext.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);
    await buyer1Context.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);
    await buyer2Context.addCookies([
      { name: "bazarbeat-session", value: "1", domain: "127.0.0.1", path: "/" },
    ]);

    // Choose target active listing
    const targetListing =
      sharedState.listings.find((l) => l.bidCount === 0 && l.status === "ACTIVE") ||
      sharedState.listings[0]!;
    const listingId = targetListing.id;
    const openingBid = targetListing.floorPricePerKg + 100;

    // 1. Farmer navigates to Dashboard (has notification bell)
    await farmerPage.goto("/farmer/dashboard");
    await expect(farmerPage.getByTestId("notification-bell")).toBeVisible();
    await expect(farmerPage.getByTestId("notification-badge")).toBeHidden();

    // 2. Buyer 1 opens listing detail and places a bid
    await buyer1Page.goto(`/buyer/listings/${listingId}`);
    await expect(buyer1Page.getByTestId("listing-detail-page")).toBeVisible();

    const bidRes1 = await placeBidViaApi(buyer1Page, {
      listingId,
      amountPerKg: openingBid,
    });
    expect(bidRes1.status).toBe(201);

    // 3. Farmer sees bell badge update to 1 and live toast appears
    await expect(farmerPage.getByTestId("notification-badge")).toBeVisible({ timeout: 5000 });
    await expect(farmerPage.getByTestId("notification-badge")).toContainText("1");
    await expect(farmerPage.getByTestId("notification-toast")).toBeVisible({ timeout: 5000 });

    // 4. Buyer 1 navigates to Buyer Dashboard so toast isn't suppressed
    await buyer1Page.goto("/buyer/dashboard");
    await expect(buyer1Page.getByTestId("notification-bell")).toBeVisible();

    // 5. Buyer 2 outbids Buyer 1
    const outbidAmount = openingBid + 200;
    const bidRes2 = await placeBidViaApi(buyer2Page, {
      listingId,
      amountPerKg: outbidAmount,
      buyerUser: "buyer-2",
    });
    expect(bidRes2.status).toBe(201);

    // 6. Buyer 1 receives OUTBID alert and toast
    await expect(buyer1Page.getByTestId("notification-badge")).toBeVisible({ timeout: 5000 });
    await expect(buyer1Page.getByTestId("notification-toast")).toBeVisible({ timeout: 5000 });

    // 7. Farmer's NEW_BID notification coalesced: unread count remains 1
    await expect(farmerPage.getByTestId("notification-badge")).toContainText("1");

    // Farmer opens notifications page and verifies coalescing
    await farmerPage.goto("/notifications");
    await expect(farmerPage.getByTestId("notifications-page")).toBeVisible();
    await expect(farmerPage.getByTestId("notification-card-NEW_BID")).toBeVisible();

    await farmerContext.close();
    await buyer1Context.close();
    await buyer2Context.close();
  });

  test("2. Auction closing notifications: winner (AUCTION_WON), farmer (AUCTION_SOLD), and loser (AUCTION_LOST)", async ({
    browser,
  }) => {
    const farmerContext = await browser.newContext();
    const winnerContext = await browser.newContext();
    const loserContext = await browser.newContext();

    const farmerPage = await farmerContext.newPage();
    const winnerPage = await winnerContext.newPage();
    const loserPage = await loserContext.newPage();

    const sharedState = await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
    });

    await setupMockApi(winnerPage, {
      sharedState,
      initialRole: "BUYER_TWO",
      initialAuthenticated: true,
    });

    await setupMockApi(loserPage, {
      sharedState,
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    const targetListing = sharedState.listings[0]!;
    const listingId = targetListing.id;

    // Simulate bids so winner and loser are recorded
    sharedState.bids.push(
      {
        id: "bid-loser",
        listingId,
        buyerId: "507f191e810c19729de86007", // Demo Buyer 1
        amountPerKg: targetListing.floorPricePerKg + 100,
        totalAmount: (targetListing.floorPricePerKg + 100) * targetListing.quantityKg,
        seq: 1,
        status: "ACCEPTED",
        placedAt: new Date().toISOString(),
      },
      {
        id: "bid-winner",
        listingId,
        buyerId: "507f191e810c19729de86008", // Demo Buyer 2
        amountPerKg: targetListing.floorPricePerKg + 300,
        totalAmount: (targetListing.floorPricePerKg + 300) * targetListing.quantityKg,
        seq: 2,
        status: "ACCEPTED",
        placedAt: new Date().toISOString(),
      },
    );
    targetListing.bidCount = 2;
    targetListing.currentBidPerKg = targetListing.floorPricePerKg + 300;

    // Close auction as SOLD
    await farmerPage.goto("/farmer/dashboard");
    const closeRes = await farmerPage.evaluate(async (id) => {
      const res = await fetch(`/api/v1/listings/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ status: "SOLD" }),
      });
      return res.status;
    }, listingId);
    expect(closeRes).toBe(200);

    // Verify farmer has AUCTION_SOLD notification
    await farmerPage.goto("/notifications");
    await expect(farmerPage.getByTestId("notification-card-AUCTION_SOLD")).toBeVisible();

    // Verify winner has AUCTION_WON notification
    await winnerPage.goto("/notifications");
    await expect(winnerPage.getByTestId("notification-card-AUCTION_WON")).toBeVisible();

    // Verify loser has AUCTION_LOST notification
    await loserPage.goto("/notifications");
    await expect(loserPage.getByTestId("notification-card-AUCTION_LOST")).toBeVisible();

    await farmerContext.close();
    await winnerContext.close();
    await loserContext.close();
  });

  test("3. Watchlist lifecycle: toggle, ended listing visibility, and demo ending-soon notification", async ({
    page,
  }) => {
    const sharedState = await setupMockApi(page, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    const targetListing = sharedState.listings[0]!;
    const listingId = targetListing.id;

    // 1. Buyer visits Marketplace and toggles watchlist on listing
    await page.goto("/buyer/marketplace");
    await expect(page.getByTestId("marketplace-page")).toBeVisible();

    const watchBtn = page.getByTestId(`watchlist-toggle-${listingId}`);
    await expect(watchBtn).toBeVisible();
    await watchBtn.click();

    // Verify active watched state
    await expect(watchBtn).toHaveAttribute("aria-pressed", "true");

    // 2. Open Watchlist page
    await page.goto("/buyer/watchlist");
    await expect(page.getByTestId("watchlist-page")).toBeVisible();
    await expect(page.getByTestId(`listing-card-${listingId}`)).toBeVisible();

    // 3. Trigger live ENDING_SOON notification in demo mode via mock SSE
    const endingSoonNotif = {
      id: `notif-ending-soon-${listingId}`,
      userId: sharedState.currentUser.id,
      type: "ENDING_SOON",
      title: "Auction ending soon!",
      body: "Less than 15 minutes left on watched produce.",
      params: {
        listingId,
        cropSlug: "bitter-gourd",
        endsAt: targetListing.endsAt,
      },
      entityRef: { kind: "listing", id: listingId },
      isRead: false,
      dedupeKey: `ENDING_SOON:${listingId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sharedState.notifications.unshift(endingSoonNotif as unknown as import("@bazarbeat/shared").NotificationItem);
    await dispatchMockUserSse(page, "notification.created", {
      notification: endingSoonNotif,
      unreadCount: 1,
    });

    await expect(page.getByTestId("notification-badge")).toContainText("1");

    // 4. Mark listing as ended: it remains accessible read-only in Watchlist (Gap 7 / D-34)
    targetListing.status = "SOLD";
    targetListing.closedAt = new Date().toISOString();

    await page.goto("/buyer/watchlist");
    await expect(page.getByTestId(`listing-card-${listingId}`)).toBeVisible();
    await expect(page.getByText(/ended/i).first()).toBeVisible();
  });

  test("4. Bangla language switch on Notifications & Watchlist: document lang, numerals, and no missing keys", async ({
    page,
  }) => {
    const sharedState = await setupMockApi(page, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    const targetListing = sharedState.listings[0]!;
    await addToWatchlistViaApi(page, targetListing.id);

    // Seed sample notification
    sharedState.notifications.unshift({
      id: "notif-sample-1",
      userId: sharedState.currentUser.id,
      type: "NEW_BID" as unknown as import("@bazarbeat/shared").NotificationType,
      title: "New bid on Bitter Gourd",
      body: "A new bid was placed.",
      params: {
        listingId: targetListing.id,
        cropSlug: "bitter-gourd",
        currentBidPerKg: 4500,
        bidCount: 3,
      },
      entityRef: { kind: "listing", id: targetListing.id },
      isRead: false,
      dedupeKey: `NEW_BID:${targetListing.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await page.goto("/notifications");
    await expect(page.getByTestId("notifications-page")).toBeVisible();

    // Switch language to Bangla
    const langBtn = page.getByRole("button", { name: /বাংলা|bn/i });
    if (await langBtn.isVisible()) {
      await langBtn.click();
    }

    // 1. Verify document lang attribute is 'bn'
    const docLang = await page.evaluate(() => document.documentElement.lang);
    expect(docLang).toBe("bn");

    // 2. Verify notifications title and tabs in Bangla
    await expect(page.getByRole("heading", { level: 1 })).toContainText("বিজ্ঞপ্তি");
    await expect(page.getByRole("tab", { name: /সব/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /অপঠিত/i })).toBeVisible();

    // 3. Verify no missing-key markers in visible text
    const pageText = await page.evaluate(() => document.body.innerText);
    expect(pageText).not.toContain("[missing");
    expect(pageText).not.toContain("notifications.");
    expect(pageText).not.toContain("watchlist.");

    // 4. Verify Bangla numerals on Watchlist page
    await page.goto("/buyer/watchlist");
    await expect(page.getByTestId("watchlist-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("সংরক্ষিত তালিকা");

    // Check for presence of Bengali numerals
    const watchlistText = await page.evaluate(() => document.body.innerText);
    const hasBanglaDigits = /[০-৯]/.test(watchlistText);
    expect(hasBanglaDigits).toBe(true);
  });

  test("5. Accessibility audit on Notifications & Watchlist: zero serious/critical Axe violations", async ({
    page,
  }) => {
    await setupMockApi(page, {
      initialRole: "BUYER",
      initialAuthenticated: true,
    });

    // Audit Notifications page
    await page.goto("/notifications");
    await expect(page.getByTestId("notifications-page")).toBeVisible();

    const notifAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(notifAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // Audit Watchlist page
    await page.goto("/buyer/watchlist");
    await expect(page.getByTestId("watchlist-page")).toBeVisible();

    const watchAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(watchAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

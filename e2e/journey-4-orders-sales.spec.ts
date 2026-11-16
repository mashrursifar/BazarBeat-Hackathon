import { expect, test } from "@playwright/test";
import { CropGrade } from "@bazarbeat/shared";
import { setupMockApi } from "./mock-api.js";
import {
  closeAuctionViaMock,
  placeBidViaApi,
} from "./test-helpers.js";

test.describe("Journey 4: Auction Closes Sold, Order Lifecycle, Handover, Payment, Delivery, and Sales/Earnings", () => {
  test("short auction closes sold, both roles see order, farmer confirms with handover, buyer pays with simulated wallet, farmer marks delivered, buyer confirms receipt, and sales/earnings show the sale", async ({
    browser,
  }) => {
    // 1. Create two isolated browser contexts for Farmer and Buyer
    const farmerContext = await browser.newContext();
    const buyerContext = await browser.newContext();

    const farmerPage = await farmerContext.newPage();
    const buyerPage = await buyerContext.newPage();

    // 2. Setup mock API with shared state across both contexts
    const now = new Date();
    const endsAt = new Date(now.getTime() + 120 * 1000).toISOString();

    const targetListing = {
      id: "507f191e810c19729de80041",
      cropId: "507f191e810c19729de86001", // Bitter Gourd
      quantityKg: 50,
      images: [{ url: "/images/crops/placeholder.svg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH" as const,
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm green bitter gourd pods with optimal texture"],
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

    const sharedState = await setupMockApi(farmerPage, {
      initialRole: "FARMER",
      initialAuthenticated: true,
      initialAvailableKg: 200,
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

    // Navigate pages to app URL before evaluating relative API calls
    await farmerPage.goto("/farmer/crop-bidding");
    await buyerPage.goto(`/buyer/listings/${targetListing.id}`);

    // 3. Buyer places a valid winning bid on the active listing (৳45.00/kg -> 4500 poisha)
    const bidResponse = await placeBidViaApi(buyerPage, {
      listingId: targetListing.id,
      amountPerKg: 4500,
    });
    expect(bidResponse.status).toBe(201);

    // 4. Auction timer ends and closes as SOLD
    const closeResponse = await closeAuctionViaMock(farmerPage, {
      listingId: targetListing.id,
      status: "SOLD",
    });
    expect(closeResponse.status).toBe(200);

    // Find the newly generated order ID from sharedState
    const order = sharedState.orders.find((o) => o.listingId === targetListing.id);
    expect(order).toBeDefined();
    const orderId = order!.id;

    // 5. Both roles see the new PENDING order in their orders list
    // - Farmer navigates to /farmer/orders
    await farmerPage.goto("/farmer/orders");
    await expect(farmerPage.getByTestId("tab-needs_action")).toBeVisible();
    await expect(farmerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // Extra spec: Contact details hidden before confirmation (privacy rule!)
    await expect(farmerPage.getByTestId("counterparty-masked")).toBeVisible();
    await expect(farmerPage.getByTestId("counterparty-revealed")).not.toBeVisible();

    // - Buyer navigates to /buyer/orders
    await buyerPage.goto("/buyer/orders");
    await expect(buyerPage.getByTestId("tab-needs_action")).toBeVisible();
    await expect(buyerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // Extra spec: Contact details hidden on buyer side too before confirmation
    await expect(buyerPage.getByTestId("counterparty-masked")).toBeVisible();
    await expect(buyerPage.getByTestId("counterparty-revealed")).not.toBeVisible();

    // 6. Farmer confirms with handover info
    await farmerPage.getByTestId("order-action-confirm").click();

    // Handover modal dialog opens
    const confirmDialog = farmerPage.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();

    // Enter pickup instructions and submit
    const noteInput = confirmDialog.locator("#handover-note");
    await noteInput.fill("Call 1 hour before pickup at Savar farm gate.");

    const submitConfirmBtn = confirmDialog.getByRole("button", { name: /confirm order/i });
    await submitConfirmBtn.click();
    await expect(confirmDialog).not.toBeVisible();

    // Farmer sees order in "In progress" tab or card status updated to CONFIRMED
    await farmerPage.getByTestId("tab-in_progress").click();
    await expect(farmerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // Extra spec: Contact details now REVEALED after confirmation!
    await expect(farmerPage.getByTestId("counterparty-revealed")).toBeVisible();
    await expect(farmerPage.getByTestId("counterparty-masked")).not.toBeVisible();

    // 7. Buyer pays with simulated wallet
    await buyerPage.getByTestId("tab-in_progress").click();
    await expect(buyerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // Extra spec: Contact details now REVEALED to buyer as well!
    await expect(buyerPage.getByTestId("counterparty-revealed")).toBeVisible();
    await expect(buyerPage.getByTestId("counterparty-masked")).not.toBeVisible();

    // Click Pay Now
    await buyerPage.getByTestId("order-action-pay").click();

    // Pay dialog opens with Demo payment banner
    const payDialog = buyerPage.getByRole("dialog");
    await expect(payDialog).toBeVisible();
    await expect(payDialog.getByTestId("demo-payment-banner")).toBeVisible();
    await expect(payDialog.getByTestId("demo-payment-pill")).toBeVisible();

    // Select Simulated Wallet option and submit
    await payDialog.getByTestId("payment-option-wallet").click();
    await payDialog.getByTestId("confirm-wallet-pay-btn").click();
    await expect(payDialog).not.toBeVisible();

    // Buyer sees payment badge updated to Paid
    await expect(buyerPage.getByTestId("payment-badge-paid")).toBeVisible();

    // 8. Farmer marks produce delivered
    await farmerPage.getByTestId("order-action-deliver").click();

    // Order transitions to Delivered tab
    await farmerPage.getByTestId("tab-delivered").click();
    await expect(farmerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // 9. Buyer confirms receipt
    await buyerPage.getByTestId("tab-delivered").click();
    await expect(buyerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    await buyerPage.getByTestId("order-action-confirm-receipt").click();

    // Order moves to Completed tab
    await buyerPage.getByTestId("tab-completed").click();
    await expect(buyerPage.locator(`[data-order-id="${orderId}"]`)).toBeVisible();

    // 10. Sales and Earnings show the completed sale on Farmer side
    // - Check /farmer/sales
    await farmerPage.goto("/farmer/sales");
    await expect(farmerPage.getByTestId("sales-page")).toBeVisible();
    await expect(farmerPage.getByTestId(`sale-row-${orderId}`)).toBeVisible();
    await expect(farmerPage.getByTestId(`sale-row-${orderId}`)).toContainText("50 kg");

    // - Check /farmer/earnings
    await farmerPage.goto("/farmer/earnings");
    await expect(farmerPage.getByTestId("earnings-page")).toBeVisible();
    await expect(farmerPage.getByTestId("kpi-settled-net")).toBeVisible();
  });
});

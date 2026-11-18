import {
  type NotificationItem,
  NotificationType,
  OrderSubEvent,
} from "@bazarbeat/shared";
import { describe, expect, it } from "vitest";

import { renderNotificationText } from "./notification-text.js";
import { i18n } from "../../lib/i18n.js";

function makeNotification(
  type: NotificationType,
  params: Record<string, unknown>,
  fallbackTitle = "Fallback Title",
  fallbackBody = "Fallback Body",
): NotificationItem {
  return {
    id: "notif-1",
    userId: "user-1",
    type,
    title: fallbackTitle,
    body: fallbackBody,
    params: params as unknown as NotificationItem["params"],
    entityRef: { kind: "listing", id: "507f1f77bcf86cd799439011" },
    isRead: false,
    readAt: null,
    dedupeKey: `key-${type}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Notification Text Rendering from i18n Keys (Task 8.6)", () => {
  const t = (key: string, options?: Record<string, unknown>): string =>
    i18n.t(key, options);

  it("renders NEW_BID in English and Bangla with formatted amounts", () => {
    const notif = makeNotification(NotificationType.NEW_BID, {
      cropSlug: "potato",
      currentBidPerKg: 3500,
      bidCount: 3,
    });

    const en = renderNotificationText(notif, t, "en");
    expect(en.title).toBe("New bid on Potato");
    expect(en.body).toBe("Current bid is ৳35.00 per kg with 3 bids.");

    const bn = renderNotificationText(notif, t, "bn");
    expect(bn.title).toBe("আলু-এ নতুন বিড");
    expect(bn.body).toContain("৳৩৫.০০");
    expect(bn.body).toContain("৩টি");
  });

  it("renders OUTBID in English and Bangla", () => {
    const notif = makeNotification(NotificationType.OUTBID, {
      cropSlug: "onion",
      newBidPerKg: 4200,
    });

    const en = renderNotificationText(notif, t, "en");
    expect(en.title).toBe("You were outbid on Onion");
    expect(en.body).toBe("A new bid of ৳42.00 per kg was placed.");

    const bn = renderNotificationText(notif, t, "bn");
    expect(bn.title).toBe("পেঁয়াজ-এ আপনার বিড ছাড়িয়ে গেছে");
    expect(bn.body).toContain("৳৪২.০০");
  });

  it("renders AUCTION_SOLD and AUCTION_WON in English and Bangla", () => {
    const sold = makeNotification(NotificationType.AUCTION_SOLD, {
      cropSlug: "tomato",
      winningBidPerKg: 2800,
      totalAmount: 1400000,
      orderId: "ord-1",
    });

    const enSold = renderNotificationText(sold, t, "en");
    expect(enSold.title).toBe("Auction sold! Tomato");
    expect(enSold.body).toBe("Your listing sold for ৳28.00 per kg. Total: ৳14000.00.");

    const won = makeNotification(NotificationType.AUCTION_WON, {
      cropSlug: "tomato",
      winningBidPerKg: 2800,
      totalAmount: 1400000,
      orderId: "ord-1",
    });

    const enWon = renderNotificationText(won, t, "en");
    expect(enWon.title).toBe("You won the auction! Tomato");
    expect(enWon.body).toBe("You won Tomato at ৳28.00 per kg. Please proceed to payment.");
  });

  it("renders AUCTION_LOST in English and Bangla", () => {
    const notif = makeNotification(NotificationType.AUCTION_LOST, {
      cropSlug: "cabbage",
      finalPricePerKg: 2200,
    });

    const en = renderNotificationText(notif, t, "en");
    expect(en.title).toBe("Auction ended for Cabbage");
    expect(en.body).toBe("The auction closed at ৳22.00 per kg.");
  });

  it("renders AUCTION_UNSOLD and ENDING_SOON in English and Bangla", () => {
    const unsold = makeNotification(NotificationType.AUCTION_UNSOLD, {
      cropSlug: "cauliflower",
    });

    const enUnsold = renderNotificationText(unsold, t, "en");
    expect(enUnsold.title).toBe("Auction ended without bids: Cauliflower");

    const endingSoon = makeNotification(NotificationType.ENDING_SOON, {
      cropSlug: "potato",
    });

    const enEnding = renderNotificationText(endingSoon, t, "en");
    expect(enEnding.title).toBe("Auction ending soon for Potato");
  });

  it("renders ORDER_UPDATE sub-events in English and Bangla", () => {
    const orderCreated = makeNotification(NotificationType.ORDER_UPDATE, {
      cropSlug: "potato",
      subEvent: OrderSubEvent.CREATED,
    });
    expect(renderNotificationText(orderCreated, t, "en").title).toBe(
      "Order created for Potato",
    );

    const orderPaid = makeNotification(NotificationType.ORDER_UPDATE, {
      cropSlug: "potato",
      subEvent: OrderSubEvent.PAID,
    });
    expect(renderNotificationText(orderPaid, t, "en").title).toBe(
      "Payment received for Potato",
    );

    const orderCompleted = makeNotification(NotificationType.ORDER_UPDATE, {
      cropSlug: "potato",
      subEvent: OrderSubEvent.COMPLETED,
    });
    expect(renderNotificationText(orderCompleted, t, "en").title).toBe(
      "Order completed for Potato",
    );
  });

  it("falls back to notification title and body if key missing or unknown type", () => {
    const fallbackNotif = makeNotification(
      "UNKNOWN_TYPE" as unknown as NotificationType,
      {},
      "Custom Stored Title",
      "Custom Stored Body",
    );

    const result = renderNotificationText(fallbackNotif, t, "en");
    expect(result.title).toBe("Custom Stored Title");
    expect(result.body).toBe("Custom Stored Body");
  });
});

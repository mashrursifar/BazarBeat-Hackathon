import {
  type NotificationItem,
  NotificationType,
  OrderSubEvent,
  UserRole,
} from "@bazarbeat/shared";
import { describe, expect, it } from "vitest";

import { getNotificationTargetRoute } from "./notification-routing.js";

function makeNotification(
  type: NotificationType,
  entityKind: "listing" | "order",
  entityId: string,
  params: Record<string, unknown> = {},
): NotificationItem {
  return {
    id: "notif-1",
    userId: "user-1",
    type,
    title: "Test title",
    body: "Test body",
    params: {
      listingId: entityKind === "listing" ? entityId : undefined,
      orderId: entityKind === "order" ? entityId : undefined,
      cropSlug: "potato",
      ...params,
    } as unknown as NotificationItem["params"],
    entityRef: { kind: entityKind, id: entityId },
    isRead: false,
    readAt: null,
    dedupeKey: `key-${type}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Notification Target Route Mapping (Task 8.6)", () => {
  it("maps OUTBID and buyer ENDING_SOON to buyer marketplace listing detail", () => {
    const outbid = makeNotification(NotificationType.OUTBID, "listing", "list-123");
    expect(getNotificationTargetRoute(outbid, UserRole.BUYER)).toBe("/buyer/marketplace/list-123");

    const endingSoonBuyer = makeNotification(NotificationType.ENDING_SOON, "listing", "list-456");
    expect(getNotificationTargetRoute(endingSoonBuyer, UserRole.BUYER)).toBe(
      "/buyer/marketplace/list-456",
    );
  });

  it("maps NEW_BID and farmer ENDING_SOON to farmer Crop Bidding page", () => {
    const newBid = makeNotification(NotificationType.NEW_BID, "listing", "list-123");
    expect(getNotificationTargetRoute(newBid, UserRole.FARMER)).toBe("/farmer/crop-bidding");

    const endingSoonFarmer = makeNotification(NotificationType.ENDING_SOON, "listing", "list-456");
    expect(getNotificationTargetRoute(endingSoonFarmer, UserRole.FARMER)).toBe(
      "/farmer/crop-bidding",
    );
  });

  it("maps AUCTION_UNSOLD to farmer products ended tab", () => {
    const unsold = makeNotification(NotificationType.AUCTION_UNSOLD, "listing", "list-123");
    expect(getNotificationTargetRoute(unsold, UserRole.FARMER)).toBe(
      "/farmer/products?tab=ENDED",
    );
  });

  it("maps AUCTION_SOLD to farmer order detail page", () => {
    const sold = makeNotification(NotificationType.AUCTION_SOLD, "order", "ord-789", {
      orderId: "ord-789",
    });
    expect(getNotificationTargetRoute(sold, UserRole.FARMER)).toBe("/farmer/orders/ord-789");
  });

  it("maps AUCTION_WON to buyer order detail page", () => {
    const won = makeNotification(NotificationType.AUCTION_WON, "order", "ord-789", {
      orderId: "ord-789",
    });
    expect(getNotificationTargetRoute(won, UserRole.BUYER)).toBe("/buyer/orders/ord-789");
  });

  it("maps AUCTION_LOST to buyer marketplace listing detail", () => {
    const lost = makeNotification(NotificationType.AUCTION_LOST, "listing", "list-123");
    expect(getNotificationTargetRoute(lost, UserRole.BUYER)).toBe("/buyer/marketplace/list-123");
  });

  it("maps ORDER_UPDATE sub-events to the role-specific order page", () => {
    const orderFarmer = makeNotification(NotificationType.ORDER_UPDATE, "order", "ord-999", {
      orderId: "ord-999",
      subEvent: OrderSubEvent.PAID,
    });
    expect(getNotificationTargetRoute(orderFarmer, UserRole.FARMER)).toBe("/farmer/orders/ord-999");

    const orderBuyer = makeNotification(NotificationType.ORDER_UPDATE, "order", "ord-999", {
      orderId: "ord-999",
      subEvent: OrderSubEvent.CONFIRMED,
    });
    expect(getNotificationTargetRoute(orderBuyer, UserRole.BUYER)).toBe("/buyer/orders/ord-999");
  });
});

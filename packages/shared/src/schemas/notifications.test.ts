import { describe, expect, it } from "vitest";
import {
  DomainEventName,
  GradingReasonCode,
  ListingStatus,
  NotificationType,
  OrderSubEvent,
  PriceReasonCode,
} from "../enums.js";
import {
  NOTIFICATION_MATRIX,
  auctionLostNotificationParamsSchema,
  auctionSoldNotificationParamsSchema,
  auctionUnsoldNotificationParamsSchema,
  auctionWonNotificationParamsSchema,
  buildNotificationDedupeKey,
  endingSoonNotificationParamsSchema,
  markNotificationsReadRequestSchema,
  newBidNotificationParamsSchema,
  notificationItemSchema,
  notificationListResponseSchema,
  notificationQuerySchema,
  orderUpdateNotificationParamsSchema,
  outbidNotificationParamsSchema,
} from "./notifications.js";
import {
  gradingReasonItemSchema,
  priceReasonItemSchema,
} from "./ai-listings.js";
import {
  addWatchlistRequestSchema,
  watchlistItemSchema,
  watchlistResponseSchema,
} from "./watchlist.js";
import { NOTIFICATION_TIMING, WATCHLIST_LIMITS, getEndingSoonWindowMs } from "../timing.js";

describe("Notification Contracts & Rules (Task 8.1)", () => {
  const listingId = "507f1f77bcf86cd799439011";
  const orderId = "507f1f77bcf86cd799439022";
  const userId = "507f1f77bcf86cd799439033";
  const isoTime = "2026-11-18T10:00:00.000Z";

  describe("Notification Params Schemas & Privacy", () => {
    it("validates NEW_BID params and rejects user identity fields", () => {
      const valid = {
        listingId,
        cropSlug: "onion",
        currentBidPerKg: 6500,
        bidCount: 3,
      };
      expect(newBidNotificationParamsSchema.parse(valid)).toEqual(valid);

      // Rejects buyerId, farmerId or extraneous PII
      expect(() =>
        newBidNotificationParamsSchema.parse({ ...valid, buyerId: userId }),
      ).toThrow();
    });

    it("validates OUTBID params and rejects user identity fields", () => {
      const valid = {
        listingId,
        cropSlug: "potato",
        newBidPerKg: 4200,
      };
      expect(outbidNotificationParamsSchema.parse(valid)).toEqual(valid);

      expect(() =>
        outbidNotificationParamsSchema.parse({ ...valid, outbidBy: "Buyer #2" }),
      ).toThrow();
    });

    it("validates AUCTION_SOLD and AUCTION_WON params", () => {
      const soldParams = {
        listingId,
        cropSlug: "green-chilli",
        orderId,
        winningBidPerKg: 14500,
        totalAmount: 725000,
      };
      expect(auctionSoldNotificationParamsSchema.parse(soldParams)).toEqual(soldParams);
      expect(auctionWonNotificationParamsSchema.parse(soldParams)).toEqual(soldParams);
    });

    it("validates AUCTION_LOST params", () => {
      const valid = {
        listingId,
        cropSlug: "bitter-gourd",
        finalPricePerKg: 8500,
      };
      expect(auctionLostNotificationParamsSchema.parse(valid)).toEqual(valid);
    });

    it("validates AUCTION_UNSOLD params", () => {
      const valid = {
        listingId,
        cropSlug: "eggplant",
      };
      expect(auctionUnsoldNotificationParamsSchema.parse(valid)).toEqual(valid);
    });

    it("validates ORDER_UPDATE params with subEvents", () => {
      const valid = {
        orderId,
        listingId,
        cropSlug: "onion",
        subEvent: OrderSubEvent.CREATED,
        deadline: isoTime,
      };
      expect(orderUpdateNotificationParamsSchema.parse(valid)).toEqual(valid);

      expect(() =>
        orderUpdateNotificationParamsSchema.parse({
          ...valid,
          subEvent: "UNKNOWN_SUBEVENT",
        }),
      ).toThrow();
    });

    it("validates ENDING_SOON params", () => {
      const valid = {
        listingId,
        cropSlug: "potato",
        endsAt: isoTime,
      };
      expect(endingSoonNotificationParamsSchema.parse(valid)).toEqual(valid);
    });
  });

  describe("buildNotificationDedupeKey", () => {
    it("builds coalesced dedupe key for NEW_BID per listing", () => {
      const key1 = buildNotificationDedupeKey(NotificationType.NEW_BID, {
        listingId: "listing-1",
        amountPerKg: 5000,
      });
      const key2 = buildNotificationDedupeKey(NotificationType.NEW_BID, {
        listingId: "listing-1",
        amountPerKg: 5500,
      });
      expect(key1).toBe("NEW_BID:listing-1");
      expect(key2).toBe("NEW_BID:listing-1");
      expect(key1).toBe(key2);
    });

    it("builds unique dedupe key for OUTBID per price point", () => {
      const key1 = buildNotificationDedupeKey(NotificationType.OUTBID, {
        listingId: "listing-1",
        newBidPerKg: 5500,
      });
      const key2 = buildNotificationDedupeKey(NotificationType.OUTBID, {
        listingId: "listing-1",
        newBidPerKg: 6000,
      });
      expect(key1).toBe("OUTBID:listing-1:5500");
      expect(key2).toBe("OUTBID:listing-1:6000");
      expect(key1).not.toBe(key2);
    });

    it("builds dedupe keys for auction outcomes", () => {
      expect(
        buildNotificationDedupeKey(NotificationType.AUCTION_SOLD, { listingId: "l-1" }),
      ).toBe("AUCTION_SOLD:l-1");
      expect(
        buildNotificationDedupeKey(NotificationType.AUCTION_WON, { listingId: "l-1" }),
      ).toBe("AUCTION_WON:l-1");
      expect(
        buildNotificationDedupeKey(NotificationType.AUCTION_LOST, { listingId: "l-1" }),
      ).toBe("AUCTION_LOST:l-1");
      expect(
        buildNotificationDedupeKey(NotificationType.AUCTION_UNSOLD, { listingId: "l-1" }),
      ).toBe("AUCTION_UNSOLD:l-1");
    });

    it("builds dedupe key for ORDER_UPDATE per subEvent", () => {
      const key = buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: "o-1",
        subEvent: OrderSubEvent.PAID,
      });
      expect(key).toBe("ORDER_UPDATE:o-1:PAID");
    });

    it("builds dedupe key for ENDING_SOON once per listing", () => {
      const key = buildNotificationDedupeKey(NotificationType.ENDING_SOON, {
        listingId: "listing-xyz",
      });
      expect(key).toBe("ENDING_SOON:listing-xyz");
    });
  });

  describe("Notification Item & List Schemas", () => {
    it("validates complete NotificationItem and NotificationListResponse with unreadCount", () => {
      const item = {
        id: "notif-1",
        userId,
        type: NotificationType.NEW_BID,
        title: "New bid on Onion",
        body: "A new bid of ৳65.00/kg was placed.",
        params: {
          listingId,
          cropSlug: "onion",
          currentBidPerKg: 6500,
          bidCount: 2,
        },
        entityRef: { kind: "listing" as const, id: listingId },
        isRead: false,
        readAt: null,
        dedupeKey: "NEW_BID:" + listingId,
        createdAt: isoTime,
        updatedAt: isoTime,
      };

      const parsedItem = notificationItemSchema.parse(item);
      expect(parsedItem.id).toBe("notif-1");
      expect(parsedItem.isRead).toBe(false);

      const response = {
        data: [item],
        meta: {
          serverTime: isoTime,
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          unreadCount: 1,
        },
      };

      const parsedResponse = notificationListResponseSchema.parse(response);
      expect(parsedResponse.meta.unreadCount).toBe(1);
    });

    it("validates notificationQuerySchema", () => {
      expect(notificationQuerySchema.parse({})).toEqual({});
      expect(
        notificationQuerySchema.parse({ unreadOnly: "true", page: "2", limit: "15" }),
      ).toEqual({
        unreadOnly: true,
        page: 2,
        limit: 15,
      });
      expect(
        notificationQuerySchema.parse({ unreadOnly: false, page: 1, limit: 20 }),
      ).toEqual({
        unreadOnly: false,
        page: 1,
        limit: 20,
      });
      expect(() => notificationQuerySchema.parse({ limit: "99" })).toThrow();
    });

    it("validates markNotificationsReadRequestSchema", () => {
      expect(markNotificationsReadRequestSchema.parse({ ids: ["n-1", "n-2"] })).toEqual({
        ids: ["n-1", "n-2"],
      });
      expect(markNotificationsReadRequestSchema.parse({ all: true })).toEqual({ all: true });

      // Rejects empty body
      expect(() => markNotificationsReadRequestSchema.parse({})).toThrow();
      expect(() => markNotificationsReadRequestSchema.parse({ ids: [] })).toThrow();
    });
  });

  describe("Notification Matrix Definition", () => {
    it("covers all matrix events from docs/phase-8.md", () => {
      expect(NOTIFICATION_MATRIX.length).toBeGreaterThanOrEqual(13);

      const bidPlacedEntries = NOTIFICATION_MATRIX.filter(
        (e) => e.event === DomainEventName.BID_PLACED,
      );
      expect(bidPlacedEntries).toHaveLength(2);
      expect(bidPlacedEntries.some((e) => e.recipient === "FARMER" && e.type === NotificationType.NEW_BID)).toBe(true);
      expect(
        bidPlacedEntries.some((e) => e.recipient === "PREVIOUS_HIGHEST_BIDDER" && e.type === NotificationType.OUTBID),
      ).toBe(true);

      const closedEntries = NOTIFICATION_MATRIX.filter(
        (e) => e.event === DomainEventName.AUCTION_CLOSED,
      );
      expect(closedEntries.some((e) => e.type === NotificationType.AUCTION_SOLD)).toBe(true);
      expect(closedEntries.some((e) => e.type === NotificationType.AUCTION_WON)).toBe(true);
      expect(closedEntries.some((e) => e.type === NotificationType.AUCTION_LOST)).toBe(true);
      expect(closedEntries.some((e) => e.type === NotificationType.AUCTION_UNSOLD)).toBe(true);
    });
  });

  describe("Watchlist & Timing Constants", () => {
    it("validates watchlistItemSchema and addWatchlistRequestSchema", () => {
      const item = {
        id: listingId,
        userId,
        listingId,
        createdAt: isoTime,
      };
      expect(watchlistItemSchema.parse(item)).toEqual(item);

      const addReq = { listingId };
      expect(addWatchlistRequestSchema.parse(addReq)).toEqual(addReq);

      const card = {
        id: listingId,
        cropId: listingId,
        crop: {
          id: listingId,
          slug: "potato",
          nameEn: "Potato",
          nameBn: "আলু",
          unit: "kg",
        },
        grade: "A" as const,
        quantityKg: 500,
        floorPricePerKg: 3000,
        currentBidPerKg: 3200,
        displayPricePerKg: 3200,
        totalDisplayCost: 3200 * 500,
        minIncrementPerKg: 100,
        hasBids: true,
        bidCount: 3,
        startsAt: isoTime,
        endsAt: isoTime,
        status: ListingStatus.ACTIVE,
        location: {
          division: "Dhaka",
          district: "Gazipur",
          upazila: "Sreepur",
        },
        thumbnailUrl: "https://example.com/thumb.jpg",
        isWatched: true,
      };

      const resp = {
        data: [card],
        meta: {
          serverTime: isoTime,
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      };
      expect(watchlistResponseSchema.parse(resp)).toEqual(resp);
    });

    it("verifies timing and limits constants", () => {
      expect(NOTIFICATION_TIMING.RETENTION_DAYS).toBe(60);
      expect(NOTIFICATION_TIMING.ENDING_SOON_WINDOW_MS).toBe(15 * 60 * 1000);
      expect(NOTIFICATION_TIMING.DEMO_ENDING_SOON_WINDOW_MS).toBe(30 * 1000);
      expect(WATCHLIST_LIMITS.MAX_ITEMS).toBe(50);
      expect(NOTIFICATION_TIMING.MAX_CONCURRENT_USER_STREAMS).toBe(6);

      expect(getEndingSoonWindowMs(false)).toBe(15 * 60 * 1000);
      expect(getEndingSoonWindowMs(true)).toBe(30 * 1000);
    });
  });

  describe("AI Reason Codes & Schemas", () => {
    it("validates GradingReasonItem and PriceReasonItem", () => {
      const gradingItem = {
        code: GradingReasonCode.COLOR_UNIFORM,
        params: { variationPercent: 2 },
      };
      expect(gradingReasonItemSchema.parse(gradingItem)).toEqual(gradingItem);

      const priceItem = {
        code: PriceReasonCode.TREND_UP,
        params: { weeklyChangePercent: 5 },
      };
      expect(priceReasonItemSchema.parse(priceItem)).toEqual(priceItem);
    });
  });
});

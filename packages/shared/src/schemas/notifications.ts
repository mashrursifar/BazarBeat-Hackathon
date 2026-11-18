import { z } from "zod";
import { DomainEventName, NotificationType, OrderSubEvent } from "../enums.js";

/**
 * Params schema per notification type.
 *
 * PRIVACY GUARANTEE (docs/phase-8.md Gap 1 / Decision D-32):
 * Params contain structured identifiers and amounts needed to render localized text
 * on the client from i18n keys.
 * PARAMS NEVER CONTAIN ANOTHER USER'S IDENTITY, NAME, OR CONTACT DETAILS.
 */

export const newBidNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    currentBidPerKg: z.number().int().positive(),
    bidCount: z.number().int().positive(),
  })
  .strict();

export type NewBidNotificationParams = z.infer<typeof newBidNotificationParamsSchema>;

export const outbidNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    newBidPerKg: z.number().int().positive(),
  })
  .strict();

export type OutbidNotificationParams = z.infer<typeof outbidNotificationParamsSchema>;

export const auctionSoldNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    orderId: z.string().min(1),
    winningBidPerKg: z.number().int().positive(),
    totalAmount: z.number().int().positive(),
  })
  .strict();

export type AuctionSoldNotificationParams = z.infer<typeof auctionSoldNotificationParamsSchema>;

export const auctionWonNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    orderId: z.string().min(1),
    winningBidPerKg: z.number().int().positive(),
    totalAmount: z.number().int().positive(),
  })
  .strict();

export type AuctionWonNotificationParams = z.infer<typeof auctionWonNotificationParamsSchema>;

export const auctionLostNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    finalPricePerKg: z.number().int().positive(),
  })
  .strict();

export type AuctionLostNotificationParams = z.infer<typeof auctionLostNotificationParamsSchema>;

export const auctionUnsoldNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
  })
  .strict();

export type AuctionUnsoldNotificationParams = z.infer<typeof auctionUnsoldNotificationParamsSchema>;

export const orderUpdateNotificationParamsSchema = z
  .object({
    orderId: z.string().min(1),
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    subEvent: z.nativeEnum(OrderSubEvent),
    deadline: z.string().datetime().optional(),
  })
  .strict();

export type OrderUpdateNotificationParams = z.infer<typeof orderUpdateNotificationParamsSchema>;

export const endingSoonNotificationParamsSchema = z
  .object({
    listingId: z.string().min(1),
    cropSlug: z.string().min(1),
    endsAt: z.string().datetime(),
  })
  .strict();

export type EndingSoonNotificationParams = z.infer<typeof endingSoonNotificationParamsSchema>;

export const notificationParamsSchema = z.union([
  newBidNotificationParamsSchema,
  outbidNotificationParamsSchema,
  auctionSoldNotificationParamsSchema,
  auctionWonNotificationParamsSchema,
  auctionLostNotificationParamsSchema,
  auctionUnsoldNotificationParamsSchema,
  orderUpdateNotificationParamsSchema,
  endingSoonNotificationParamsSchema,
]);

export type NotificationParams = z.infer<typeof notificationParamsSchema>;

export const notificationEntityRefSchema = z
  .object({
    kind: z.enum(["listing", "order"]),
    id: z.string().min(1),
  })
  .strict();

export type NotificationEntityRef = z.infer<typeof notificationEntityRefSchema>;

export const notificationItemSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    type: z.nativeEnum(NotificationType),
    title: z.string().min(1),
    body: z.string().min(1),
    params: notificationParamsSchema,
    entityRef: notificationEntityRefSchema,
    isRead: z.boolean(),
    readAt: z.string().datetime().nullable().optional(),
    dedupeKey: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationListResponseSchema = z
  .object({
    data: z.array(notificationItemSchema),
    meta: z
      .object({
        serverTime: z.string().datetime(),
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
        unreadCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

export const markNotificationsReadRequestSchema = z
  .object({
    ids: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .strict()
  .refine(
    (val) => (Array.isArray(val.ids) && val.ids.length > 0) || val.all === true,
    {
      message: "Must provide non-empty ids array or all: true",
      path: ["ids"],
    },
  );

export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;

/**
 * DedupeKey Builder (Decision D-33).
 *
 * Rules:
 * - NEW_BID: NEW_BID:${listingId} (coalesced per listing while unread)
 * - OUTBID: OUTBID:${listingId}:${amountPerKg} (includes new price per kg)
 * - AUCTION_SOLD: AUCTION_SOLD:${listingId}
 * - AUCTION_WON: AUCTION_WON:${listingId}
 * - AUCTION_LOST: AUCTION_LOST:${listingId}
 * - AUCTION_UNSOLD: AUCTION_UNSOLD:${listingId}
 * - ORDER_UPDATE: ORDER_UPDATE:${orderId}:${subEvent}
 * - ENDING_SOON: ENDING_SOON:${listingId} (sent once per listing per user)
 */
export function buildNotificationDedupeKey(
  type: NotificationType,
  details: {
    listingId?: string;
    orderId?: string;
    subEvent?: OrderSubEvent;
    amountPerKg?: number;
    newBidPerKg?: number;
  },
): string {
  switch (type) {
    case NotificationType.NEW_BID:
      return `NEW_BID:${details.listingId}`;
    case NotificationType.OUTBID:
      return `OUTBID:${details.listingId}:${details.newBidPerKg ?? details.amountPerKg}`;
    case NotificationType.AUCTION_SOLD:
      return `AUCTION_SOLD:${details.listingId}`;
    case NotificationType.AUCTION_WON:
      return `AUCTION_WON:${details.listingId}`;
    case NotificationType.AUCTION_LOST:
      return `AUCTION_LOST:${details.listingId}`;
    case NotificationType.AUCTION_UNSOLD:
      return `AUCTION_UNSOLD:${details.listingId}`;
    case NotificationType.ORDER_UPDATE:
      return `ORDER_UPDATE:${details.orderId}:${details.subEvent}`;
    case NotificationType.ENDING_SOON:
      return `ENDING_SOON:${details.listingId}`;
    default: {
      const exhaustiveCheck: never = type;
      return `${exhaustiveCheck}:${details.listingId ?? details.orderId ?? "unknown"}`;
    }
  }
}

/**
 * Typed Notification Matrix (Contract from docs/phase-8.md).
 */
export type NotificationRecipientRole =
  | "FARMER"
  | "PREVIOUS_HIGHEST_BIDDER"
  | "WINNING_BUYER"
  | "OTHER_BIDDERS"
  | "BUYER"
  | "OTHER_PARTY"
  | "BOTH_PARTIES"
  | "WATCHERS_AND_BIDDERS";

export interface NotificationMatrixEntry {
  event: DomainEventName | "scheduler.ending_soon";
  recipient: NotificationRecipientRole;
  type: NotificationType;
  subEvent?: OrderSubEvent;
  coalesced?: boolean;
  notes?: string;
}

export const NOTIFICATION_MATRIX: readonly NotificationMatrixEntry[] = [
  {
    event: DomainEventName.BID_PLACED,
    recipient: "FARMER",
    type: NotificationType.NEW_BID,
    coalesced: true,
    notes: "Coalesced per listing while unread",
  },
  {
    event: DomainEventName.BID_PLACED,
    recipient: "PREVIOUS_HIGHEST_BIDDER",
    type: NotificationType.OUTBID,
    notes: "Includes the new price per kg only",
  },
  {
    event: DomainEventName.AUCTION_CLOSED,
    recipient: "FARMER",
    type: NotificationType.AUCTION_SOLD,
    notes: "Links to the order",
  },
  {
    event: DomainEventName.AUCTION_CLOSED,
    recipient: "WINNING_BUYER",
    type: NotificationType.AUCTION_WON,
    notes: "Links to the order",
  },
  {
    event: DomainEventName.AUCTION_CLOSED,
    recipient: "OTHER_BIDDERS",
    type: NotificationType.AUCTION_LOST,
    notes: "Includes the final price",
  },
  {
    event: DomainEventName.AUCTION_CLOSED,
    recipient: "FARMER",
    type: NotificationType.AUCTION_UNSOLD,
    notes: "Hints at relist",
  },
  {
    event: DomainEventName.ORDER_CREATED,
    recipient: "FARMER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.CREATED,
    notes: "Mentions the confirm deadline",
  },
  {
    event: DomainEventName.ORDER_CONFIRMED,
    recipient: "BUYER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.CONFIRMED,
  },
  {
    event: DomainEventName.PAYMENT_PAID,
    recipient: "FARMER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.PAID,
  },
  {
    event: DomainEventName.ORDER_DELIVERED,
    recipient: "BUYER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.DELIVERED,
    notes: "Mentions the auto-complete deadline",
  },
  {
    event: DomainEventName.ORDER_COMPLETED,
    recipient: "FARMER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.COMPLETED,
    notes: "Also sent on auto-complete",
  },
  {
    event: DomainEventName.ORDER_CANCELLED,
    recipient: "OTHER_PARTY",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.CANCELLED,
    notes: "The other party; both when cancelled by SYSTEM",
  },
  {
    event: DomainEventName.ORDER_DISPUTED,
    recipient: "FARMER",
    type: NotificationType.ORDER_UPDATE,
    subEvent: OrderSubEvent.DISPUTED,
  },
  {
    event: "scheduler.ending_soon",
    recipient: "WATCHERS_AND_BIDDERS",
    type: NotificationType.ENDING_SOON,
    notes: "15 minutes before the end (30 seconds in demo mode), once per listing per user",
  },
] as const;

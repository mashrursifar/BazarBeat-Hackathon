import { z } from "zod";
import { DomainEventName, ListingStatus, PaymentMethod } from "./enums.js";
import type { NotificationItem } from "./schemas/notifications.js";

/**
 * Payload for the 'bid.placed' domain event.
 * Emitted when a valid bid is atomically accepted onto an active listing.
 */
export const bidPlacedEventPayloadSchema = z.object({
  listingId: z.string(),
  bidId: z.string(),
  buyerId: z.string(),
  bidderLabel: z.string(),
  amountPerKg: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  bidCount: z.number().int().positive(),
  currentBidPerKg: z.number().int().positive(),
  placedAt: z.string().datetime(),
  previousBidderId: z.string().optional(),
});

export type BidPlacedEventPayload = z.infer<typeof bidPlacedEventPayloadSchema>;

/**
 * Payload for the 'auction.extended' domain event.
 * Emitted when an accepted bid within the anti-sniping window extends endsAt.
 */
export const auctionExtendedEventPayloadSchema = z.object({
  listingId: z.string(),
  endsAt: z.string().datetime(),
  extensionCount: z.number().int().positive(),
  extendedAt: z.string().datetime(),
});

export type AuctionExtendedEventPayload = z.infer<typeof auctionExtendedEventPayloadSchema>;

/**
 * Payload for the 'auction.closed' domain event.
 * Emitted when an auction transitions from ACTIVE to SOLD, EXPIRED_UNSOLD, or CANCELLED.
 */
export const auctionClosedEventPayloadSchema = z.object({
  listingId: z.string(),
  status: z.enum([ListingStatus.SOLD, ListingStatus.EXPIRED_UNSOLD, ListingStatus.CANCELLED]),
  closedAt: z.string().datetime(),
  winningBidId: z.string().optional(),
  winningBidderId: z.string().optional(),
  winningAmountPerKg: z.number().int().positive().optional(),
  totalAmount: z.number().int().positive().optional(),
});

export type AuctionClosedEventPayload = z.infer<typeof auctionClosedEventPayloadSchema>;

/**
 * Payload for the 'order.created' domain event.
 * Emitted when a sold auction automatically generates an order.
 */
export const orderCreatedEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  cropId: z.string(),
  quantityKg: z.number().positive(),
  pricePerKg: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  platformFee: z.number().int().nonnegative(),
  farmerNet: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type OrderCreatedEventPayload = z.infer<typeof orderCreatedEventPayloadSchema>;

/**
 * Payload for the 'order.confirmed' domain event.
 * Emitted when a farmer confirms an order with handover details.
 */
export const orderConfirmedEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  confirmedAt: z.string().datetime(),
  handoverAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export type OrderConfirmedEventPayload = z.infer<typeof orderConfirmedEventPayloadSchema>;

/**
 * Payload for the 'order.delivered' domain event.
 * Emitted when farmer marks an order as delivered/handed over.
 */
export const orderDeliveredEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  deliveredAt: z.string().datetime(),
  note: z.string().optional(),
});

export type OrderDeliveredEventPayload = z.infer<typeof orderDeliveredEventPayloadSchema>;

/**
 * Payload for the 'order.completed' domain event.
 * Emitted when buyer marks an order completed.
 */
export const orderCompletedEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  completedAt: z.string().datetime(),
  note: z.string().optional(),
});

export type OrderCompletedEventPayload = z.infer<typeof orderCompletedEventPayloadSchema>;

/**
 * Payload for the 'order.cancelled' domain event.
 * Emitted when an order in PENDING or CONFIRMED is cancelled.
 */
export const orderCancelledEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  cancelledBy: z.string(),
  reason: z.string(),
  note: z.string().optional(),
  cancelledAt: z.string().datetime(),
  refunded: z.boolean().optional(),
});

export type OrderCancelledEventPayload = z.infer<typeof orderCancelledEventPayloadSchema>;

/**
 * Payload for the 'order.disputed' domain event.
 * Emitted when a buyer raises a dispute on a DELIVERED order within the dispute window.
 */
export const orderDisputedEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  farmerId: z.string(),
  buyerId: z.string(),
  disputedBy: z.string(),
  reason: z.string(),
  note: z.string().optional(),
  disputedAt: z.string().datetime(),
});

export type OrderDisputedEventPayload = z.infer<typeof orderDisputedEventPayloadSchema>;

/**
 * Payload for the 'payment.paid' domain event.
 * Emitted when an order payment becomes PAID (wallet sim or COD upon delivery).
 */
export const paymentPaidEventPayloadSchema = z.object({
  orderId: z.string(),
  listingId: z.string(),
  buyerId: z.string(),
  farmerId: z.string(),
  amount: z.number().int().positive(),
  method: z.enum([PaymentMethod.COD, PaymentMethod.WALLET_SIM]),
  paidAt: z.string().datetime(),
});

export type PaymentPaidEventPayload = z.infer<typeof paymentPaidEventPayloadSchema>;

export interface NotificationCreatedEventPayload {
  userId: string;
  notification: NotificationItem;
  unreadCount: number;
}

export interface NotificationUpdatedEventPayload {
  userId: string;
  notification: NotificationItem;
  unreadCount: number;
}

/**
 * Type-safe mapping between DomainEventName and its respective payload type.
 */
export interface DomainEventPayloadMap {
  [DomainEventName.BID_PLACED]: BidPlacedEventPayload;
  [DomainEventName.AUCTION_EXTENDED]: AuctionExtendedEventPayload;
  [DomainEventName.AUCTION_CLOSED]: AuctionClosedEventPayload;
  [DomainEventName.ORDER_CREATED]: OrderCreatedEventPayload;
  [DomainEventName.ORDER_CONFIRMED]: OrderConfirmedEventPayload;
  [DomainEventName.ORDER_DELIVERED]: OrderDeliveredEventPayload;
  [DomainEventName.ORDER_COMPLETED]: OrderCompletedEventPayload;
  [DomainEventName.ORDER_CANCELLED]: OrderCancelledEventPayload;
  [DomainEventName.ORDER_DISPUTED]: OrderDisputedEventPayload;
  [DomainEventName.PAYMENT_PAID]: PaymentPaidEventPayload;
  [DomainEventName.NOTIFICATION_CREATED]: NotificationCreatedEventPayload;
  [DomainEventName.NOTIFICATION_UPDATED]: NotificationUpdatedEventPayload;
}

/**
 * Generic domain event object shape.
 */
export interface DomainEvent<E extends DomainEventName = DomainEventName> {
  name: E;
  payload: DomainEventPayloadMap[E];
  occurredAt: string;
}


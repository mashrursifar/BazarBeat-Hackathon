import { z } from "zod";
import { DomainEventName, ListingStatus } from "./enums.js";

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
 * Type-safe mapping between DomainEventName and its respective payload type.
 */
export interface DomainEventPayloadMap {
  [DomainEventName.BID_PLACED]: BidPlacedEventPayload;
  [DomainEventName.AUCTION_EXTENDED]: AuctionExtendedEventPayload;
  [DomainEventName.AUCTION_CLOSED]: AuctionClosedEventPayload;
  [DomainEventName.ORDER_CREATED]: OrderCreatedEventPayload;
}

/**
 * Generic domain event object shape.
 */
export interface DomainEvent<E extends DomainEventName = DomainEventName> {
  name: E;
  payload: DomainEventPayloadMap[E];
  occurredAt: string;
}


import { ObjectId } from "bson";
import mongoose from "mongoose";
import {
  type AuctionClosedEventPayload,
  type BidPlacedEventPayload,
  DomainEventName,
  ListingStatus,
  NotificationType,
  type OrderCancelledEventPayload,
  type OrderCompletedEventPayload,
  type OrderConfirmedEventPayload,
  type OrderCreatedEventPayload,
  type OrderDeliveredEventPayload,
  type OrderDisputedEventPayload,
  OrderSubEvent,
  type PaymentPaidEventPayload,
  buildNotificationDedupeKey,
  getOrderAutoCancelMs,
  getOrderAutoCompleteMs,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { type DomainEventEmitter, getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { logger } from "../../shared/logger.js";
import { Bid } from "../bids/bid.model.js";
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";
import { createOrCoalesceNotification } from "./notification.service.js";

function formatTaka(poisha: number): string {
  return `৳${(poisha / 100).toFixed(2)}`;
}

async function getListingMeta(
  listingId: string,
): Promise<{ farmerId: string; cropSlug: string; cropName: string } | null> {
  try {
    if (!mongoose.isValidObjectId(listingId)) return null;
    const listing = await Listing.findById(listingId).populate("cropId").lean();
    if (!listing) return null;
    const crop = listing.cropId as unknown as { slug?: string; nameEn?: string } | null;
    return {
      farmerId: listing.farmerId.toString(),
      cropSlug: crop?.slug ?? "produce",
      cropName: crop?.nameEn ?? "produce",
    };
  } catch (err: unknown) {
    logger.error({ err, listingId }, "Failed to fetch listing metadata for notification");
    return null;
  }
}

async function getCropMeta(
  cropId: string,
): Promise<{ cropSlug: string; cropName: string }> {
  try {
    if (mongoose.isValidObjectId(cropId)) {
      const crop = await Crop.findById(cropId).lean();
      if (crop) {
        return { cropSlug: crop.slug, cropName: crop.nameEn };
      }
    }
  } catch (err: unknown) {
    logger.error({ err, cropId }, "Failed to fetch crop metadata for notification");
  }
  return { cropSlug: "produce", cropName: "produce" };
}

/**
 * Handles 'bid.placed' event:
 * - Notifies farmer of NEW_BID (coalesced per listing while unread)
 * - Notifies previous highest bidder of OUTBID (includes new price per kg only)
 */
export async function handleBidPlaced(payload: BidPlacedEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    if (!meta) return;

    // 1. Notify Farmer (NEW_BID) — exclude if acting user is farmer
    if (meta.farmerId !== payload.buyerId) {
      await createOrCoalesceNotification({
        userId: meta.farmerId,
        type: NotificationType.NEW_BID,
        title: `New bid on ${meta.cropName}`,
        body: `A new bid of ${formatTaka(payload.amountPerKg)}/kg was placed.`,
        params: {
          listingId: payload.listingId,
          cropSlug: meta.cropSlug,
          currentBidPerKg: payload.amountPerKg,
          bidCount: payload.bidCount,
        },
        entityRef: { kind: "listing", id: payload.listingId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.NEW_BID, {
          listingId: payload.listingId,
        }),
      });
    }

    // 2. Notify Previous Highest Bidder (OUTBID)
    if (
      payload.previousBidderId &&
      payload.previousBidderId !== payload.buyerId &&
      payload.previousBidderId !== meta.farmerId
    ) {
      await createOrCoalesceNotification({
        userId: payload.previousBidderId,
        type: NotificationType.OUTBID,
        title: `You were outbid on ${meta.cropName}`,
        body: `A new highest bid of ${formatTaka(payload.amountPerKg)}/kg was placed.`,
        params: {
          listingId: payload.listingId,
          cropSlug: meta.cropSlug,
          newBidPerKg: payload.amountPerKg,
        },
        entityRef: { kind: "listing", id: payload.listingId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.OUTBID, {
          listingId: payload.listingId,
          newBidPerKg: payload.amountPerKg,
        }),
      });
    }
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process bid.placed notification subscriber");
  }
}

/**
 * Handles 'auction.closed' event:
 * - SOLD:
 *   - Farmer gets AUCTION_SOLD (links to order)
 *   - Winning buyer gets AUCTION_WON (links to order)
 *   - Other bidders get AUCTION_LOST (includes final price)
 * - EXPIRED_UNSOLD:
 *   - Farmer gets AUCTION_UNSOLD (hints at relist)
 */
export async function handleAuctionClosed(payload: AuctionClosedEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    if (!meta) return;

    if (payload.status === ListingStatus.SOLD && payload.winningBidderId && payload.winningAmountPerKg && payload.totalAmount) {
      // Find associated order
      const order = await Order.findOne({ listingId: new ObjectId(payload.listingId) }).lean();
      const orderId = order?._id.toString() ?? payload.listingId;

      // 1. Farmer: AUCTION_SOLD
      await createOrCoalesceNotification({
        userId: meta.farmerId,
        type: NotificationType.AUCTION_SOLD,
        title: `Your ${meta.cropName} auction sold!`,
        body: `Sold for ${formatTaka(payload.totalAmount)} (${formatTaka(payload.winningAmountPerKg)}/kg).`,
        params: {
          listingId: payload.listingId,
          cropSlug: meta.cropSlug,
          orderId,
          winningBidPerKg: payload.winningAmountPerKg,
          totalAmount: payload.totalAmount,
        },
        entityRef: { kind: "order", id: orderId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.AUCTION_SOLD, {
          listingId: payload.listingId,
        }),
      });

      // 2. Winning Buyer: AUCTION_WON
      await createOrCoalesceNotification({
        userId: payload.winningBidderId,
        type: NotificationType.AUCTION_WON,
        title: `You won the ${meta.cropName} auction!`,
        body: `Winning bid: ${formatTaka(payload.winningAmountPerKg)}/kg (Total: ${formatTaka(payload.totalAmount)}).`,
        params: {
          listingId: payload.listingId,
          cropSlug: meta.cropSlug,
          orderId,
          winningBidPerKg: payload.winningAmountPerKg,
          totalAmount: payload.totalAmount,
        },
        entityRef: { kind: "order", id: orderId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.AUCTION_WON, {
          listingId: payload.listingId,
        }),
      });

      // 3. Other Bidders: AUCTION_LOST
      const otherBidderIds = await Bid.find({
        listingId: new ObjectId(payload.listingId),
        buyerId: { $ne: new ObjectId(payload.winningBidderId) },
      }).distinct("buyerId");

      for (const otherId of otherBidderIds) {
        const bidderIdStr = otherId.toString();
        await createOrCoalesceNotification({
          userId: bidderIdStr,
          type: NotificationType.AUCTION_LOST,
          title: `Auction ended for ${meta.cropName}`,
          body: `The auction ended at ${formatTaka(payload.winningAmountPerKg)}/kg.`,
          params: {
            listingId: payload.listingId,
            cropSlug: meta.cropSlug,
            finalPricePerKg: payload.winningAmountPerKg,
          },
          entityRef: { kind: "listing", id: payload.listingId },
          dedupeKey: buildNotificationDedupeKey(NotificationType.AUCTION_LOST, {
            listingId: payload.listingId,
          }),
        });
      }
    } else if (payload.status === ListingStatus.EXPIRED_UNSOLD) {
      // Farmer: AUCTION_UNSOLD
      await createOrCoalesceNotification({
        userId: meta.farmerId,
        type: NotificationType.AUCTION_UNSOLD,
        title: `Auction ended without bids`,
        body: `Your ${meta.cropName} auction ended with no bids. You can adjust the floor price and relist.`,
        params: {
          listingId: payload.listingId,
          cropSlug: meta.cropSlug,
        },
        entityRef: { kind: "listing", id: payload.listingId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.AUCTION_UNSOLD, {
          listingId: payload.listingId,
        }),
      });
    }
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process auction.closed notification subscriber");
  }
}

/**
 * Handles 'order.created' event:
 * - Farmer: ORDER_UPDATE (CREATED) with confirm deadline
 */
export async function handleOrderCreated(payload: OrderCreatedEventPayload): Promise<void> {
  try {
    const { cropSlug, cropName } = await getCropMeta(payload.cropId);
    const deadlineMs = getOrderAutoCancelMs(env.DEMO_MODE);
    const deadline = new Date(new Date(payload.createdAt).getTime() + deadlineMs).toISOString();

    await createOrCoalesceNotification({
      userId: payload.farmerId,
      type: NotificationType.ORDER_UPDATE,
      title: `New order pending confirmation`,
      body: `Please confirm handover details for your ${cropName} order before the deadline.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.CREATED,
        deadline,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.CREATED,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.created notification subscriber");
  }
}

/**
 * Handles 'order.confirmed' event:
 * - Buyer: ORDER_UPDATE (CONFIRMED)
 */
export async function handleOrderConfirmed(payload: OrderConfirmedEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";
    const cropName = meta?.cropName ?? "produce";

    await createOrCoalesceNotification({
      userId: payload.buyerId,
      type: NotificationType.ORDER_UPDATE,
      title: `Order confirmed by farmer`,
      body: `The farmer confirmed handover details for your ${cropName} order.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.CONFIRMED,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.CONFIRMED,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.confirmed notification subscriber");
  }
}

/**
 * Handles 'payment.paid' event:
 * - Farmer: ORDER_UPDATE (PAID)
 */
export async function handlePaymentPaid(payload: PaymentPaidEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";

    await createOrCoalesceNotification({
      userId: payload.farmerId,
      type: NotificationType.ORDER_UPDATE,
      title: `Payment received`,
      body: `Payment of ${formatTaka(payload.amount)} was received for order.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.PAID,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.PAID,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process payment.paid notification subscriber");
  }
}

/**
 * Handles 'order.delivered' event:
 * - Buyer: ORDER_UPDATE (DELIVERED) with auto-complete deadline
 */
export async function handleOrderDelivered(payload: OrderDeliveredEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";
    const cropName = meta?.cropName ?? "produce";
    const deadlineMs = getOrderAutoCompleteMs(env.DEMO_MODE);
    const deadline = new Date(new Date(payload.deliveredAt).getTime() + deadlineMs).toISOString();

    await createOrCoalesceNotification({
      userId: payload.buyerId,
      type: NotificationType.ORDER_UPDATE,
      title: `Order delivered`,
      body: `Your ${cropName} was delivered. Please inspect and confirm receipt.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.DELIVERED,
        deadline,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.DELIVERED,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.delivered notification subscriber");
  }
}

/**
 * Handles 'order.completed' event:
 * - Farmer: ORDER_UPDATE (COMPLETED)
 */
export async function handleOrderCompleted(payload: OrderCompletedEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";
    const cropName = meta?.cropName ?? "produce";

    await createOrCoalesceNotification({
      userId: payload.farmerId,
      type: NotificationType.ORDER_UPDATE,
      title: `Order completed`,
      body: `The buyer confirmed receipt for your ${cropName} order.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.COMPLETED,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.COMPLETED,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.completed notification subscriber");
  }
}

/**
 * Handles 'order.cancelled' event:
 * - If cancelledBy === SYSTEM: notify both farmer and buyer
 * - Else if cancelledBy === farmer: notify buyer
 * - Else if cancelledBy === buyer: notify farmer
 */
export async function handleOrderCancelled(payload: OrderCancelledEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";
    const cropName = meta?.cropName ?? "produce";

    const recipients: string[] = [];
    if (payload.cancelledBy === "SYSTEM") {
      recipients.push(payload.farmerId, payload.buyerId);
    } else if (payload.cancelledBy === payload.farmerId) {
      recipients.push(payload.buyerId);
    } else if (payload.cancelledBy === payload.buyerId) {
      recipients.push(payload.farmerId);
    } else {
      recipients.push(payload.farmerId, payload.buyerId);
    }

    for (const recipientId of recipients) {
      await createOrCoalesceNotification({
        userId: recipientId,
        type: NotificationType.ORDER_UPDATE,
        title: `Order cancelled`,
        body: `Order for ${cropName} was cancelled.`,
        params: {
          orderId: payload.orderId,
          listingId: payload.listingId,
          cropSlug,
          subEvent: OrderSubEvent.CANCELLED,
        },
        entityRef: { kind: "order", id: payload.orderId },
        dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
          orderId: payload.orderId,
          subEvent: OrderSubEvent.CANCELLED,
        }),
      });
    }
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.cancelled notification subscriber");
  }
}

/**
 * Handles 'order.disputed' event:
 * - Farmer: ORDER_UPDATE (DISPUTED)
 */
export async function handleOrderDisputed(payload: OrderDisputedEventPayload): Promise<void> {
  try {
    const meta = await getListingMeta(payload.listingId);
    const cropSlug = meta?.cropSlug ?? "produce";
    const cropName = meta?.cropName ?? "produce";

    await createOrCoalesceNotification({
      userId: payload.farmerId,
      type: NotificationType.ORDER_UPDATE,
      title: `Order reported with issue`,
      body: `A problem was reported by the buyer for ${cropName}.`,
      params: {
        orderId: payload.orderId,
        listingId: payload.listingId,
        cropSlug,
        subEvent: OrderSubEvent.DISPUTED,
      },
      entityRef: { kind: "order", id: payload.orderId },
      dedupeKey: buildNotificationDedupeKey(NotificationType.ORDER_UPDATE, {
        orderId: payload.orderId,
        subEvent: OrderSubEvent.DISPUTED,
      }),
    });
  } catch (err: unknown) {
    logger.error({ err, payload }, "Failed to process order.disputed notification subscriber");
  }
}

/**
 * Subscribes notification event listeners to the DomainEventEmitter.
 * Returns an unbind cleanup function.
 */
export function registerNotificationSubscribers(
  emitter: DomainEventEmitter = getDomainEventEmitter(),
): () => void {
  const unsubs: Array<() => void> = [
    emitter.on(DomainEventName.BID_PLACED, handleBidPlaced),
    emitter.on(DomainEventName.AUCTION_CLOSED, handleAuctionClosed),
    emitter.on(DomainEventName.ORDER_CREATED, handleOrderCreated),
    emitter.on(DomainEventName.ORDER_CONFIRMED, handleOrderConfirmed),
    emitter.on(DomainEventName.PAYMENT_PAID, handlePaymentPaid),
    emitter.on(DomainEventName.ORDER_DELIVERED, handleOrderDelivered),
    emitter.on(DomainEventName.ORDER_COMPLETED, handleOrderCompleted),
    emitter.on(DomainEventName.ORDER_CANCELLED, handleOrderCancelled),
    emitter.on(DomainEventName.ORDER_DISPUTED, handleOrderDisputed),
  ];

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

import type { MinimalOrder } from "@bazarbeat/shared";
import type { OrderRecord } from "./order.model.js";

type RawOrderDoc = OrderRecord & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt?: Date;
};

/**
 * Maps an internal Mongoose order document to the MinimalOrder DTO contract.
 */
export function mapOrderToMinimalOrder(order: RawOrderDoc): MinimalOrder {
  return {
    id: order._id.toString(),
    listingId: order.listingId.toString(),
    farmerId: order.farmerId.toString(),
    buyerId: order.buyerId.toString(),
    cropId: order.cropId.toString(),
    quantityKg: order.quantityKg,
    grade: order.grade as MinimalOrder["grade"],
    pricePerKg: order.pricePerKg,
    subtotal: order.subtotal,
    platformFee: order.platformFee,
    farmerNet: order.farmerNet,
    status: order.status as MinimalOrder["status"],
    payment: {
      status: order.payment.status as MinimalOrder["payment"]["status"],
      ...(order.payment.method ? { method: order.payment.method as MinimalOrder["payment"]["method"] } : {}),
      ...(order.payment.paidAt ? { paidAt: order.payment.paidAt.toISOString() } : {}),
      ...(order.payment.refundedAt ? { refundedAt: order.payment.refundedAt.toISOString() } : {}),
    },
    ...(order.fulfilment
      ? {
          fulfilment: {
            method: order.fulfilment.method as NonNullable<MinimalOrder["fulfilment"]>["method"],
            ...(order.fulfilment.note ? { note: order.fulfilment.note } : {}),
            ...(order.fulfilment.handoverAt ? { handoverAt: order.fulfilment.handoverAt.toISOString() } : {}),
          },
        }
      : {}),
    ...(order.dispute
      ? {
          dispute: {
            reason: order.dispute.reason as NonNullable<MinimalOrder["dispute"]>["reason"],
            ...(order.dispute.note ? { note: order.dispute.note } : {}),
            raisedAt: order.dispute.raisedAt.toISOString(),
            ...(order.dispute.resolution ? { resolution: order.dispute.resolution } : {}),
          },
        }
      : {}),
    ...(order.statusHistory && order.statusHistory.length > 0
      ? {
          statusHistory: order.statusHistory.map((entry) => ({
            status: entry.status as MinimalOrder["status"],
            at: entry.at.toISOString(),
            ...(entry.byUserId ? { byUserId: entry.byUserId.toString() } : {}),
            ...(entry.note ? { note: entry.note } : {}),
          })),
        }
      : {}),
    ...(order.confirmedAt ? { confirmedAt: order.confirmedAt.toISOString() } : {}),
    ...(order.deliveredAt ? { deliveredAt: order.deliveredAt.toISOString() } : {}),
    ...(order.completedAt ? { completedAt: order.completedAt.toISOString() } : {}),
    ...(order.cancelledAt ? { cancelledAt: order.cancelledAt.toISOString() } : {}),
    ...(order.cancelledBy ? { cancelledBy: order.cancelledBy.toString() } : {}),
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    ...(order.cancelNote ? { cancelNote: order.cancelNote } : {}),
    ...(order.stockReturn
      ? {
          stockReturn: {
            decision: order.stockReturn.decision as NonNullable<MinimalOrder["stockReturn"]>["decision"],
            decidedAt: order.stockReturn.decidedAt.toISOString(),
            ...(order.stockReturn.note ? { note: order.stockReturn.note } : {}),
          },
        }
      : {}),
    createdAt: order.createdAt.toISOString(),
    ...(order.updatedAt ? { updatedAt: order.updatedAt.toISOString() } : {}),
  };
}

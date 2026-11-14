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
    },
    createdAt: order.createdAt.toISOString(),
    ...(order.updatedAt ? { updatedAt: order.updatedAt.toISOString() } : {}),
  };
}


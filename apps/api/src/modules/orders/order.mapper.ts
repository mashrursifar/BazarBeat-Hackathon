import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  type CounterpartyDto,
  type FarmerOrderCard,
  type FarmerOrderDetail,
  type MinimalOrder,
  OrderStatus,
  UserRole,
  getOrderActions,
  getOrderAutoCancelMs,
  getOrderAutoCompleteMs,
} from "@bazarbeat/shared";

import type { CropRecord } from "../crops/crop.model.js";
import type { ListingRecord } from "../listings/listing.model.js";
import type { UserRecord } from "../users/user.model.js";
import type { OrderRecord } from "./order.model.js";

type RawOrderDoc = OrderRecord & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt?: Date;
};

type WithId<T> = T & { _id: { toString(): string } };

function toIsoString(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

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
      ...(order.payment.paidAt ? { paidAt: toIsoString(order.payment.paidAt) } : {}),
      ...(order.payment.refundedAt ? { refundedAt: toIsoString(order.payment.refundedAt) } : {}),
    },
    ...(order.fulfilment
      ? {
          fulfilment: {
            method: order.fulfilment.method as NonNullable<MinimalOrder["fulfilment"]>["method"],
            ...(order.fulfilment.note ? { note: order.fulfilment.note } : {}),
            ...(order.fulfilment.handoverAt ? { handoverAt: toIsoString(order.fulfilment.handoverAt) } : {}),
          },
        }
      : {}),
    ...(order.dispute
      ? {
          dispute: {
            reason: order.dispute.reason as NonNullable<MinimalOrder["dispute"]>["reason"],
            ...(order.dispute.note ? { note: order.dispute.note } : {}),
            raisedAt: toIsoString(order.dispute.raisedAt)!,
            ...(order.dispute.resolution ? { resolution: order.dispute.resolution } : {}),
          },
        }
      : {}),
    ...(order.statusHistory && order.statusHistory.length > 0
      ? {
          statusHistory: order.statusHistory.map((entry) => ({
            status: entry.status as MinimalOrder["status"],
            at: toIsoString(entry.at)!,
            ...(entry.byUserId ? { byUserId: entry.byUserId.toString() } : {}),
            ...(entry.note ? { note: entry.note } : {}),
          })),
        }
      : {}),
    ...(order.confirmedAt ? { confirmedAt: toIsoString(order.confirmedAt) } : {}),
    ...(order.deliveredAt ? { deliveredAt: toIsoString(order.deliveredAt) } : {}),
    ...(order.completedAt ? { completedAt: toIsoString(order.completedAt) } : {}),
    ...(order.cancelledAt ? { cancelledAt: toIsoString(order.cancelledAt) } : {}),
    ...(order.cancelledBy ? { cancelledBy: order.cancelledBy.toString() } : {}),
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    ...(order.cancelNote ? { cancelNote: order.cancelNote } : {}),
    ...(order.stockReturn
      ? {
          stockReturn: {
            decision: order.stockReturn.decision as NonNullable<MinimalOrder["stockReturn"]>["decision"],
            decidedAt: toIsoString(order.stockReturn.decidedAt)!,
            ...(order.stockReturn.note ? { note: order.stockReturn.note } : {}),
          },
        }
      : {}),
    createdAt: toIsoString(order.createdAt)!,
    ...(order.updatedAt ? { updatedAt: toIsoString(order.updatedAt) } : {}),
  };
}

/**
 * Computes auto-cancel or auto-complete deadlines based on order status.
 */
export function computeOrderDeadlines(
  createdAt: Date | string,
  deliveredAt: Date | string | undefined,
  status: OrderStatus,
  isDemoMode: boolean,
): {
  autoCancelDeadline?: string;
  autoCompleteDeadline?: string;
  deadline?: string;
} {
  const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (status === OrderStatus.PENDING) {
    const autoCancelMs = getOrderAutoCancelMs(isDemoMode);
    const deadline = new Date(createdDate.getTime() + autoCancelMs).toISOString();
    return { autoCancelDeadline: deadline, deadline };
  }
  if (status === OrderStatus.DELIVERED) {
    const autoCompleteMs = getOrderAutoCompleteMs(isDemoMode);
    const baseDate = deliveredAt
      ? deliveredAt instanceof Date
        ? deliveredAt
        : new Date(deliveredAt)
      : createdDate;
    const deadline = new Date(baseDate.getTime() + autoCompleteMs).toISOString();
    return { autoCompleteDeadline: deadline, deadline };
  }
  return {};
}

/**
 * Maps counterparty with privacy rules from gap 7 / AUCTION_RULES §10 / SECURITY §5:
 * - If PENDING: masked (isMasked: true, anonymized name/label, division/district only, zero phone numbers or addresses)
 * - If CONFIRMED or later: revealed (isMasked: false, full contact details, phone, full location)
 */
export function mapCounterparty(
  user: WithId<UserRecord> | null | undefined,
  orderStatus: OrderStatus,
  role: UserRole,
  fallbackId: string,
): CounterpartyDto {
  const isPending = orderStatus === OrderStatus.PENDING;
  const id = user ? user._id.toString() : fallbackId;

  if (isPending || !user) {
    const maskedName = role === UserRole.FARMER ? "Farmer" : "Buyer";
    return {
      id,
      name: maskedName,
      role,
      isMasked: true,
      ...(user?.division ? { division: user.division } : {}),
      ...(user?.district ? { district: user.district } : {}),
    };
  }

  return {
    id,
    name: user.name,
    role,
    phone: user.phone,
    isMasked: false,
    ...(user.organization ? { organizationName: user.organization } : {}),
    location: {
      division: user.division,
      district: user.district,
      ...(user.upazila ? { upazila: user.upazila } : {}),
    },
  };
}

/**
 * Maps order to FarmerOrderCard DTO.
 */
export function mapOrderToFarmerOrderCard(
  order: RawOrderDoc,
  crop: WithId<CropRecord> | null | undefined,
  buyerUser: WithId<UserRecord> | null | undefined,
  isDemoMode: boolean,
): FarmerOrderCard {
  const deadlines = computeOrderDeadlines(
    order.createdAt,
    order.deliveredAt ?? undefined,
    order.status as OrderStatus,
    isDemoMode,
  );

  return {
    id: order._id.toString(),
    listingId: order.listingId.toString(),
    cropId: order.cropId.toString(),
    cropName: crop?.nameEn ?? "Unknown Crop",
    cropNameBn: crop?.nameBn ?? "অজানা ফসল",
    imageUrl: crop?.imageUrl,
    grade: order.grade as FarmerOrderCard["grade"],
    quantityKg: order.quantityKg,
    pricePerKg: order.pricePerKg,
    subtotal: order.subtotal,
    platformFee: order.platformFee,
    farmerNet: order.farmerNet,
    status: order.status as OrderStatus,
    payment: {
      status: order.payment.status as FarmerOrderCard["payment"]["status"],
      ...(order.payment.method ? { method: order.payment.method as FarmerOrderCard["payment"]["method"] } : {}),
      ...(order.payment.paidAt ? { paidAt: toIsoString(order.payment.paidAt) } : {}),
      ...(order.payment.refundedAt ? { refundedAt: toIsoString(order.payment.refundedAt) } : {}),
    },
    fulfilment: {
      method: (order.fulfilment?.method ?? "PICKUP") as FarmerOrderCard["fulfilment"]["method"],
      ...(order.fulfilment?.note ? { note: order.fulfilment.note } : {}),
      ...(order.fulfilment?.handoverAt ? { handoverAt: toIsoString(order.fulfilment.handoverAt) } : {}),
    },
    buyer: mapCounterparty(
      buyerUser,
      order.status as OrderStatus,
      UserRole.BUYER,
      order.buyerId.toString(),
    ),
    ...(order.stockReturn
      ? {
          stockReturn: {
            decision: order.stockReturn.decision as NonNullable<FarmerOrderCard["stockReturn"]>["decision"],
            decidedAt: toIsoString(order.stockReturn.decidedAt)!,
            ...(order.stockReturn.note ? { note: order.stockReturn.note } : {}),
          },
        }
      : {}),
    ...deadlines,
    createdAt: toIsoString(order.createdAt)!,
    ...(order.updatedAt ? { updatedAt: toIsoString(order.updatedAt) } : {}),
  };
}

/**
 * Maps order to BuyerOrderCard DTO.
 */
export function mapOrderToBuyerOrderCard(
  order: RawOrderDoc,
  crop: WithId<CropRecord> | null | undefined,
  farmerUser: WithId<UserRecord> | null | undefined,
  isDemoMode: boolean,
): BuyerOrderCard {
  const deadlines = computeOrderDeadlines(
    order.createdAt,
    order.deliveredAt ?? undefined,
    order.status as OrderStatus,
    isDemoMode,
  );

  return {
    id: order._id.toString(),
    listingId: order.listingId.toString(),
    cropId: order.cropId.toString(),
    cropName: crop?.nameEn ?? "Unknown Crop",
    cropNameBn: crop?.nameBn ?? "অজানা ফসল",
    imageUrl: crop?.imageUrl,
    grade: order.grade as BuyerOrderCard["grade"],
    quantityKg: order.quantityKg,
    pricePerKg: order.pricePerKg,
    subtotal: order.subtotal,
    totalAmount: order.subtotal,
    status: order.status as OrderStatus,
    payment: {
      status: order.payment.status as BuyerOrderCard["payment"]["status"],
      ...(order.payment.method ? { method: order.payment.method as BuyerOrderCard["payment"]["method"] } : {}),
      ...(order.payment.paidAt ? { paidAt: toIsoString(order.payment.paidAt) } : {}),
      ...(order.payment.refundedAt ? { refundedAt: toIsoString(order.payment.refundedAt) } : {}),
    },
    fulfilment: {
      method: (order.fulfilment?.method ?? "PICKUP") as BuyerOrderCard["fulfilment"]["method"],
      ...(order.fulfilment?.note ? { note: order.fulfilment.note } : {}),
      ...(order.fulfilment?.handoverAt ? { handoverAt: toIsoString(order.fulfilment.handoverAt) } : {}),
    },
    farmer: mapCounterparty(
      farmerUser,
      order.status as OrderStatus,
      UserRole.FARMER,
      order.farmerId.toString(),
    ),
    ...deadlines,
    createdAt: toIsoString(order.createdAt)!,
    ...(order.updatedAt ? { updatedAt: toIsoString(order.updatedAt) } : {}),
  };
}

/**
 * Maps order to FarmerOrderDetail DTO.
 */
export function mapOrderToFarmerOrderDetail(
  order: RawOrderDoc,
  crop: WithId<CropRecord> | null | undefined,
  buyerUser: WithId<UserRecord> | null | undefined,
  listing: WithId<ListingRecord> | null | undefined,
  isDemoMode: boolean,
): FarmerOrderDetail {
  const baseCard = mapOrderToFarmerOrderCard(order, crop, buyerUser, isDemoMode);
  const availableActions = getOrderActions(UserRole.FARMER, {
    status: order.status as OrderStatus,
    payment: {
      status: order.payment.status as FarmerOrderDetail["payment"]["status"],
      method: order.payment.method as FarmerOrderDetail["payment"]["method"],
    },
  });

  const timeline = (order.statusHistory ?? []).map((entry) => ({
    status: entry.status as OrderStatus,
    at: toIsoString(entry.at)!,
    ...(entry.byUserId ? { byUserId: entry.byUserId.toString() } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  }));

  return {
    ...baseCard,
    timeline,
    statusHistory: timeline,
    availableActions,
    ...(order.dispute
      ? {
          dispute: {
            reason: order.dispute.reason as NonNullable<FarmerOrderDetail["dispute"]>["reason"],
            ...(order.dispute.note ? { note: order.dispute.note } : {}),
            raisedAt: toIsoString(order.dispute.raisedAt)!,
            ...(order.dispute.resolution ? { resolution: order.dispute.resolution } : {}),
          },
        }
      : {}),
    ...(listing
      ? {
          listingSummary: {
            id: listing._id.toString(),
            ...(crop?.nameEn ? { title: crop.nameEn } : {}),
            ...(listing.images?.[0]?.url ? { imageUrl: listing.images[0].url } : {}),
            division: listing.location.division,
            district: listing.location.district,
          },
        }
      : {}),
  };
}

/**
 * Maps order to BuyerOrderDetail DTO.
 */
export function mapOrderToBuyerOrderDetail(
  order: RawOrderDoc,
  crop: WithId<CropRecord> | null | undefined,
  farmerUser: WithId<UserRecord> | null | undefined,
  listing: WithId<ListingRecord> | null | undefined,
  isDemoMode: boolean,
): BuyerOrderDetail {
  const baseCard = mapOrderToBuyerOrderCard(order, crop, farmerUser, isDemoMode);
  const availableActions = getOrderActions(UserRole.BUYER, {
    status: order.status as OrderStatus,
    payment: {
      status: order.payment.status as BuyerOrderDetail["payment"]["status"],
      method: order.payment.method as BuyerOrderDetail["payment"]["method"],
    },
  });

  const timeline = (order.statusHistory ?? []).map((entry) => ({
    status: entry.status as OrderStatus,
    at: toIsoString(entry.at)!,
    ...(entry.byUserId ? { byUserId: entry.byUserId.toString() } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  }));

  return {
    ...baseCard,
    timeline,
    statusHistory: timeline,
    availableActions,
    ...(order.dispute
      ? {
          dispute: {
            reason: order.dispute.reason as NonNullable<BuyerOrderDetail["dispute"]>["reason"],
            ...(order.dispute.note ? { note: order.dispute.note } : {}),
            raisedAt: toIsoString(order.dispute.raisedAt)!,
            ...(order.dispute.resolution ? { resolution: order.dispute.resolution } : {}),
          },
        }
      : {}),
    ...(listing
      ? {
          listingSummary: {
            id: listing._id.toString(),
            ...(crop?.nameEn ? { title: crop.nameEn } : {}),
            ...(listing.images?.[0]?.url ? { imageUrl: listing.images[0].url } : {}),
            division: listing.location.division,
            district: listing.location.district,
          },
        }
      : {}),
  };
}

import { ObjectId } from "bson";
import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  type FarmerOrderCard,
  type FarmerOrderDetail,
  OrderErrorCode,
  type OrderListMeta,
  type OrderListQuery,
  OrderStatus,
  type OrderStatusCounts,
  UserRole,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import { Crop, type CropRecord } from "../crops/crop.model.js";
import { Listing, type ListingRecord } from "../listings/listing.model.js";
import { User, type UserRecord } from "../users/user.model.js";
import {
  mapOrderToBuyerOrderCard,
  mapOrderToBuyerOrderDetail,
  mapOrderToFarmerOrderCard,
  mapOrderToFarmerOrderDetail,
} from "./order.mapper.js";
import { Order, type OrderRecord } from "./order.model.js";

type RawOrderDoc = OrderRecord & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt?: Date;
};

type WithId<T> = T & { _id: { toString(): string } };

export interface ActorContext {
  userId: string;
  role: UserRole;
}

/**
 * Validates database ObjectId string format.
 */
function ensureObjectId(value: string, fieldName = "ID"): string {
  if (!/^[\da-f]{24}$/i.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `Invalid ${fieldName} reference`);
  }
  return value.toLowerCase();
}

export class OrderService {
  /**
   * Retrieves role-scoped, paginated, and filtered order list.
   * Includes per-status counts in meta and auto-cancel/auto-complete deadlines.
   */
  public async listOrders(
    actor: ActorContext,
    query: OrderListQuery,
  ): Promise<{
    data: (FarmerOrderCard | BuyerOrderCard)[];
    meta: OrderListMeta;
  }> {
    const clock = getClock();
    const actorObjectId = new ObjectId(actor.userId);

    // 1. Base role filter
    const baseRoleFilter: Record<string, unknown> =
      actor.role === UserRole.FARMER
        ? { farmerId: actorObjectId }
        : { buyerId: actorObjectId };

    const filter: Record<string, unknown> = { ...baseRoleFilter };

    // 2. Status or Status Group filter
    if (query.status) {
      filter.status = query.status;
    } else {
      const groupParam = (query.statusGroup ?? query.group)?.toLowerCase();
      if (groupParam === "active") {
        filter.status = {
          $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.DELIVERED],
        };
      } else if (groupParam === "completed") {
        filter.status = OrderStatus.COMPLETED;
      } else if (groupParam === "cancelled") {
        filter.status = OrderStatus.CANCELLED;
      } else if (groupParam === "disputed") {
        filter.status = OrderStatus.DISPUTED;
      }
    }

    // 3. Crop filter (by cropId or slug)
    if (query.cropId) {
      filter.cropId = new ObjectId(query.cropId);
    } else if (query.crop) {
      if (/^[\da-f]{24}$/i.test(query.crop)) {
        filter.cropId = new ObjectId(query.crop);
      } else {
        const cropDoc = (await Crop.findOne({ slug: query.crop.toLowerCase() })
          .select("_id")
          .lean()) as { _id: { toString(): string } } | null;
        if (cropDoc) {
          filter.cropId = cropDoc._id;
        } else {
          filter.cropId = new ObjectId(); // Non-matching dummy ID
        }
      }
    }

    // 4. Date range filter on createdAt
    const fromStr = query.from ?? query.startDate ?? query.dateFrom;
    const toStr = query.to ?? query.endDate ?? query.dateTo;
    if (fromStr || toStr) {
      const dateFilter: Record<string, Date> = {};
      if (fromStr) {
        const parsedFrom = new Date(fromStr);
        if (!isNaN(parsedFrom.getTime())) {
          dateFilter.$gte = parsedFrom;
        }
      }
      if (toStr) {
        const parsedTo = new Date(toStr);
        if (!isNaN(parsedTo.getTime())) {
          dateFilter.$lte = parsedTo;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    }

    // 5. Per-status counts aggregation (scoped to the authenticated user)
    const countsAggregation = (await Order.aggregate([
      { $match: baseRoleFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])) as { _id: string; count: number }[];

    const statusCounts: OrderStatusCounts = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.CONFIRMED]: 0,
      [OrderStatus.DELIVERED]: 0,
      [OrderStatus.COMPLETED]: 0,
      [OrderStatus.CANCELLED]: 0,
      [OrderStatus.DISPUTED]: 0,
    };

    for (const row of countsAggregation) {
      if (row._id && statusCounts[row._id] !== undefined) {
        statusCounts[row._id] = row.count;
      }
    }

    // 6. Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const orders = (await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()) as unknown as RawOrderDoc[];

    // 7. Batch fetch related crops and counterparty users
    const cropIds = [...new Set(orders.map((o) => o.cropId.toString()))];
    const counterpartUserIds = [
      ...new Set(
        orders.map((o) =>
          actor.role === UserRole.FARMER
            ? o.buyerId.toString()
            : o.farmerId.toString(),
        ),
      ),
    ];

    const [crops, counterpartUsers] = await Promise.all([
      Crop.find({ _id: { $in: cropIds } }).lean(),
      User.find({ _id: { $in: counterpartUserIds } }).lean(),
    ]);

    const cropMap = new Map(
      crops.map((c) => [c._id.toString(), c as unknown as WithId<CropRecord>]),
    );
    const userMap = new Map(
      counterpartUsers.map((u) => [
        u._id.toString(),
        u as unknown as WithId<UserRecord>,
      ]),
    );

    // 8. Map cards
    const isDemoMode = env.DEMO_MODE;
    const data: (FarmerOrderCard | BuyerOrderCard)[] = orders.map((order) => {
      const crop = cropMap.get(order.cropId.toString());
      if (actor.role === UserRole.FARMER) {
        const buyer = userMap.get(order.buyerId.toString());
        return mapOrderToFarmerOrderCard(order, crop, buyer, isDemoMode);
      }
      const farmer = userMap.get(order.farmerId.toString());
      return mapOrderToBuyerOrderCard(order, crop, farmer, isDemoMode);
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        serverTime: clock.iso(),
        statusCounts,
        counts: statusCounts,
      },
    };
  }

  /**
   * Retrieves single order detail for participants only.
   * Throws 404 ORDER_NOT_FOUND if not found or if caller is not a participant.
   */
  public async getOrderById(
    orderId: string,
    actor: ActorContext,
  ): Promise<FarmerOrderDetail | BuyerOrderDetail> {
    const cleanId = ensureObjectId(orderId, "order");
    const order = (await Order.findById(cleanId).lean()) as unknown as RawOrderDoc | null;

    if (!order) {
      throw new AppError(404, OrderErrorCode.ORDER_NOT_FOUND, "Order not found");
    }

    // Participants check: actor must be farmerId or buyerId
    const isFarmer = order.farmerId.toString() === actor.userId;
    const isBuyer = order.buyerId.toString() === actor.userId;

    if (!isFarmer && !isBuyer) {
      // SECURITY §2 / gap 7: non-participants get NOT_FOUND to prevent leaking order existence
      throw new AppError(404, OrderErrorCode.ORDER_NOT_FOUND, "Order not found");
    }

    const counterpartId = isFarmer ? order.buyerId : order.farmerId;

    const [crop, counterpartUser, listing] = await Promise.all([
      Crop.findById(order.cropId).lean() as Promise<WithId<CropRecord> | null>,
      User.findById(counterpartId).lean() as Promise<WithId<UserRecord> | null>,
      Listing.findById(order.listingId).lean() as Promise<WithId<ListingRecord> | null>,
    ]);

    const isDemoMode = env.DEMO_MODE;

    if (isFarmer) {
      return mapOrderToFarmerOrderDetail(
        order,
        crop,
        counterpartUser,
        listing,
        isDemoMode,
      );
    }

    return mapOrderToBuyerOrderDetail(
      order,
      crop,
      counterpartUser,
      listing,
      isDemoMode,
    );
  }
}

let orderServiceInstance: OrderService | undefined;

export function getOrderService(): OrderService {
  if (!orderServiceInstance) {
    orderServiceInstance = new OrderService();
  }
  return orderServiceInstance;
}

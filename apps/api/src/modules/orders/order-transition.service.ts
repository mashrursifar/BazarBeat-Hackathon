import { ObjectId } from "bson";
import {
  type ConfirmOrderRequest,
  type DisputeOrderRequest,
  DomainEventName,
  type MinimalOrder,
  OrderAction,
  OrderErrorCode,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockReturnDecision,
  UserRole,
  canPerformOrderAction,
  confirmOrderRequestSchema,
  decideStockReturnRequestSchema,
  disputeOrderRequestSchema,
  getOrderDisputeWindowMs,
  validateHandoverSchedule,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { AppError } from "../../shared/errors.js";
import { returnStock } from "../inventory/inventory.service.js";
import { mapOrderToMinimalOrder } from "./order.mapper.js";
import { Order, type OrderRecord } from "./order.model.js";

type RawOrderDoc = OrderRecord & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt?: Date;
};

export interface ActorContext {
  userId: string;
  role: UserRole | "SYSTEM";
  isSystem?: boolean;
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

/**
 * Helper to fetch order document with validation.
 */
async function fetchOrderOrThrow(orderId: string): Promise<RawOrderDoc> {
  const cleanId = ensureObjectId(orderId, "order");
  const order = await Order.findById(cleanId);
  if (!order) {
    throw new AppError(404, OrderErrorCode.ORDER_NOT_FOUND, "Order not found");
  }
  return order as unknown as RawOrderDoc;
}

/**
 * Order Transition Service (Task 6.3 - P0, core engine).
 * DESIGN_PATTERNS (#3 State Machine, #4 Domain Events, #7 Optimistic Concurrency).
 * AGENTS Rules 3 & 4: This service is the SINGLE authority for all order status and payment transitions.
 * No order status is ever set directly from a controller or outside this engine.
 */
export class OrderTransitionService {
  /**
   * Farmer confirms order, provides handover schedule and pickup note.
   * Transitions: PENDING -> CONFIRMED.
   */
  public async confirm(
    orderId: string,
    actor: ActorContext,
    request: ConfirmOrderRequest,
  ): Promise<MinimalOrder> {
    const validatedRequest = confirmOrderRequestSchema.parse(request);
    const order = await fetchOrderOrThrow(orderId);

    // Ownership check: actor must be the order's farmer
    if (actor.role !== UserRole.FARMER || order.farmerId.toString() !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Only the order farmer can confirm this order");
    }

    // Guard against illegal state transition using getOrderActions / state machine
    if (
      !canPerformOrderAction(actor.role, OrderAction.CONFIRM, {
        status: order.status as OrderStatus,
        payment: {
          status: order.payment.status as PaymentStatus,
          method: order.payment.method as PaymentMethod | undefined,
        },
      })
    ) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot confirm order in status '${order.status}'`,
      );
    }

    const clock = getClock();
    const now = clock.now();

    // Handover scheduling validation
    const handoverCheck = validateHandoverSchedule(
      validatedRequest.handoverAt,
      now,
      validatedRequest.note,
    );
    if (!handoverCheck.valid) {
      throw new AppError(
        400,
        OrderErrorCode.HANDOVER_TIME_INVALID,
        handoverCheck.reason ?? "Handover time is invalid",
      );
    }

    // Atomic conditional update on expected current status PENDING
    const updated = (await Order.findOneAndUpdate(
      {
        _id: order._id,
        farmerId: actor.userId,
        status: OrderStatus.PENDING,
      },
      {
        $set: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: now,
          "fulfilment.handoverAt": new Date(validatedRequest.handoverAt),
          ...(validatedRequest.note !== undefined
            ? { "fulfilment.note": validatedRequest.note }
            : {}),
          ...(validatedRequest.fulfilmentMethod !== undefined
            ? { "fulfilment.method": validatedRequest.fulfilmentMethod }
            : {}),
        },
        $push: {
          statusHistory: {
            status: OrderStatus.CONFIRMED,
            at: now,
            byUserId: new ObjectId(actor.userId),
            ...(validatedRequest.note ? { note: validatedRequest.note } : {}),
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      // Re-query to determine concurrency loss reason
      const current = await fetchOrderOrThrow(orderId);
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is no longer in PENDING status (current: '${current.status}')`,
      );
    }

    // Emit typed domain event
    getDomainEventEmitter().emit(DomainEventName.ORDER_CONFIRMED, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      farmerId: updated.farmerId.toString(),
      buyerId: updated.buyerId.toString(),
      confirmedAt: now.toISOString(),
      handoverAt: new Date(validatedRequest.handoverAt).toISOString(),
      ...(validatedRequest.note ? { note: validatedRequest.note } : {}),
    });

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Buyer settles simulated payment via wallet.
   * Switches payment method to WALLET_SIM and status to PAID.
   */
  public async markPaid(
    orderId: string,
    actor: ActorContext,
    request?: { method?: PaymentMethod },
  ): Promise<MinimalOrder> {
    void request;
    const order = await fetchOrderOrThrow(orderId);

    // Ownership check: actor must be the order's buyer
    if (actor.role !== UserRole.BUYER || order.buyerId.toString() !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Only the order buyer can mark payment");
    }

    // Check payment status
    if (order.payment.status === PaymentStatus.PAID) {
      throw new AppError(
        409,
        OrderErrorCode.ORDER_ALREADY_PAID,
        "Order payment is already marked as PAID",
      );
    }

    // Guard against illegal order status for payment
    if (
      !canPerformOrderAction(actor.role, OrderAction.MARK_PAID, {
        status: order.status as OrderStatus,
        payment: {
          status: order.payment.status as PaymentStatus,
          method: order.payment.method as PaymentMethod | undefined,
        },
      })
    ) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot mark payment for order in status '${order.status}'`,
      );
    }

    const clock = getClock();
    const now = clock.now();

    // Atomic conditional update on UNPAID payment status and active order status
    const updated = (await Order.findOneAndUpdate(
      {
        _id: order._id,
        buyerId: actor.userId,
        "payment.status": PaymentStatus.UNPAID,
        status: {
          $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.DELIVERED],
        },
      },
      {
        $set: {
          "payment.status": PaymentStatus.PAID,
          "payment.method": PaymentMethod.WALLET_SIM,
          "payment.paidAt": now,
        },
        $push: {
          statusHistory: {
            status: order.status as OrderStatus,
            at: now,
            byUserId: new ObjectId(actor.userId),
            note: "Paid via simulated wallet",
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      const current = await fetchOrderOrThrow(orderId);
      if (current.payment.status === PaymentStatus.PAID) {
        throw new AppError(
          409,
          OrderErrorCode.ORDER_ALREADY_PAID,
          "Order payment is already marked as PAID",
        );
      }
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is not in an eligible state for payment (current: '${current.status}')`,
      );
    }

    // Emit typed domain event
    getDomainEventEmitter().emit(DomainEventName.PAYMENT_PAID, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      buyerId: updated.buyerId.toString(),
      farmerId: updated.farmerId.toString(),
      amount: updated.subtotal,
      method: PaymentMethod.WALLET_SIM,
      paidAt: now.toISOString(),
    });

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Farmer marks order as delivered / handed over.
   * Transitions: CONFIRMED -> DELIVERED.
   * Payment rule: If payment was not already PAID, COD becomes PAID.
   */
  public async markDelivered(
    orderId: string,
    actor: ActorContext,
    request?: { note?: string },
  ): Promise<MinimalOrder> {
    const order = await fetchOrderOrThrow(orderId);

    // Ownership check: actor must be the order's farmer
    if (actor.role !== UserRole.FARMER || order.farmerId.toString() !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Only the order farmer can mark delivery");
    }

    // Guard against illegal state transition
    if (
      !canPerformOrderAction(actor.role, OrderAction.MARK_DELIVERED, {
        status: order.status as OrderStatus,
        payment: {
          status: order.payment.status as PaymentStatus,
          method: order.payment.method as PaymentMethod | undefined,
        },
      })
    ) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot mark delivered for order in status '${order.status}'`,
      );
    }

    const clock = getClock();
    const now = clock.now();
    const willBecomePaid = order.payment.status !== PaymentStatus.PAID;

    const setFields: Record<string, unknown> = {
      status: OrderStatus.DELIVERED,
      deliveredAt: now,
    };

    if (willBecomePaid) {
      setFields["payment.status"] = PaymentStatus.PAID;
      setFields["payment.method"] = order.payment.method ?? PaymentMethod.COD;
      setFields["payment.paidAt"] = now;
    }

    // Atomic conditional update on CONFIRMED status
    const updated = (await Order.findOneAndUpdate(
      {
        _id: order._id,
        farmerId: actor.userId,
        status: OrderStatus.CONFIRMED,
      },
      {
        $set: setFields,
        $push: {
          statusHistory: {
            status: OrderStatus.DELIVERED,
            at: now,
            byUserId: new ObjectId(actor.userId),
            ...(request?.note ? { note: request.note } : {}),
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      const current = await fetchOrderOrThrow(orderId);
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is no longer in CONFIRMED status (current: '${current.status}')`,
      );
    }

    // Emit order.delivered domain event
    getDomainEventEmitter().emit(DomainEventName.ORDER_DELIVERED, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      farmerId: updated.farmerId.toString(),
      buyerId: updated.buyerId.toString(),
      deliveredAt: now.toISOString(),
      ...(request?.note ? { note: request.note } : {}),
    });

    // If COD transitioned to PAID on delivery, emit payment.paid event
    if (willBecomePaid) {
      getDomainEventEmitter().emit(DomainEventName.PAYMENT_PAID, {
        orderId: updated._id.toString(),
        listingId: updated.listingId.toString(),
        buyerId: updated.buyerId.toString(),
        farmerId: updated.farmerId.toString(),
        amount: updated.subtotal,
        method: (updated.payment.method as PaymentMethod) ?? PaymentMethod.COD,
        paidAt: now.toISOString(),
      });
    }

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Buyer completes order upon receipt of produce.
   * Transitions: DELIVERED -> COMPLETED.
   */
  public async complete(
    orderId: string,
    actor: ActorContext,
    request?: { note?: string },
  ): Promise<MinimalOrder> {
    const order = await fetchOrderOrThrow(orderId);
    const isSystem =
      actor.isSystem === true || actor.userId === "SYSTEM" || (actor.role as string) === "SYSTEM";

    // Ownership check: actor must be the order's buyer unless SYSTEM
    if (!isSystem && (actor.role !== UserRole.BUYER || order.buyerId.toString() !== actor.userId)) {
      throw new AppError(403, "FORBIDDEN", "Only the order buyer can complete this order");
    }

    // Guard against illegal state transition
    if (order.status !== OrderStatus.DELIVERED) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot complete order in status '${order.status}'`,
      );
    }

    if (isSystem && order.dispute) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        "Cannot auto-complete order with active dispute",
      );
    }

    const clock = getClock();
    const now = clock.now();

    // Atomic conditional update on DELIVERED status (and no dispute if system)
    const filterConditions: Record<string, unknown> = {
      _id: order._id,
      status: OrderStatus.DELIVERED,
    };
    if (!isSystem) {
      filterConditions.buyerId = actor.userId;
    } else {
      filterConditions.dispute = { $exists: false };
    }

    const updated = (await Order.findOneAndUpdate(
      filterConditions,
      {
        $set: {
          status: OrderStatus.COMPLETED,
          completedAt: now,
        },
        $push: {
          statusHistory: {
            status: OrderStatus.COMPLETED,
            at: now,
            ...(isSystem ? {} : { byUserId: new ObjectId(actor.userId) }),
            ...(request?.note ? { note: request.note } : isSystem ? { note: "Auto-completed by system" } : {}),
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      const current = await fetchOrderOrThrow(orderId);
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is no longer in DELIVERED status (current: '${current.status}')`,
      );
    }

    // Emit order.completed domain event
    getDomainEventEmitter().emit(DomainEventName.ORDER_COMPLETED, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      farmerId: updated.farmerId.toString(),
      buyerId: updated.buyerId.toString(),
      completedAt: now.toISOString(),
      ...(request?.note ? { note: request.note } : isSystem ? { note: "Auto-completed by system" } : {}),
    });

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Buyer or Farmer cancels an order from PENDING or CONFIRMED.
   * Transitions: PENDING | CONFIRMED -> CANCELLED.
   * Refund rule: If paid by wallet, simulated payment transitions to REFUNDED.
   */
  public async cancel(
    orderId: string,
    actor: ActorContext,
    request: { reason: string; note?: string },
  ): Promise<MinimalOrder> {
    if (!request.reason || request.reason.trim().length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Cancellation reason is required");
    }

    const order = await fetchOrderOrThrow(orderId);
    const isSystem =
      actor.isSystem === true || actor.userId === "SYSTEM" || (actor.role as string) === "SYSTEM";

    if (!isSystem) {
      // Ownership check: actor must be farmer or buyer on this order
      const isFarmer = actor.role === UserRole.FARMER && order.farmerId.toString() === actor.userId;
      const isBuyer = actor.role === UserRole.BUYER && order.buyerId.toString() === actor.userId;

      if (!isFarmer && !isBuyer) {
        throw new AppError(403, "FORBIDDEN", "Only order participants can cancel this order");
      }

      // Guard against illegal state transition
      if (
        !canPerformOrderAction(actor.role as UserRole, OrderAction.CANCEL, {
          status: order.status as OrderStatus,
          payment: {
            status: order.payment.status as PaymentStatus,
            method: order.payment.method as PaymentMethod | undefined,
          },
        })
      ) {
        throw new AppError(
          409,
          OrderErrorCode.INVALID_TRANSITION,
          `Cannot cancel order in status '${order.status}'`,
        );
      }
    } else {
      // System auto-cancellation is permitted ONLY on PENDING orders past deadline
      if (order.status !== OrderStatus.PENDING) {
        throw new AppError(
          409,
          OrderErrorCode.INVALID_TRANSITION,
          `Cannot auto-cancel order in status '${order.status}'`,
        );
      }
    }

    const clock = getClock();
    const now = clock.now();

    // Check if wallet refund simulation is required
    const isWalletPaid =
      order.payment.status === PaymentStatus.PAID &&
      order.payment.method === PaymentMethod.WALLET_SIM;

    const setFields: Record<string, unknown> = {
      status: OrderStatus.CANCELLED,
      cancelledAt: now,
      ...(isSystem ? {} : { cancelledBy: new ObjectId(actor.userId) }),
      cancelReason: request.reason.trim(),
      ...(request.note ? { cancelNote: request.note.trim() } : {}),
    };

    if (isWalletPaid) {
      setFields["payment.status"] = PaymentStatus.REFUNDED;
      setFields["payment.refundedAt"] = now;
    }

    // Atomic conditional update on the expected current status and payment status
    const expectedStatus = order.status;
    const filterConditions: Record<string, unknown> = {
      _id: order._id,
      status: expectedStatus,
      "payment.status": order.payment.status,
    };
    if (!isSystem) {
      filterConditions.$or = [
        { farmerId: actor.userId },
        { buyerId: actor.userId },
      ];
    }

    const updated = (await Order.findOneAndUpdate(
      filterConditions,
      {
        $set: setFields,
        $push: {
          statusHistory: {
            status: OrderStatus.CANCELLED,
            at: now,
            ...(isSystem ? {} : { byUserId: new ObjectId(actor.userId) }),
            note: `${request.reason.trim()}${request.note ? `: ${request.note.trim()}` : ""}`,
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      const current = await fetchOrderOrThrow(orderId);
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is not eligible for cancellation (current status: '${current.status}')`,
      );
    }

    // Emit order.cancelled domain event
    getDomainEventEmitter().emit(DomainEventName.ORDER_CANCELLED, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      farmerId: updated.farmerId.toString(),
      buyerId: updated.buyerId.toString(),
      cancelledBy: actor.userId,
      reason: request.reason.trim(),
      ...(request.note ? { note: request.note.trim() } : {}),
      cancelledAt: now.toISOString(),
      refunded: isWalletPaid,
    });

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Farmer decides stock return for a cancelled order lot.
   * Can be invoked ONLY after cancellation and ONLY ONCE.
   * When decision is RETURNED, returns stock via ledger RETURN movement.
   */
  public async decideStockReturn(
    orderId: string,
    actor: ActorContext,
    request: { decision: StockReturnDecision; note?: string },
  ): Promise<MinimalOrder> {
    const validatedRequest = decideStockReturnRequestSchema.parse(request);
    const order = await fetchOrderOrThrow(orderId);

    // Ownership check: actor must be the order's farmer
    if (actor.role !== UserRole.FARMER || order.farmerId.toString() !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Only the order farmer can decide stock return");
    }

    // Status check: must be CANCELLED
    if (order.status !== OrderStatus.CANCELLED) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Stock return can only be decided for CANCELLED orders (current: '${order.status}')`,
      );
    }

    // Once-only check
    if (order.stockReturn?.decision) {
      throw new AppError(
        409,
        "CONFLICT",
        "Stock return decision has already been recorded for this order",
      );
    }

    const clock = getClock();
    const now = clock.now();

    // If farmer chooses RETURNED, apply atomic ledger RETURN movement
    if (validatedRequest.decision === StockReturnDecision.RETURNED) {
      await returnStock({
        farmerId: order.farmerId.toString(),
        cropId: order.cropId.toString(),
        quantityKg: order.quantityKg,
        orderId: order._id.toString(),
        operationId: `order-return-${order._id.toString()}`,
        note: validatedRequest.note ?? "Cancelled order stock returned to inventory",
      });
    }

    // Atomic conditional update ensuring stockReturn has not been set yet
    const updated = (await Order.findOneAndUpdate(
      {
        _id: order._id,
        farmerId: actor.userId,
        status: OrderStatus.CANCELLED,
        stockReturn: { $exists: false },
      },
      {
        $set: {
          stockReturn: {
            decision: validatedRequest.decision,
            decidedAt: now,
            ...(validatedRequest.note ? { note: validatedRequest.note } : {}),
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      throw new AppError(
        409,
        "CONFLICT",
        "Stock return decision has already been recorded or order is not cancelled",
      );
    }

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Buyer disputes a delivered order.
   * Transitions: DELIVERED -> DISPUTED.
   * Window: Within 24 hours of delivery.
   * Keeps AI grade snapshot immutable.
   */
  public async dispute(
    orderId: string,
    actor: ActorContext,
    request: DisputeOrderRequest,
  ): Promise<MinimalOrder> {
    const validatedRequest = disputeOrderRequestSchema.parse(request);
    const order = await fetchOrderOrThrow(orderId);

    // Ownership check: actor must be the order's buyer
    if (actor.role !== UserRole.BUYER || order.buyerId.toString() !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Only the order buyer can dispute this order");
    }

    // Status check: only from DELIVERED
    if (order.status !== OrderStatus.DELIVERED) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot dispute order in status '${order.status}'`,
      );
    }

    const clock = getClock();
    const now = clock.now();

    // Check 24-hour delivery window
    const disputeWindowMs = getOrderDisputeWindowMs(env.DEMO_MODE);
    const deliveredAtTime = order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
    if (!order.deliveredAt || now.getTime() - deliveredAtTime > disputeWindowMs) {
      throw new AppError(
        409,
        OrderErrorCode.DISPUTE_WINDOW_EXPIRED,
        "Dispute window has expired (must be within 24 hours of delivery)",
      );
    }

    // Atomic conditional update on DELIVERED status
    const updated = (await Order.findOneAndUpdate(
      {
        _id: order._id,
        buyerId: actor.userId,
        status: OrderStatus.DELIVERED,
      },
      {
        $set: {
          status: OrderStatus.DISPUTED,
          dispute: {
            reason: validatedRequest.reason,
            ...(validatedRequest.note ? { note: validatedRequest.note } : {}),
            raisedAt: now,
          },
        },
        $push: {
          statusHistory: {
            status: OrderStatus.DISPUTED,
            at: now,
            byUserId: new ObjectId(actor.userId),
            ...(validatedRequest.note
              ? { note: `${validatedRequest.reason}: ${validatedRequest.note}` }
              : { note: validatedRequest.reason }),
          },
        },
      },
      { new: true },
    )) as unknown as RawOrderDoc | null;

    if (!updated) {
      const current = await fetchOrderOrThrow(orderId);
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Order is no longer in DELIVERED status (current: '${current.status}')`,
      );
    }

    // Emit order.disputed domain event
    getDomainEventEmitter().emit(DomainEventName.ORDER_DISPUTED, {
      orderId: updated._id.toString(),
      listingId: updated.listingId.toString(),
      farmerId: updated.farmerId.toString(),
      buyerId: updated.buyerId.toString(),
      disputedBy: actor.userId,
      reason: validatedRequest.reason,
      ...(validatedRequest.note ? { note: validatedRequest.note } : {}),
      disputedAt: now.toISOString(),
    });

    return mapOrderToMinimalOrder(updated);
  }

  /**
   * Dev-only resolution of a DISPUTED order (complete or cancel).
   * Transitions: DISPUTED -> COMPLETED | CANCELLED.
   */
  public async resolveDispute(
    orderId: string,
    resolution: {
      action: "COMPLETE" | "CANCEL";
      note?: string;
      resolvedBy?: string;
    },
  ): Promise<MinimalOrder> {
    const order = await fetchOrderOrThrow(orderId);

    if (order.status !== OrderStatus.DISPUTED) {
      throw new AppError(
        409,
        OrderErrorCode.INVALID_TRANSITION,
        `Cannot resolve dispute on order in status '${order.status}' (must be DISPUTED)`,
      );
    }

    const clock = getClock();
    const now = clock.now();
    const resolutionNote = resolution.note?.trim() || `Dispute resolved as ${resolution.action}`;

    if (resolution.action === "COMPLETE") {
      const updated = (await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: OrderStatus.DISPUTED,
        },
        {
          $set: {
            status: OrderStatus.COMPLETED,
            completedAt: now,
            "dispute.resolution": resolutionNote,
          },
          $push: {
            statusHistory: {
              status: OrderStatus.COMPLETED,
              at: now,
              note: `Resolved by ${resolution.resolvedBy ?? "dev"}: ${resolutionNote}`,
            },
          },
        },
        { new: true },
      )) as unknown as RawOrderDoc | null;

      if (!updated) {
        throw new AppError(409, OrderErrorCode.INVALID_TRANSITION, "Order is no longer DISPUTED");
      }

      getDomainEventEmitter().emit(DomainEventName.ORDER_COMPLETED, {
        orderId: updated._id.toString(),
        listingId: updated.listingId.toString(),
        farmerId: updated.farmerId.toString(),
        buyerId: updated.buyerId.toString(),
        completedAt: now.toISOString(),
        note: resolutionNote,
      });

      return mapOrderToMinimalOrder(updated);
    } else if (resolution.action === "CANCEL") {
      const isWalletPaid =
        order.payment.status === PaymentStatus.PAID &&
        order.payment.method === PaymentMethod.WALLET_SIM;

      const setFields: Record<string, unknown> = {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
        cancelReason: "DISPUTE_RESOLVED_CANCELLED",
        cancelNote: resolutionNote,
        "dispute.resolution": resolutionNote,
      };

      if (isWalletPaid) {
        setFields["payment.status"] = PaymentStatus.REFUNDED;
        setFields["payment.refundedAt"] = now;
      }

      const updated = (await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: OrderStatus.DISPUTED,
        },
        {
          $set: setFields,
          $push: {
            statusHistory: {
              status: OrderStatus.CANCELLED,
              at: now,
              note: `Resolved by ${resolution.resolvedBy ?? "dev"}: ${resolutionNote}`,
            },
          },
        },
        { new: true },
      )) as unknown as RawOrderDoc | null;

      if (!updated) {
        throw new AppError(409, OrderErrorCode.INVALID_TRANSITION, "Order is no longer DISPUTED");
      }

      getDomainEventEmitter().emit(DomainEventName.ORDER_CANCELLED, {
        orderId: updated._id.toString(),
        listingId: updated.listingId.toString(),
        farmerId: updated.farmerId.toString(),
        buyerId: updated.buyerId.toString(),
        cancelledBy: resolution.resolvedBy ?? "DEV_SCRIPT",
        reason: "DISPUTE_RESOLVED_CANCELLED",
        note: resolutionNote,
        cancelledAt: now.toISOString(),
        refunded: isWalletPaid,
      });

      return mapOrderToMinimalOrder(updated);
    } else {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Invalid resolution action: ${(resolution as { action: string }).action}`,
      );
    }
  }
}

let serviceInstance: OrderTransitionService | undefined;

export function getOrderTransitionService(): OrderTransitionService {
  if (!serviceInstance) {
    serviceInstance = new OrderTransitionService();
  }
  return serviceInstance;
}

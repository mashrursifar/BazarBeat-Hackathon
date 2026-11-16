import {
  OrderAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "./enums.js";
import { ORDER_HANDOVER } from "./timing.js";

/**
 * AUCTION_RULES §11: Order state machine transitions.
 * PENDING ──farmer confirms──> CONFIRMED ──mark delivered──> DELIVERED ──buyer completes──> COMPLETED
 *    │                           │                               │
 *    └──cancel (either)──> CANCELLED      └──cancel (before delivery)──> CANCELLED     └──dispute──> DISPUTED
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.DISPUTED]: [],
} as const;

export function isAllowedOrderTransition(current: OrderStatus, next: OrderStatus): boolean {
  const allowed = ALLOWED_ORDER_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

/**
 * AUCTION_RULES §11: Independent payment state transitions.
 * UNPAID ──mark paid (simulated/COD)──> PAID ──order cancelled──> REFUNDED
 */
export const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.UNPAID]: [PaymentStatus.PAID],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
  [PaymentStatus.REFUNDED]: [],
} as const;

export function isAllowedPaymentTransition(current: PaymentStatus, next: PaymentStatus): boolean {
  const allowed = ALLOWED_PAYMENT_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export interface OrderActionContext {
  status: OrderStatus;
  payment?: {
    status: PaymentStatus;
    method?: PaymentMethod;
  };
}

/**
 * Determines which actions an authenticated actor can perform on an order based on role and current state.
 * Sources: AUCTION_RULES §11, API_SPEC (Orders).
 *
 * Farmer:
 * - PENDING: CONFIRM, CANCEL
 * - CONFIRMED: MARK_DELIVERED, CANCEL
 * - DELIVERED: None (waiting for buyer)
 * - COMPLETED / CANCELLED / DISPUTED: None
 *
 * Buyer:
 * - PENDING: MARK_PAID (if unpaid), CANCEL
 * - CONFIRMED: MARK_PAID (if unpaid), CANCEL
 * - DELIVERED: COMPLETE, DISPUTE, MARK_PAID (if unpaid)
 * - COMPLETED / CANCELLED / DISPUTED: None
 */
export function getOrderActions(role: UserRole, order: OrderActionContext): OrderAction[] {
  const isPaid = order.payment?.status === PaymentStatus.PAID;

  if (role === UserRole.FARMER) {
    switch (order.status) {
      case OrderStatus.PENDING:
        return [OrderAction.CONFIRM, OrderAction.CANCEL];
      case OrderStatus.CONFIRMED:
        return [OrderAction.MARK_DELIVERED, OrderAction.CANCEL];
      case OrderStatus.DELIVERED:
      case OrderStatus.COMPLETED:
      case OrderStatus.CANCELLED:
      case OrderStatus.DISPUTED:
        return [];
      default:
        return [];
    }
  }

  if (role === UserRole.BUYER) {
    switch (order.status) {
      case OrderStatus.PENDING:
      case OrderStatus.CONFIRMED:
        return isPaid
          ? [OrderAction.CANCEL]
          : [OrderAction.MARK_PAID, OrderAction.CANCEL];
      case OrderStatus.DELIVERED:
        return isPaid
          ? [OrderAction.COMPLETE, OrderAction.DISPUTE]
          : [OrderAction.COMPLETE, OrderAction.DISPUTE, OrderAction.MARK_PAID];
      case OrderStatus.COMPLETED:
      case OrderStatus.CANCELLED:
      case OrderStatus.DISPUTED:
        return [];
      default:
        return [];
    }
  }

  return [];
}

export function canPerformOrderAction(
  role: UserRole,
  action: OrderAction,
  order: OrderActionContext
): boolean {
  return getOrderActions(role, order).includes(action);
}

export interface HandoverValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Pure function validating handover scheduling constraints.
 * Rule: Time from now up to 72 hours ahead; note up to 200 characters.
 */
export function validateHandoverSchedule(
  handoverAt: string | Date,
  now: Date = new Date(),
  note?: string
): HandoverValidationResult {
  if (note && note.trim().length > ORDER_HANDOVER.MAX_NOTE_LENGTH) {
    return {
      valid: false,
      reason: `Note exceeds maximum length of ${ORDER_HANDOVER.MAX_NOTE_LENGTH} characters`,
    };
  }

  const date = typeof handoverAt === "string" ? new Date(handoverAt) : handoverAt;
  if (Number.isNaN(date.getTime())) {
    return { valid: false, reason: "Invalid handover date format" };
  }

  const diffMs = date.getTime() - now.getTime();
  // Allow 60s tolerance for server/network clock skew
  if (diffMs < -60_000) {
    return { valid: false, reason: "Handover time must be in the future" };
  }

  if (diffMs > ORDER_HANDOVER.MAX_HOURS_AHEAD_MS + 60_000) {
    return {
      valid: false,
      reason: `Handover time cannot be more than ${ORDER_HANDOVER.MAX_HOURS_AHEAD} hours ahead`,
    };
  }

  return { valid: true };
}

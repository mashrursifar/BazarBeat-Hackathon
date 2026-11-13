import { ListingStatus } from "@bazarbeat/shared";
import { AppError } from "../../shared/errors.js";

export type ListingStatusType = (typeof ListingStatus)[keyof typeof ListingStatus];

export type ListingAction =
  "publish" | "close_sold" | "close_unsold" | "cancel" | "accept_current_bid";

export interface ListingTransition {
  from: ListingStatusType;
  to: ListingStatusType;
  action: ListingAction;
}

/**
 * State machine transition table defined in AUCTION_RULES.md §7.
 */
export const LISTING_TRANSITIONS: readonly ListingTransition[] = [
  { from: ListingStatus.DRAFT, to: ListingStatus.ACTIVE, action: "publish" },
  { from: ListingStatus.ACTIVE, to: ListingStatus.SOLD, action: "close_sold" },
  { from: ListingStatus.ACTIVE, to: ListingStatus.EXPIRED_UNSOLD, action: "close_unsold" },
  { from: ListingStatus.ACTIVE, to: ListingStatus.CANCELLED, action: "cancel" },
  { from: ListingStatus.ACTIVE, to: ListingStatus.SOLD, action: "accept_current_bid" },
] as const;

export const TERMINAL_LISTING_STATUSES: ReadonlySet<ListingStatusType> = new Set([
  ListingStatus.SOLD,
  ListingStatus.EXPIRED_UNSOLD,
  ListingStatus.CANCELLED,
]);

export function isTerminalListingStatus(status: ListingStatusType): boolean {
  return TERMINAL_LISTING_STATUSES.has(status);
}

export function canTransitionListing(
  from: ListingStatusType,
  to: ListingStatusType,
  action: ListingAction,
): boolean {
  return LISTING_TRANSITIONS.some((t) => t.from === from && t.to === to && t.action === action);
}

export function assertValidListingTransition(
  from: ListingStatusType,
  to: ListingStatusType,
  action: ListingAction,
): void {
  if (!canTransitionListing(from, to, action)) {
    throw new AppError(
      422,
      "INVALID_TRANSITION",
      `Cannot transition listing from '${from}' to '${to}' via '${action}'`,
    );
  }
}

export function getNextListingStatus(
  from: ListingStatusType,
  action: ListingAction,
): ListingStatusType {
  const transition = LISTING_TRANSITIONS.find((t) => t.from === from && t.action === action);
  if (!transition) {
    throw new AppError(
      422,
      "INVALID_TRANSITION",
      `Invalid action '${action}' for listing in status '${from}'`,
    );
  }
  return transition.to;
}

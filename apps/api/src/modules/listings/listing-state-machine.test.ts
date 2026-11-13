import { describe, expect, it } from "vitest";
import { ListingStatus } from "@bazarbeat/shared";

import {
  LISTING_TRANSITIONS,
  TERMINAL_LISTING_STATUSES,
  assertValidListingTransition,
  canTransitionListing,
  getNextListingStatus,
  isTerminalListingStatus,
} from "./listing-state-machine.js";

describe("Listing State Machine (AUCTION_RULES.md §7)", () => {
  it("defines all permitted transitions accurately", () => {
    expect(LISTING_TRANSITIONS).toHaveLength(5);
    expect(canTransitionListing(ListingStatus.DRAFT, ListingStatus.ACTIVE, "publish")).toBe(true);
    expect(canTransitionListing(ListingStatus.ACTIVE, ListingStatus.SOLD, "close_sold")).toBe(true);
    expect(
      canTransitionListing(ListingStatus.ACTIVE, ListingStatus.EXPIRED_UNSOLD, "close_unsold"),
    ).toBe(true);
    expect(canTransitionListing(ListingStatus.ACTIVE, ListingStatus.CANCELLED, "cancel")).toBe(
      true,
    );
    expect(
      canTransitionListing(ListingStatus.ACTIVE, ListingStatus.SOLD, "accept_current_bid"),
    ).toBe(true);
  });

  it("identifies terminal states and prevents transitions out of them", () => {
    expect(isTerminalListingStatus(ListingStatus.SOLD)).toBe(true);
    expect(isTerminalListingStatus(ListingStatus.EXPIRED_UNSOLD)).toBe(true);
    expect(isTerminalListingStatus(ListingStatus.CANCELLED)).toBe(true);
    expect(isTerminalListingStatus(ListingStatus.ACTIVE)).toBe(false);
    expect(isTerminalListingStatus(ListingStatus.DRAFT)).toBe(false);

    for (const terminal of TERMINAL_LISTING_STATUSES) {
      expect(canTransitionListing(terminal, ListingStatus.ACTIVE, "publish")).toBe(false);
      expect(canTransitionListing(terminal, ListingStatus.DRAFT, "publish")).toBe(false);
      expect(() => getNextListingStatus(terminal, "publish")).toThrowError(/Invalid action/);
    }
  });

  it("returns the expected next status on valid actions", () => {
    expect(getNextListingStatus(ListingStatus.DRAFT, "publish")).toBe(ListingStatus.ACTIVE);
    expect(getNextListingStatus(ListingStatus.ACTIVE, "close_sold")).toBe(ListingStatus.SOLD);
    expect(getNextListingStatus(ListingStatus.ACTIVE, "close_unsold")).toBe(
      ListingStatus.EXPIRED_UNSOLD,
    );
    expect(getNextListingStatus(ListingStatus.ACTIVE, "cancel")).toBe(ListingStatus.CANCELLED);
    expect(getNextListingStatus(ListingStatus.ACTIVE, "accept_current_bid")).toBe(
      ListingStatus.SOLD,
    );
  });

  it("asserts valid transitions and throws typed AppError on invalid transitions", () => {
    expect(() =>
      assertValidListingTransition(ListingStatus.DRAFT, ListingStatus.ACTIVE, "publish"),
    ).not.toThrow();

    expect(() =>
      assertValidListingTransition(ListingStatus.DRAFT, ListingStatus.SOLD, "close_sold"),
    ).toThrowError(/Cannot transition listing/);

    expect(() =>
      assertValidListingTransition(ListingStatus.ACTIVE, ListingStatus.DRAFT, "publish"),
    ).toThrowError(/Cannot transition listing/);
  });
});

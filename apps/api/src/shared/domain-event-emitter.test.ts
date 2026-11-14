import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainEventName, ListingStatus } from "@bazarbeat/shared";

import {
  DomainEventEmitter,
  getDomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "./domain-event-emitter.js";
import { logger } from "./logger.js";

describe("DomainEventEmitter", () => {
  afterEach(() => {
    resetDomainEventEmitter();
    vi.restoreAllMocks();
  });

  it("publishes and receives typed domain events", () => {
    const emitter = new DomainEventEmitter();
    const received: unknown[] = [];

    emitter.on(DomainEventName.BID_PLACED, (payload) => {
      received.push(payload);
    });

    const payload = {
      listingId: "listing-1",
      bidId: "bid-1",
      buyerId: "buyer-1",
      bidderLabel: "Buyer #1",
      amountPerKg: 5000,
      totalAmount: 500000,
      bidCount: 1,
      currentBidPerKg: 5000,
      placedAt: "2026-11-14T10:00:00.000Z",
    };

    emitter.emit(DomainEventName.BID_PLACED, payload);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  it("supports multiple subscribers for the same event", () => {
    const emitter = new DomainEventEmitter();
    let count = 0;

    emitter.on(DomainEventName.AUCTION_EXTENDED, () => {
      count += 1;
    });
    emitter.on(DomainEventName.AUCTION_EXTENDED, () => {
      count += 10;
    });

    emitter.emit(DomainEventName.AUCTION_EXTENDED, {
      listingId: "listing-1",
      endsAt: "2026-11-14T10:02:00.000Z",
      extensionCount: 1,
      extendedAt: "2026-11-14T10:00:00.000Z",
    });

    expect(count).toBe(11);
  });

  it("unsubscribes via returned callback function", () => {
    const emitter = new DomainEventEmitter();
    let calls = 0;

    const unsubscribe = emitter.on(DomainEventName.AUCTION_CLOSED, () => {
      calls += 1;
    });

    emitter.emit(DomainEventName.AUCTION_CLOSED, {
      listingId: "listing-1",
      status: ListingStatus.SOLD,
      closedAt: "2026-11-14T10:00:00.000Z",
    });
    expect(calls).toBe(1);

    unsubscribe();

    emitter.emit(DomainEventName.AUCTION_CLOSED, {
      listingId: "listing-1",
      status: ListingStatus.SOLD,
      closedAt: "2026-11-14T10:00:00.000Z",
    });
    expect(calls).toBe(1);
  });

  it("supports once listener firing only once", () => {
    const emitter = new DomainEventEmitter();
    let calls = 0;

    emitter.once(DomainEventName.ORDER_CREATED, () => {
      calls += 1;
    });

    const orderPayload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      cropId: "crop-1",
      quantityKg: 100,
      pricePerKg: 5000,
      totalAmount: 500000,
      platformFee: 0,
      farmerNet: 500000,
      createdAt: "2026-11-14T10:00:00.000Z",
    };

    emitter.emit(DomainEventName.ORDER_CREATED, orderPayload);
    emitter.emit(DomainEventName.ORDER_CREATED, orderPayload);

    expect(calls).toBe(1);
    expect(emitter.listenerCount(DomainEventName.ORDER_CREATED)).toBe(0);
  });

  it("handles synchronous listener errors gracefully without halting other listeners", () => {
    const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const emitter = new DomainEventEmitter();
    let secondListenerCalled = false;

    emitter.on(DomainEventName.BID_PLACED, () => {
      throw new Error("Simulated failure in listener 1");
    });
    emitter.on(DomainEventName.BID_PLACED, () => {
      secondListenerCalled = true;
    });

    emitter.emit(DomainEventName.BID_PLACED, {
      listingId: "listing-1",
      bidId: "bid-1",
      buyerId: "buyer-1",
      bidderLabel: "Buyer #1",
      amountPerKg: 5000,
      totalAmount: 500000,
      bidCount: 1,
      currentBidPerKg: 5000,
      placedAt: "2026-11-14T10:00:00.000Z",
    });

    expect(secondListenerCalled).toBe(true);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: DomainEventName.BID_PLACED }),
      "Domain event listener threw synchronously",
    );
  });

  it("handles asynchronous listener rejection gracefully", async () => {
    const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const emitter = new DomainEventEmitter();

    emitter.on(DomainEventName.AUCTION_CLOSED, async () => {
      await Promise.resolve();
      throw new Error("Async failure");
    });

    emitter.emit(DomainEventName.AUCTION_CLOSED, {
      listingId: "listing-1",
      status: ListingStatus.EXPIRED_UNSOLD,
      closedAt: "2026-11-14T10:00:00.000Z",
    });

    // Wait a tick for the promise rejection
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: DomainEventName.AUCTION_CLOSED }),
      "Domain event listener rejected asynchronously",
    );
  });

  it("manages global emitter replacement and reset", () => {
    const defaultEmitter = getDomainEventEmitter();
    expect(defaultEmitter).toBeInstanceOf(DomainEventEmitter);

    const customEmitter = new DomainEventEmitter();
    setDomainEventEmitter(customEmitter);
    expect(getDomainEventEmitter()).toBe(customEmitter);

    resetDomainEventEmitter();
    expect(getDomainEventEmitter()).not.toBe(customEmitter);
    expect(getDomainEventEmitter()).toBeInstanceOf(DomainEventEmitter);
  });
});


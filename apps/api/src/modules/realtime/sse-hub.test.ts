import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  DomainEventName,
  type FarmerListing,
  ListingStatus,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { ListingStreamHub } from "./sse-hub.js";

function createMockResponse(): {
  res: Response;
  written: string[];
  headers: Record<string, string>;
  statusCode: number;
} {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const emitter = new EventEmitter();

  const mockRes = {
    statusCode: 200,
    status(code: number): unknown {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string): void {
      headers[name.toLowerCase()] = value;
    },
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      emitter.emit("close");
      return mockRes;
    }),
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    emit: emitter.emit.bind(emitter),
  };

  return { res: mockRes as unknown as Response, written, headers, statusCode: 200 };
}

function createMockRequest(): Request {
  const emitter = new EventEmitter();
  return {
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    emit: emitter.emit.bind(emitter),
  } as unknown as Request;
}

const mockFarmer: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  role: UserRole.FARMER,
  name: "Farmer Roy",
  division: "Rajshahi",
  district: "Bogra",
  language: "en",
};

const mockBuyer: PublicUser = {
  id: "507f1f77bcf86cd799439012",
  role: UserRole.BUYER,
  name: "Buyer Kabir",
  division: "Dhaka",
  district: "Dhaka",
  language: "en",
};

const mockListing: FarmerListing = {
  id: "607f1f77bcf86cd799439021",
  cropId: "607f1f77bcf86cd799439001",
  quantityKg: 50,
  images: [{ url: "/uploads/sample.jpg", width: 800, height: 600 }],
  location: {
    division: "Rajshahi",
    district: "Bogra",
  },
  aiAssessment: {
    grade: CropGrade.A,
    confidence: 0.95,
    classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
    qualityNotes: ["Uniform size"],
    cropMatch: true,
    modelVersion: "mock-1.0",
    provider: "mock",
    degraded: false,
    assessedAt: "2026-11-14T10:00:00.000Z",
  },
  aiPriceGuidance: {
    lowPerKg: 4000,
    expectedPerKg: 5000,
    highPerKg: 6000,
    trend: "FLAT",
    confidence: 0.9,
    explanation: ["Normal supply"],
    modelVersion: "mock-1.0",
    provider: "mock",
    degraded: false,
    generatedAt: "2026-11-14T10:00:00.000Z",
    suggestedFloorPerKg: 4500,
  },
  floorPricePerKg: 4500,
  minIncrementPerKg: 100,
  startsAt: "2026-11-14T10:00:00.000Z",
  endsAt: "2026-11-14T12:00:00.000Z",
  originalEndsAt: "2026-11-14T12:00:00.000Z",
  extensionCount: 0,
  status: ListingStatus.ACTIVE,
  currentBidPerKg: undefined,
  bidCount: 0,
  createdAt: "2026-11-14T10:00:00.000Z",
};

describe("ListingStreamHub unit tests", () => {
  let eventEmitter: DomainEventEmitter;
  let hub: ListingStreamHub;

  beforeEach(() => {
    vi.useFakeTimers();
    eventEmitter = new DomainEventEmitter();
    setDomainEventEmitter(eventEmitter);
    hub = new ListingStreamHub({ eventEmitter, defaultHeartbeatIntervalMs: 20_000, maxStreamsPerUser: 3 });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    hub.destroy();
    resetDomainEventEmitter();
  });

  it("sets SSE headers and emits the initial snapshot on client registration", () => {
    const { res, written, headers } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockBuyer, req, res });

    expect(headers["content-type"]).toBe("text/event-stream");
    expect(headers["cache-control"]).toBe("no-cache, no-transform");
    expect(headers["connection"]).toBe("keep-alive");
    expect(headers["x-accel-buffering"]).toBe("no");

    expect(written.length).toBe(1);
    const chunk = written[0]!;
    expect(chunk).toContain("event: snapshot\n");

    const dataLine = chunk.split("\n")[1]!;
    const snapshot = JSON.parse(dataLine.replace(/^data: /, ""));

    expect(snapshot.listingId).toBe(mockListing.id);
    expect(snapshot.currentPrice).toBe(4500); // defaults to floorPricePerKg when no bids
    expect(snapshot.currentBidPerKg).toBeNull();
    expect(snapshot.bidCount).toBe(0);
    expect(snapshot.status).toBe(ListingStatus.ACTIVE);
    expect(snapshot.endTime).toBe(mockListing.endsAt);
    expect(snapshot.serverTime).toBeDefined();
  });

  it("emits heartbeat comment every 20 seconds", () => {
    const { res, written } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockBuyer, req, res, heartbeatIntervalMs: 20_000 });
    expect(written.length).toBe(1); // snapshot only

    vi.advanceTimersByTime(20_000);
    expect(written.length).toBe(2);
    expect(written[1]).toBe(": heartbeat\n\n");

    vi.advanceTimersByTime(20_000);
    expect(written.length).toBe(3);
    expect(written[2]).toBe(": heartbeat\n\n");
  });

  it("cleans up subscriber and user stream counts on client disconnect", () => {
    const { res } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockBuyer, req, res });
    expect(hub.getSubscriberCount(mockListing.id)).toBe(1);
    expect(hub.getUserStreamCount(mockBuyer.id)).toBe(1);

    // Simulate client closing connection
    (req as unknown as EventEmitter).emit("close");

    expect(hub.getSubscriberCount(mockListing.id)).toBe(0);
    expect(hub.getUserStreamCount(mockBuyer.id)).toBe(0);
  });

  it("enforces per-user stream cap with 429 RATE_LIMITED", () => {
    for (let i = 0; i < 3; i++) {
      const { res } = createMockResponse();
      const req = createMockRequest();
      hub.registerClient({ listing: mockListing, user: mockBuyer, req, res });
    }

    expect(hub.getUserStreamCount(mockBuyer.id)).toBe(3);

    const fourth = createMockResponse();
    const fourthReq = createMockRequest();

    expect(() =>
      hub.registerClient({ listing: mockListing, user: mockBuyer, req: fourthReq, res: fourth.res }),
    ).toThrowError(/Maximum concurrent streams limit/);
  });

  it("broadcasts bid.placed without leaking buyerId", () => {
    const { res, written } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockFarmer, req, res });
    expect(written.length).toBe(1); // snapshot

    eventEmitter.emit(DomainEventName.BID_PLACED, {
      listingId: mockListing.id,
      bidId: "707f1f77bcf86cd799439031",
      buyerId: mockBuyer.id,
      bidderLabel: "Buyer #1",
      amountPerKg: 4600,
      totalAmount: 230000,
      bidCount: 1,
      currentBidPerKg: 4600,
      placedAt: "2026-11-14T10:30:00.000Z",
    });

    expect(written.length).toBe(2);
    const chunk = written[1]!;
    expect(chunk).toContain("event: bid.placed\n");

    const dataLine = chunk.split("\n")[1]!;
    const patch = JSON.parse(dataLine.replace(/^data: /, ""));

    expect(patch.listingId).toBe(mockListing.id);
    expect(patch.bidderLabel).toBe("Buyer #1");
    expect(patch.currentPrice).toBe(4600);
    expect(patch.bidCount).toBe(1);
    expect(patch.buyerId).toBeUndefined(); // MUST NOT leak buyerId!
  });

  it("broadcasts auction.extended", () => {
    const { res, written } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockBuyer, req, res });

    eventEmitter.emit(DomainEventName.AUCTION_EXTENDED, {
      listingId: mockListing.id,
      endsAt: "2026-11-14T12:02:00.000Z",
      extensionCount: 1,
      extendedAt: "2026-11-14T11:59:00.000Z",
    });

    expect(written.length).toBe(2);
    const chunk = written[1]!;
    expect(chunk).toContain("event: auction.extended\n");

    const dataLine = chunk.split("\n")[1]!;
    const patch = JSON.parse(dataLine.replace(/^data: /, ""));

    expect(patch.listingId).toBe(mockListing.id);
    expect(patch.endsAt).toBe("2026-11-14T12:02:00.000Z");
    expect(patch.endTime).toBe("2026-11-14T12:02:00.000Z");
    expect(patch.extensionCount).toBe(1);
  });

  it("broadcasts auction.closed without leaking winningBidderId", () => {
    const { res, written } = createMockResponse();
    const req = createMockRequest();

    hub.registerClient({ listing: mockListing, user: mockFarmer, req, res });

    eventEmitter.emit(DomainEventName.AUCTION_CLOSED, {
      listingId: mockListing.id,
      status: ListingStatus.SOLD,
      closedAt: "2026-11-14T12:00:00.000Z",
      winningBidId: "707f1f77bcf86cd799439031",
      winningBidderId: mockBuyer.id,
      winningAmountPerKg: 5000,
      totalAmount: 250000,
    });

    expect(written.length).toBe(2);
    const chunk = written[1]!;
    expect(chunk).toContain("event: auction.closed\n");

    const dataLine = chunk.split("\n")[1]!;
    const patch = JSON.parse(dataLine.replace(/^data: /, ""));

    expect(patch.listingId).toBe(mockListing.id);
    expect(patch.status).toBe(ListingStatus.SOLD);
    expect(patch.winningAmountPerKg).toBe(5000);
    expect(patch.totalAmount).toBe(250000);
    expect(patch.winningBidderId).toBeUndefined(); // MUST NOT leak winningBidderId!
  });
});

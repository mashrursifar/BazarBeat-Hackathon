import http from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuctionCloseTrigger,
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { Bid } from "../bids/bid.model.js";
import { placeBid } from "../bids/bid.service.js";
import { closeAuction } from "../auctions/closing.service.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import {
  getListingStreamHub,
  resetListingStreamHub,
} from "./sse-hub.js";

const farmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const buyerTwoId = new Types.ObjectId().toString();

const farmerUser: PublicUser = {
  id: farmerId,
  role: UserRole.FARMER,
  name: "Farmer Roy",
  division: "Rajshahi",
  district: "Bogra",
  language: "en",
};

const buyerUser: PublicUser = {
  id: buyerId,
  role: UserRole.BUYER,
  name: "Buyer Kabir",
  division: "Dhaka",
  district: "Dhaka",
  organization: "Kabir Foods",
  language: "en",
};

const buyerTwoUser: PublicUser = {
  id: buyerTwoId,
  role: UserRole.BUYER,
  name: "Buyer Salam",
  division: "Chittagong",
  district: "Chittagong",
  organization: "Salam Trading",
  language: "en",
};

const sessionUsers: Record<string, PublicUser> = {
  farmer: farmerUser,
  buyer: buyerUser,
  buyerTwo: buyerTwoUser,
};

interface ParsedSseEvent {
  event?: string;
  data?: unknown;
  comment?: string;
  raw: string;
}

interface StreamConnection {
  req: http.ClientRequest;
  events: ParsedSseEvent[];
  waitForEvent: (eventName: string, timeoutMs?: number) => Promise<ParsedSseEvent>;
  waitForComment: (pattern: string | RegExp, timeoutMs?: number) => Promise<ParsedSseEvent>;
  close: () => Promise<void>;
}

describe("Listing Stream Integration Tests (Task 4.7)", () => {
  let mongoReplSet: MongoMemoryReplSet | undefined;
  let testClock: TestClock;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(mongoReplSet.getUri());

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    authenticateAccessTokenMock.mockImplementation(async (token: string) => {
      const user = sessionUsers[token];
      if (user === undefined) throw new Error("Unexpected test access token");
      return user;
    });
  }, 180_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    if (mongoReplSet !== undefined) await mongoReplSet.stop();
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date("2026-11-14T10:00:00.000Z"));
    setClock(testClock);

    const emitter = new DomainEventEmitter();
    setDomainEventEmitter(emitter);
    resetListingStreamHub({ eventEmitter: emitter, defaultHeartbeatIntervalMs: 80 });

    await Promise.all([
      Listing.deleteMany({}),
      Bid.deleteMany({}),
      User.deleteMany({}),
      InventoryItem.deleteMany({}),
    ]);

    await Promise.all([
      User.create({
        _id: farmerId,
        phone: "+8801712345678",
        role: UserRole.FARMER,
        name: "Farmer Roy",
        division: "Rajshahi",
        district: "Bogra",
        passwordHash: "cost12hash",
        language: "en",
      }),
      User.create({
        _id: buyerId,
        phone: "+8801712345679",
        role: UserRole.BUYER,
        name: "Buyer Kabir",
        division: "Dhaka",
        district: "Dhaka",
        passwordHash: "cost12hash",
        organization: "Kabir Foods",
        language: "en",
      }),
      User.create({
        _id: buyerTwoId,
        phone: "+8801712345680",
        role: UserRole.BUYER,
        name: "Buyer Salam",
        division: "Chittagong",
        district: "Chittagong",
        passwordHash: "cost12hash",
        organization: "Salam Trading",
        language: "en",
      }),
    ]);
  });

  afterEach(() => {
    resetListingStreamHub();
    resetClock();
    resetDomainEventEmitter();
  });

  async function createActiveListing(
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<typeof Listing>> {
    const now = testClock.now();
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    const cropId = new Types.ObjectId();

    await InventoryItem.create({
      farmerId,
      cropId,
      availableKg: 0,
      listedKg: 100,
      soldKg: 0,
    });

    return Listing.create({
      farmerId,
      cropId,
      quantityKg: 100,
      images: [{ url: "/sample.jpg", width: 800, height: 600 }],
      location: {
        division: "Rajshahi",
        district: "Bogra",
      },
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.95, B: 0.05, C: 0 },
        qualityNotes: ["Top quality"],
        cropMatch: true,
        modelVersion: "mock-1.0",
        provider: "mock",
        degraded: false,
        assessedAt: now,
        imageHashes: ["hash-1"],
      },
      aiPriceGuidance: {
        lowPerKg: 4000,
        expectedPerKg: 5000,
        highPerKg: 6000,
        trend: "UP",
        confidence: 0.9,
        explanation: ["High demand"],
        modelVersion: "mock-price-1.0",
        provider: "mock",
        degraded: false,
        generatedAt: now,
        suggestedFloorPerKg: 4500,
      },
      floorPricePerKg: 4500,
      minIncrementPerKg: 100,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      currentBidPerKg: undefined,
      bidCount: 0,
      ...overrides,
    });
  }

  function connectToStream(listingId: string, token: string): Promise<StreamConnection> {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}/api/v1/listings/${listingId}/stream`;
      const events: ParsedSseEvent[] = [];
      const listeners: Array<(event: ParsedSseEvent) => void> = [];
      let buffer = "";

      const req = http.get(
        url,
        {
          headers: {
            Cookie: `accessToken=${token}`,
            Accept: "text/event-stream",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Stream connection failed with HTTP ${res.statusCode}`));
            return;
          }

          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            buffer += chunk;
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim()) continue;
              const lines = part.split("\n");
              let currentEvent: string | undefined;
              let currentData: unknown = undefined;
              let currentComment: string | undefined;

              for (const line of lines) {
                if (line.startsWith(":")) {
                  currentComment = line.slice(1).trim();
                } else if (line.startsWith("event:")) {
                  currentEvent = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  const rawData = line.slice(5).trim();
                  try {
                    currentData = JSON.parse(rawData);
                  } catch {
                    currentData = rawData;
                  }
                }
              }

              const parsed: ParsedSseEvent = {
                event: currentEvent,
                data: currentData,
                comment: currentComment,
                raw: part,
              };

              events.push(parsed);
              for (const listener of [...listeners]) {
                listener(parsed);
              }
            }
          });

          const connection: StreamConnection = {
            req,
            events,
            waitForEvent: (eventName: string, timeoutMs = 3000) => {
              const existing = events.find((e) => e.event === eventName);
              if (existing) return Promise.resolve(existing);

              return new Promise<ParsedSseEvent>((resEvent, rejEvent) => {
                const timer = setTimeout(() => {
                  rejEvent(
                    new Error(
                      `Timed out waiting for event "${eventName}". Received: ${JSON.stringify(
                        events.map((e) => e.event ?? e.comment),
                      )}`,
                    ),
                  );
                }, timeoutMs);

                const handler = (e: ParsedSseEvent): void => {
                  if (e.event === eventName) {
                    clearTimeout(timer);
                    const idx = listeners.indexOf(handler);
                    if (idx >= 0) listeners.splice(idx, 1);
                    resEvent(e);
                  }
                };
                listeners.push(handler);
              });
            },
            waitForComment: (pattern: string | RegExp, timeoutMs = 3000) => {
              const matches = (c?: string): boolean =>
                c !== undefined &&
                (typeof pattern === "string" ? c.includes(pattern) : pattern.test(c));

              const existing = events.find((e) => matches(e.comment));
              if (existing) return Promise.resolve(existing);

              return new Promise<ParsedSseEvent>((resComm, rejComm) => {
                const timer = setTimeout(() => {
                  rejComm(new Error(`Timed out waiting for comment matching "${pattern}"`));
                }, timeoutMs);

                const handler = (e: ParsedSseEvent): void => {
                  if (matches(e.comment)) {
                    clearTimeout(timer);
                    const idx = listeners.indexOf(handler);
                    if (idx >= 0) listeners.splice(idx, 1);
                    resComm(e);
                  }
                };
                listeners.push(handler);
              });
            },
            close: (): Promise<void> => {
              return new Promise<void>((resClose) => {
                req.destroy();
                setTimeout(resClose, 50);
              });
            },
          };

          resolve(connection);
        },
      );

      req.on("error", (err) => {
        reject(err);
      });
    });
  }

  it("rejects unauthenticated stream requests with 401 UNAUTHENTICATED", async () => {
    const listing = await createActiveListing();
    const response = await request(app).get(`/api/v1/listings/${listing._id.toString()}/stream`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 for a non-existent listing", async () => {
    const fakeId = new Types.ObjectId().toString();
    const response = await request(app)
      .get(`/api/v1/listings/${fakeId}/stream`)
      .set("Cookie", ["accessToken=buyer"]);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("sends initial snapshot on connection with price, bid count, endsAt, status, and serverTime", async () => {
    const listing = await createActiveListing();
    const stream = await connectToStream(listing._id.toString(), "buyer");

    try {
      const snapshotEvent = await stream.waitForEvent("snapshot");
      expect(snapshotEvent.event).toBe("snapshot");
      expect(snapshotEvent.data).toBeDefined();

      const snapshot = snapshotEvent.data;
      expect(snapshot.listingId).toBe(listing._id.toString());
      expect(snapshot.currentPrice).toBe(4500); // floor price initially
      expect(snapshot.currentBidPerKg).toBeNull();
      expect(snapshot.bidCount).toBe(0);
      expect(snapshot.status).toBe(ListingStatus.ACTIVE);
      expect(snapshot.endTime).toBeDefined();
      expect(snapshot.serverTime).toBeDefined();
    } finally {
      await stream.close();
    }
  });

  it("receives bid.placed state patch when a bid is placed without leaking buyerId", async () => {
    const listing = await createActiveListing();
    const stream = await connectToStream(listing._id.toString(), "farmer");

    try {
      await stream.waitForEvent("snapshot");

      // Place a bid through the bidding service
      const bidResult = await placeBid(
        buyerUser,
        listing._id.toString(),
        { amountPerKg: 4600 },
      );
      expect(bidResult.seq).toBe(1);

      const bidPlacedEvent = await stream.waitForEvent("bid.placed");
      expect(bidPlacedEvent.event).toBe("bid.placed");

      const patch = bidPlacedEvent.data;
      expect(patch.listingId).toBe(listing._id.toString());
      expect(patch.currentPrice).toBe(4600);
      expect(patch.bidCount).toBe(1);
      expect(patch.amountPerKg).toBe(4600);
      expect(patch.bidderLabel).toBe("Buyer #1");
      expect(patch.serverTime).toBeDefined();

      // Privacy verification: buyerId MUST NOT be in the event payload
      expect(patch.buyerId).toBeUndefined();
    } finally {
      await stream.close();
    }
  });

  it("receives auction.extended state patch when anti-sniping window triggers", async () => {
    const listing = await createActiveListing();
    const stream = await connectToStream(listing._id.toString(), "buyer");

    try {
      await stream.waitForEvent("snapshot");

      // Advance clock into anti-sniping window (1 minute before endsAt)
      testClock.advanceTo(new Date(listing.endsAt.getTime() - 60_000));

      await placeBid(
        buyerTwoUser,
        listing._id.toString(),
        { amountPerKg: 4600 },
      );

      const extEvent = await stream.waitForEvent("auction.extended");
      expect(extEvent.event).toBe("auction.extended");

      const patch = extEvent.data;
      expect(patch.listingId).toBe(listing._id.toString());
      expect(patch.extensionCount).toBe(1);
      expect(new Date(patch.endsAt).getTime()).toBeGreaterThan(listing.endsAt.getTime());
      expect(patch.endTime).toBe(patch.endsAt);
    } finally {
      await stream.close();
    }
  });

  it("receives auction.closed state patch when auction closes without leaking winningBidderId", async () => {
    const listing = await createActiveListing();
    const stream = await connectToStream(listing._id.toString(), "farmer");

    try {
      await stream.waitForEvent("snapshot");

      // Place a bid first
      await placeBid(
        buyerUser,
        listing._id.toString(),
        { amountPerKg: 4800 },
      );
      await stream.waitForEvent("bid.placed");

      // Advance clock past endsAt and trigger closeAuction
      testClock.advanceTo(new Date(listing.endsAt.getTime() + 5000));
      const closeResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.SCHEDULER,
        clock: testClock,
      });
      expect(closeResult.status).toBe(ListingStatus.SOLD);

      const closedEvent = await stream.waitForEvent("auction.closed");
      expect(closedEvent.event).toBe("auction.closed");

      const patch = closedEvent.data;
      expect(patch.listingId).toBe(listing._id.toString());
      expect(patch.status).toBe(ListingStatus.SOLD);
      expect(patch.winningAmountPerKg).toBe(4800);
      expect(patch.closedAt).toBeDefined();

      // Privacy verification: winningBidderId MUST NOT be in the event payload
      expect(patch.winningBidderId).toBeUndefined();
    } finally {
      await stream.close();
    }
  });

  it("receives heartbeat comment comments periodically", async () => {
    const listing = await createActiveListing();
    const stream = await connectToStream(listing._id.toString(), "buyer");

    try {
      await stream.waitForEvent("snapshot");

      const commentEvent = await stream.waitForComment("heartbeat");
      expect(commentEvent.comment).toBe("heartbeat");
    } finally {
      await stream.close();
    }
  });

  it("cleans up subscriber and user stream counts on client disconnect with zero leaks", async () => {
    const listing = await createActiveListing();
    const hub = getListingStreamHub();

    expect(hub.getSubscriberCount(listing._id.toString())).toBe(0);
    expect(hub.getUserStreamCount(farmerId)).toBe(0);

    const stream = await connectToStream(listing._id.toString(), "farmer");
    await stream.waitForEvent("snapshot");

    expect(hub.getSubscriberCount(listing._id.toString())).toBe(1);
    expect(hub.getUserStreamCount(farmerId)).toBe(1);

    // Disconnect the stream
    await stream.close();

    // Verify subscriber count drops back to 0
    await vi.waitFor(() => {
      expect(hub.getSubscriberCount(listing._id.toString())).toBe(0);
      expect(hub.getUserStreamCount(farmerId)).toBe(0);
    }, { timeout: 1500 });
  });

  it("enforces per-user open stream cap and rejects extra connections with 429 RATE_LIMITED", async () => {
    const listing = await createActiveListing();
    const streams: StreamConnection[] = [];

    try {
      // Connect 5 streams for buyer (the max cap)
      for (let i = 0; i < 5; i++) {
        const s = await connectToStream(listing._id.toString(), "buyer");
        await s.waitForEvent("snapshot");
        streams.push(s);
      }

      expect(getListingStreamHub().getUserStreamCount(buyerId)).toBe(5);

      // Attempt 6th stream for the same buyer
      const sixthResponse = await request(app)
        .get(`/api/v1/listings/${listing._id.toString()}/stream`)
        .set("Cookie", ["accessToken=buyer"]);

      expect(sixthResponse.status).toBe(429);
      expect(sixthResponse.body.error.code).toBe("RATE_LIMITED");

      // Another user (e.g. buyerTwo) can still connect fine
      const otherStream = await connectToStream(listing._id.toString(), "buyerTwo");
      await otherStream.waitForEvent("snapshot");
      streams.push(otherStream);
      expect(getListingStreamHub().getUserStreamCount(buyerTwoId)).toBe(1);
    } finally {
      for (const s of streams) {
        await s.close();
      }
    }
  });
});

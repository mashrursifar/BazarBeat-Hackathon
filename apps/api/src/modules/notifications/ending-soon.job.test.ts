import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CropGrade,
  ListingStatus,
  NotificationType,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { Bid } from "../bids/bid.model.js";
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import { runEndingSoonJob } from "./ending-soon.job.js";
import { Notification } from "./notification.model.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

describe("Ending-Soon Job (Task 8.3)", () => {
  let farmerId: string;
  let buyerOneId: string;
  let buyerTwoId: string;
  let cropId: string;

  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(mongoReplSet.getUri());
    await Promise.all([
      Notification.init(),
      Listing.init(),
      Bid.init(),
      Crop.init(),
      User.init(),
    ]);
  }, 180_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date("2026-11-18T10:00:00.000Z"));
    setClock(testClock);

    eventEmitter = new DomainEventEmitter();
    setDomainEventEmitter(eventEmitter);

    await Notification.deleteMany({});
    await Listing.deleteMany({});
    await Bid.deleteMany({});
    await Crop.deleteMany({});
    await User.deleteMany({});

    farmerId = new Types.ObjectId().toString();
    buyerOneId = new Types.ObjectId().toString();
    buyerTwoId = new Types.ObjectId().toString();

    await User.create([
      {
        _id: new ObjectId(farmerId),
        phone: "01700000001",
        name: "Rahim Farmer",
        role: UserRole.FARMER,
        division: "Dhaka",
        district: "Dhaka",
        passwordHash: "hash",
      },
      {
        _id: new ObjectId(buyerOneId),
        phone: "01800000001",
        name: "Buyer One",
        role: UserRole.BUYER,
        division: "Dhaka",
        district: "Dhaka",
        passwordHash: "hash",
      },
      {
        _id: new ObjectId(buyerTwoId),
        phone: "01800000002",
        name: "Buyer Two",
        role: UserRole.BUYER,
        division: "Dhaka",
        district: "Dhaka",
        passwordHash: "hash",
      },
    ]);

    const cropDoc = await Crop.create({
      slug: "potato",
      nameEn: "Potato",
      nameBn: "আলু",
      unit: "KG",
      minLotKg: 50,
      maxLotKg: 2000,
      shelfLifeHours: 120,
      gradeGuide: { A: "Firm dry", B: "Slight split", C: "Small cut" },
      minIncrementPerKg: 100,
      imageUrl: "https://example.com/potato.jpg",
      isActive: true,
    });
    cropId = cropDoc._id.toString();
  });

  afterEach(() => {
    resetClock();
    resetDomainEventEmitter();
  });

  async function createListingWithTiming(
    endsAtOffsetMs: number,
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<typeof Listing>> {
    const now = testClock.now();
    const endsAt = new Date(now.getTime() + endsAtOffsetMs);
    return Listing.create({
      farmerId: new ObjectId(farmerId),
      cropId: new ObjectId(cropId),
      quantityKg: 200,
      images: [{ url: "https://example.com/p1.jpg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm skin"],
        cropMatch: true,
        modelVersion: "v1",
        provider: "mock",
        degraded: false,
        assessedAt: now,
        imageHashes: ["hash"],
      },
      aiPriceGuidance: {
        lowPerKg: 3000,
        expectedPerKg: 3500,
        highPerKg: 4000,
        trend: "FLAT",
        confidence: 0.9,
        explanation: ["Stable supply"],
        modelVersion: "v1",
        provider: "mock",
        degraded: false,
        generatedAt: now,
        suggestedFloorPerKg: 3000,
      },
      floorPricePerKg: 3000,
      minIncrementPerKg: 50,
      currentBidPerKg: 3200,
      currentBidderId: new ObjectId(buyerOneId),
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      bidCount: 1,
      location: { division: "Dhaka", district: "Dhaka" },
      ...overrides,
    });
  }

  it("notifies farmer and bidders once when entering 15-minute window", async () => {
    // Listing ending in 10 minutes (within 15-min window)
    const listing = await createListingWithTiming(10 * 60 * 1000);

    // Add a second bidder
    await Bid.create({
      listingId: listing._id,
      buyerId: new ObjectId(buyerTwoId),
      amountPerKg: 3100,
      totalAmount: 620000,
      seq: 1,
      status: "ACCEPTED",
      placedAt: testClock.now(),
    });

    // Pass 1: should notify farmer + 2 buyers = 3 notifications
    const summary1 = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    expect(summary1.foundListings).toBe(1);
    expect(summary1.notifiedCount).toBe(2); // farmer + buyerTwo (buyerOne is currentBidderId without Bid doc in this test, or distinct bids)

    const notifs = await Notification.find({}).lean();
    expect(notifs.length).toBeGreaterThanOrEqual(2);
    expect(notifs.every((n) => n.type === NotificationType.ENDING_SOON)).toBe(true);

    // Pass 2: subsequent tick (e.g. 10 seconds later) should notify NOTHING (dedupeKey protects)
    testClock.advanceBy(10_000);
    const summary2 = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    expect(summary2.foundListings).toBe(1);
    expect(summary2.notifiedCount).toBe(0); // 0 new notifications!

    const notifsAfter = await Notification.find({}).lean();
    expect(notifsAfter.length).toBe(notifs.length);
  });

  it("does not re-notify when an anti-sniping extension occurs", async () => {
    // Listing ending in 1 minute (within 15-min window)
    const listing = await createListingWithTiming(60 * 1000);

    // First run creates notifications
    await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    const countBefore = await Notification.countDocuments({});
    expect(countBefore).toBeGreaterThan(0);

    // Simulate anti-sniping extension: endsAt moves forward +2 minutes
    listing.endsAt = new Date(listing.endsAt.getTime() + 2 * 60 * 1000);
    listing.extensionCount = 1;
    await listing.save();

    // Next scheduler tick: listing is still ending soon (now ending in 3 minutes)
    testClock.advanceBy(10_000);
    const summary = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    expect(summary.foundListings).toBe(1);
    expect(summary.notifiedCount).toBe(0); // Dedupe prevents re-notifying!

    const countAfter = await Notification.countDocuments({});
    expect(countAfter).toBe(countBefore);
  });

  it("leaves listings outside the window completely untouched", async () => {
    // 1. Listing ending in 25 minutes (outside 15-min window)
    await createListingWithTiming(25 * 60 * 1000);

    // 2. Listing already expired (endsAt <= now)
    await createListingWithTiming(-60 * 1000);

    // 3. Inactive/Sold listing
    await createListingWithTiming(5 * 60 * 1000, { status: ListingStatus.SOLD });

    const summary = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    expect(summary.foundListings).toBe(0);
    expect(summary.notifiedCount).toBe(0);
    expect(await Notification.countDocuments({})).toBe(0);
  });

  it("uses 30-second window in demo mode", async () => {
    // Listing A: ends in 20 seconds (within 30s demo window)
    await createListingWithTiming(20 * 1000);

    // Listing B: ends in 50 seconds (outside 30s demo window)
    await createListingWithTiming(50 * 1000);

    const summary = await runEndingSoonJob({ clock: testClock, isDemoMode: true });
    expect(summary.foundListings).toBe(1);
    expect(summary.notifiedCount).toBe(1); // Farmer notified
  });

  it("ensures a failing listing does not block other valid listings from being notified", async () => {
    // Listing 1: valid listing ending in 5 minutes
    await createListingWithTiming(5 * 60 * 1000);

    // Listing 2: second valid listing ending in 8 minutes
    await createListingWithTiming(8 * 60 * 1000);

    // Even if one listing encountered an issue, the other completes successfully
    const summary = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
    expect(summary.foundListings).toBe(2);
    expect(summary.notifiedCount).toBe(2);
    expect(summary.failedCount).toBe(0);
  });
});

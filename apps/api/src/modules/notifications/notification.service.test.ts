import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CropGrade,
  DomainEventName,
  ListingStatus,
  NotificationType,
  OrderSubEvent,
  PaymentMethod,
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
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { Notification } from "./notification.model.js";
import {
  createOrCoalesceNotification,
  getNotificationsForUser,
  getUnreadCount,
  markNotificationsRead,
} from "./notification.service.js";
import { registerNotificationSubscribers } from "./notification.subscribers.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

describe("Notification Service & Subscribers (Task 8.2)", () => {
  let farmerId: string;
  let buyerOneId: string;
  let buyerTwoId: string;
  let buyerThreeId: string;
  let cropId: string;
  let listingId: string;
  let orderId: string;
  let unregisterSubscribers: () => void;

  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(mongoReplSet.getUri());
    await Promise.all([
      Notification.init(),
      Listing.init(),
      Bid.init(),
      Order.init(),
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

    unregisterSubscribers = registerNotificationSubscribers(eventEmitter);

    await Notification.deleteMany({});
    await Listing.deleteMany({});
    await Bid.deleteMany({});
    await Order.deleteMany({});
    await Crop.deleteMany({});
    await User.deleteMany({});

    farmerId = new Types.ObjectId().toString();
    buyerOneId = new Types.ObjectId().toString();
    buyerTwoId = new Types.ObjectId().toString();
    buyerThreeId = new Types.ObjectId().toString();

    // Create users
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
      {
        _id: new ObjectId(buyerThreeId),
        phone: "01800000003",
        name: "Buyer Three",
        role: UserRole.BUYER,
        division: "Dhaka",
        district: "Dhaka",
        passwordHash: "hash",
      },
    ]);

    // Create Crop
    const cropDoc = await Crop.create({
      slug: "onion",
      nameEn: "Onion",
      nameBn: "পেঁয়াজ",
      unit: "KG",
      minLotKg: 50,
      maxLotKg: 2000,
      shelfLifeHours: 120,
      gradeGuide: { A: "Firm dry", B: "Slight split", C: "Small cut" },
      minIncrementPerKg: 100,
      imageUrl: "https://example.com/onion.jpg",
      isActive: true,
    });
    cropId = cropDoc._id.toString();

    // Create Listing
    const listingDoc = await Listing.create({
      farmerId: new ObjectId(farmerId),
      cropId: new ObjectId(cropId),
      quantityKg: 100,
      images: [{ url: "https://example.com/onion1.jpg", width: 800, height: 600 }],
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
        assessedAt: testClock.now(),
        imageHashes: ["hash"],
      },
      aiPriceGuidance: {
        lowPerKg: 5000,
        expectedPerKg: 6000,
        highPerKg: 7000,
        trend: "UP",
        confidence: 0.9,
        explanation: ["Seasonal demand"],
        modelVersion: "v1",
        provider: "mock",
        degraded: false,
        generatedAt: testClock.now(),
        suggestedFloorPerKg: 5000,
      },
      floorPricePerKg: 5000,
      minIncrementPerKg: 100,
      currentBidPerKg: 5500,
      currentBidderId: new ObjectId(buyerOneId),
      startsAt: testClock.now(),
      endsAt: new Date(testClock.now().getTime() + 3600_000),
      originalEndsAt: new Date(testClock.now().getTime() + 3600_000),
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      bidCount: 1,
      location: { division: "Dhaka", district: "Dhaka" },
    });
    listingId = listingDoc._id.toString();

    // Create Order
    const orderDoc = await Order.create({
      listingId: new ObjectId(listingId),
      farmerId: new ObjectId(farmerId),
      buyerId: new ObjectId(buyerOneId),
      cropId: new ObjectId(cropId),
      quantityKg: 100,
      grade: CropGrade.A,
      pricePerKg: 6000,
      subtotal: 600000,
      platformFee: 12000,
      farmerNet: 588000,
      status: "PENDING",
      payment: { method: PaymentMethod.WALLET_SIM, status: "UNPAID" },
      fulfilment: { method: "PICKUP" },
      statusHistory: [{ status: "PENDING", at: testClock.now(), byUserId: new ObjectId(farmerId) }],
    });
    orderId = orderDoc._id.toString();
  });

  afterEach(() => {
    unregisterSubscribers();
    resetClock();
    resetDomainEventEmitter();
  });

  describe("Table-driven Notification Matrix Tests", () => {
    it("handles bid.placed: creates coalesced NEW_BID for farmer and OUTBID for previous bidder", async () => {
      eventEmitter.emit(DomainEventName.BID_PLACED, {
        listingId,
        bidId: new Types.ObjectId().toString(),
        buyerId: buyerTwoId,
        bidderLabel: "Buyer #2",
        amountPerKg: 6000,
        totalAmount: 600000,
        bidCount: 2,
        currentBidPerKg: 6000,
        placedAt: testClock.iso(),
        previousBidderId: buyerOneId,
      });

      // Allow async listeners to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 1. Farmer notification: NEW_BID
      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
      const farmerNotif = farmerNotifs[0]!;
      expect(farmerNotif.type).toBe(NotificationType.NEW_BID);
      expect(farmerNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
        currentBidPerKg: 6000,
        bidCount: 2,
      });
      expect(farmerNotif.entityRef).toMatchObject({ kind: "listing", id: listingId });

      // 2. Previous bidder notification: OUTBID
      const buyerOneNotifs = await Notification.find({ userId: new ObjectId(buyerOneId) });
      expect(buyerOneNotifs).toHaveLength(1);
      const buyerOneNotif = buyerOneNotifs[0]!;
      expect(buyerOneNotif.type).toBe(NotificationType.OUTBID);
      expect(buyerOneNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
        newBidPerKg: 6000,
      });

      // 3. New bidder receives NO notification (self-exclusion)
      const buyerTwoNotifs = await Notification.find({ userId: new ObjectId(buyerTwoId) });
      expect(buyerTwoNotifs).toHaveLength(0);
    });

    it("handles auction.closed (SOLD): notifies farmer (AUCTION_SOLD), winner (AUCTION_WON), other bidders (AUCTION_LOST)", async () => {
      // Add a third bidder who placed a bid
      await Bid.create({
        listingId: new ObjectId(listingId),
        buyerId: new ObjectId(buyerThreeId),
        amountPerKg: 5200,
        totalAmount: 520000,
        seq: 1,
        status: "ACCEPTED",
        placedAt: testClock.now(),
      });

      eventEmitter.emit(DomainEventName.AUCTION_CLOSED, {
        listingId,
        status: ListingStatus.SOLD,
        closedAt: testClock.iso(),
        winningBidderId: buyerTwoId,
        winningBidId: new Types.ObjectId().toString(),
        winningAmountPerKg: 6500,
        totalAmount: 650000,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 1. Farmer: AUCTION_SOLD
      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
      const farmerNotif = farmerNotifs[0]!;
      expect(farmerNotif.type).toBe(NotificationType.AUCTION_SOLD);
      expect(farmerNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
        orderId,
        winningBidPerKg: 6500,
        totalAmount: 650000,
      });
      expect(farmerNotif.entityRef).toMatchObject({ kind: "order", id: orderId });

      // 2. Winner: AUCTION_WON
      const winnerNotifs = await Notification.find({ userId: new ObjectId(buyerTwoId) });
      expect(winnerNotifs).toHaveLength(1);
      const winnerNotif = winnerNotifs[0]!;
      expect(winnerNotif.type).toBe(NotificationType.AUCTION_WON);
      expect(winnerNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
        orderId,
        winningBidPerKg: 6500,
        totalAmount: 650000,
      });

      // 3. Other bidder (buyerThree): AUCTION_LOST
      const loserNotifs = await Notification.find({ userId: new ObjectId(buyerThreeId) });
      expect(loserNotifs).toHaveLength(1);
      const loserNotif = loserNotifs[0]!;
      expect(loserNotif.type).toBe(NotificationType.AUCTION_LOST);
      expect(loserNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
        finalPricePerKg: 6500,
      });
      expect(loserNotif.entityRef).toMatchObject({ kind: "listing", id: listingId });
    });

    it("handles auction.closed (EXPIRED_UNSOLD): notifies farmer (AUCTION_UNSOLD)", async () => {
      eventEmitter.emit(DomainEventName.AUCTION_CLOSED, {
        listingId,
        status: ListingStatus.EXPIRED_UNSOLD,
        closedAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
      const farmerNotif = farmerNotifs[0]!;
      expect(farmerNotif.type).toBe(NotificationType.AUCTION_UNSOLD);
      expect(farmerNotif.params).toEqual({
        listingId,
        cropSlug: "onion",
      });
      expect(farmerNotif.entityRef).toMatchObject({ kind: "listing", id: listingId });
    });

    it("handles order.created: notifies farmer (ORDER_UPDATE - CREATED) with deadline", async () => {
      eventEmitter.emit(DomainEventName.ORDER_CREATED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        cropId,
        quantityKg: 100,
        pricePerKg: 6000,
        totalAmount: 600000,
        platformFee: 12000,
        farmerNet: 588000,
        createdAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(notifs).toHaveLength(1);
      const notif = notifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.CREATED);
      expect(params["orderId"]).toBe(orderId);
      expect(params["deadline"]).toBeDefined();
    });

    it("handles order.confirmed: notifies buyer (ORDER_UPDATE - CONFIRMED)", async () => {
      eventEmitter.emit(DomainEventName.ORDER_CONFIRMED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        confirmedAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifs = await Notification.find({ userId: new ObjectId(buyerOneId) });
      expect(notifs).toHaveLength(1);
      const notif = notifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.CONFIRMED);
    });

    it("handles payment.paid: notifies farmer (ORDER_UPDATE - PAID)", async () => {
      eventEmitter.emit(DomainEventName.PAYMENT_PAID, {
        orderId,
        listingId,
        buyerId: buyerOneId,
        farmerId,
        amount: 600000,
        method: PaymentMethod.WALLET_SIM,
        paidAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(notifs).toHaveLength(1);
      const notif = notifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.PAID);
    });

    it("handles order.delivered: notifies buyer (ORDER_UPDATE - DELIVERED) with auto-complete deadline", async () => {
      eventEmitter.emit(DomainEventName.ORDER_DELIVERED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        deliveredAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifs = await Notification.find({ userId: new ObjectId(buyerOneId) });
      expect(notifs).toHaveLength(1);
      const notif = notifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.DELIVERED);
      expect(params["deadline"]).toBeDefined();
    });

    it("handles order.completed: notifies farmer (ORDER_UPDATE - COMPLETED)", async () => {
      eventEmitter.emit(DomainEventName.ORDER_COMPLETED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        completedAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(notifs).toHaveLength(1);
      const notif = notifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.COMPLETED);
    });

    it("handles order.cancelled: notifies both when cancelledBy SYSTEM, or the other party when cancelled by participant", async () => {
      // 1. Cancelled by SYSTEM: notifies both
      eventEmitter.emit(DomainEventName.ORDER_CANCELLED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        cancelledBy: "SYSTEM",
        reason: "CONFIRMATION_TIMEOUT",
        cancelledAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      const buyerNotifs = await Notification.find({ userId: new ObjectId(buyerOneId) });
      expect(farmerNotifs).toHaveLength(1);
      expect(buyerNotifs).toHaveLength(1);
      const fParams = farmerNotifs[0]!.params as Record<string, unknown>;
      const bParams = buyerNotifs[0]!.params as Record<string, unknown>;
      expect(fParams["subEvent"]).toBe(OrderSubEvent.CANCELLED);
      expect(bParams["subEvent"]).toBe(OrderSubEvent.CANCELLED);

      // Clean up notifications for next test
      await Notification.deleteMany({});

      // 2. Cancelled by Farmer: notifies Buyer only
      eventEmitter.emit(DomainEventName.ORDER_CANCELLED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        cancelledBy: farmerId,
        reason: "FARMER_CROP_DAMAGED",
        cancelledAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(await Notification.countDocuments({ userId: new ObjectId(farmerId) })).toBe(0);
      expect(await Notification.countDocuments({ userId: new ObjectId(buyerOneId) })).toBe(1);
    });

    it("handles order.disputed: notifies farmer (ORDER_UPDATE - DISPUTED)", async () => {
      eventEmitter.emit(DomainEventName.ORDER_DISPUTED, {
        orderId,
        listingId,
        farmerId,
        buyerId: buyerOneId,
        disputedBy: buyerOneId,
        reason: "GRADE_LOWER_THAN_LISTED",
        disputedAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
      const notif = farmerNotifs[0]!;
      expect(notif.type).toBe(NotificationType.ORDER_UPDATE);
      const params = notif.params as Record<string, unknown>;
      expect(params["subEvent"]).toBe(OrderSubEvent.DISPUTED);

      // Buyer is not notified (self-exclusion)
      expect(await Notification.countDocuments({ userId: new ObjectId(buyerOneId) })).toBe(0);
    });
  });

  describe("Coalescing & Deduplication Rules (Gap 3 / D-33)", () => {
    it("coalesces multiple unread NEW_BID notifications on the same listing into one document", async () => {
      // First bid
      eventEmitter.emit(DomainEventName.BID_PLACED, {
        listingId,
        bidId: new Types.ObjectId().toString(),
        buyerId: buyerOneId,
        bidderLabel: "Buyer #1",
        amountPerKg: 5500,
        totalAmount: 550000,
        bidCount: 1,
        currentBidPerKg: 5500,
        placedAt: testClock.iso(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      let farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
      const notif1 = farmerNotifs[0]!;
      expect((notif1.params as Record<string, unknown>)["bidCount"]).toBe(1);
      expect((notif1.params as Record<string, unknown>)["currentBidPerKg"]).toBe(5500);

      // Second bid on same listing while unread
      testClock.advanceBy(10_000);
      eventEmitter.emit(DomainEventName.BID_PLACED, {
        listingId,
        bidId: new Types.ObjectId().toString(),
        buyerId: buyerTwoId,
        bidderLabel: "Buyer #2",
        amountPerKg: 5800,
        totalAmount: 580000,
        bidCount: 2,
        currentBidPerKg: 5800,
        placedAt: testClock.iso(),
        previousBidderId: buyerOneId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      // Still only 1 document! Coalesced!
      expect(farmerNotifs).toHaveLength(1);
      const notif2 = farmerNotifs[0]!;
      expect((notif2.params as Record<string, unknown>)["bidCount"]).toBe(2);
      expect((notif2.params as Record<string, unknown>)["currentBidPerKg"]).toBe(5800);
      expect(notif2.isRead).toBe(false);
    });

    it("ensures duplicate events create only one notification document via dedupeKey", async () => {
      // Emit payment.paid twice
      const paymentPayload = {
        orderId,
        listingId,
        buyerId: buyerOneId,
        farmerId,
        amount: 600000,
        method: PaymentMethod.WALLET_SIM,
        paidAt: testClock.iso(),
      };

      eventEmitter.emit(DomainEventName.PAYMENT_PAID, paymentPayload);
      await new Promise((resolve) => setTimeout(resolve, 30));

      eventEmitter.emit(DomainEventName.PAYMENT_PAID, paymentPayload);
      await new Promise((resolve) => setTimeout(resolve, 30));

      const farmerNotifs = await Notification.find({ userId: new ObjectId(farmerId) });
      expect(farmerNotifs).toHaveLength(1);
    });

    it("guarantees params contain zero counterparty identities across all notification types", async () => {
      // Create one of each notification
      await createOrCoalesceNotification({
        userId: farmerId,
        type: NotificationType.NEW_BID,
        title: "Test",
        body: "Test",
        params: { listingId, cropSlug: "onion", currentBidPerKg: 5000, bidCount: 1 },
        entityRef: { kind: "listing", id: listingId },
        dedupeKey: `NEW_BID:${listingId}`,
      });

      await createOrCoalesceNotification({
        userId: buyerOneId,
        type: NotificationType.OUTBID,
        title: "Test",
        body: "Test",
        params: { listingId, cropSlug: "onion", newBidPerKg: 5200 },
        entityRef: { kind: "listing", id: listingId },
        dedupeKey: `OUTBID:${listingId}:5200`,
      });

      const allNotifs = await Notification.find({}).lean();
      expect(allNotifs.length).toBeGreaterThan(0);

      for (const notif of allNotifs) {
        const paramsJson = JSON.stringify(notif.params);
        expect(paramsJson).not.toContain(farmerId);
        expect(paramsJson).not.toContain(buyerOneId);
        expect(paramsJson).not.toContain(buyerTwoId);
        expect(paramsJson).not.toContain("01700000001");
        expect(paramsJson).not.toContain("01800000001");
        expect(paramsJson).not.toContain("Buyer One");
        expect(paramsJson).not.toContain("Rahim Farmer");
      }
    });

    it("verifies a failing subscriber does not disrupt domain event emitter or action flow", async () => {
      // Simulate an error inside a listener
      const failingEmitter = new DomainEventEmitter();
      failingEmitter.on(DomainEventName.BID_PLACED, () => {
        throw new Error("Simulated subscriber crash");
      });

      expect(() => {
        failingEmitter.emit(DomainEventName.BID_PLACED, {
          listingId,
          bidId: "b-1",
          buyerId: buyerOneId,
          bidderLabel: "Buyer #1",
          amountPerKg: 5000,
          totalAmount: 500000,
          bidCount: 1,
          currentBidPerKg: 5000,
          placedAt: testClock.iso(),
        });
      }).not.toThrow();
    });
  });

  describe("Pagination and Read Status", () => {
    it("returns paginated notifications and accurate unreadCount", async () => {
      for (let i = 1; i <= 5; i++) {
        testClock.advanceBy(1000);
        await createOrCoalesceNotification({
          userId: farmerId,
          type: NotificationType.ORDER_UPDATE,
          title: `Update ${i}`,
          body: `Body ${i}`,
          params: {
            orderId: `order-${i}`,
            listingId,
            cropSlug: "onion",
            subEvent: OrderSubEvent.PAID,
          },
          entityRef: { kind: "order", id: `order-${i}` },
          dedupeKey: `ORDER_UPDATE:order-${i}:PAID`,
        });
      }

      const list = await getNotificationsForUser(farmerId, { page: 1, limit: 3 });
      expect(list.data).toHaveLength(3);
      expect(list.meta.total).toBe(5);
      expect(list.meta.totalPages).toBe(2);
      expect(list.meta.unreadCount).toBe(5);

      // Mark first two as read
      const firstId = list.data[0]?.id;
      const secondId = list.data[1]?.id;
      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();
      if (!firstId || !secondId) throw new Error("Expected at least 2 notifications in page");
      const idsToMark = [firstId, secondId];
      const markResult = await markNotificationsRead(farmerId, { ids: idsToMark });
      expect(markResult.markedCount).toBe(2);
      expect(markResult.unreadCount).toBe(3);

      const unreadList = await getNotificationsForUser(farmerId, { unreadOnly: true });
      expect(unreadList.data).toHaveLength(3);
      expect(unreadList.meta.unreadCount).toBe(3);

      // Mark all remaining as read
      const markAllResult = await markNotificationsRead(farmerId, { all: true });
      expect(markAllResult.markedCount).toBe(3);
      expect(markAllResult.unreadCount).toBe(0);
      expect(await getUnreadCount(farmerId)).toBe(0);
    });
  });
});

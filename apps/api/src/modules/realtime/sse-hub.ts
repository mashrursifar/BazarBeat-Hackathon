import type { Request, Response } from "express";
import {
  AUCTION_TIMING,
  type AuctionClosedEventPayload,
  type AuctionExtendedEventPayload,
  type BidPlacedEventPayload,
  DomainEventName,
  type FarmerListing,
  type ListingStreamAuctionClosedPatch,
  type ListingStreamAuctionExtendedPatch,
  type ListingStreamBidPlacedPatch,
  ListingStreamEventName,
  type ListingStreamSnapshot,
  type PublicUser,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import {
  type DomainEventEmitter,
  getDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

/**
 * Representation of an active Server-Sent Events (SSE) connection.
 */
export interface ListingStreamClient {
  id: string;
  userId: string;
  listingId: string;
  res: Response;
  heartbeatTimer: NodeJS.Timeout;
}

export interface RegisterListingStreamOptions {
  listing: FarmerListing;
  user: PublicUser;
  req: Request<Record<string, string>, unknown, unknown, Record<string, unknown>>;
  res: Response;
  heartbeatIntervalMs?: number;
}

export interface ListingStreamHubOptions {
  eventEmitter?: DomainEventEmitter;
  defaultHeartbeatIntervalMs?: number;
  maxStreamsPerUser?: number;
}

/**
 * In-Memory Server-Sent Events (SSE) Hub for real-time listing updates.
 *
 * ARCHITECTURE §5:
 * Real-time listing updates broadcast bid.placed, auction.extended, and auction.closed
 * as lightweight state patches to connected subscribers.
 *
 * KNOWN LIMITATION (Single-Instance):
 * This SSE hub maintains client subscriptions, user stream counts, and heartbeat timers
 * in application process memory subscribed to the in-process DomainEventEmitter. It is designed
 * for single-instance deployment (hackathon MVP per ARCHITECTURE §11 and DECISIONS D-16).
 * In a multi-instance production setup, an external pub/sub message broker (e.g. Redis Pub/Sub,
 * NATS, or RabbitMQ) would be required to distribute domain events across multiple API nodes.
 */
export class ListingStreamHub {
  private readonly listingSubscribers = new Map<string, Set<ListingStreamClient>>();
  private readonly userStreams = new Map<string, Set<ListingStreamClient>>();
  private readonly defaultHeartbeatIntervalMs: number;
  private readonly maxStreamsPerUser: number;
  private unbindListeners?: () => void;
  private clientSequence = 0;

  public constructor(options?: ListingStreamHubOptions) {
    this.defaultHeartbeatIntervalMs =
      options?.defaultHeartbeatIntervalMs ?? AUCTION_TIMING.SSE_HEARTBEAT_INTERVAL_MS;
    this.maxStreamsPerUser =
      options?.maxStreamsPerUser ?? AUCTION_TIMING.MAX_CONCURRENT_STREAMS_PER_USER;

    this.bindEventEmitter(options?.eventEmitter ?? getDomainEventEmitter());
  }

  /**
   * Binds event listeners to the provided DomainEventEmitter.
   */
  public bindEventEmitter(emitter: DomainEventEmitter): void {
    if (this.unbindListeners) {
      this.unbindListeners();
    }

    const unsubBid = emitter.on(DomainEventName.BID_PLACED, (payload) => {
      this.handleBidPlaced(payload);
    });

    const unsubExt = emitter.on(DomainEventName.AUCTION_EXTENDED, (payload) => {
      this.handleAuctionExtended(payload);
    });

    const unsubClosed = emitter.on(DomainEventName.AUCTION_CLOSED, (payload) => {
      this.handleAuctionClosed(payload);
    });

    this.unbindListeners = (): void => {
      unsubBid();
      unsubExt();
      unsubClosed();
    };
  }

  /**
   * Registers a client connection to a listing's SSE stream.
   * Sends the initial snapshot, starts the heartbeat timer, and manages disconnect cleanup.
   */
  public registerClient(options: RegisterListingStreamOptions): void {
    const { listing, user, req, res, heartbeatIntervalMs } = options;

    // 1. Enforce per-user stream cap
    const currentUserStreams = this.getUserStreamCount(user.id);
    if (currentUserStreams >= this.maxStreamsPerUser) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        `Maximum concurrent streams limit (${this.maxStreamsPerUser}) reached for user`,
      );
    }

    // 2. Configure SSE HTTP response headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // 3. Emit initial snapshot event
    const snapshot: ListingStreamSnapshot = {
      listingId: listing.id,
      currentPrice: listing.currentBidPerKg ?? listing.floorPricePerKg,
      currentBidPerKg: listing.currentBidPerKg ?? null,
      floorPricePerKg: listing.floorPricePerKg,
      bidCount: listing.bidCount,
      endTime: listing.endsAt,
      endsAt: listing.endsAt,
      status: listing.status,
      serverTime: getClock().iso(),
    };

    res.write(
      `event: ${ListingStreamEventName.SNAPSHOT}\ndata: ${JSON.stringify(snapshot)}\n\n`,
    );

    // 4. Set up periodic heartbeat comment
    const intervalMs = heartbeatIntervalMs ?? this.defaultHeartbeatIntervalMs;
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (err: unknown) {
        logger.warn({ err, listingId: listing.id, userId: user.id }, "Heartbeat write failed; removing client");
        this.removeClient(client);
      }
    }, intervalMs);

    // Unref timer in Node so it doesn't block process exit if unclosed
    if (typeof heartbeatTimer.unref === "function") {
      heartbeatTimer.unref();
    }

    const clientId = `client-${++this.clientSequence}-${user.id}`;
    const client: ListingStreamClient = {
      id: clientId,
      userId: user.id,
      listingId: listing.id,
      res,
      heartbeatTimer,
    };

    // 5. Add to subscriber indices
    let subscribers = this.listingSubscribers.get(listing.id);
    if (!subscribers) {
      subscribers = new Set();
      this.listingSubscribers.set(listing.id, subscribers);
    }
    subscribers.add(client);

    let userStreamsSet = this.userStreams.get(user.id);
    if (!userStreamsSet) {
      userStreamsSet = new Set();
      this.userStreams.set(user.id, userStreamsSet);
    }
    userStreamsSet.add(client);

    // 6. Register disconnect handlers
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.removeClient(client);
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);
    res.on("error", cleanup);
    req.on("close", cleanup);
    req.on("aborted", cleanup);
  }

  /**
   * Removes a client and cleans up empty subscriber sets.
   */
  public removeClient(client: ListingStreamClient): void {
    clearInterval(client.heartbeatTimer);

    const subscribers = this.listingSubscribers.get(client.listingId);
    if (subscribers) {
      subscribers.delete(client);
      if (subscribers.size === 0) {
        this.listingSubscribers.delete(client.listingId);
      }
    }

    const userSet = this.userStreams.get(client.userId);
    if (userSet) {
      userSet.delete(client);
      if (userSet.size === 0) {
        this.userStreams.delete(client.userId);
      }
    }
  }

  /**
   * Returns total count of active subscribers, optionally scoped to a listing.
   */
  public getSubscriberCount(listingId?: string): number {
    if (listingId) {
      return this.listingSubscribers.get(listingId)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.listingSubscribers.values()) {
      total += set.size;
    }
    return total;
  }

  /**
   * Returns the count of active open streams for a specific user.
   */
  public getUserStreamCount(userId: string): number {
    return this.userStreams.get(userId)?.size ?? 0;
  }

  /**
   * Broadcasts a formatted SSE event to all clients listening to a specific listing.
   */
  private broadcast(listingId: string, eventName: string, data: unknown): void {
    const subscribers = this.listingSubscribers.get(listingId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of subscribers) {
      try {
        client.res.write(payload);
      } catch (err: unknown) {
        logger.warn(
          { err, listingId, clientId: client.id },
          "Failed to write SSE event to client; removing client",
        );
        this.removeClient(client);
      }
    }
  }

  /**
   * Handles bid.placed domain event.
   * Privacy rule: Does NOT forward buyerId to avoid leaking bidder user identities.
   */
  private handleBidPlaced(payload: BidPlacedEventPayload): void {
    const patch: ListingStreamBidPlacedPatch = {
      listingId: payload.listingId,
      bidId: payload.bidId,
      bidderLabel: payload.bidderLabel,
      currentPrice: payload.amountPerKg,
      currentBidPerKg: payload.amountPerKg,
      amountPerKg: payload.amountPerKg,
      totalAmount: payload.totalAmount,
      bidCount: payload.bidCount,
      placedAt: payload.placedAt,
      serverTime: getClock().iso(),
    };

    this.broadcast(payload.listingId, ListingStreamEventName.BID_PLACED, patch);
  }

  /**
   * Handles auction.extended domain event.
   */
  private handleAuctionExtended(payload: AuctionExtendedEventPayload): void {
    const patch: ListingStreamAuctionExtendedPatch = {
      listingId: payload.listingId,
      endsAt: payload.endsAt,
      endTime: payload.endsAt,
      extensionCount: payload.extensionCount,
      extendedAt: payload.extendedAt,
      serverTime: getClock().iso(),
    };

    this.broadcast(payload.listingId, ListingStreamEventName.AUCTION_EXTENDED, patch);
  }

  /**
   * Handles auction.closed domain event.
   * Privacy rule: Does NOT forward winningBidderId to avoid leaking winner identity.
   */
  private handleAuctionClosed(payload: AuctionClosedEventPayload): void {
    const patch: ListingStreamAuctionClosedPatch = {
      listingId: payload.listingId,
      status: payload.status,
      closedAt: payload.closedAt,
      ...(payload.winningBidId ? { winningBidId: payload.winningBidId } : {}),
      ...(payload.winningAmountPerKg ? { winningAmountPerKg: payload.winningAmountPerKg } : {}),
      ...(payload.totalAmount ? { totalAmount: payload.totalAmount } : {}),
      serverTime: getClock().iso(),
    };

    this.broadcast(payload.listingId, ListingStreamEventName.AUCTION_CLOSED, patch);
  }

  /**
   * Cleans up all subscribers, timers, and listeners.
   */
  public destroy(): void {
    if (this.unbindListeners) {
      this.unbindListeners();
      this.unbindListeners = undefined;
    }

    for (const subscribers of this.listingSubscribers.values()) {
      for (const client of subscribers) {
        clearInterval(client.heartbeatTimer);
        try {
          client.res.end();
        } catch {
          // ignore already ended connections
        }
      }
    }

    this.listingSubscribers.clear();
    this.userStreams.clear();
  }
}

let activeHub: ListingStreamHub = new ListingStreamHub();

export function getListingStreamHub(): ListingStreamHub {
  return activeHub;
}

export function setListingStreamHub(hub: ListingStreamHub): void {
  activeHub = hub;
}

export function resetListingStreamHub(options?: ListingStreamHubOptions): void {
  activeHub.destroy();
  activeHub = new ListingStreamHub(options);
}

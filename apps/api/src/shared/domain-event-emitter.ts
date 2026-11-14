import { EventEmitter } from "node:events";
import type { DomainEventName, DomainEventPayloadMap } from "@bazarbeat/shared";

import { logger } from "./logger.js";

export type DomainEventListener<E extends DomainEventName> = (
  payload: DomainEventPayloadMap[E],
) => void | Promise<void>;

/**
 * Typed in-process event emitter for domain events.
 * DESIGN_PATTERNS (backend #4): Services emit events (bid.placed, auction.extended, auction.closed, order.created).
 * Subscribers handle side effects asynchronously; services never invoke notification/realtime code directly.
 */
export class DomainEventEmitter {
  private readonly emitter: EventEmitter;

  public constructor() {
    this.emitter = new EventEmitter();
    // Allow up to 50 listeners without Node warning (for SSE clients, notifications, cache invalidation, etc.)
    this.emitter.setMaxListeners(50);
  }

  /**
   * Publishes a typed domain event to all registered subscribers.
   * Catches and logs listener exceptions so individual failures do not disrupt other subscribers or the publisher.
   */
  public emit<E extends DomainEventName>(name: E, payload: DomainEventPayloadMap[E]): void {
    const listeners = this.emitter.rawListeners(name);
    for (const listener of listeners) {
      try {
        const result = (listener as DomainEventListener<E>)(payload);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            logger.error(
              { err: error, event: name },
              "Domain event listener rejected asynchronously",
            );
          });
        }
      } catch (error: unknown) {
        logger.error(
          { err: error, event: name },
          "Domain event listener threw synchronously",
        );
      }
    }
  }

  /**
   * Subscribes a listener to a domain event. Returns an unsubscribe function.
   */
  public on<E extends DomainEventName>(
    name: E,
    listener: DomainEventListener<E>,
  ): () => void {
    this.emitter.on(name, listener as (...args: unknown[]) => void);
    return () => {
      this.off(name, listener);
    };
  }

  /**
   * Subscribes a one-time listener to a domain event. Returns an unsubscribe function.
   */
  public once<E extends DomainEventName>(
    name: E,
    listener: DomainEventListener<E>,
  ): () => void {
    const wrapper: DomainEventListener<E> = (payload) => {
      this.off(name, wrapper);
      return listener(payload);
    };
    this.emitter.on(name, wrapper as (...args: unknown[]) => void);
    return () => {
      this.off(name, wrapper);
    };
  }

  /**
   * Removes a specific listener subscription.
   */
  public off<E extends DomainEventName>(
    name: E,
    listener: DomainEventListener<E>,
  ): void {
    this.emitter.off(name, listener as (...args: unknown[]) => void);
  }

  /**
   * Returns the count of active listeners registered for the given event.
   */
  public listenerCount(name: DomainEventName): number {
    return this.emitter.listenerCount(name);
  }

  /**
   * Removes all listeners for a given event, or all registered listeners across all events.
   */
  public removeAllListeners(name?: DomainEventName): void {
    if (name) {
      this.emitter.removeAllListeners(name);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

let activeEmitter: DomainEventEmitter = new DomainEventEmitter();

/**
 * Returns the active domain event emitter instance.
 */
export function getDomainEventEmitter(): DomainEventEmitter {
  return activeEmitter;
}

/**
 * Replaces the active domain event emitter instance.
 */
export function setDomainEventEmitter(emitter: DomainEventEmitter): void {
  activeEmitter = emitter;
}

/**
 * Resets the active domain event emitter to a fresh instance.
 */
export function resetDomainEventEmitter(): void {
  activeEmitter.removeAllListeners();
  activeEmitter = new DomainEventEmitter();
}


/**
 * Clock interface and implementations for time-authoritative operations.
 * AUCTION_RULES §1: The server is the only authority on time.
 * TESTING §6: The API's auction code must depend on a Clock interface so tests can advance time.
 */

export interface Clock {
  /**
   * Returns a Date object representing the current instant.
   */
  now(): Date;

  /**
   * Returns an ISO-8601 UTC string representing the current instant.
   */
  iso(): string;

  /**
   * Returns milliseconds since Unix epoch (equivalent to Date.now()).
   */
  timestamp(): number;
}

/**
 * Production clock implementation reading standard system time.
 */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }

  public iso(): string {
    return new Date().toISOString();
  }

  public timestamp(): number {
    return Date.now();
  }
}

/**
 * Controllable clock implementation for hermetic unit, integration, and E2E testing.
 */
export class TestClock implements Clock {
  private currentTimeMs: number;

  public constructor(initialTime: Date | string | number = Date.now()) {
    this.currentTimeMs = new Date(initialTime).getTime();
  }

  public now(): Date {
    return new Date(this.currentTimeMs);
  }

  public iso(): string {
    return new Date(this.currentTimeMs).toISOString();
  }

  public timestamp(): number {
    return this.currentTimeMs;
  }

  /**
   * Advances the clock forward by a duration in milliseconds.
   */
  public advanceBy(ms: number): void {
    if (ms < 0) {
      throw new Error("advanceBy requires a non-negative millisecond value; use setTime() to move backward");
    }
    this.currentTimeMs += ms;
  }

  /**
   * Advances the clock forward to a specific target time.
   */
  public advanceTo(target: Date | string | number): void {
    const targetMs = new Date(target).getTime();
    if (targetMs < this.currentTimeMs) {
      throw new Error("advanceTo cannot advance backward in time; use setTime() to move backward");
    }
    this.currentTimeMs = targetMs;
  }

  /**
   * Sets the clock to an arbitrary timestamp.
   */
  public setTime(time: Date | string | number): void {
    this.currentTimeMs = new Date(time).getTime();
  }

  /**
   * Resets the clock to the given time or system current time.
   */
  public reset(time: Date | string | number = Date.now()): void {
    this.currentTimeMs = new Date(time).getTime();
  }
}

let activeClock: Clock = new SystemClock();

/**
 * Retrieves the currently active clock instance.
 */
export function getClock(): Clock {
  return activeClock;
}

/**
 * Sets the active clock instance (typically used in test setup).
 */
export function setClock(clock: Clock): void {
  activeClock = clock;
}

/**
 * Resets the active clock back to the default SystemClock.
 */
export function resetClock(): void {
  activeClock = new SystemClock();
}


export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures to trigger opening the circuit (default: 3) */
  failureThreshold?: number;
  /** Cooldown in milliseconds before entering HALF_OPEN trial state (default: 30,000) */
  resetTimeoutMs?: number;
}

/**
 * Standard Circuit Breaker for remote service resilience (D-42).
 * - CLOSED: Requests flow to target service.
 * - OPEN: Target service calls are short-circuited; requests fall back immediately.
 * - HALF_OPEN: Cooldown elapsed; a single trial request is permitted to test recovery.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private nextAttemptTime = 0;
  private lastStateChange: Date = new Date();
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptTime) {
      this.state = "HALF_OPEN";
      this.lastStateChange = new Date();
    }
    return this.state;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== "CLOSED") {
      this.state = "CLOSED";
      this.lastStateChange = new Date();
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      this.lastStateChange = new Date();
    }
  }

  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  public isClosed(): boolean {
    return this.getState() === "CLOSED";
  }

  public isHalfOpen(): boolean {
    return this.getState() === "HALF_OPEN";
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getFailureThreshold(): number {
    return this.failureThreshold;
  }

  public getResetTimeoutMs(): number {
    return this.resetTimeoutMs;
  }

  public getNextAttemptTime(): number {
    return this.nextAttemptTime;
  }

  public getLastStateChange(): Date {
    return this.lastStateChange;
  }

  /**
   * Manually resets the circuit breaker to CLOSED.
   */
  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.nextAttemptTime = 0;
    this.lastStateChange = new Date();
  }

  /**
   * For testing: force set the state.
   */
  public forceState(state: CircuitState, cooldownRemainingMs = 0): void {
    this.state = state;
    this.lastStateChange = new Date();
    if (state === "OPEN") {
      this.nextAttemptTime = Date.now() + cooldownRemainingMs;
    }
  }
}

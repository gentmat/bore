/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures when external services (bore-server) are unavailable
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests fail fast without trying
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */

import { logger } from './logger';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
}

interface CircuitBreakerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  timeouts: number;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  successRate: string;
  nextAttempt: string | null;
}

interface Stats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  timeouts: number;
}

class CircuitBreakerError extends Error {
  circuitBreakerOpen: boolean;

  constructor(message: string) {
    super(message);
    this.circuitBreakerOpen = true;
    this.name = 'CircuitBreakerError';
  }
}

class CircuitBreaker {
  private name: string;
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private nextAttempt: number;
  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;
  private resetTimeout: number;
  private stats: Stats;

  /**
   * Create a circuit breaker
   * @param options - Configuration options
   * @param options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param options.successThreshold - Number of successes in half-open before closing (default: 2)
   * @param options.timeout - Request timeout in ms (default: 10000)
   * @param options.resetTimeout - Time to wait before attempting half-open in ms (default: 60000)
   * @param options.name - Circuit breaker name for logging (default: 'circuit-breaker')
   */
  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || 'circuit-breaker';
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 10000; // 10 seconds
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    
    // Metrics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      timeouts: 0
    };
    
    logger.info(`Circuit breaker '${this.name}' initialized`, {
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to try half-open
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        throw new CircuitBreakerError(`Circuit breaker '${this.name}' is OPEN`);
      }
      // Move to half-open state
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info(`Circuit breaker '${this.name}' entering HALF_OPEN state`);
    }

    try {
      // Execute with timeout
      const result = await this._executeWithTimeout(fn);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async _executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.timeouts++;
        reject(new Error(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Handle successful execution
   */
  private _onSuccess(): void {
    this.stats.successfulRequests++;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this._close();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private _onFailure(error: Error): void {
    this.stats.failedRequests++;
    this.failureCount++;
    
    logger.warn(`Circuit breaker '${this.name}' recorded failure`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this._open();
    } else if (this.failureCount >= this.failureThreshold) {
      this._open();
    }
  }

  /**
   * Open the circuit
   */
  private _open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    
    logger.error(`Circuit breaker '${this.name}' OPENED`, {
      failureCount: this.failureCount,
      nextAttempt: new Date(this.nextAttempt).toISOString()
    });
  }

  /**
   * Close the circuit
   */
  private _close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    
    logger.info(`Circuit breaker '${this.name}' CLOSED - service recovered`);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      successRate: successRate.toFixed(2) + '%',
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      timeouts: 0
    };
    logger.info(`Circuit breaker '${this.name}' reset`);
  }
}

export default CircuitBreaker;
export { CircuitBreaker, CircuitState, CircuitBreakerOptions, CircuitBreakerStats, CircuitBreakerError };

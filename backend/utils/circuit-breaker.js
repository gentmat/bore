/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures when external services (bore-server) are unavailable
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests fail fast without trying
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */

const { logger } = require('./logger');

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
  /**
   * Create a circuit breaker
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param {number} options.successThreshold - Number of successes in half-open before closing (default: 2)
   * @param {number} options.timeout - Request timeout in ms (default: 10000)
   * @param {number} options.resetTimeout - Time to wait before attempting half-open in ms (default: 60000)
   * @param {string} options.name - Circuit breaker name for logging (default: 'circuit-breaker')
   */
  constructor(options = {}) {
    this.name = options.name || 'circuit-breaker';
    this.state = STATE.CLOSED;
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
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function
   * @throws {Error} If circuit is open or function fails
   */
  async execute(fn) {
    this.stats.totalRequests++;
    
    // Check if circuit is open
    if (this.state === STATE.OPEN) {
      // Check if it's time to try half-open
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
        error.circuitBreakerOpen = true;
        throw error;
      }
      // Move to half-open state
      this.state = STATE.HALF_OPEN;
      this.successCount = 0;
      logger.info(`Circuit breaker '${this.name}' entering HALF_OPEN state`);
    }

    try {
      // Execute with timeout
      const result = await this._executeWithTimeout(fn);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async _executeWithTimeout(fn) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.timeouts++;
        reject(new Error(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle successful execution
   */
  _onSuccess() {
    this.stats.successfulRequests++;
    this.failureCount = 0;

    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this._close();
      }
    }
  }

  /**
   * Handle failed execution
   */
  _onFailure(error) {
    this.stats.failedRequests++;
    this.failureCount++;
    
    logger.warn(`Circuit breaker '${this.name}' recorded failure`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message
    });

    if (this.state === STATE.HALF_OPEN) {
      this._open();
    } else if (this.failureCount >= this.failureThreshold) {
      this._open();
    }
  }

  /**
   * Open the circuit
   */
  _open() {
    this.state = STATE.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    
    logger.error(`Circuit breaker '${this.name}' OPENED`, {
      failureCount: this.failureCount,
      nextAttempt: new Date(this.nextAttempt).toISOString()
    });
  }

  /**
   * Close the circuit
   */
  _close() {
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    
    logger.info(`Circuit breaker '${this.name}' CLOSED - service recovered`);
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      successRate: successRate.toFixed(2) + '%',
      nextAttempt: this.state === STATE.OPEN ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset() {
    this.state = STATE.CLOSED;
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

module.exports = CircuitBreaker;

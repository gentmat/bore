/**
 * Unit tests for Circuit Breaker
 * Tests fault tolerance and cascade failure prevention
 */

const CircuitBreaker = require('../utils/circuit-breaker');

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Circuit Breaker', () => {
  let breaker;
  let mockFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 5000
    });
    mockFunction = jest.fn();
  });

  describe('CLOSED state', () => {
    it('should execute function successfully when closed', async () => {
      mockFunction.mockResolvedValue('success');

      const result = await breaker.execute(mockFunction);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it('should track successful requests', async () => {
      mockFunction.mockResolvedValue('success');

      await breaker.execute(mockFunction);
      await breaker.execute(mockFunction);

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
    });

    it('should handle function failures', async () => {
      mockFunction.mockRejectedValue(new Error('Service failed'));

      await expect(breaker.execute(mockFunction)).rejects.toThrow('Service failed');

      const stats = breaker.getStats();
      expect(stats.failedRequests).toBe(1);
    });

    it('should open after failure threshold reached', async () => {
      mockFunction.mockRejectedValue(new Error('Service failed'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFunction)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit by exceeding failure threshold
      mockFunction.mockRejectedValue(new Error('Service failed'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFunction)).rejects.toThrow();
      }
    });

    it('should reject requests immediately when open', async () => {
      mockFunction.mockResolvedValue('success');

      await expect(breaker.execute(mockFunction)).rejects.toThrow('Circuit breaker');

      const stats = breaker.getStats();
      expect(stats.rejectedRequests).toBeGreaterThan(0);
      // Function should not be called
      expect(mockFunction).toHaveBeenCalledTimes(3); // Only from beforeEach
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      jest.useFakeTimers();
      mockFunction.mockResolvedValue('success');

      // Fast-forward past reset timeout
      jest.advanceTimersByTime(6000);

      await breaker.execute(mockFunction);

      expect(breaker.getState()).toBe('HALF_OPEN');

      jest.useRealTimers();
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      mockFunction.mockRejectedValue(new Error('Service failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFunction)).rejects.toThrow();
      }

      // Move to half-open
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();
    });

    it('should close after success threshold met', async () => {
      mockFunction.mockResolvedValue('success');

      // Success threshold is 2
      await breaker.execute(mockFunction);
      await breaker.execute(mockFunction);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reopen on failure in half-open state', async () => {
      mockFunction.mockRejectedValue(new Error('Still failing'));

      await expect(breaker.execute(mockFunction)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const slowFunction = jest.fn(() => new Promise(resolve => {
        setTimeout(() => resolve('done'), 5000);
      }));

      await expect(breaker.execute(slowFunction)).rejects.toThrow('timed out');

      const stats = breaker.getStats();
      expect(stats.timeouts).toBe(1);
    });

    it('should not timeout fast operations', async () => {
      const fastFunction = jest.fn(() => new Promise(resolve => {
        setTimeout(() => resolve('done'), 100);
      }));

      const result = await breaker.execute(fastFunction);

      expect(result).toBe('done');
      const stats = breaker.getStats();
      expect(stats.timeouts).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      mockFunction.mockResolvedValue('success');

      await breaker.execute(mockFunction);
      await breaker.execute(mockFunction);

      const stats = breaker.getStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
      expect(stats.state).toBe('CLOSED');
      expect(stats.successRate).toBe('100.00%');
    });

    it('should calculate success rate correctly', async () => {
      mockFunction
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      await breaker.execute(mockFunction);
      await expect(breaker.execute(mockFunction)).rejects.toThrow();
      await breaker.execute(mockFunction);

      const stats = breaker.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.successRate).toBe('66.67%');
    });
  });

  describe('Reset', () => {
    it('should reset all statistics and state', async () => {
      mockFunction.mockRejectedValue(new Error('fail'));

      // Generate some failures
      await expect(breaker.execute(mockFunction)).rejects.toThrow();
      await expect(breaker.execute(mockFunction)).rejects.toThrow();

      breaker.reset();

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(breaker.getState()).toBe('CLOSED');
    });
  });
});

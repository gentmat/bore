/**
 * Error Handler Tests
 * Tests for standardized error responses
 */

const { ErrorResponses, ApiError, globalErrorHandler } = require('../utils/error-handler');

describe('ErrorResponses', () => {
  let mockRes;
  let mockReq;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockReq = {
      id: 'req-123',
      path: '/api/v1/test',
      method: 'GET'
    };
  });

  describe('badRequest', () => {
    it('should return 400 with correct error format', () => {
      ErrorResponses.badRequest(mockRes, 'Invalid data', null, 'req-123');

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'bad_request',
          message: 'Invalid data',
          requestId: 'req-123'
        })
      );
    });
  });

  describe('unauthorized', () => {
    it('should return 401 with correct error format', () => {
      ErrorResponses.unauthorized(mockRes, 'Auth required', 'req-456');

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'unauthorized',
          message: 'Auth required',
          requestId: 'req-456'
        })
      );
    });
  });

  describe('notFound', () => {
    it('should return 404 with correct error format', () => {
      ErrorResponses.notFound(mockRes, 'User', 'req-789');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'not_found',
          message: 'User not found',
          requestId: 'req-789'
        })
      );
    });
  });

  describe('internalError', () => {
    it('should return 500 with correct error format', () => {
      ErrorResponses.internalError(mockRes, 'Something went wrong', 'req-999');

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'internal_error',
          message: 'Something went wrong',
          requestId: 'req-999'
        })
      );
    });
  });

  describe('validationError', () => {
    it('should return 400 with validation details', () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' }
      ];

      ErrorResponses.validationError(mockRes, details, 'req-111');

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'validation_error',
          message: 'Input validation failed',
          details,
          requestId: 'req-111'
        })
      );
    });
  });
});

describe('ApiError', () => {
  it('should create ApiError with correct properties', () => {
    const error = new ApiError(404, 'not_found', 'Resource not found', { id: '123' });

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('not_found');
    expect(error.message).toBe('Resource not found');
    expect(error.details).toEqual({ id: '123' });
    expect(error.timestamp).toBeDefined();
  });
});

describe('globalErrorHandler', () => {
  let mockRes;
  let mockReq;
  let mockNext;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockReq = {
      id: 'req-123',
      path: '/api/v1/test',
      method: 'POST'
    };
    mockNext = jest.fn();

    // Suppress console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('should handle ApiError correctly', () => {
    const error = new ApiError(403, 'forbidden', 'Access denied');
    
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'forbidden',
        message: 'Access denied'
      })
    );
  });

  it('should handle JWT errors', () => {
    const error = new Error('jwt malformed');
    error.name = 'JsonWebTokenError';
    
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_token'
      })
    );
  });

  it('should handle generic errors in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Database connection failed');
    
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'internal_error',
        message: 'An unexpected error occurred'
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should include error details in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Database connection failed');
    
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'internal_error',
        message: 'Database connection failed',
        details: expect.objectContaining({
          stack: expect.any(String)
        })
      })
    );

    process.env.NODE_ENV = originalEnv;
  });
});

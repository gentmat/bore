/**
 * Validation Middleware Tests
 * Tests for input validation using Joi
 */

const { schemas, validate } = require('../middleware/validation');

describe('Validation Schemas', () => {
  describe('signup schema', () => {
    it('should validate correct signup data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const { error, value } = schemas.signup.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.email).toBe('john@example.com'); // Should be lowercase
    });

    it('should reject invalid email', () => {
      const data = {
        name: 'John Doe',
        email: 'not-an-email',
        password: 'password123'
      };

      const { error } = schemas.signup.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    it('should reject short password', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'short'
      };

      const { error } = schemas.signup.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('password');
    });

    it('should reject short name', () => {
      const data = {
        name: 'J',
        email: 'john@example.com',
        password: 'password123'
      };

      const { error } = schemas.signup.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('name');
    });
  });

  describe('createInstance schema', () => {
    it('should validate correct instance data', () => {
      const data = {
        name: 'My Instance',
        localPort: 3000,
        region: 'us-east'
      };

      const { error, value } = schemas.createInstance.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.localPort).toBe(3000);
    });

    it('should reject invalid port', () => {
      const data = {
        name: 'My Instance',
        localPort: 70000, // Too high
        region: 'us-east'
      };

      const { error } = schemas.createInstance.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('localPort');
    });

    it('should use default region if not provided', () => {
      const data = {
        name: 'My Instance',
        localPort: 3000
      };

      const { error, value } = schemas.createInstance.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.region).toBe('local');
    });
  });

  describe('heartbeat schema', () => {
    it('should validate heartbeat data', () => {
      const data = {
        vscode_responsive: true,
        cpu_usage: 45.5,
        memory_usage: 1024000,
        has_code_server: true,
        last_activity: Date.now()
      };

      const { error } = schemas.heartbeat.validate(data);
      
      expect(error).toBeUndefined();
    });

    it('should reject invalid CPU usage', () => {
      const data = {
        cpu_usage: 150 // Over 100%
      };

      const { error } = schemas.heartbeat.validate(data);
      
      expect(error).toBeDefined();
    });
  });
});

describe('validate middleware', () => {
  it('should call next() for valid data', () => {
    const req = {
      body: {
        name: 'Test',
        email: 'test@example.com',
        password: 'password123'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validate(schemas.signup);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid data', () => {
    const req = {
      body: {
        name: 'T', // Too short
        email: 'invalid',
        password: '123'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validate(schemas.signup);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'validation_error'
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should strip unknown fields', () => {
    const req = {
      body: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        extraField: 'should be removed'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validate(schemas.signup);
    middleware(req, res, next);

    expect(req.body.extraField).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

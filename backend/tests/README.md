# Backend Tests

Comprehensive unit and integration tests for the Bore backend API.

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

## Test Structure

```
tests/
├── auth.test.js           # Authentication endpoints
├── error-handler.test.js  # Error handling utilities
├── validation.test.js     # Input validation
└── README.md             # This file
```

## Test Coverage Goals

- **Routes**: 80%+ coverage
- **Utilities**: 90%+ coverage
- **Middleware**: 85%+ coverage

## Writing New Tests

### Example Test File

```javascript
const request = require('supertest');
const app = require('../server'); // Your Express app

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', async () => {
    const response = await request(app)
      .post('/api/v1/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });
});
```

## Mocking

We use Jest's built-in mocking for:
- Database operations
- External API calls
- Authentication middleware
- Redis connections

Example:
```javascript
jest.mock('../database', () => ({
  db: {
    query: jest.fn(),
    getUserById: jest.fn()
  }
}));
```

## Best Practices

1. **Test one thing at a time** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should clearly state what they verify
3. **Arrange-Act-Assert** - Structure tests with setup, execution, and verification
4. **Mock external dependencies** - Don't rely on database, Redis, or external services
5. **Clean up after tests** - Use `afterEach()` to reset mocks and state

## Continuous Integration

Tests run automatically on:
- Every push to `main` branch
- Every pull request
- Pre-deployment checks

## Coverage Reports

After running tests with coverage, view the HTML report:

```bash
open coverage/lcov-report/index.html
```

## Troubleshooting

### Tests failing due to mocks
- Ensure mocks are cleared: `jest.clearAllMocks()`
- Check mock implementation order

### Timeouts
- Increase timeout for slow tests: `jest.setTimeout(10000)`
- Check for unhandled promises

### Database connection errors
- Ensure database mocks are properly configured
- Don't use real database in tests

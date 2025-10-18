# Backend Tests

Unit tests for the Bore backend API core functionality.

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

### Run Only Unit Tests
```bash
npm run test:unit
```

## Test Structure

```
tests/
├── capacity-limiter.test.ts    # Capacity limiting functionality
├── circuit-breaker.test.ts     # Circuit breaker pattern
├── error-handler.test.ts       # Error handling utilities
├── naming-convention.test.ts   # Field naming conventions
├── server-registry.test.ts     # Server registry management
├── validation.test.ts          # Input validation
├── jest.setup.ts              # Global test configuration
└── README.md                  # This file
```

## Test Coverage Goals

- **Core Utilities**: 80%+ coverage
- **Middleware**: 85%+ coverage
- **Services**: 70%+ coverage

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

Unit tests run automatically on:
- Every push to `main` branch
- Every pull request
- Pre-deployment checks

Note: Integration and E2E tests have been removed as they required external dependencies (database, running servers).

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

### Mock configuration
- All external dependencies are mocked (database, Redis, etc.)
- Tests run in isolation without requiring external services

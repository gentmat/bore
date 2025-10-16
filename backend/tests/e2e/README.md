# End-to-End Tests

Comprehensive end-to-end tests that verify the entire application flow from user perspective.

## Overview

E2E tests run against a real (or test) database and server instance, testing the complete user journey through the application.

## Running E2E Tests

```bash
# Ensure test database is set up
createdb bore_db_test

# Run migrations on test database
TEST_DB_NAME=bore_db_test npm run migrate:up

# Start the backend server (in another terminal)
npm run dev

# Run E2E tests
npm run test:e2e
```

## Test Structure

### Authentication Flow (`auth.e2e.test.js`)
- User registration with validation
- Login with correct/incorrect credentials
- Token refresh mechanism
- Protected route access
- Logout and token revocation

### Instance Lifecycle (`instance-lifecycle.e2e.test.js`)
- Instance creation
- Instance listing and retrieval
- Instance start/stop
- Heartbeat handling
- Health metrics
- Instance deletion

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data after tests
3. **Realistic Data**: Use realistic test data that mirrors production
4. **Error Scenarios**: Test both success and failure paths
5. **Timing**: Account for async operations with appropriate waits

## Environment Variables

E2E tests respect these environment variables:

```bash
TEST_DB_NAME=bore_db_test       # Test database name
API_URL=http://localhost:3000    # API endpoint (default)
INTERNAL_API_KEY=test-key        # Internal API key for tests
```

## Adding New E2E Tests

1. Create new test file in `tests/e2e/` directory
2. Follow naming convention: `feature-name.e2e.test.js`
3. Include setup/teardown for test data
4. Document the test scenarios in comments
5. Update this README with new test coverage

## CI/CD Integration

E2E tests are run in CI/CD pipeline after:
- Unit tests pass
- Integration tests pass
- Database migrations are applied

They serve as the final verification before deployment.

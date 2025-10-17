# Testing Guide for Bore GUI

This document provides comprehensive information about the testing infrastructure for the Bore GUI application.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)

## Overview

The Bore GUI testing infrastructure includes:

- **Unit Tests**: Component-level tests using Vitest and React Testing Library
- **E2E Tests**: End-to-end tests using Playwright
- **Coverage Reports**: Code coverage tracking with v8

## Test Types

### Unit Tests

Unit tests focus on individual components in isolation. They test:
- Component rendering
- User interactions
- State management
- Props handling
- Error handling

**Location**: `src/**/*.test.tsx`

**Technologies**:
- [Vitest](https://vitest.dev/) - Fast unit test framework
- [React Testing Library](https://testing-library.com/react) - React component testing
- [Happy DOM](https://github.com/capricorn86/happy-dom) - Lightweight DOM implementation
- [User Event](https://testing-library.com/docs/user-event/intro) - User interaction simulation

### E2E Tests

End-to-end tests validate complete user workflows. They test:
- Multi-page flows
- User journeys
- Integration between components
- Real browser interactions

**Location**: `e2e/**/*.spec.ts`

**Technologies**:
- [Playwright](https://playwright.dev/) - Modern e2e testing framework

## Setup

### Install Dependencies

```bash
npm install
```

This will install all testing dependencies including:
- `vitest` and `@vitest/ui`
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- `@playwright/test`
- `happy-dom` and `jsdom`

### Install Playwright Browsers

```bash
npx playwright install
```

This installs the required browser binaries for Playwright tests.

## Running Tests

### Unit Tests

Run all unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test -- --watch
```

Run tests with UI:
```bash
npm run test:ui
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run specific test file:
```bash
npm test -- src/App.test.tsx
```

### E2E Tests

Run all e2e tests:
```bash
npm run test:e2e
```

Run e2e tests with UI:
```bash
npm run test:e2e:ui
```

Run specific e2e test:
```bash
npx playwright test e2e/login.spec.ts
```

Run tests in headed mode (see browser):
```bash
npx playwright test --headed
```

Debug a test:
```bash
npx playwright test --debug
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test/testUtils';
import userEvent from '@testing-library/user-event';
import MyComponent from './MyComponent';
import { mockInvoke } from './test/setup';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce({ success: true });
    
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('some_command');
    });
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';
import { mockTauriAPI, waitForLoadingToComplete } from './helpers';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriAPI(page);
    await page.goto('/');
  });

  test('should complete user flow', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await page.click('button:has-text("Start")');
    
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Testing Tauri API Calls

The test setup includes mocks for Tauri APIs:

```typescript
import { mockInvoke, mockListen, mockOpen } from './test/setup';

// Mock a successful invoke
mockInvoke.mockResolvedValueOnce({ success: true });

// Mock an error
mockInvoke.mockRejectedValueOnce(new Error('Failed'));

// Mock file dialog
mockOpen.mockResolvedValueOnce('/selected/path');

// Mock event listener
mockListen.mockResolvedValue(() => {});
```

## Test Coverage

### Current Coverage

The test suite covers:

#### Unit Tests
- ✅ `App.tsx` - Main application component
  - Initialization and dependency checking
  - Authentication flow
  - State transitions
  - Error handling
  
- ✅ `LoginPage.tsx` - Login functionality
  - Form rendering and validation
  - User input handling
  - Login submission
  - Error display
  
- ✅ `Dashboard.tsx` - Main dashboard
  - Instance list display
  - Tunnel operations
  - Real-time updates
  - Modal interactions
  
- ✅ `CreateInstanceModal.tsx` - Instance creation
  - Form validation
  - Folder selection
  - Instance creation flow
  - Error handling

#### E2E Tests
- ✅ Login flow
- ✅ Dashboard navigation
- ✅ Dependency checking
- ✅ Create instance flow

### Viewing Coverage Reports

After running tests with coverage:
```bash
npm run test:coverage
```

Open the HTML report:
```bash
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## Best Practices

### Unit Tests

1. **Test Behavior, Not Implementation**
   - Focus on what the component does, not how it does it
   - Test user-visible behavior

2. **Use Testing Library Queries**
   - Prefer `getByRole` over `getByTestId`
   - Use semantic queries that match how users interact

3. **Avoid Testing Implementation Details**
   - Don't test internal state directly
   - Test the effects of state changes

4. **Mock External Dependencies**
   - Always mock Tauri API calls
   - Mock time-dependent operations
   - Keep mocks simple and focused

5. **Clean Up After Tests**
   - Use `beforeEach` to reset mocks
   - Automatic cleanup with `afterEach` in setup

### E2E Tests

1. **Test Complete User Journeys**
   - Focus on critical paths
   - Test realistic user scenarios

2. **Use Page Object Pattern**
   - Extract common interactions into helpers
   - Keep tests readable and maintainable

3. **Wait for Elements Properly**
   - Use `waitFor` and `toBeVisible`
   - Avoid fixed `setTimeout`

4. **Mock Backend When Appropriate**
   - Mock Tauri API for predictable tests
   - Use `page.addInitScript` for setup

5. **Take Screenshots on Failure**
   - Configured automatically in Playwright
   - Helps debug failing tests

## CI/CD Integration

The tests are designed to run in CI environments:

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:coverage
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run e2e tests
        run: npm run test:e2e
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Troubleshooting

### Common Issues

**Tests failing due to timing issues**
- Use `waitFor` instead of fixed waits
- Increase timeout for slow operations
- Check for race conditions

**Mocks not working**
- Clear mocks in `beforeEach`
- Verify mock setup in `test/setup.ts`
- Check import paths

**E2E tests can't find elements**
- Verify selectors are correct
- Check if page has loaded
- Use Playwright inspector: `npx playwright test --debug`

**Coverage not accurate**
- Ensure all files are included
- Check coverage configuration in `vitest.config.ts`
- Verify test files follow naming convention

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass before submitting PR
3. Maintain or improve coverage percentage
4. Update this document if adding new test patterns

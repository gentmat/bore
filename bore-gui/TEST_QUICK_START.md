# Test Quick Start Guide

## 🚀 First Time Setup

```bash
# 1. Navigate to the GUI directory
cd bore-gui

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (for e2e tests)
npx playwright install
```

## 🧪 Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run in watch mode (recommended during development)
npm test -- --watch

# Run with UI (interactive test runner)
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/App.test.tsx

# Run tests matching a pattern
npm test -- --grep "LoginPage"
```

### E2E Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with UI (see browser interactions)
npm run test:e2e:ui

# Run in headed mode (browser visible)
npx playwright test --headed

# Run specific test file
npx playwright test e2e/login.spec.ts

# Debug a specific test
npx playwright test e2e/login.spec.ts --debug

# Run only failed tests
npx playwright test --last-failed
```

## 📊 Viewing Results

### Unit Test Coverage
```bash
# Generate and view coverage report
npm run test:coverage

# Open HTML report (after running coverage)
# Linux/Mac:
open coverage/index.html

# Windows:
start coverage/index.html
```

### E2E Test Reports
```bash
# View last test report
npx playwright show-report

# The report is automatically opened if tests fail
```

## 🔍 Common Workflows

### During Development

```bash
# Keep unit tests running in watch mode
npm test -- --watch

# In another terminal, run your dev server
npm run dev
```

### Before Committing

```bash
# Run all tests with coverage
npm run test:coverage && npm run test:e2e
```

### Debugging a Failing Test

```bash
# For unit tests - use test:ui for interactive debugging
npm run test:ui

# For e2e tests - use Playwright inspector
npx playwright test --debug

# Or run in headed mode to see the browser
npx playwright test --headed
```

## 📝 Test File Locations

```
bore-gui/
├── src/
│   ├── App.test.tsx                     # App component tests
│   ├── test/
│   │   ├── setup.ts                     # Test setup & mocks
│   │   └── testUtils.tsx                # Custom test utilities
│   └── components/
│       ├── LoginPage.test.tsx           # Login tests
│       ├── Dashboard.test.tsx           # Dashboard tests
│       └── CreateInstanceModal.test.tsx # Modal tests
├── e2e/
│   ├── helpers.ts                       # E2E test helpers
│   ├── login.spec.ts                    # Login flow tests
│   ├── dashboard.spec.ts                # Dashboard flow tests
│   ├── dependency-check.spec.ts         # Dependency tests
│   └── create-instance.spec.ts          # Instance creation tests
├── vitest.config.ts                     # Vitest configuration
└── playwright.config.ts                 # Playwright configuration
```

## 💡 Tips

### Speed Up Test Runs

```bash
# Run tests in parallel (unit tests do this by default)
npm test -- --pool=threads

# Skip slow tests during development
npm test -- --exclude "**/slow.test.tsx"

# Run only changed files
npm test -- --changed
```

### Better Test Output

```bash
# Show more details
npm test -- --reporter=verbose

# Show only failures
npm test -- --reporter=basic

# UI mode for best experience
npm run test:ui
```

### CI/CD Testing

```bash
# Run tests as they would run in CI
CI=true npm run test:coverage
CI=true npm run test:e2e
```

## 🐛 Troubleshooting

### Tests Won't Run

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# For Playwright issues
npx playwright install --force
```

### Tests Are Slow

```bash
# Check if you're in watch mode accidentally
# Use --run flag to run once
npm test -- --run

# For Playwright, try single worker
npx playwright test --workers=1
```

### Mock Issues

```bash
# Verify mocks are being cleared between tests
# Check beforeEach in your test files includes:
# vi.clearAllMocks()
```

## 📚 More Information

- Full testing guide: `TESTING.md`
- Coverage summary: `TEST_COVERAGE_SUMMARY.md`
- Vitest docs: https://vitest.dev
- Playwright docs: https://playwright.dev
- React Testing Library: https://testing-library.com/react

## ✨ Quick Commands Cheatsheet

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm test -- --watch` | Watch mode |
| `npm run test:ui` | Interactive UI |
| `npm run test:coverage` | With coverage |
| `npm run test:e2e` | E2E tests |
| `npm run test:e2e:ui` | E2E with UI |
| `npx playwright test --debug` | Debug E2E |
| `npx playwright show-report` | View E2E report |

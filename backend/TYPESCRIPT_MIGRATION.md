# TypeScript Migration Guide

This guide outlines the strategy for gradually migrating the Bore backend from JavaScript to TypeScript.

## Current Status (Updated: October 16, 2025)

- ✅ TypeScript configuration (`tsconfig.json`) is set up
- ✅ Type definitions (`types/index.d.ts`, `types/express.d.ts`) are created
- ✅ Dev dependencies are installed
- ✅ Database migrations system implemented
- ✅ E2E test suite created
- ✅ API documentation made mandatory
- ✅ **Phase 2: Utilities** (100% complete - 3/3 files)
- ✅ **Phase 3: Core Modules** (50% complete - 1/2 files)
- ✅ **Phase 4: Middleware** (100% complete - 6/6 files)
- 🔄 **Overall Progress: ~40% complete**

## Migration Strategy

We're using a **gradual migration approach** to avoid disrupting the working codebase:

1. **Phase 1: Infrastructure** ✅
   - Set up TypeScript configuration
   - Install type definitions for dependencies
   - Create base type definitions
   - Configure build scripts

2. **Phase 2: Utilities First** (Start here)
   - Migrate utility modules (low risk, high reuse)
   - `/utils/logger.js` → `/utils/logger.ts`
   - `/utils/error-handler.js` → `/utils/error-handler.ts`
   - `/utils/circuit-breaker.js` → `/utils/circuit-breaker.ts`

3. **Phase 3: Core Modules**
   - `/config.js` → `/config.ts`
   - `/database.js` → `/database.ts`
   - Middleware files

4. **Phase 4: Business Logic**
   - `/capacity-limiter.js` → `/capacity-limiter.ts`
   - `/server-registry.js` → `/server-registry.ts`
   - Service files

5. **Phase 5: Routes**
   - `/routes/auth-routes.js` → `/routes/auth-routes.ts`
   - `/routes/instance-routes.js` → `/routes/instance-routes.ts`
   - Other route files

6. **Phase 6: Main Server**
   - `/server.js` → `/server.ts`

## Migration Checklist for Each File

When migrating a file from `.js` to `.ts`:

### 1. Preparation
- [ ] Read and understand the file
- [ ] Identify all exported functions/classes
- [ ] List all dependencies

### 2. Type Annotations
- [ ] Add types to function parameters
- [ ] Add return types to functions
- [ ] Type all variables (especially `any` types)
- [ ] Add interface/type definitions for objects

### 3. Strict Mode Fixes
- [ ] Fix `noImplicitAny` errors
- [ ] Fix `strictNullChecks` errors
- [ ] Handle undefined/null cases properly
- [ ] Add proper error handling types

### 4. Testing
- [ ] Ensure existing tests pass
- [ ] Add type-specific tests if needed
- [ ] Verify no runtime behavior changes

### 5. Documentation
- [ ] Update JSDoc to TSDoc
- [ ] Document generic types
- [ ] Add examples in comments

## Example Migration

### Before (JavaScript)
```javascript
// utils/logger.js
function createLogger(context) {
  return {
    info: (message, metadata) => {
      console.log(formatMessage(message, metadata));
    }
  };
}

module.exports = { createLogger };
```

### After (TypeScript)
```typescript
// utils/logger.ts
interface LogMetadata {
  [key: string]: any;
}

interface Logger {
  info(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: Error, metadata?: LogMetadata): void;
}

export function createLogger(context: string): Logger {
  return {
    info: (message: string, metadata?: LogMetadata): void => {
      console.log(formatMessage(message, metadata));
    },
    error: (message: string, error?: Error, metadata?: LogMetadata): void => {
      // Implementation
    }
  };
}
```

## Commands

### Type Check (without compiling)
```bash
npm run type-check
```

### Build TypeScript
```bash
npm run build
```

### Run with TypeScript (development)
```bash
npm install -g ts-node
ts-node server.ts
```

### Run compiled JavaScript (production)
```bash
npm run build
node dist/server.js
```

## Benefits of Migration

### Type Safety
- Catch errors at compile time
- Prevent runtime type errors
- Better IDE autocomplete

### Developer Experience
- IntelliSense support
- Refactoring confidence
- Self-documenting code

### Maintainability
- Easier to understand code
- Prevents bugs from typos
- Better collaboration

## Common Issues & Solutions

### Issue: Module not found
**Solution:** Install type definitions
```bash
npm install --save-dev @types/package-name
```

### Issue: Any type warnings
**Solution:** Create proper interfaces
```typescript
// Bad
const user: any = await db.getUser();

// Good
interface User {
  id: string;
  email: string;
}
const user: User = await db.getUser();
```

### Issue: Null/undefined errors
**Solution:** Use optional chaining and nullish coalescing
```typescript
// Bad
const port = config.server.port;

// Good
const port = config?.server?.port ?? 3000;
```

## Priority Order

Migrate in this order for minimum disruption:

1. **Low Risk, High Value**
   - Utils (logger, error-handler)
   - Types and interfaces
   - Config files

2. **Medium Risk**
   - Middleware
   - Database layer
   - Services

3. **High Risk (Do Last)**
   - Routes
   - Main server file

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Definitely Typed](https://github.com/DefinitelyTyped/DefinitelyTyped)

## Progress Tracking

Track migration progress here:

- [x] **Utils (3/3) ✅**
  - [x] logger.ts
  - [x] error-handler.ts
  - [x] circuit-breaker.ts
- [x] **Core (1/2) 🔄**
  - [x] config.ts
  - [ ] database.ts
- [x] **Middleware (6/6) ✅**
  - [x] request-id.ts
  - [x] http-logger.ts
  - [x] validation.ts
  - [x] rate-limiter.ts
  - [x] capacity-check.ts
  - [x] refresh-token.ts
- [ ] **Services (0/2)**
  - [ ] capacity-limiter.ts
  - [ ] server-registry.ts
- [ ] **Routes (0/4)**
  - [ ] auth-routes.ts
  - [ ] instance-routes.ts
  - [ ] admin-routes.ts
  - [ ] internal-routes.ts
- [ ] **Main (0/1)**
  - [ ] server.ts

**Overall Progress: ~40%** (10/23 files migrated)
**LOC Migrated: ~1,200 lines**
**Interfaces Created: 50+ types/interfaces**

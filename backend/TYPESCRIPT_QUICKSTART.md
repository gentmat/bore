# TypeScript Quick Start Guide

## Overview

The Bore backend is undergoing a gradual migration from JavaScript to TypeScript for improved type safety, better developer experience, and more maintainable code.

**Current Status**: ~40% migrated (utilities, config, and all middleware complete)

## What's Been Migrated

✅ **Utilities** (100%)
- `utils/logger.ts` - Structured logging
- `utils/error-handler.ts` - Error handling
- `utils/circuit-breaker.ts` - Circuit breaker pattern

✅ **Configuration** (100%)
- `config.ts` - Application configuration with full type safety

✅ **Middleware** (100%)
- `middleware/request-id.ts`
- `middleware/http-logger.ts`
- `middleware/validation.ts`
- `middleware/rate-limiter.ts`
- `middleware/capacity-check.ts`
- `middleware/refresh-token.ts`

## Setup

### Prerequisites
```bash
# Node.js 18+ required
node --version

# Install dependencies
npm install
```

### Type Checking
```bash
# Check types without compiling
npm run type-check

# Watch mode for continuous type checking
npm run type-check:watch
```

### Building
```bash
# Compile TypeScript to JavaScript
npm run build

# Watch mode for continuous compilation
npm run build:watch
```

### Running

#### JavaScript (Current Production)
```bash
# Start server with JavaScript
npm start

# Development mode with auto-reload
npm run dev
```

#### TypeScript (Development/Testing)
```bash
# Run TypeScript directly with ts-node
npm run dev:ts

# Build and run compiled JavaScript
npm run start:ts
```

## Using TypeScript Modules

### Importing Migrated Modules

Since both `.js` and `.ts` files exist during the migration, you can use either:

```javascript
// From JavaScript files - works with both .js and .ts
const { logger } = require('./utils/logger');
const config = require('./config');

// From TypeScript files
import { logger } from './utils/logger';
import config from './config';
```

### Type Safety Example

**Before (JavaScript)**:
```javascript
const logger = require('./utils/logger');

// No type safety - could pass anything
logger.info(123, { user: undefined });
```

**After (TypeScript)**:
```typescript
import { logger, LogMetadata } from './utils/logger';

// Full type safety
logger.info('User login', { userId: '123', email: 'user@example.com' });
//                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                         Autocomplete and type checking enabled!

// Error caught at compile time:
logger.info(123);  // ❌ Argument of type 'number' is not assignable to 'string'
```

### Express Type Extensions

All Express request/response extensions are typed:

```typescript
import { Request, Response } from 'express';

app.get('/api/example', (req: Request, res: Response) => {
  // TypeScript knows about custom properties
  const userId = req.user?.user_id;  // ✅ Typed
  const requestId = req.id;           // ✅ Typed
  
  res.locals.broadcast = true;        // ✅ Typed
});
```

## Development Workflow

### 1. Type-First Development
```bash
# Terminal 1: Watch for type errors
npm run type-check:watch

# Terminal 2: Run development server
npm run dev
```

### 2. Linting
```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### 3. Testing
```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

## Common TypeScript Patterns

### 1. Configuration Usage
```typescript
import config from './config';

// All config sections are typed
const port: number = config.server.port;
const jwtSecret: string = config.security.jwtSecret;
const maxTunnels: number = config.capacity.maxTunnelsPerServer;
```

### 2. Error Handling
```typescript
import { ApiError, ErrorResponses } from './utils/error-handler';

// Type-safe error responses
ErrorResponses.notFound(res, 'User');
ErrorResponses.unauthorized(res, 'Invalid token', req.id);

// Custom API errors
throw new ApiError(400, 'invalid_input', 'Name is required', {
  field: 'name',
  expected: 'string'
});
```

### 3. Validation
```typescript
import { schemas, validate } from './middleware/validation';

// Type-safe validation middleware
router.post('/signup', 
  validate(schemas.signup),  // Validates and transforms data
  async (req, res) => {
    // req.body is now validated and normalized
    const { name, email, password } = req.body;
  }
);
```

### 4. Circuit Breaker
```typescript
import CircuitBreaker from './utils/circuit-breaker';

const breaker = new CircuitBreaker({
  name: 'external-api',
  failureThreshold: 5,
  timeout: 10000
});

// Type-safe execution
const result = await breaker.execute<UserData>(async () => {
  return await fetchUserData(userId);
});
// result is typed as UserData
```

## IDE Configuration

### VS Code (Recommended)
Install these extensions:
- **ESLint** - For linting
- **TypeScript and JavaScript Language Features** (built-in)

Your `settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### IntelliJ IDEA / WebStorm
TypeScript support is built-in. Just ensure:
1. TypeScript language service is enabled
2. ESLint plugin is installed and enabled

## Migration Guide

### For Contributors

When modifying existing code:

1. **If the file is `.js`**: Keep working in JavaScript for now
2. **If the file is `.ts`**: Use TypeScript with full type safety
3. **Creating new files**: Prefer TypeScript (`.ts`)

### Converting a File

See `TYPESCRIPT_MIGRATION.md` for the full checklist. Quick steps:

1. Rename `.js` to `.ts`
2. Add type annotations to function parameters
3. Add return types to functions
4. Define interfaces for complex objects
5. Run `npm run type-check` to find issues
6. Fix all type errors
7. Test thoroughly

## Troubleshooting

### "Cannot find module" errors
```bash
# Make sure to install type definitions
npm install --save-dev @types/package-name
```

### Type errors in third-party modules
```typescript
// Use type assertion as temporary workaround
const result = (await someLibrary.method()) as ExpectedType;
```

### "Property does not exist on Request"
```typescript
// Custom Request properties are defined in types/express.d.ts
// If you add new properties, extend the interface there
```

## Performance

TypeScript compilation adds minimal overhead:

- **Development**: Use `ts-node` for quick iterations
- **Production**: Compile to JavaScript once, run compiled code
- **Type checking**: Happens only at compile time, no runtime cost

## Resources

### Documentation
- 📖 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- 📖 [Express with TypeScript](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/express)
- 📖 [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Internal Docs
- `TYPESCRIPT_MIGRATION_STATUS.md` - Current migration status
- `TYPESCRIPT_MIGRATION.md` - Full migration guide
- `types/index.d.ts` - Custom type definitions
- `types/express.d.ts` - Express extensions

## FAQ

**Q: Can I still use JavaScript files?**  
A: Yes! The migration is gradual. JavaScript files continue to work.

**Q: Do I need to migrate my code now?**  
A: No rush. We're migrating incrementally. New code should prefer TypeScript.

**Q: Will this break existing functionality?**  
A: No. All migrated modules maintain backward compatibility.

**Q: How do I know which files are TypeScript?**  
A: Look for `.ts` extension. All `.ts` files are TypeScript.

**Q: Can I import TypeScript from JavaScript?**  
A: Yes! Node.js resolves both `.js` and `.ts` (after compilation).

---

**Need Help?** Check `TYPESCRIPT_MIGRATION_STATUS.md` or ask the team!

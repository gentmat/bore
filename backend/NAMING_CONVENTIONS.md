# Naming Conventions Guide

## Overview

This project follows a consistent naming convention strategy to ensure code quality and maintainability:

- **Database Layer (PostgreSQL)**: `snake_case`
- **API/JavaScript Layer**: `camelCase`
- **Automatic Conversion**: Bidirectional mapping between conventions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                        │
│              (accepts both camelCase & snake_case)       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              VALIDATION MIDDLEWARE                       │
│     • Validates input using Joi schemas                  │
│     • Normalizes to snake_case via normalizeRequestBody()│
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 ROUTE HANDLERS                           │
│          • Receives normalized snake_case data           │
│          • Passes to database layer                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                DATABASE LAYER                            │
│     • Expects snake_case (PostgreSQL standard)           │
│     • Returns camelCase via formatDbRow()                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 API RESPONSE                             │
│             (returns camelCase to client)                │
└─────────────────────────────────────────────────────────┘
```

## Utilities

### Location
`/backend/utils/naming-convention.js`

### Functions

#### Conversion Functions

- **`snakeToCamel(str)`**: Convert snake_case to camelCase
- **`camelToSnake(str)`**: Convert camelCase to snake_case

```javascript
snakeToCamel('user_id')      // => 'userId'
camelToSnake('localPort')    // => 'local_port'
```

#### Object Transformation

- **`keysToCamel(obj)`**: Convert all object keys to camelCase (deep)
- **`keysToSnake(obj)`**: Convert all object keys to snake_case (deep)

```javascript
keysToCamel({ user_id: 123, local_port: 8080 })
// => { userId: 123, localPort: 8080 }

keysToSnake({ userId: 123, localPort: 8080 })
// => { user_id: 123, local_port: 8080 }
```

#### Request/Response Formatting

- **`normalizeRequestBody(body)`**: Normalize request body to snake_case
- **`formatDbRow(row)`**: Format database row to camelCase
- **`formatDbRows(rows)`**: Format multiple database rows to camelCase

```javascript
// In validation middleware
const normalized = normalizeRequestBody(req.body);
// Accepts both { localPort: 8080 } and { local_port: 8080 }
// Always returns { local_port: 8080 }

// In database layer
const user = await db.getUserById(id);
// Returns { userId: 'user_123', localPort: 8080, createdAt: '...' }
```

#### Field Mapping

- **`apiToDb(apiField)`**: Map API field name to database field name
- **`dbToApi(dbField)`**: Map database field name to API field name

```javascript
apiToDb('localPort')         // => 'local_port'
dbToApi('user_id')          // => 'userId'
```

## Field Mappings

Common field mappings are defined in `FIELD_MAPPINGS`:

| API (camelCase) | Database (snake_case) |
|----------------|----------------------|
| localPort | local_port |
| remotePort | remote_port |
| userId | user_id |
| serverId | server_id |
| serverHost | server_host |
| publicUrl | public_url |
| tunnelConnected | tunnel_connected |
| currentTunnelToken | current_tunnel_token |
| vscodeResponsive | vscode_responsive |
| cpuUsage | cpu_usage |
| memoryUsage | memory_usage |
| hasCodeServer | has_code_server |
| lastActivity | last_activity |
| createdAt | created_at |
| updatedAt | updated_at |

## Usage Examples

### Validation Middleware

The validation middleware automatically normalizes request bodies:

```javascript
// middleware/validation.js
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      // Return validation error
    }

    // Normalize naming convention
    const normalized = normalizeRequestBody(value);
    req[source] = normalized;  // snake_case for database
    req[`${source}Original`] = value;  // Original for compatibility
    
    next();
  };
}
```

### Database Layer

All database operations return camelCase:

```javascript
// database.js
async getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return formatDbRow(result.rows[0]);  // Converts to camelCase
}

async getInstancesByUserId(userId) {
  const result = await pool.query(
    'SELECT * FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return formatDbRows(result.rows);  // Converts array to camelCase
}
```

### Route Handlers

Routes receive normalized data and return camelCase:

```javascript
// routes/instance-routes.js
router.post('/', authenticateJWT, validate(schemas.createInstance), async (req, res) => {
  // req.body is already normalized to snake_case
  const { name, local_port, region } = req.body;
  
  const instance = await db.createInstance({
    id: generateId(),
    user_id: req.user.user_id,
    name,
    local_port,
    region
  });
  
  // instance is already in camelCase from db.createInstance
  res.status(201).json(instance);
});
```

### Client Usage

Clients can use either naming convention:

```javascript
// Option 1: camelCase (JavaScript standard)
const response = await fetch('/api/v1/instances', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Instance',
    localPort: 8080,
    region: 'us-east'
  })
});

// Option 2: snake_case (also accepted)
const response = await fetch('/api/v1/instances', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Instance',
    local_port: 8080,
    region: 'us-east'
  })
});

// Both return the same camelCase response:
// {
//   id: 'inst_123',
//   userId: 'user_123',
//   name: 'My Instance',
//   localPort: 8080,
//   region: 'us-east',
//   status: 'inactive',
//   createdAt: '2024-01-01T00:00:00Z'
// }
```

## Validation Schemas

Validation schemas accept both naming conventions:

```javascript
// middleware/validation.js
createInstance: Joi.object({
  name: Joi.string().min(1).max(255).trim().required(),
  // Accept both localPort and local_port
  localPort: Joi.number().integer().min(1).max(65535).optional(),
  local_port: Joi.number().integer().min(1).max(65535).optional(),
  region: Joi.string().max(100).trim().optional().default('local'),
  // Accept both serverHost and server_host
  serverHost: Joi.string().max(255).trim().optional(),
  server_host: Joi.string().max(255).trim().optional()
}).custom((value, helpers) => {
  // Ensure at least one port field is provided
  if (!value.localPort && !value.local_port) {
    return helpers.error('any.required', { label: 'localPort or local_port' });
  }
  return value;
})
```

## Testing

Comprehensive tests are available in `tests/naming-convention.test.js`:

```bash
npm test tests/naming-convention.test.js
```

Tests cover:
- ✅ Basic conversion (snake_case ↔ camelCase)
- ✅ Object key transformation (deep)
- ✅ Array handling
- ✅ Request normalization
- ✅ Database row formatting
- ✅ Real-world scenarios

## Migration Guide

### For Existing Code

If you have existing code that uses snake_case:

1. **Database queries**: No changes needed (still use snake_case)
2. **Route handlers**: Update to use camelCase from db responses
3. **API responses**: Already converted automatically

### Example Migration

**Before:**
```javascript
router.get('/:id', async (req, res) => {
  const instance = await db.getInstanceById(req.params.id);
  
  // Accessing with snake_case
  if (instance.user_id !== req.user.user_id) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(instance);  // Returns snake_case
});
```

**After:**
```javascript
router.get('/:id', async (req, res) => {
  const instance = await db.getInstanceById(req.params.id);
  
  // Accessing with camelCase
  if (instance.userId !== req.user.user_id) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(instance);  // Returns camelCase automatically
});
```

## Best Practices

1. **Always use camelCase in JavaScript code** (routes, services, utilities)
2. **Always use snake_case in SQL queries** (database layer)
3. **Let the utilities handle conversion** (don't manually convert)
4. **Trust the validation middleware** (it normalizes input)
5. **Trust the database layer** (it formats output)

## Benefits

✅ **Consistent API**: All responses use JavaScript-standard camelCase
✅ **Database Standard**: PostgreSQL best practice (snake_case)
✅ **Backward Compatible**: Accepts both formats in requests
✅ **Type Safe**: Works well with TypeScript definitions
✅ **Maintainable**: Single source of truth for field mappings
✅ **Tested**: Comprehensive test coverage

## Common Pitfalls

❌ **Don't**: Manually check for both naming conventions
```javascript
// Bad
const port = req.body.localPort || req.body.local_port;
```

✅ **Do**: Trust the validation middleware
```javascript
// Good
const { local_port } = req.body;  // Already normalized
```

❌ **Don't**: Convert manually in routes
```javascript
// Bad
const response = {
  user_id: instance.userId,
  local_port: instance.localPort
};
```

✅ **Do**: Return the database result directly
```javascript
// Good
res.json(instance);  // Already in camelCase from database
```

## Future Enhancements

- [ ] Add TypeScript interfaces for all models
- [ ] Generate Swagger docs with both naming conventions
- [ ] Add runtime validation for field naming
- [ ] Create ESLint rule to enforce camelCase in code

## Support

For questions or issues related to naming conventions:
1. Check this documentation
2. Review the tests in `tests/naming-convention.test.js`
3. Examine `utils/naming-convention.js` source code

# Backend API Specification for Managed Tunnels

This document specifies the backend API endpoints required to support the new managed tunnel workflow.

## API Endpoints Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | User authentication |
| `/api/user/instances` | GET | List user's tunnel instances |
| `/api/user/instances/{id}/connect` | POST | Get connection info for instance |
| `/api/internal/validate-key` | POST | Validate tunnel tokens (existing) |

---

## 1. User Authentication

### `POST /api/auth/login`

Authenticate user with email/password and return JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "user_password"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_123abc"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "invalid_credentials",
  "message": "Invalid email or password"
}
```

**Implementation Notes:**
- Verify email and password against your user database
- Generate JWT token with expiration (e.g., 30 days)
- Include `user_id` in JWT claims for subsequent requests
- Use bcrypt or similar for password hashing

---

## 2. List User Instances

### `GET /api/user/instances`

List all tunnel instances belonging to the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "instances": [
    {
      "id": "inst_abc123",
      "name": "my-dev-server",
      "local_port": 8080,
      "server_region": "us-east-1",
      "status": "inactive",
      "public_url": null
    },
    {
      "id": "inst_def456",
      "name": "my-api",
      "local_port": 3000,
      "server_region": "eu-west-1",
      "status": "active",
      "public_url": "eu-west-1.tunnels.example.com:15234"
    }
  ]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

**Fields:**
- `id`: Unique instance identifier
- `name`: User-friendly name (unique per user)
- `local_port`: Port on user's localhost to forward
- `server_region`: Bore server region
- `status`: `"active"` (tunnel running) or `"inactive"`
- `public_url`: Public URL when active, null when inactive

---

## 3. Connect to Instance

### `POST /api/user/instances/{instance_id}/connect`

Get connection information to start a tunnel for a specific instance.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "instance_id": "inst_abc123",
  "tunnel_token": "temp_token_xyz789",
  "server_host": "us-east-1.tunnels.example.com",
  "local_port": 8080,
  "remote_port": 15234,
  "ttl": 3600
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

**Response (404 Not Found):**
```json
{
  "error": "instance_not_found",
  "message": "Instance not found or does not belong to you"
}
```

**Fields:**
- `tunnel_token`: Temporary token for bore server authentication (expires after `ttl`)
- `server_host`: Bore server hostname to connect to
- `local_port`: Local port to forward
- `remote_port`: Pre-assigned remote port on bore server
- `ttl`: Token validity in seconds

**Implementation Notes:**
1. Verify user owns the instance
2. Generate temporary token (expires in `ttl` seconds)
3. Assign or reserve a remote port on the bore server
4. Store mapping: `tunnel_token` → `{user_id, instance_id, remote_port}`
5. Update instance status to `"active"`
6. Return connection details

---

## 4. Validate Tunnel Token (Existing)

### `POST /api/internal/validate-key`

This is the existing endpoint used by bore servers to validate API keys. Now it must also support temporary tunnel tokens.

**Request:**
```json
{
  "api_key": "temp_token_xyz789",
  "server_id": "us-east-1",
  "requested_port": 15234
}
```

**Response (200 OK):**
```json
{
  "allowed": true,
  "user_id": "user_123abc",
  "instance_id": "inst_abc123",
  "max_concurrent_tunnels": 5,
  "max_bandwidth_mbps": 100
}
```

**Response (403 Forbidden):**
```json
{
  "allowed": false,
  "reason": "invalid_token"
}
```

**Implementation Notes:**
- Check if `api_key` is a legacy API key OR a temporary tunnel token
- For tunnel tokens:
  - Verify token hasn't expired
  - Verify `requested_port` matches the pre-assigned port
  - Return associated `user_id` and `instance_id`
- For legacy API keys:
  - Use existing validation logic

---

## Database Schema Additions

### `instances` table
```sql
CREATE TABLE instances (
  id VARCHAR(255) PRIMARY KEY,          -- e.g., "inst_abc123"
  user_id VARCHAR(255) NOT NULL,        -- Foreign key to users table
  name VARCHAR(255) NOT NULL,           -- User-friendly name
  local_port INT NOT NULL,              -- Port on user's localhost
  server_region VARCHAR(100),           -- e.g., "us-east-1"
  status VARCHAR(50) DEFAULT 'inactive', -- "active" or "inactive"
  public_url VARCHAR(255),              -- Public URL when active
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, name)                 -- Name must be unique per user
);
```

### `tunnel_tokens` table
```sql
CREATE TABLE tunnel_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  server_host VARCHAR(255) NOT NULL,
  remote_port INT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);
```

---

## Web Dashboard Requirements

The web dashboard should allow users to:

1. **View Instances**: List all tunnel instances
2. **Create Instance**: Form with fields:
   - Name (required)
   - Local Port (required)
   - Server Region (dropdown)
3. **Edit Instance**: Update name, local port, or region
4. **Delete Instance**: Remove instance (only if inactive)
5. **View Status**: See if instance is active/inactive
6. **View Public URL**: Display public URL when active

---

## Security Considerations

1. **JWT Tokens**: 
   - Use strong secret key
   - Include expiration claim
   - Validate on every request

2. **Tunnel Tokens**:
   - Generate cryptographically secure random tokens
   - Short TTL (e.g., 1 hour)
   - One-time use recommended
   - Clean up expired tokens regularly

3. **Rate Limiting**:
   - Limit login attempts
   - Limit instance creation
   - Limit connection requests

4. **Input Validation**:
   - Validate port ranges (1024-65535)
   - Sanitize instance names
   - Validate region names

---

## Example Implementation (Node.js/Express)

```javascript
// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Find user
  const user = await db.users.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  // Generate JWT
  const token = jwt.sign(
    { user_id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  res.json({ token, user_id: user.id });
});

// List instances endpoint
app.get('/api/user/instances', authenticateJWT, async (req, res) => {
  const instances = await db.instances.find({ user_id: req.user.user_id });
  res.json({ instances });
});

// Connect instance endpoint
app.post('/api/user/instances/:id/connect', authenticateJWT, async (req, res) => {
  const instance = await db.instances.findOne({
    id: req.params.id,
    user_id: req.user.user_id
  });
  
  if (!instance) {
    return res.status(404).json({ error: 'instance_not_found' });
  }
  
  // Generate temporary token
  const tunnel_token = generateSecureToken();
  const remote_port = await assignPort(instance.server_region);
  const ttl = 3600;
  
  // Store token
  await db.tunnel_tokens.insert({
    token: tunnel_token,
    user_id: req.user.user_id,
    instance_id: instance.id,
    server_host: `${instance.server_region}.tunnels.example.com`,
    remote_port,
    expires_at: new Date(Date.now() + ttl * 1000)
  });
  
  // Update instance status
  await db.instances.update(
    { id: instance.id },
    { status: 'active', public_url: `${instance.server_region}.tunnels.example.com:${remote_port}` }
  );
  
  res.json({
    instance_id: instance.id,
    tunnel_token,
    server_host: `${instance.server_region}.tunnels.example.com`,
    local_port: instance.local_port,
    remote_port,
    ttl
  });
});
```

---

## Testing Checklist

- [ ] Login with valid credentials returns token
- [ ] Login with invalid credentials returns 401
- [ ] List instances requires authentication
- [ ] List instances returns only user's instances
- [ ] Connect to instance generates valid tunnel token
- [ ] Connect to non-existent instance returns 404
- [ ] Validate-key accepts tunnel tokens
- [ ] Validate-key rejects expired tokens
- [ ] Validate-key still works with legacy API keys
- [ ] Instance status updates to active when connected
- [ ] Public URL is assigned when instance becomes active

---

## Migration Notes

This new system is **backwards compatible**. Users can still use:

```bash
bore 8080 --to server.com --secret sk_live_key
```

The `/api/internal/validate-key` endpoint must support both:
1. Legacy API keys (e.g., `sk_live_...`)
2. New temporary tunnel tokens

Detect by checking if the key starts with `sk_` for legacy mode.

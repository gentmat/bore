# New Managed Tunnel Architecture

## Overview

This document describes the new architecture where users manage tunnels through a web dashboard and the CLI client simply connects to pre-configured instances.

## User Journey

### 1. Web Dashboard Registration
- User signs up at https://dashboard.yourservice.com
- Creates an account with email/password
- Gets authenticated

### 2. Create Tunnel Instances
In the web dashboard, user creates tunnel instances:

```
Instance Name: My Dev Server
Local Port: 8080
Region: us-east-1
Status: Inactive
```

Each instance gets a unique ID (e.g., `inst_abc123`)

### 3. CLI Authentication
```bash
bore login
# Prompts for email/password
# Stores auth token in ~/.bore/credentials.json
```

### 4. Start a Tunnel
```bash
bore start my-dev-server
# Or use instance ID: bore start inst_abc123

# Output (minimal):
# ✓ Connected to "My Dev Server"
# ✓ Forwarding localhost:8080
```

### 5. List Instances
```bash
bore list

# Output:
# Available instances:
#   • my-dev-server (inst_abc123) - Active
#   • my-api (inst_def456) - Inactive
```

### 6. Stop a Tunnel
```bash
bore stop
# Disconnects current tunnel
```

## Backend API Changes

### New Endpoints

#### 1. User Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "hashedpassword"
}

Response:
{
  "token": "jwt_token_here",
  "user_id": "user_123"
}
```

#### 2. List User Instances
```http
GET /api/user/instances
Authorization: Bearer jwt_token_here

Response:
{
  "instances": [
    {
      "id": "inst_abc123",
      "name": "my-dev-server",
      "local_port": 8080,
      "server_region": "us-east-1",
      "status": "inactive",
      "public_url": null
    }
  ]
}
```

#### 3. Get Instance Connection Info
```http
POST /api/user/instances/{instance_id}/connect
Authorization: Bearer jwt_token_here

Response:
{
  "instance_id": "inst_abc123",
  "tunnel_token": "temp_token_for_bore_server",
  "server_host": "us-east-1.tunnels.yourservice.com",
  "local_port": 8080,
  "remote_port": 15234,
  "ttl": 3600
}
```

#### 4. Existing Bore Server Validation
```http
POST /api/internal/validate-key
Content-Type: application/json

{
  "api_key": "temp_token_for_bore_server",
  "server_id": "us-east-1",
  "requested_port": 15234
}

Response:
{
  "allowed": true,
  "user_id": "user_123",
  "instance_id": "inst_abc123",
  "max_concurrent_tunnels": 5
}
```

## Client Architecture Changes

### New File Structure
```
bore-client/
├── src/
│   ├── main.rs           # CLI commands (login, start, stop, list)
│   ├── client.rs         # Tunnel connection logic (existing)
│   ├── auth.rs           # Authentication & token management (NEW)
│   ├── config.rs         # Local config file handling (NEW)
│   └── api_client.rs     # Backend API client (NEW)
└── Cargo.toml
```

### Config File Location
`~/.bore/credentials.json`
```json
{
  "api_endpoint": "https://api.yourservice.com",
  "auth_token": "jwt_token_here",
  "user_id": "user_123"
}
```

## CLI Commands

### `bore login`
- Prompts for email/password
- Calls `/api/auth/login`
- Stores JWT token in `~/.bore/credentials.json`

### `bore logout`
- Removes credentials file

### `bore list`
- Reads token from credentials file
- Calls `/api/user/instances`
- Displays user's instances

### `bore start <instance-name-or-id>`
- Reads token from credentials file
- Calls `/api/user/instances` to find instance by name/id
- Calls `/api/user/instances/{id}/connect` to get connection details
- Connects to bore server using temporary token
- Starts tunnel silently (no public URL shown in CLI)

### `bore stop`
- Terminates current tunnel connection

## Security Considerations

1. **JWT Token Storage**: Store in `~/.bore/credentials.json` with 600 permissions
2. **Temporary Tunnel Tokens**: The backend generates short-lived tokens for bore server authentication
3. **No Secrets in CLI**: Users never see or manage API keys directly
4. **Web Dashboard**: All tunnel management happens in the secure web interface

## Migration Path

Users with existing CLI workflows can still use:
```bash
bore 8080 --to server.com --secret sk_live_key
```

But new users will use the managed approach:
```bash
bore login
bore start my-instance
```

## Benefits

1. **Better UX**: Users don't need to remember server addresses or manage API keys
2. **Centralized Management**: All tunnels visible and manageable from web dashboard
3. **Analytics**: Backend can track tunnel usage per instance
4. **Access Control**: Easy to revoke access by deactivating instances in dashboard
5. **Multi-Region**: Backend can assign optimal server region automatically

## Implementation Priority

1. ✅ Design architecture (this document)
2. Backend API endpoints for instances
3. Client authentication module
4. Client API communication
5. Update CLI commands
6. Web dashboard for instance management
7. Documentation updates

# Bore API Documentation

Complete REST API documentation for the Bore TCP tunneling solution.

## 🎯 Overview

The Bore API provides comprehensive management capabilities for TCP tunnels, including:

- **User Authentication**: JWT-based authentication with role-based access
- **Instance Management**: Create, monitor, and manage tunnel instances
- **Server Management**: Coordinate multiple bore-servers
- **Real-time Updates**: WebSocket/SSE for live status updates
- **Metrics & Monitoring**: Performance and operational metrics
- **Administrative Functions**: System administration and configuration

## 📚 Table of Contents

- [Authentication](#-authentication)
- [API Endpoints](#-api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Instances](#instances-endpoints)
  - [Servers](#servers-endpoints)
  - [Users](#users-endpoints)
  - [Metrics](#metrics-endpoints)
  - [WebSocket](#websocket-connections)
- [Error Handling](#-error-handling)
- [Rate Limiting](#-rate-limiting)
- [Examples](#-examples)

## 🔐 Authentication

### Authentication Methods

#### 1. JWT Token Authentication (Recommended)

```http
Authorization: Bearer <jwt_token>
```

#### 2. API Key Authentication (for bore-servers)

```http
X-API-Key: <api_key>
```

#### 3. Internal API Key (for service-to-service)

```http
X-Internal-API-Key: <internal_api_key>
```

### Getting Authentication Tokens

#### Register New User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "api_key": "sk_live_1234567890abcdef",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-01T12:00:00Z"
  },
  "expires_in": 3600
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "refresh_token_here"
}
```

## 🛠 API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "string (required, email format)",
  "password": "string (required, min 8 chars)",
  "name": "string (required, max 100 chars)"
}
```

**Response (201 Created):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "api_key": "sk_live_1234567890abcdef",
  "role": "user",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Login User
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "api_key": "sk_live_1234567890abcdef",
  "role": "user",
  "created_at": "2024-01-01T00:00:00Z",
  "last_login": "2024-01-01T12:00:00Z",
  "stats": {
    "total_instances": 5,
    "active_instances": 2,
    "total_bandwidth": 1048576
  }
}
```

#### Update User Profile
```http
PUT /api/v1/auth/profile
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "string (optional)",
  "current_password": "string (required for password change)",
  "new_password": "string (optional)"
}
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <jwt_token>
```

### Instances Endpoints

#### List Instances
```http
GET /api/v1/instances
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`online`, `offline`, `error`)
- `server_id` (optional): Filter by server ID
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `sort` (optional): Sort field (`created_at`, `name`, `status`)
- `order` (optional): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "instances": [
    {
      "id": "inst_123",
      "name": "my-web-app",
      "local_port": 8080,
      "remote_port": 12345,
      "server_id": "server_1",
      "status": "online",
      "tunnel_connected": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z",
      "stats": {
        "bytes_sent": 1048576,
        "bytes_received": 2097152,
        "connections": 42,
        "uptime": 3600
      }
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### Create Instance
```http
POST /api/v1/instances
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "string (required, max 100 chars)",
  "local_port": "number (required, 1024-65535)",
  "server_id": "string (optional, auto-assigned if not provided)",
  "region": "string (optional)",
  "protocol": "string (optional, default: tcp)",
  "max_connections": "number (optional, default: 100)"
}
```

**Response (201 Created):**
```json
{
  "id": "inst_123",
  "name": "my-web-app",
  "local_port": 8080,
  "remote_port": 12345,
  "server_id": "server_1",
  "status": "starting",
  "tunnel_connected": false,
  "created_at": "2024-01-01T00:00:00Z",
  "connection_string": "bore.example.com:12345"
}
```

#### Get Instance
```http
GET /api/v1/instances/{instance_id}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "inst_123",
  "name": "my-web-app",
  "local_port": 8080,
  "remote_port": 12345,
  "server_id": "server_1",
  "status": "online",
  "tunnel_connected": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z",
  "connection_string": "bore.example.com:12345",
  "stats": {
    "bytes_sent": 1048576,
    "bytes_received": 2097152,
    "connections": 42,
    "uptime": 3600,
    "avg_response_time": 25
  },
  "server_info": {
    "id": "server_1",
    "name": "US-East Server",
    "region": "us-east",
    "capacity": 100,
    "active_instances": 45
  }
}
```

#### Update Instance
```http
PUT /api/v1/instances/{instance_id}
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "string (optional)",
  "max_connections": "number (optional)",
  "status": "string (optional, for server updates)"
}
```

#### Update Instance Status
```http
PUT /api/v1/instances/{instance_id}/status
Authorization: Bearer <jwt_token> or X-Internal-API-Key
```

**Request Body:**
```json
{
  "status": "string (required: online, offline, error)",
  "tunnel_connected": "boolean (optional)",
  "last_heartbeat": "string (optional, ISO 8601)"
}
```

#### Delete Instance
```http
DELETE /api/v1/instances/{instance_id}
Authorization: Bearer <jwt_token>
```

**Response (204 No Content)**

#### Get Instance Logs
```http
GET /api/v1/instances/{instance_id}/logs
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of log entries (default: 100)
- `level` (optional): Log level filter (`error`, `warn`, `info`, `debug`)
- `since` (optional): ISO 8601 timestamp for start time

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "level": "info",
      "message": "Instance started successfully",
      "metadata": {
        "port": 12345,
        "server": "server_1"
      }
    }
  ],
  "total": 50
}
```

### Servers Endpoints

#### List Servers
```http
GET /api/v1/servers
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "servers": [
    {
      "id": "server_1",
      "name": "US-East Server",
      "region": "us-east",
      "host": "bore-us-east.example.com",
      "port": 7835,
      "status": "online",
      "capacity": 100,
      "active_instances": 45,
      "load_average": 0.45,
      "last_heartbeat": "2024-01-01T12:00:00Z",
      "version": "0.6.0",
      "uptime": 86400
    }
  ]
}
```

#### Get Server
```http
GET /api/v1/servers/{server_id}
Authorization: Bearer <jwt_token>
```

#### Register Server
```http
POST /api/v1/servers/register
X-Internal-API-Key: <internal_api_key>
```

**Request Body:**
```json
{
  "id": "string (required)",
  "name": "string (required)",
  "region": "string (required)",
  "host": "string (required)",
  "port": "number (required)",
  "capacity": "number (required)",
  "version": "string (required)"
}
```

#### Server Heartbeat
```http
POST /api/v1/servers/{server_id}/heartbeat
X-Internal-API-Key: <internal_api_key>
```

**Request Body:**
```json
{
  "status": "string (required)",
  "active_instances": "number (required)",
  "load_average": "number (optional)",
  "memory_usage": "number (optional)",
  "cpu_usage": "number (optional)"
}
```

### Users Endpoints (Admin Only)

#### List Users
```http
GET /api/v1/admin/users
Authorization: Bearer <admin_jwt_token>
```

#### Get User
```http
GET /api/v1/admin/users/{user_id}
Authorization: Bearer <admin_jwt_token>
```

#### Update User
```http
PUT /api/v1/admin/users/{user_id}
Authorization: Bearer <admin_jwt_token>
```

#### Delete User
```http
DELETE /api/v1/admin/users/{user_id}
Authorization: Bearer <admin_jwt_token>
```

### Metrics Endpoints

#### Get System Metrics
```http
GET /api/v1/metrics/system
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "tunnels": {
    "total": 150,
    "active": 125,
    "offline": 25
  },
  "servers": {
    "total": 5,
    "online": 5,
    "offline": 0
  },
  "users": {
    "total": 1000,
    "active": 250
  },
  "performance": {
    "avg_response_time": 25,
    "throughput_mbps": 150.5,
    "error_rate": 0.01
  },
  "resources": {
    "cpu_usage": 45.2,
    "memory_usage": 68.7,
    "disk_usage": 23.1
  }
}
```

#### Get User Metrics
```http
GET /api/v1/metrics/user
Authorization: Bearer <jwt_token>
```

#### Prometheus Metrics
```http
GET /metrics
```

Returns Prometheus-formatted metrics for monitoring systems.

### WebSocket Connections

#### Real-time Instance Updates
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws/instances');

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your_jwt_token'
}));

// Subscribe to instance updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'instances',
  instance_id: 'inst_123' // optional for specific instance
}));

// Receive updates
ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Instance update:', data);
};
```

**Message Format:**
```json
{
  "type": "instance_update",
  "instance": {
    "id": "inst_123",
    "status": "online",
    "tunnel_connected": true,
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

#### Server-Sent Events (SSE)
```http
GET /api/v1/events/instances
Authorization: Bearer <jwt_token>
Accept: text/event-stream
```

**Response:**
```
data: {"type":"instance_update","instance":{"id":"inst_123","status":"online"}}
data: {"type":"server_update","server":{"id":"server_1","load_average":0.45}}
```

## ❌ Error Handling

### Error Response Format

All errors return a consistent JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details",
      "request_id": "req_123456789"
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "password": "Password must be at least 8 characters"
      }
    }
  }
}
```

## 🚦 Rate Limiting

### Rate Limiting Rules

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 10 requests | 15 minutes |
| API requests | 100 requests | 15 minutes |
| Instance creation | 5 requests | 1 hour |
| Admin endpoints | 50 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": 900,
      "retry_after": 300
    }
  }
}
```

## 📝 Examples

### Example 1: Complete Tunnel Creation Flow

```bash
# 1. Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecureDev123!",
    "name": "Developer"
  }'

# 2. Login
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecureDev123!"
  }' | jq -r '.token')

# 3. Create instance
INSTANCE=$(curl -X POST http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "development-server",
    "local_port": 3000
  }' | jq -r '.')

echo "Created instance: $INSTANCE"

# 4. Check status
INSTANCE_ID=$(echo $INSTANCE | jq -r '.id')
curl -X GET "http://localhost:3000/api/v1/instances/$INSTANCE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Example 2: WebSocket Real-time Updates

```javascript
class BoreClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.ws = null;
    this.subscriptions = new Map();
  }

  connect() {
    this.ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/ws/instances`);

    this.ws.onopen = () => {
      // Authenticate
      this.send({
        type: 'auth',
        token: this.token
      });
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  subscribe(instanceId, callback) {
    this.subscriptions.set(instanceId, callback);
    this.send({
      type: 'subscribe',
      channel: 'instances',
      instance_id: instanceId
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(data) {
    if (data.type === 'instance_update') {
      const callback = this.subscriptions.get(data.instance.id);
      if (callback) {
        callback(data.instance);
      }
    }
  }
}

// Usage
const client = new BoreClient('http://localhost:3000', 'your_jwt_token');
client.connect();

client.subscribe('inst_123', (instance) => {
  console.log('Instance updated:', instance.status);
});
```

### Example 3: Server Registration (bore-server)

```bash
# Register server
curl -X POST http://localhost:3000/api/v1/servers/register \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: your_internal_key" \
  -d '{
    "id": "server-prod-1",
    "name": "Production Server 1",
    "region": "us-west",
    "host": "bore-server-1.example.com",
    "port": 7835,
    "capacity": 200,
    "version": "0.6.0"
  }'

# Send heartbeat
curl -X POST http://localhost:3000/api/v1/servers/server-prod-1/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: your_internal_key" \
  -d '{
    "status": "online",
    "active_instances": 45,
    "load_average": 0.32,
    "memory_usage": 0.67,
    "cpu_usage": 0.45
  }'
```

### Example 4: Monitoring and Metrics

```bash
# Get system metrics
curl -X GET http://localhost:3000/api/v1/metrics/system \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get Prometheus metrics
curl -X GET http://localhost:3000/metrics

# Get instance logs
curl -X GET "http://localhost:3000/api/v1/instances/inst_123/logs?level=error&limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## 📞 Support

For API-related questions:

1. Check this documentation for detailed endpoint information
2. Review error responses for debugging issues
3. Consult the main [README.md](../README.md) for general project information
4. Open an issue on GitHub with API details and request/response examples

Happy tunneling! 🚀✨
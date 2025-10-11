# bore-server

Server component for [bore](https://github.com/ekzhang/bore) - a simple TCP tunnel.

## Installation

Install the server using cargo:

```bash
cargo install bore-server
```

## Usage

Run a bore server:

```bash
# Basic server (no authentication)
bore-server

# With port range restriction
bore-server --min-port 1024 --max-port 65535

# With backend API authentication
bore-server --backend-url https://api.yourdomain.com

# With legacy shared secret (deprecated)
bore-server --secret your_shared_secret

# Custom bind address
bore-server --bind-addr 0.0.0.0
```

### Environment Variables

- `BORE_MIN_PORT` - Minimum allowed port (default: 1024)
- `BORE_MAX_PORT` - Maximum allowed port (default: 65535)
- `BORE_SECRET` - Shared secret for authentication (deprecated)
- `BORE_BACKEND_URL` - Backend API URL for authentication
- `BORE_SERVER_ID` - Server ID for multi-server deployments

## Backend API Integration

The server can integrate with a backend API for user authentication and usage tracking. See the main repository documentation for API specifications.

## Learn More

See the main [bore repository](https://github.com/ekzhang/bore) for more information.

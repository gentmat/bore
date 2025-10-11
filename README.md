# bore – authenticated TCP tunnels for your users

[![Build status](https://img.shields.io/github/actions/workflow/status/ekzhang/bore/ci.yml)](https://github.com/ekzhang/bore/actions)

This fork of **bore** turns the original single-secret tunnel into a **SaaS-ready platform** with:

- Individual API keys per user
- Backend validation for trials and paid plans
- Usage tracking and concurrent tunnel limits
- Developer-friendly Rust code and self-hostable binaries
- **Separate client and server packages** for easy installation

If you want to expose services running on your laptop to the public internet (web apps, APIs, game servers, IoT devices), bore makes it fast and secure.

![Architecture diagram showing client, bore server, and backend API](docs/assets/diagram.png)

---

## Features

- **Modern Rust codebase** built on async Tokio
- **Authenticated tunnels** with API-key-based backend integration
- **Per-user limits** (tunnels, bandwidth, trials) enforced server-side
- **Self-hostable** binary for complete control
- **Cross-platform clients** (Windows, macOS, Linux)
- **Modular architecture** with separate client and server packages
- **Documentation included:** `SERVER_GUIDE.md`, `CLIENT_GUIDE.md`, `AUTHENTICATION.md`

---

## Installation

### Install Client Only

```bash
cargo install bore-client
```

### Install Server Only

```bash
cargo install bore-server
```

### Install from Source

```bash
git clone https://github.com/yourusername/bore.git
cd bore

# Build entire workspace
cargo build --release --workspace

# Or build individual packages
cargo build --release -p bore-client
cargo build --release -p bore-server

# Binaries will be at:
# - target/release/bore (client)
# - target/release/bore-server (server)
```

---

## Quick Start

> For detailed step-by-step instructions, see `SERVER_GUIDE.md` and `CLIENT_GUIDE.md`.

### 1. Run the Server

```bash
# With backend authentication (recommended)
bore-server \
  --backend-url https://api.yourservice.com \
  --server-id us-east-1 \
  --min-port 10000 \
  --max-port 20000

# Development mode (no backend, allows all clients)
bore-server
```

### 2. Connect a Client

```bash
# Expose localhost:8000 using your API key
bore 8000 --to tunnel.yourservice.com --secret sk_live_your_api_key

# Output:
# ✓ Tunnel established!
#   Public URL: tunnel.yourservice.com:15234
#   Forwarding to: localhost:8000
```

Share the public URL with anyone. Each user can run multiple tunnels (within their plan limits).

---

## Project Structure

This is a Cargo workspace with three packages:

- **`bore-shared`** - Shared library with protocol definitions and authentication
- **`bore-client`** - Client binary for forwarding local ports
- **`bore-server`** - Server binary for accepting tunnel connections

Each package can be built and installed independently:

```bash
# Install just the client
cargo install --path bore-client

# Install just the server
cargo install --path bore-server

# Or from crates.io (after publishing)
cargo install bore-client
cargo install bore-server
```

---

## Authentication & Backend Integration

The server verifies every tunnel request against your backend API.

1. Client sends `Authenticate(<API_KEY>)`
2. Server calls `POST /api/internal/validate-key`
3. Backend decides if the user is allowed and returns limits
4. Server logs session start/end for analytics and billing

Detailed flow, request/response formats, and mock backend examples are in `AUTHENTICATION.md`.

---

## Documentation

- **[INSTALLATION.md](INSTALLATION.md)** – Complete installation guide for all platforms
- **[MIGRATION.md](MIGRATION.md)** – Migration guide from old single-binary setup
- `SERVER_GUIDE.md` – Deploying and operating bore servers
- `CLIENT_GUIDE.md` – Installing and using the bore CLI
- `AUTHENTICATION.md` – Backend API contract and tunnel lifecycle
- `saas-architecture.md` – Complete SaaS architecture blueprint
- `INTEGRATION_SUMMARY.md` – Quick overview & next steps

---

## Development

```bash
# Format & lint entire workspace
cargo fmt --all
cargo clippy --workspace --all-targets --all-features

# Run tests
cargo test --workspace

# Build specific packages
cargo build -p bore-client
cargo build -p bore-server
cargo build -p bore-shared
```

---

## Publishing Packages

Each package can be published independently to crates.io:

```bash
# Publish shared library first (required by client and server)
cd bore-shared && cargo publish

# Then publish client and server
cd ../bore-client && cargo publish
cd ../bore-server && cargo publish
```

---

## License & Credits

- This fork builds upon the original project by Eric Zhang ([@ekzhang1](https://twitter.com/ekzhang1)), licensed under MIT.
- Thanks to the Tokio team and the Rust community for the async ecosystem that powers bore.

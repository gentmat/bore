# Migration Guide

This guide helps you migrate from the old single-binary setup to the new workspace structure.

## What Changed?

The project has been restructured into a Cargo workspace with three packages:

- **`bore-shared`** - Shared library (protocol + auth)
- **`bore-client`** - Client binary (`bore`)
- **`bore-server`** - Server binary (`bore-server`)

## For Users

### Old Way (Single Binary)

```bash
# Old installation
cargo install bore-cli

# Old usage
bore local 3000 --to server.com    # Client
bore server                         # Server
```

### New Way (Separate Packages)

```bash
# New installation - install only what you need
cargo install bore-client          # For client users
cargo install bore-server          # For server operators

# New usage
bore 3000 --to server.com          # Client (simplified!)
bore local 3000 --to server.com    # Client (explicit command still works)
bore-server                         # Server (renamed binary)
```

### Key Changes

1. **Binary names changed:**
   - Client: `bore` (simplified from `bore local`)
   - Server: `bore-server` (was `bore server`)

2. **Client is simpler:**
   - Direct usage: `bore 3000 --to server.com`
   - No need for `local` subcommand (but still supported)

3. **Install only what you need:**
   - Client users: `cargo install bore-client`
   - Server operators: `cargo install bore-server`

## For Developers

### Old Structure

```
bore/
├── Cargo.toml (single package)
├── src/
│   ├── main.rs
│   ├── client.rs
│   ├── server.rs
│   ├── shared.rs
│   └── auth.rs
```

### New Structure

```
bore/
├── Cargo.toml (workspace)
├── bore-shared/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── protocol.rs (was shared.rs)
│       └── auth.rs
├── bore-client/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       └── client.rs
└── bore-server/
    ├── Cargo.toml
    └── src/
        ├── main.rs
        ├── server.rs
        └── backend.rs
```

### Import Changes

**Old imports:**
```rust
use bore_cli::client::Client;
use bore_cli::server::Server;
use bore_cli::shared::{ClientMessage, ServerMessage};
use bore_cli::auth::Authenticator;
```

**New imports:**
```rust
// In client package
use bore_shared::{ClientMessage, ServerMessage, Authenticator};
mod client;
use client::Client;

// In server package
use bore_shared::{ClientMessage, ServerMessage, Authenticator};
mod server;
use server::Server;
```

### Building

**Old way:**
```bash
cargo build --release
# Single binary: target/release/bore
```

**New way:**
```bash
# Build entire workspace
cargo build --release --workspace

# Or build specific packages
cargo build --release -p bore-client
cargo build --release -p bore-server
cargo build --release -p bore-shared

# Binaries:
# - target/release/bore (client)
# - target/release/bore-server (server)
```

### Running Tests

**Old way:**
```bash
cargo test
```

**New way:**
```bash
# Test entire workspace
cargo test --workspace

# Test specific package
cargo test -p bore-client
cargo test -p bore-server
cargo test -p bore-shared
```

## For CI/CD

### Old GitHub Actions

```yaml
- name: Build
  run: cargo build --release
  
- name: Upload binary
  uses: actions/upload-artifact@v3
  with:
    name: bore
    path: target/release/bore
```

### New GitHub Actions

```yaml
- name: Build workspace
  run: cargo build --release --workspace
  
- name: Upload client binary
  uses: actions/upload-artifact@v3
  with:
    name: bore-client
    path: target/release/bore
    
- name: Upload server binary
  uses: actions/upload-artifact@v3
  with:
    name: bore-server
    path: target/release/bore-server
```

## Benefits of New Structure

1. **Smaller installations** - Users install only what they need
2. **Clearer separation** - Client and server code are independent
3. **Easier maintenance** - Changes to client don't affect server and vice versa
4. **Better documentation** - Each package has its own README
5. **Flexible deployment** - Deploy client and server separately

## Backward Compatibility

The client binary still supports the old command style:

```bash
# Both work:
bore local 3000 --to server.com    # Old style
bore 3000 --to server.com          # New simplified style
```

All environment variables and configuration options remain the same.

## Need Help?

- For client issues: See [CLIENT_GUIDE.md](CLIENT_GUIDE.md)
- For server issues: See [SERVER_GUIDE.md](SERVER_GUIDE.md)
- For installation: See [INSTALLATION.md](INSTALLATION.md)

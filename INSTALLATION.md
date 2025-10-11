# Installation Guide

This guide covers all installation methods for bore client and server.

## Quick Install (from crates.io)

Once published to crates.io, you can install with:

```bash
# Install client only
cargo install bore-client

# Install server only
cargo install bore-server

# Install both
cargo install bore-client bore-server
```

## Install from Source

### Prerequisites

- Rust 1.70+ (install from https://rustup.rs)
- Git

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/yourusername/bore.git
cd bore

# Build entire workspace
cargo build --release --workspace

# Binaries will be at:
# - target/release/bore (client)
# - target/release/bore-server (server)
```

### Install to System Path

#### Linux/macOS

```bash
# Install client
sudo cp target/release/bore /usr/local/bin/

# Install server
sudo cp target/release/bore-server /usr/local/bin/

# Or install to user directory (no sudo needed)
mkdir -p ~/.local/bin
cp target/release/bore ~/.local/bin/
cp target/release/bore-server ~/.local/bin/
# Make sure ~/.local/bin is in your PATH
```

#### Windows

```powershell
# Copy to a directory in your PATH, for example:
Copy-Item target\release\bore.exe C:\Windows\System32\
Copy-Item target\release\bore-server.exe C:\Windows\System32\

# Or add the target\release directory to your PATH
```

## Build Individual Packages

You can build only the package you need:

```bash
# Build only client
cargo build --release -p bore-client

# Build only server
cargo build --release -p bore-server

# Build only shared library (for development)
cargo build --release -p bore-shared
```

## Install Individual Packages from Source

```bash
# Install client from local source
cargo install --path bore-client

# Install server from local source
cargo install --path bore-server
```

This installs binaries to `~/.cargo/bin/` which should be in your PATH.

## Verify Installation

```bash
# Check client
bore --version
bore --help

# Check server
bore-server --version
bore-server --help
```

## Docker Installation

If you have Docker installed:

```bash
# Build Docker image with server
docker build -t bore-server .

# Run server
docker run -p 7835:7835 -p 10000-20000:10000-20000 bore-server \
  --min-port 10000 --max-port 20000
```

## Distribution-Specific Packages

### Arch Linux (AUR)

```bash
yay -S bore-client bore-server
# or
paru -S bore-client bore-server
```

### Homebrew (macOS/Linux)

```bash
brew install bore-client
brew install bore-server
```

### Debian/Ubuntu (.deb packages)

Download `.deb` packages from releases:

```bash
# Client
wget https://github.com/yourusername/bore/releases/download/v0.6.0/bore-client_0.6.0_amd64.deb
sudo dpkg -i bore-client_0.6.0_amd64.deb

# Server
wget https://github.com/yourusername/bore/releases/download/v0.6.0/bore-server_0.6.0_amd64.deb
sudo dpkg -i bore-server_0.6.0_amd64.deb
```

## Uninstall

```bash
# If installed with cargo install
cargo uninstall bore-client
cargo uninstall bore-server

# If copied to system path
sudo rm /usr/local/bin/bore
sudo rm /usr/local/bin/bore-server
```

## Next Steps

- **Client users**: See [CLIENT_GUIDE.md](CLIENT_GUIDE.md)
- **Server operators**: See [SERVER_GUIDE.md](SERVER_GUIDE.md)
- **Developers**: See [README.md](README.md) for development setup

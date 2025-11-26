#!/bin/bash
# Build bore client (Rust CLI)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Building Bore Client ==="

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    sudo pacman -S --needed --noconfirm rust
fi

cd "$PROJECT_ROOT"

echo ""
echo "Building bore-client..."
cargo build --release -p bore-client

echo ""
echo "Installing to /usr/local/bin..."
sudo cp target/release/bore /usr/local/bin/bore

echo ""
echo "✅ Bore client installed!"
echo ""
echo "Usage:"
echo "   bore local <LOCAL_PORT> --to <SERVER_HOST> --port <SERVER_PORT>"
echo ""
echo "Example:"
echo "   bore local 8080 --to localhost --port 7835"

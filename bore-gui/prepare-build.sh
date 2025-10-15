#!/bin/bash

# Prepare bore-client binary for bundling
set -e

echo "📦 Preparing bore-client binary for bundling..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BORE_CLIENT_DIR="$SCRIPT_DIR/../bore-client"
RESOURCES_DIR="$SCRIPT_DIR/src-tauri/resources"
PROJECT_ROOT="$SCRIPT_DIR/.."

# Create resources directory
mkdir -p "$RESOURCES_DIR"

# Build bore-client
echo "🔨 Building bore-client..."
cd "$BORE_CLIENT_DIR"
cargo build --release

# Copy binary to resources
echo "📋 Copying bore binary to resources..."
BORE_BINARY="$PROJECT_ROOT/target/release/bore"
if [ ! -f "$BORE_BINARY" ]; then
    echo "❌ Error: bore binary not found at $BORE_BINARY"
    echo "   Expected location: $BORE_BINARY"
    exit 1
fi

# Copy as bore-client for consistency with GUI naming
cp "$BORE_BINARY" "$RESOURCES_DIR/bore-client"
chmod +x "$RESOURCES_DIR/bore-client"

echo "✅ bore-client binary prepared successfully!"
echo "   Location: $RESOURCES_DIR/bore-client"

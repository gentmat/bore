#!/bin/bash

# Prepare resources for Bore GUI build
# This script ensures bore-client is built and available in resources

set -e

echo "=== Preparing Bore GUI Resources ==="

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$SCRIPT_DIR/src-tauri/resources"
BORE_CLIENT_DIR="$PROJECT_ROOT/bore-client"

echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo "Resources directory: $RESOURCES_DIR"

# Create resources directory if it doesn't exist
mkdir -p "$RESOURCES_DIR"

# Check if bore-client directory exists
if [ ! -d "$BORE_CLIENT_DIR" ]; then
    echo "❌ Error: bore-client directory not found at $BORE_CLIENT_DIR"
    echo "   Please ensure you're in the bore project root directory"
    exit 1
fi

# Build bore-client
echo "📦 Building bore-client..."
cd "$BORE_CLIENT_DIR"
cargo build --release

# Check for binary in workspace root target directory (Cargo workspace)
BORE_BINARY="$PROJECT_ROOT/target/release/bore"
if [ ! -f "$BORE_BINARY" ]; then
    # Fallback: check in bore-client local target
    BORE_BINARY="$BORE_CLIENT_DIR/target/release/bore"
    if [ ! -f "$BORE_BINARY" ]; then
        echo "❌ Error: Failed to build bore-client"
        echo "   Expected binary at: $PROJECT_ROOT/target/release/bore"
        echo "   or at: $BORE_CLIENT_DIR/target/release/bore"
        exit 1
    fi
fi

echo "✅ bore-client built successfully at: $BORE_BINARY"

# Copy to resources
echo "📋 Copying bore-client to resources..."
cp "$BORE_BINARY" "$RESOURCES_DIR/bore-client"
chmod +x "$RESOURCES_DIR/bore-client"

echo "✅ bore-client copied to $RESOURCES_DIR/bore-client"

# Verify
if [ -f "$RESOURCES_DIR/bore-client" ]; then
    SIZE=$(stat -c%s "$RESOURCES_DIR/bore-client" 2>/dev/null || stat -f%z "$RESOURCES_DIR/bore-client" 2>/dev/null || echo "unknown")
    echo "✅ Verification successful"
    echo "   File: $RESOURCES_DIR/bore-client"
    echo "   Size: $SIZE bytes"
    
    # Test execution
    if "$RESOURCES_DIR/bore-client" --version >/dev/null 2>&1; then
        echo "   Executable: Yes"
    else
        echo "   ⚠️  Warning: Binary exists but may not be executable"
    fi
else
    echo "❌ Error: Failed to copy bore-client"
    exit 1
fi

echo ""
echo "=== Resources prepared successfully! ==="
echo "You can now build the Bore GUI application:"
echo "  cd $SCRIPT_DIR"
echo "  npm install"
echo "  npm run tauri dev    # for development"
echo "  npm run tauri build  # for production"

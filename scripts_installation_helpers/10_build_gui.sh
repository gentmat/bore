#!/bin/bash
# Build bore GUI (Tauri desktop app)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GUI_DIR="$PROJECT_ROOT/bore-gui"

echo "=== Building Bore GUI ==="

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    sudo pacman -S --needed --noconfirm rust
fi

# Check for Node.js
if ! command -v npm &> /dev/null; then
    echo "Installing Node.js..."
    sudo pacman -S --needed --noconfirm nodejs npm
fi

# Install Tauri dependencies
echo ""
echo "Installing Tauri dependencies..."
sudo pacman -S --needed --noconfirm \
    webkit2gtk \
    base-devel \
    curl \
    wget \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg \
    libvips

cd "$GUI_DIR"

echo ""
echo "Installing npm dependencies..."
npm install

echo ""
echo "Fixing gdk-pixbuf for AppImage (Arch Linux workaround)..."
sudo mkdir -p /usr/lib/gdk-pixbuf-2.0/2.10.0/loaders
gdk-pixbuf-query-loaders 2>/dev/null | sudo tee /usr/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache > /dev/null
sudo touch /usr/lib/gdk-pixbuf-2.0/2.10.0/loaders/.placeholder

echo ""
echo "Building Tauri app..."
NO_STRIP=1 npm run tauri build

echo ""
echo "Renaming bundles..."
BUNDLE_DIR="$GUI_DIR/src-tauri/target/release/bundle"
mv "$BUNDLE_DIR/appimage/bore-tunnel"*.AppImage "$BUNDLE_DIR/appimage/bore-tunnel.AppImage" 2>/dev/null || true
mv "$BUNDLE_DIR/deb/bore-tunnel"*.deb "$BUNDLE_DIR/deb/bore-tunnel.deb" 2>/dev/null || true
mv "$BUNDLE_DIR/rpm/bore-tunnel"*.rpm "$BUNDLE_DIR/rpm/bore-tunnel.rpm" 2>/dev/null || true

echo ""
echo "✅ Bore GUI built!"
echo ""
echo "Packages:"
echo "   Binary:   $GUI_DIR/src-tauri/target/release/bore-gui"
echo "   AppImage: $BUNDLE_DIR/appimage/bore-tunnel.AppImage"
echo "   DEB:      $BUNDLE_DIR/deb/bore-tunnel.deb"
echo "   RPM:      $BUNDLE_DIR/rpm/bore-tunnel.rpm"
echo ""
echo "To install system-wide:"
echo "   sudo cp $GUI_DIR/src-tauri/target/release/bore-gui /usr/local/bin/"

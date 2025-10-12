#!/bin/bash

# Bore Tunnel - Automated Installer Build Script
# This script builds installers for your users

set -e

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║   Bore Tunnel - Building User Installers      ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the bore-gui directory"
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: Rust is not installed"
    echo "   Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf src-tauri/target/release/bundle
echo ""

# Build installers
echo "🚀 Building installers (this may take a few minutes)..."
echo ""
npm run tauri build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║            ✅ BUILD SUCCESSFUL!                ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
    echo "📦 Installers created:"
    echo ""
    
    # Create release directory
    mkdir -p release
    
    # Detect platform and copy files
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "🐧 Linux Installers:"
        
        # AppImage
        if [ -d "src-tauri/target/release/bundle/appimage" ]; then
            APPIMAGE=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" -type f | head -n 1)
            if [ -n "$APPIMAGE" ]; then
                cp "$APPIMAGE" release/bore-tunnel.AppImage
                chmod +x release/bore-tunnel.AppImage
                ls -lh release/bore-tunnel.AppImage | awk '{print "   AppImage:  " $9 " (" $5 ")"}'
            fi
        fi
        
        # DEB
        if [ -d "src-tauri/target/release/bundle/deb" ]; then
            DEB=$(find src-tauri/target/release/bundle/deb -name "*.deb" -type f | head -n 1)
            if [ -n "$DEB" ]; then
                cp "$DEB" release/bore-tunnel.deb
                ls -lh release/bore-tunnel.deb | awk '{print "   DEB:       " $9 " (" $5 ")"}'
            fi
        fi
        
        # RPM
        if [ -d "src-tauri/target/release/bundle/rpm" ]; then
            RPM=$(find src-tauri/target/release/bundle/rpm -name "*.rpm" -type f | head -n 1)
            if [ -n "$RPM" ]; then
                cp "$RPM" release/bore-tunnel.rpm
                ls -lh release/bore-tunnel.rpm | awk '{print "   RPM:       " $9 " (" $5 ")"}'
            fi
        fi
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍎 macOS Installers:"
        
        # DMG
        if [ -d "src-tauri/target/release/bundle/dmg" ]; then
            DMG=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" -type f | head -n 1)
            if [ -n "$DMG" ]; then
                cp "$DMG" release/bore-tunnel.dmg
                ls -lh release/bore-tunnel.dmg | awk '{print "   DMG:       " $9 " (" $5 ")"}'
            fi
        fi
        
        # App Bundle
        if [ -d "src-tauri/target/release/bundle/macos" ]; then
            APP=$(find src-tauri/target/release/bundle/macos -name "*.app" -type d | head -n 1)
            if [ -n "$APP" ]; then
                echo "   App:       $APP"
            fi
        fi
        
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "🪟 Windows Installers:"
        
        # NSIS
        if [ -d "src-tauri/target/release/bundle/nsis" ]; then
            NSIS=$(find src-tauri/target/release/bundle/nsis -name "*-setup.exe" -type f | head -n 1)
            if [ -n "$NSIS" ]; then
                cp "$NSIS" release/bore-tunnel-setup.exe
                ls -lh release/bore-tunnel-setup.exe | awk '{print "   Setup.exe: " $9 " (" $5 ")"}'
            fi
        fi
        
        # MSI
        if [ -d "src-tauri/target/release/bundle/msi" ]; then
            MSI=$(find src-tauri/target/release/bundle/msi -name "*.msi" -type f | head -n 1)
            if [ -n "$MSI" ]; then
                cp "$MSI" release/bore-tunnel.msi
                ls -lh release/bore-tunnel.msi | awk '{print "   MSI:       " $9 " (" $5 ")"}'
            fi
        fi
    fi
    
    echo ""
    echo "📁 Installers copied to: ./release/"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "👉 Next Steps:"
    echo "   1. Go to the 'release' folder"
    echo "   2. Copy the installer files"
    echo "   3. Share them with your users"
    echo "   4. Users just double-click to install!"
    echo ""
    echo "📝 Include USER_INSTALLATION_GUIDE.md with the files"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
else
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║              ❌ BUILD FAILED!                  ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
    echo "Check the error messages above for details."
    echo ""
    exit 1
fi

#!/bin/bash
# Uninstall code-server installed by Bore GUI

set -e

echo "=== Uninstalling code-server ==="
echo ""

# Check if code-server is running
if pgrep -x "code-server" > /dev/null; then
    echo "Stopping running code-server processes..."
    pkill -x "code-server" || true
    sleep 1
fi

# Remove symlink
if [ -L "$HOME/.local/bin/code-server" ]; then
    echo "Removing symlink: ~/.local/bin/code-server"
    rm -f "$HOME/.local/bin/code-server"
fi

# Remove installation directory
if [ -d "$HOME/.local/lib/code-server-"* ]; then
    echo "Removing installation: ~/.local/lib/code-server-*"
    rm -rf "$HOME/.local/lib/code-server-"*
fi

# Remove cache
if [ -d "$HOME/.cache/code-server" ]; then
    echo "Removing cache: ~/.cache/code-server"
    rm -rf "$HOME/.cache/code-server"
fi

# Remove config (optional - ask user)
if [ -d "$HOME/.config/code-server" ]; then
    echo ""
    read -p "Remove code-server config (~/.config/code-server)? (y/n): " REMOVE_CONFIG
    if [[ "$REMOVE_CONFIG" =~ ^[Yy]$ ]]; then
        rm -rf "$HOME/.config/code-server"
        echo "Config removed"
    else
        echo "Config kept"
    fi
fi

# Remove data directory (optional)
if [ -d "$HOME/.local/share/code-server" ]; then
    echo ""
    read -p "Remove code-server data (~/.local/share/code-server)? (y/n): " REMOVE_DATA
    if [[ "$REMOVE_DATA" =~ ^[Yy]$ ]]; then
        rm -rf "$HOME/.local/share/code-server"
        echo "Data removed"
    else
        echo "Data kept"
    fi
fi

echo ""
echo "✅ code-server uninstalled!"

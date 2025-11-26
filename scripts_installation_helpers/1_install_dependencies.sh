#!/bin/bash
# Install system dependencies for Bore on Arch Linux

set -e

echo "=== Installing System Dependencies ==="

# Docker and Docker Compose
sudo pacman -S --needed --noconfirm docker docker-compose git base-devel

# Enable Docker service
sudo systemctl enable --now docker

# Add current user to docker group
if ! groups | grep -q docker; then
    sudo usermod -aG docker $USER
    echo ""
    echo "⚠️  User added to docker group."
    echo "   Run: newgrp docker"
    echo "   Or logout and login again."
fi

echo ""
echo "✅ Dependencies installed successfully!"

#!/bin/bash
# Clean Docker resources and restart backend services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Cleaning Docker resources (containers, images, volumes) ==="

CONTAINERS=$(sudo docker ps -aq)
if [ -n "$CONTAINERS" ]; then
    echo "Stopping containers..."
    sudo docker stop $CONTAINERS
    echo "Removing containers..."
    sudo docker rm $CONTAINERS
else
    echo "No containers to stop/remove."
fi

IMAGES=$(sudo docker images -q)
if [ -n "$IMAGES" ]; then
    echo "Removing images..."
    sudo docker rmi $IMAGES
else
    echo "No images to remove."
fi

VOLUMES=$(sudo docker volume ls -q)
if [ -n "$VOLUMES" ]; then
    echo "Removing volumes..."
    sudo docker volume rm $VOLUMES
else
    echo "No volumes to remove."
fi

echo "=== Starting backend with Docker Compose ==="
cd "$BACKEND_DIR"

sudo docker compose up -d

echo "✅ Docker environment cleaned and backend started."

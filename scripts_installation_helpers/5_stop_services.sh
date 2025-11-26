#!/bin/bash
# Stop Bore services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Stopping Bore Services ==="

cd "$BACKEND_DIR"

sudo docker compose --profile tunnel --profile monitoring down

echo ""
echo "✅ All services stopped!"

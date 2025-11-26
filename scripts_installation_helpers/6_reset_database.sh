#!/bin/bash
# Reset database (WARNING: Deletes all data!)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Reset Database ==="
echo ""
echo "⚠️  WARNING: This will DELETE all data!"
echo ""
read -p "Are you sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

cd "$BACKEND_DIR"

echo ""
echo "Stopping services..."
sudo docker compose --profile tunnel --profile monitoring down

echo ""
echo "Removing volumes..."
sudo docker compose down -v

echo ""
echo "Starting fresh..."
sudo docker compose up -d

echo ""
echo "✅ Database reset complete!"
echo "   Run 4_verify_installation.sh to check status."

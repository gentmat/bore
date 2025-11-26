#!/bin/bash
# Start Bore services with Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Starting Bore Services ==="

cd "$BACKEND_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env not found. Run 2_setup_environment.sh first."
    exit 1
fi

# Load compose profiles
source .env

echo "Building and starting containers..."
echo ""

# Build images
sudo docker compose build

# Start services
sudo docker compose up -d

echo ""
echo "=== Waiting for services to be healthy ==="

# Wait for backend to be healthy (max 60 seconds)
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    echo "   Waiting for backend... ($ELAPSED/$TIMEOUT)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠️  Backend health check timed out. Check logs:"
    echo "   docker compose logs backend"
fi

echo ""
echo "=== Service Status ==="
sudo docker compose ps

echo ""
echo "✅ Services started!"
echo ""
echo "URLs:"
echo "   Backend API:  http://localhost:3000"
echo "   Login Page:   http://localhost:3000/login.html"

if grep -q "tunnel" .env 2>/dev/null; then
    echo "   Bore Server:  localhost:7835"
fi

if grep -q "monitoring" .env 2>/dev/null; then
    echo "   Grafana:      http://localhost:3001"
    echo "   Prometheus:   http://localhost:9090"
fi

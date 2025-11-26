#!/bin/bash
# Verify Bore installation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Verifying Bore Installation ==="
echo ""

cd "$BACKEND_DIR"

ERRORS=0

# Check Docker
echo "1. Docker Status"
if sudo docker info > /dev/null 2>&1; then
    echo "   ✅ Docker is running"
else
    echo "   ❌ Docker is not running"
    ERRORS=$((ERRORS + 1))
fi

# Check containers
echo ""
echo "2. Container Status"
sudo docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "   ❌ Containers not running"

# Check Backend API
echo ""
echo "3. Backend API Health"
if curl -s http://localhost:3000/health | grep -q "ok\|healthy"; then
    echo "   ✅ Backend is healthy"
else
    echo "   ❌ Backend health check failed"
    ERRORS=$((ERRORS + 1))
fi

# Check PostgreSQL
echo ""
echo "4. PostgreSQL Connection"
if sudo docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL is ready"
else
    echo "   ❌ PostgreSQL is not ready"
    ERRORS=$((ERRORS + 1))
fi

# Check Redis
echo ""
echo "5. Redis Connection"
if sudo docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "   ✅ Redis is ready"
else
    echo "   ❌ Redis is not ready"
    ERRORS=$((ERRORS + 1))
fi

# Check Bore Server (if enabled)
echo ""
echo "6. Bore Server"
if sudo docker compose ps bore-server 2>/dev/null | grep -q "running\|Up"; then
    echo "   ✅ Bore server is running"
else
    echo "   ⚠️  Bore server not running (may be disabled)"
fi

# Check monitoring (if enabled)
echo ""
echo "7. Monitoring Stack"
if sudo docker compose ps prometheus 2>/dev/null | grep -q "running\|Up"; then
    echo "   ✅ Prometheus is running"
else
    echo "   ⚠️  Prometheus not running (may be disabled)"
fi

if sudo docker compose ps grafana 2>/dev/null | grep -q "running\|Up"; then
    echo "   ✅ Grafana is running"
else
    echo "   ⚠️  Grafana not running (may be disabled)"
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All core services are running!"
    echo ""
    echo "Access points:"
    echo "   Dashboard: http://localhost:3000"
    echo "   API Docs:  http://localhost:3000/docs"
else
    echo "❌ $ERRORS error(s) found. Check logs:"
    echo "   docker compose logs -f"
fi

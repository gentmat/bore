#!/bin/bash
# View service logs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

cd "$BACKEND_DIR"

echo "=== Bore Logs ==="
echo ""
echo "Select service:"
echo "  1) All services"
echo "  2) Backend only"
echo "  3) Bore Server only"
echo "  4) PostgreSQL only"
echo "  5) Redis only"
echo "  6) Prometheus only"
echo "  7) Grafana only"
echo ""
read -p "Choice [1-7]: " CHOICE

case $CHOICE in
    1) sudo docker compose logs -f ;;
    2) sudo docker compose logs -f backend ;;
    3) sudo docker compose logs -f bore-server ;;
    4) sudo docker compose logs -f postgres ;;
    5) sudo docker compose logs -f redis ;;
    6) sudo docker compose logs -f prometheus ;;
    7) sudo docker compose logs -f grafana ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

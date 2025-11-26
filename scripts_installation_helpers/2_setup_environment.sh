#!/bin/bash
# Setup environment configuration for Bore

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Setting Up Environment ==="

cd "$BACKEND_DIR"

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
else
    echo "⚠️  .env already exists, skipping copy"
fi

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)

# Update .env with secure values
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
sed -i "s|^INTERNAL_API_KEY=.*|INTERNAL_API_KEY=$INTERNAL_API_KEY|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env

echo ""
echo "✅ Generated secure secrets in .env"
echo ""
echo "=== Admin Setup (Optional) ==="
read -p "Create admin user? (y/n): " CREATE_ADMIN

if [[ "$CREATE_ADMIN" =~ ^[Yy]$ ]]; then
    read -p "Admin email: " ADMIN_EMAIL
    read -sp "Admin password: " ADMIN_PASSWORD
    echo ""
    
    sed -i "s|^# ADMIN_EMAIL=.*|ADMIN_EMAIL=$ADMIN_EMAIL|" .env
    sed -i "s|^# ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" .env
    sed -i "s|^# ADMIN_AUTO_CREATE=.*|ADMIN_AUTO_CREATE=true|" .env
    
    # Also add if not commented
    if ! grep -q "^ADMIN_EMAIL=" .env; then
        echo "ADMIN_EMAIL=$ADMIN_EMAIL" >> .env
    fi
    if ! grep -q "^ADMIN_PASSWORD=" .env; then
        echo "ADMIN_PASSWORD=$ADMIN_PASSWORD" >> .env
    fi
    if ! grep -q "^ADMIN_AUTO_CREATE=" .env; then
        echo "ADMIN_AUTO_CREATE=true" >> .env
    fi
    
    echo "✅ Admin user will be created on startup"
fi

echo ""
echo "=== Enable Bore Server? ==="
read -p "Run bore-server on this machine? (y/n): " ENABLE_TUNNEL

if [[ "$ENABLE_TUNNEL" =~ ^[Yy]$ ]]; then
    sed -i "s|^ENABLE_MASTER_TUNNEL=.*|ENABLE_MASTER_TUNNEL=true|" .env
    sed -i "s|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=tunnel|" .env
    echo "✅ Bore server will start with docker compose"
else
    sed -i "s|^ENABLE_MASTER_TUNNEL=.*|ENABLE_MASTER_TUNNEL=false|" .env
    sed -i "s|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=|" .env
    echo "✅ Bore server disabled (use separate VPS)"
fi

echo ""
echo "=== Enable Monitoring? ==="
read -p "Enable Grafana + Prometheus? (y/n): " ENABLE_MONITORING

if [[ "$ENABLE_MONITORING" =~ ^[Yy]$ ]]; then
    CURRENT=$(grep "^COMPOSE_PROFILES=" .env | cut -d= -f2 | tr -d '\n\r')
    if [ -n "$CURRENT" ]; then
        NEW_VALUE="${CURRENT},monitoring"
    else
        NEW_VALUE="monitoring"
    fi
    # Remove old line and append new one
    grep -v "^COMPOSE_PROFILES=" .env > .env.tmp && mv .env.tmp .env
    echo "COMPOSE_PROFILES=$NEW_VALUE" >> .env
    echo "✅ Monitoring enabled"
fi

echo ""
echo "✅ Environment setup complete!"
echo "   Config file: $BACKEND_DIR/.env"

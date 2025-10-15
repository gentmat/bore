#!/bin/bash

# Bore Backend Start Script
# Automatically detects if bore-server should run on master

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default to false if not set
ENABLE_MASTER_TUNNEL=${ENABLE_MASTER_TUNNEL:-false}

echo "============================================"
echo "🚀 Starting Bore Backend"
echo "============================================"
echo ""

if [ "$ENABLE_MASTER_TUNNEL" = "true" ]; then
  echo "📦 Mode: TESTING (with bore-server on master)"
  echo "⚠️  Not recommended for production!"
  echo ""
  echo "Starting:"
  echo "  ✅ Backend API"
  echo "  ✅ PostgreSQL"
  echo "  ✅ Redis"
  echo "  ✅ bore-server (on master)"
  echo ""
  
  docker-compose --profile with-tunnel up -d
  
else
  echo "📦 Mode: PRODUCTION (coordinator only)"
  echo "✅ Master will NOT run bore-server"
  echo "   Deploy bore-servers on separate VPS"
  echo ""
  echo "Starting:"
  echo "  ✅ Backend API"
  echo "  ✅ PostgreSQL"
  echo "  ✅ Redis"
  echo "  ❌ bore-server (run separately)"
  echo ""
  
  docker-compose up -d
  
fi

echo ""
echo "============================================"

# Wait for services to start
sleep 5

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "============================================"
echo "✅ Done!"
echo ""

if [ "$ENABLE_MASTER_TUNNEL" = "true" ]; then
  echo "🌐 Access:"
  echo "   Dashboard:  http://localhost:3000/dashboard"
  echo "   bore-server: localhost:7835"
else
  echo "🌐 Access:"
  echo "   Dashboard:  http://localhost:3000/dashboard"
  echo ""
  echo "⚠️  Remember to deploy bore-servers separately:"
  echo "   ssh vps1 'docker run -d bore-server...'"
fi

echo ""
echo "============================================"

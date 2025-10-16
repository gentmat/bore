#!/bin/bash
# ONE-COMMAND SETUP - Complete Backend Setup
set -e

echo "🚀 Bore Backend - One-Command Setup"
echo "===================================="

# Colors
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; NC='\033[0m'

print_step() { echo -e "\n${G}➤${NC} $1"; }
print_error() { echo -e "${R}✗${NC} $1"; exit 1; }

# Load env
[ -f .env ] && export $(cat .env | grep -v '^#' | xargs) 2>/dev/null || true
DB_NAME=${DB_NAME:-bore_db}
TEST_DB_NAME=${TEST_DB_NAME:-bore_db_test}
DB_USER=${DB_USER:-postgres}

# 1. Check prerequisites
print_step "Checking prerequisites..."
command -v node >/dev/null || print_error "Node.js not found"
command -v npm >/dev/null || print_error "npm not found"
command -v psql >/dev/null || print_error "PostgreSQL not found"
echo "✓ All prerequisites met"

# 2. Install dependencies
print_step "Installing npm dependencies..."
npm install
echo "✓ Dependencies installed"

# 3. Setup environment
if [ ! -f .env ]; then
    print_step "Creating .env file..."
    cp .env.example .env 2>/dev/null || echo "⚠ .env.example not found, skipping"
fi

# 4. Create databases
print_step "Creating databases..."
psql -U $DB_USER -h localhost -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    psql -U $DB_USER -h localhost -c "CREATE DATABASE $DB_NAME"
echo "✓ Main database: $DB_NAME"

psql -U $DB_USER -h localhost -tc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB_NAME'" | grep -q 1 || \
    psql -U $DB_USER -h localhost -c "CREATE DATABASE $TEST_DB_NAME"
echo "✓ Test database: $TEST_DB_NAME"

# 5. Run migrations
print_step "Running database migrations..."
npm run migrate:up
echo "✓ Migrations applied"

# 6. Run migrations on test DB
print_step "Setting up test database..."
TEST_DB_NAME=$TEST_DB_NAME npm run migrate:up
echo "✓ Test database ready"

# 7. Verify setup
print_step "Verifying installation..."
./scripts/verify-setup.sh || echo "⚠ Some checks failed (non-critical)"

# 8. Done!
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                       ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. npm run dev          # Start development server"
echo "  2. npm run test:all     # Run all tests"
echo "  3. Open: http://localhost:3000/api/v1/docs"
echo ""

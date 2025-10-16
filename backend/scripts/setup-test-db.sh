#!/bin/bash

# Setup Test Database Script
# Creates and initializes test database for E2E tests

set -e

echo "🔧 Setting up test database..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Test database name
TEST_DB_NAME=${TEST_DB_NAME:-bore_db_test}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "📦 Database: $TEST_DB_NAME"
echo "👤 User: $DB_USER"
echo "🖥️  Host: $DB_HOST:$DB_PORT"
echo ""

# Check if database exists
DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tAc "SELECT 1 FROM pg_database WHERE datname='$TEST_DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
  echo "⚠️  Test database already exists"
  read -p "Drop and recreate? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Dropping existing database..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE $TEST_DB_NAME;"
  else
    echo "ℹ️  Using existing database"
    exit 0
  fi
fi

# Create test database
echo "✨ Creating test database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $TEST_DB_NAME;"

# Run migrations on test database
echo "🚀 Running migrations..."
TEST_DB_NAME=$TEST_DB_NAME npm run migrate:up

echo ""
echo "✅ Test database setup complete!"
echo ""
echo "To run E2E tests:"
echo "  npm run test:e2e"
echo ""
echo "To clean up:"
echo "  psql -U $DB_USER -c 'DROP DATABASE $TEST_DB_NAME;'"

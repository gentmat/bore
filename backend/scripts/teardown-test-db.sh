#!/bin/bash

# Teardown Test Database Script
# Removes test database after testing

set -e

echo "🧹 Tearing down test database..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

TEST_DB_NAME=${TEST_DB_NAME:-bore_db_test}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "📦 Database: $TEST_DB_NAME"
echo ""

# Check if database exists
DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tAc "SELECT 1 FROM pg_database WHERE datname='$TEST_DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" != "1" ]; then
  echo "ℹ️  Test database does not exist"
  exit 0
fi

# Drop test database
echo "🗑️  Dropping test database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE $TEST_DB_NAME;"

echo ""
echo "✅ Test database removed!"

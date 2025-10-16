#!/bin/bash

# Run Database Migrations Script
# Applies pending migrations to the database

set -e

echo "🚀 Running database migrations..."
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-bore_db}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "📦 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo "🖥️  Host: $DB_HOST:$DB_PORT"
echo ""

# Check migration status
echo "📊 Current migration status:"
npm run migrate

echo ""
echo "⏳ Applying pending migrations..."
npm run migrate:up

echo ""
echo "✅ Migrations complete!"
echo ""
echo "To rollback last migration:"
echo "  npm run migrate:down"

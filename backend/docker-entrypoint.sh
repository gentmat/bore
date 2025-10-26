#!/bin/sh
set -e

echo "🚀 Starting Bore Backend..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until node -e "const {Pool} = require('pg'); const pool = new Pool({host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD}); pool.query('SELECT 1').then(() => {console.log('✅ PostgreSQL is ready'); process.exit(0);}).catch(() => process.exit(1));" 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

# Run database migrations
echo "🔄 Running database migrations..."
if npm run migrate:up; then
  echo "✅ Migrations completed successfully"
else
  echo "⚠️  Migration failed, but continuing (legacy schema will be used)"
fi

# Start the application
echo "🎯 Starting application..."
exec node dist/server.js

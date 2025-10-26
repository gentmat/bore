#!/bin/bash
# Reset database by dropping all tables and re-running migrations
# WARNING: This will delete all data!

set -e

cd "$(dirname "$0")/.."

echo "⚠️  WARNING: This will DROP ALL TABLES and data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo "🗑️  Dropping all tables..."
node -r ts-node/register -e "
const {Pool} = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function dropAll() {
  await pool.query(\`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  \`);
  console.log('✅ All tables dropped');
  process.exit(0);
}

dropAll().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
"

echo "🚀 Running migrations..."
npm run migrate:up

echo "✅ Database reset complete!"

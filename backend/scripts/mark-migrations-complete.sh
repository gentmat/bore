#!/bin/bash
# Mark existing migrations as complete without re-running them
# Use this if your database schema is already up to date

set -e

cd "$(dirname "$0")/.."

echo "📝 Marking migrations as complete..."
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

async function markComplete() {
  // Mark initial schema as migrated
  await pool.query(\`
    INSERT INTO pgmigrations (name, run_on) 
    VALUES ('1729080000000_initial-schema', NOW())
    ON CONFLICT DO NOTHING;
  \`);
  
  // Check if is_banned column exists
  const result = await pool.query(\`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_banned';
  \`);
  
  if (result.rows.length > 0) {
    // Mark add_banned_column as migrated too
    await pool.query(\`
      INSERT INTO pgmigrations (name, run_on) 
      VALUES ('1729080001000_add_banned_column', NOW())
      ON CONFLICT DO NOTHING;
    \`);
    console.log('✅ Marked both migrations as complete');
  } else {
    console.log('✅ Marked initial schema as complete');
    console.log('ℹ️  Run npm run migrate:up to apply remaining migrations');
  }
  
  process.exit(0);
}

markComplete().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
"

echo "✅ Done!"

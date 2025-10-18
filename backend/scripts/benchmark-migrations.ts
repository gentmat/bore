#!/usr/bin/env node

/**
 * Migration Performance Benchmark
 * Measures the performance of database migrations
 */

import { Pool } from 'pg';
import { execSync } from 'child_process';
import config from '../config';

// Create benchmark database connection
const benchmarkDb = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: process.env.BENCHMARK_DB_NAME || 'bore_db_benchmark',
  user: config.database.user,
  password: config.database.password,
});

interface TableStat {
  schemaname: string;
  tablename: string;
  size: string;
  row_count: number;
}

/**
 * Format time in milliseconds
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Run a migration and measure time
 */
async function benchmarkMigration(direction: 'up' | 'down' = 'up'): Promise<number> {
  const startTime = Date.now();
  
  try {
    execSync(`npm run migrate:${direction}`, {
      stdio: 'pipe',
      env: {
        ...process.env,
        DB_NAME: process.env.BENCHMARK_DB_NAME || 'bore_db_benchmark'
      }
    });
    
    const endTime = Date.now();
    return endTime - startTime;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Migration ${direction} failed:`, (error as Error).message);
    throw error;
  }
}

/**
 * Count rows in all tables
 */
async function getTableStats(): Promise<TableStat[]> {
  const client = await benchmarkDb.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
      FROM (
        SELECT 
          table_schema AS schemaname,
          table_name AS tablename,
          query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ) t
      ORDER BY tablename;
    `);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Run full benchmark suite
 */
async function runBenchmark(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('\n🔧 Starting Migration Performance Benchmark\n');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  
  const dbName = process.env.BENCHMARK_DB_NAME || 'bore_db_benchmark';
  
  try {
    // 1. Create benchmark database
    // eslint-disable-next-line no-console
    console.log(`\n📦 Creating benchmark database: ${dbName}`);
    const adminDb = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: 'postgres',
      user: config.database.user,
      password: config.database.password,
    });
    
    try {
      await adminDb.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await adminDb.query(`CREATE DATABASE ${dbName}`);
      // eslint-disable-next-line no-console
      console.log('✅ Database created');
    } finally {
      await adminDb.end();
    }

    // 2. Benchmark UP migration
    // eslint-disable-next-line no-console
    console.log('\n⏱️  Running UP migration...');
    const upTime = await benchmarkMigration('up');
    // eslint-disable-next-line no-console
    console.log(`✅ UP migration completed in: ${formatTime(upTime)}`);

    // 3. Get table statistics
    // eslint-disable-next-line no-console
    console.log('\n📊 Analyzing database...');
    const stats = await getTableStats();

    // eslint-disable-next-line no-console
    console.log('\nTable Statistics:');
    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    // eslint-disable-next-line no-console
    console.log('Table Name'.padEnd(25) + 'Rows'.padEnd(15) + 'Size');
    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    
    let totalRows = 0;
    stats.forEach(stat => {
      const rows = stat.row_count || 0;
      totalRows += rows;
      // eslint-disable-next-line no-console
      console.log(
        stat.tablename.padEnd(25) +
        rows.toString().padEnd(15) +
        stat.size
      );
    });

    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    // eslint-disable-next-line no-console
    console.log(`Total: ${totalRows} rows across ${stats.length} tables`);

    // 4. Benchmark DOWN migration
    // eslint-disable-next-line no-console
    console.log('\n⏱️  Running DOWN migration...');
    const downTime = await benchmarkMigration('down');
    // eslint-disable-next-line no-console
    console.log(`✅ DOWN migration completed in: ${formatTime(downTime)}`);

    // 5. Performance summary
    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(60));
    // eslint-disable-next-line no-console
    console.log('📈 Performance Summary');
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));
    // eslint-disable-next-line no-console
    console.log(`UP Migration:   ${formatTime(upTime)}`);
    // eslint-disable-next-line no-console
    console.log(`DOWN Migration: ${formatTime(downTime)}`);
    // eslint-disable-next-line no-console
    console.log(`Total Time:     ${formatTime(upTime + downTime)}`);
    // eslint-disable-next-line no-console
    console.log(`Average:        ${formatTime((upTime + downTime) / 2)}`);
    
    // Performance rating
    const avgTime = (upTime + downTime) / 2;
    let rating: string;
    if (avgTime < 100) rating = '🚀 Excellent';
    else if (avgTime < 500) rating = '✅ Good';
    else if (avgTime < 1000) rating = '⚠️  Acceptable';
    else rating = '🐌 Slow';
  
    // eslint-disable-next-line no-console
    console.log(`Performance:    ${rating}`);
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));

    // 6. Cleanup
    // eslint-disable-next-line no-console
    console.log('\n🧹 Cleaning up...');
    const adminDb2 = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: 'postgres',
      user: config.database.user,
      password: config.database.password,
    });
    
    try {
      await adminDb2.query(`DROP DATABASE ${dbName}`);
      // eslint-disable-next-line no-console
      console.log('✅ Benchmark database removed');
    } finally {
      await adminDb2.end();
    }

    // eslint-disable-next-line no-console
    console.log('\n✅ Benchmark complete!\n');
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runBenchmark()
    .then(() => benchmarkDb.end())
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error('Fatal error:', error);
      benchmarkDb.end();
      process.exit(1);
    });
}

export { runBenchmark };

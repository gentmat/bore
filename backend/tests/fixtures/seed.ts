/**
 * Database Seeding Utility
 */

import { Pool, PoolClient } from 'pg';
import config from '../../config';
import { generateTestUsers, generateTestInstances, generateTestServers } from './seed-data';

interface SeedResult {
  users: unknown[];
  instances: unknown[];
  servers: unknown[];
  testPassword: string;
}

async function seedDatabase(pool: Pool): Promise<SeedResult> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const users = await generateTestUsers();
    const servers = generateTestServers();
    
    const seededUsers: unknown[] = [];
    for (const user of users) {
      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, name, plan, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [user.id, user.email, user.password_hash, user.name, user.plan, user.is_admin]
      );
      seededUsers.push(result.rows[0]);
    }

    const instances = generateTestInstances(seededUsers[0].id);
    const seededInstances: unknown[] = [];
    for (const inst of instances) {
      const result = await client.query(
        `INSERT INTO instances (id, user_id, name, local_port, region, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [inst.id, inst.user_id, inst.name, inst.local_port, inst.region, inst.status]
      );
      seededInstances.push(result.rows[0]);
    }

    const seededServers: unknown[] = [];
    for (const srv of servers) {
      const result = await client.query(
        `INSERT INTO bore_servers (id, host, port, location, max_bandwidth_mbps, max_concurrent_tunnels, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [srv.id, srv.host, srv.port, srv.location, srv.max_bandwidth_mbps, srv.max_concurrent_tunnels, srv.status]
      );
      seededServers.push(result.rows[0]);
    }

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('✅ Database seeded');
    return { users: seededUsers, instances: seededInstances, servers: seededServers, testPassword: 'TestPassword123!' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function clearSeedData(pool: Pool): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE refresh_tokens, tunnel_tokens, health_metrics, status_history, alert_history, instances, bore_servers, waitlist, users CASCADE');
    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('✅ Test data cleared');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: process.env.TEST_DB_NAME || 'bore_db_test',
    user: config.database.user,
    password: config.database.password,
  });

  const cmd = process.argv[2];
  (cmd === 'seed' ? seedDatabase(pool) : clearSeedData(pool))
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

export { seedDatabase, clearSeedData };

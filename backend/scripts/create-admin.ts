#!/usr/bin/env ts-node

/**
 * Admin User Creation Script
 * Creates an admin user based on environment variables or command line arguments
 */

import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import config from '../config';

interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  is_admin: boolean;
  plan: string;
}

async function createAdminUser(): Promise<void> {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  try {
    // Check if admin configuration is provided
    if (!config.admin.email || !config.admin.password) {
      console.error('❌ Admin configuration missing!');
      console.error('Set the following environment variables:');
      console.error('  ADMIN_EMAIL=admin@example.com');
      console.error('  ADMIN_PASSWORD=secure_password');
      console.error('  ADMIN_NAME="Admin User" (optional)');
      console.error('  ADMIN_AUTO_CREATE=true (optional)');
      process.exit(1);
    }

    console.log('🔧 Creating admin user...');
    console.log(`   Email: ${config.admin.email}`);
    console.log(`   Name: ${config.admin.name || 'Admin User'}`);

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id, email, is_admin FROM users WHERE email = $1',
      [config.admin.email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_admin) {
        console.log('✅ Admin user already exists and has admin privileges');
        return;
      } else {
        // Upgrade existing user to admin
        await pool.query(
          'UPDATE users SET is_admin = true, plan = $1 WHERE email = $2',
          ['enterprise', config.admin.email]
        );
        console.log('🔄 Existing user upgraded to admin with enterprise plan');
        return;
      }
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(config.admin.password, 10);

    // Create admin user
    const adminUser: AdminUser = {
      id: 'admin-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      email: config.admin.email,
      password_hash: passwordHash,
      name: config.admin.name || 'Admin User',
      is_admin: true,
      plan: 'enterprise',
    };

    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, is_admin, plan, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        adminUser.id,
        adminUser.email,
        adminUser.password_hash,
        adminUser.name,
        adminUser.is_admin,
        adminUser.plan,
      ]
    );

    console.log('✅ Admin user created successfully!');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Name: ${adminUser.name}`);
    console.log(`   Plan: ${adminUser.plan}`);
    console.log('');
    console.log('🔐 Login credentials:');
    console.log(`   URL: http://localhost:${config.server.port}/login.html`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: [set in ADMIN_PASSWORD environment variable]`);

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 Admin setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Admin setup failed:', error);
      process.exit(1);
    });
}

export { createAdminUser };

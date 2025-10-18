# Admin User Setup Guide

This guide explains how to set up admin users for your Bore server deployment, both for development and production environments.

## Overview

Bore provides multiple ways to create admin users:

1. **Environment Variables (Recommended for Production)** - Automatic admin creation on server startup
2. **Manual Script** - Create admin users after deployment
3. **Database Direct Access** - For emergency situations

## Method 1: Environment Variables (Production Recommended)

### Step 1: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password_here
ADMIN_NAME="Admin User"                    # Optional, defaults to "Admin User"
ADMIN_AUTO_CREATE=true                    # Optional, enables auto-creation on startup
```

### Step 2: Security Best Practices

- **Use a strong password**: At least 12 characters with mixed case, numbers, and symbols
- **Use your actual email**: For notifications and password recovery
- **Don't commit passwords**: Keep `.env` file out of version control
- **Use environment variables in production**: Set them in your deployment platform

### Step 3: Deploy and Start Server

When you start the server with `ADMIN_AUTO_CREATE=true`, the admin user will be automatically created:

```bash
# Production deployment
npm start

# Or with Docker
docker-compose up -d
```

The server will log the admin creation process:

```
🔧 Creating admin user...
   Email: admin@yourdomain.com
   Name: Admin User
✅ Admin user created successfully!
🔐 Login credentials:
   URL: http://localhost:3000/login.html
   Email: admin@yourdomain.com
   Password: [set in ADMIN_PASSWORD environment variable]
```

## Method 2: Manual Script Creation

### Step 1: Set Environment Variables

```bash
export ADMIN_EMAIL=admin@yourdomain.com
export ADMIN_PASSWORD=your_secure_password_here
export ADMIN_NAME="Admin User"  # Optional
```

### Step 2: Run the Admin Creation Script

```bash
cd backend
npm run create-admin
```

### Step 3: Verify Creation

The script will:
- Check if admin already exists
- Create new admin user with enterprise plan
- Upgrade existing users to admin if needed
- Provide login credentials

## Method 3: Database Direct Access (Emergency Only)

### For PostgreSQL:

```sql
-- Check existing users
SELECT email, name, is_admin FROM users;

-- Create admin user (replace with your values)
INSERT INTO users (
  id, 
  email, 
  password_hash, 
  name, 
  is_admin, 
  plan, 
  created_at, 
  updated_at
) VALUES (
  'admin-' || gen_random_uuid(),
  'admin@yourdomain.com',
  '$2b$10$hashed_password_here',  -- Use bcrypt to hash your password
  'Admin User',
  true,
  'enterprise',
  NOW(),
  NOW()
);

-- Upgrade existing user to admin
UPDATE users SET is_admin = true, plan = 'enterprise' WHERE email = 'user@example.com';
```

### Password Hashing

Use Node.js to hash passwords:

```javascript
const bcrypt = require('bcryptjs');
const password = 'your_password';
const hash = bcrypt.hashSync(password, 10);
console.log(hash); // Use this in the database
```

## Admin Features

Once logged in as an admin, you have access to:

### Dashboard Features
- **User Management**: View all users, their plans, and consumption
- **Instance Monitoring**: Real-time tunnel status and performance metrics
- **System Health**: Server status, database connectivity, Redis status
- **Capacity Management**: Monitor system capacity and resource allocation

### Administrative Controls
- **User Plan Management**: Upgrade/downgrade user plans
- **Instance Control**: Start/stop/restart user tunnels
- **Server Management**: Add/remove bore servers
- **Alert Configuration**: Set up email and Slack notifications

### API Access
Admin users have access to additional API endpoints:
- `GET /api/v1/admin/users` - List all users
- `PUT /api/v1/admin/users/{id}` - Update user details
- `DELETE /api/v1/admin/users/{id}` - Delete users
- `GET /api/v1/admin/metrics` - System-wide metrics

## Security Considerations

### Production Deployment
1. **Use HTTPS**: Always deploy behind SSL/TLS
2. **Strong Passwords**: Minimum 12 characters, complex
3. **Limited Admin Access**: Only create necessary admin accounts
4. **Regular Password Rotation**: Change admin passwords periodically
5. **Audit Logs**: Monitor admin actions in system logs

### Environment Security
```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)

# Set in production environment
export NODE_ENV=production
export JWT_SECRET="$JWT_SECRET"
export INTERNAL_API_KEY="$INTERNAL_API_KEY"
export ADMIN_EMAIL="admin@yourdomain.com"
export ADMIN_PASSWORD="your_very_secure_password"
export ADMIN_AUTO_CREATE="true"
```

### Docker Deployment

```dockerfile
# Dockerfile example
ENV NODE_ENV=production
ENV ADMIN_EMAIL=admin@yourdomain.com
ENV ADMIN_PASSWORD=your_secure_password
ENV ADMIN_AUTO_CREATE=true
```

Or use Docker Compose:

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - ADMIN_EMAIL=admin@yourdomain.com
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - ADMIN_AUTO_CREATE=true
```

## Troubleshooting

### Admin User Not Created
1. Check environment variables are set correctly
2. Verify database connectivity
3. Check server logs for error messages
4. Ensure `ADMIN_AUTO_CREATE=true` is set

### Login Issues
1. Verify email and password are correct
2. Check if user exists in database
3. Confirm `is_admin` flag is set to `true`
4. Check rate limiting (wait 60 seconds if too many attempts)

### Permission Issues
1. Verify user has `is_admin = true` in database
2. Check JWT token contains admin claims
3. Clear browser cache and cookies
4. Restart backend server

## Migration from Development

If you're moving from development to production:

1. **Export existing admin data**:
   ```sql
   SELECT email, name, created_at FROM users WHERE is_admin = true;
   ```

2. **Set up production environment variables** with the same email

3. **Run production deployment** - the script will handle creating/upgrading the admin user

4. **Verify access** by logging into the production dashboard

## Support

For issues with admin setup:
1. Check server logs: `docker logs bore-backend`
2. Verify database connection: `curl http://localhost:3000/health`
3. Review environment variables: `env | grep ADMIN`
4. Check configuration: `cat backend/.env`

## Quick Reference

| Method | Use Case | Command |
|--------|----------|---------|
| Environment Variables | Production deployment | Set `ADMIN_*` vars + `ADMIN_AUTO_CREATE=true` |
| Manual Script | After deployment | `npm run create-admin` |
| Database Direct | Emergency only | SQL commands |
| Development | Local testing | Use test seed data |

Remember: Always keep your admin credentials secure and change them regularly in production environments!

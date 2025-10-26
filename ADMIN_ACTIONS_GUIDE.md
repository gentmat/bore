# Admin Dashboard - User & Instance Management

## ✅ Implemented Features

### 🚫 User Ban/Unban
**Purpose**: Block abusive users from accessing the system without deleting their data.

**How it works**:
1. Admin clicks "🚫 Ban" button next to a user
2. User's `is_banned` flag is set to `true` in database
3. User is immediately logged out (JWT check fails on next request)
4. Banned users see: "Your account has been suspended. Please contact support."
5. Admin can click "✓ Unban" to restore access

**API Endpoints**:
- `POST /api/v1/admin/users/:userId/ban` - Ban a user
- `POST /api/v1/admin/users/:userId/unban` - Unban a user

**Protection**: Cannot ban admin users

---

### ⚡ Force Disconnect Instance
**Purpose**: Immediately terminate stuck or malicious tunnel connections.

**How it works**:
1. Admin clicks "⚡ Disconnect" button next to an active instance
2. Instance status set to `inactive`
3. `tunnel_connected` flag set to `false`
4. Status reason: "Force disconnected by admin"
5. Tunnel server will close the connection on next health check

**API Endpoint**:
- `POST /api/v1/admin/instances/:instanceId/disconnect`

---

### 📋 Audit Logging
**Purpose**: Track all admin actions for accountability and debugging.

**What's logged**:
- Admin ID and email
- Action performed (ban_user, unban_user, force_disconnect_instance)
- Target type and ID (user/instance)
- Additional details (user email, instance name, etc.)
- IP address
- Timestamp

**API Endpoint**:
- `GET /api/v1/admin/audit-logs?limit=100` - View recent admin actions

**Database**: `audit_logs` table with indexed queries

---

## 🎨 UI Features

### Users Table
- **Email** - User's email address
- **Name** - Display name
- **Plan** - trial/pro/enterprise badge
- **Status** - Admin badge + Banned badge (if applicable)
- **Created** - Account creation date
- **Expires** - Plan expiration
- **Actions** - Ban/Unban button (disabled for admins)

### Instances Table
- **Instance ID** - Unique identifier
- **Name** - Instance name
- **User ID** - Owner
- **Region** - Server location
- **Status** - active/inactive badge
- **Ports** - Local and remote ports
- **Public URL** - Tunnel endpoint
- **Created** - Instance creation date
- **Actions** - Disconnect button (only for active instances)

### Visual Feedback
- **Confirmation dialogs** before destructive actions
- **Success alerts** after actions complete
- **Auto-refresh** tables after actions
- **Color-coded badges**:
  - Banned: Red
  - Admin: Orange gradient
  - Active: Green
  - Inactive: Gray

---

## 🔒 Security

### Middleware Protection
- `authenticateJWT` - Checks if user is banned on every request
- `requireAdminAuth` - Verifies admin status before allowing actions
- Banned users get 403 Forbidden with clear message

### Input Validation
- User ID and Instance ID required
- Cannot ban admin users
- Cannot disconnect already inactive instances

### Audit Trail
- Every admin action logged with full context
- IP addresses tracked
- Immutable log entries (no delete, only insert)

---

## 📊 Database Schema

### New Column: `users.is_banned`
```sql
ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
```

### New Table: `audit_logs`
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:
- `idx_audit_admin` - Fast queries by admin
- `idx_audit_action` - Fast queries by action type
- `idx_audit_target` - Fast queries by target

---

## 🚀 Deployment

### 1. Run Migration (for existing databases)
```bash
cd backend
psql -U postgres -d bore_db -f migrations/add_banned_column.sql
```

### 2. Rebuild & Deploy
```bash
cd /home/maroun/Documents/Projects/bore
npm run build:all  # In backend directory
COMPOSE_PROFILES=monitoring make docker-up
```

### 3. Access Admin Panel
- Login: `http://localhost:3000/login`
- Credentials: `maroun.tanos@gmail.com` / `mib2003`
- Auto-redirects to: `http://localhost:3000/admin.html`

---

## 🎯 Usage Examples

### Ban an Abusive User
1. Go to admin dashboard
2. Find user in "All Users" table
3. Click "🚫 Ban" button
4. Confirm action
5. User is immediately logged out
6. Action logged in audit trail

### Unban a User
1. Find banned user (has red "Banned" badge)
2. Click "✓ Unban" button
3. Confirm action
4. User can login again

### Force Disconnect Stuck Tunnel
1. Go to "All Instances" table
2. Find active instance
3. Click "⚡ Disconnect" button
4. Confirm action
5. Tunnel terminated immediately

### View Audit Logs
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  http://localhost:3000/api/v1/admin/audit-logs?limit=50
```

---

## 📝 API Reference

### Ban User
```http
POST /api/v1/admin/users/:userId/ban
Authorization: Bearer <admin_jwt>
```

**Response**:
```json
{
  "success": true,
  "message": "User banned successfully"
}
```

### Unban User
```http
POST /api/v1/admin/users/:userId/unban
Authorization: Bearer <admin_jwt>
```

### Force Disconnect Instance
```http
POST /api/v1/admin/instances/:instanceId/disconnect
Authorization: Bearer <admin_jwt>
```

### Get Audit Logs
```http
GET /api/v1/admin/audit-logs?limit=100
Authorization: Bearer <admin_jwt>
```

**Response**:
```json
{
  "success": true,
  "logs": [
    {
      "id": 1,
      "adminId": "admin_123",
      "adminEmail": "maroun.tanos@gmail.com",
      "action": "ban_user",
      "targetType": "user",
      "targetId": "user_456",
      "details": {
        "userEmail": "abuser@example.com"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-10-26T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

## 🔮 Future Enhancements (Not Implemented Yet)

### User Management
- [ ] Delete user (with cascade delete of instances)
- [ ] Reset user password
- [ ] Extend plan expiration (quick date picker)
- [ ] View user activity logs
- [ ] Suspend user (temporary ban with auto-unban date)

### Instance Management
- [ ] Delete instance
- [ ] View instance logs (real-time)
- [ ] Bandwidth usage per instance
- [ ] Set instance resource limits

### System Controls
- [ ] Enable/disable new signups
- [ ] Set global rate limits
- [ ] Broadcast announcement banner
- [ ] Trigger manual database backup
- [ ] Emergency shutdown (stop all tunnels)
- [ ] Clear Redis cache

### Monitoring
- [ ] Recent errors dashboard (last 50 API errors)
- [ ] Active sessions viewer
- [ ] Resource alerts (CPU/memory/disk warnings)
- [ ] Email notifications for critical events

---

## 🐛 Troubleshooting

### Migration Failed
If the migration fails, manually run:
```sql
ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
```

### Banned User Still Has Access
- Clear browser localStorage
- Revoke refresh tokens:
  ```sql
  UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = 'USER_ID';
  ```

### Action Buttons Not Working
- Check browser console for errors
- Verify JWT token is valid
- Ensure admin flag is set: `SELECT is_admin FROM users WHERE email = 'maroun.tanos@gmail.com';`

### Audit Logs Not Showing
- Check table exists: `\dt audit_logs` in psql
- Run migration script
- Verify admin actions are being called

---

## ✅ Testing Checklist

- [x] Ban user → User cannot login
- [x] Unban user → User can login again
- [x] Force disconnect → Instance status changes to inactive
- [x] Audit logs → Actions are recorded
- [x] Cannot ban admin users
- [x] Cannot disconnect inactive instances
- [x] UI updates after actions
- [x] Confirmation dialogs appear
- [x] Error messages display correctly

---

**Status**: ✅ Complete and Production Ready  
**Last Updated**: 2025-10-26

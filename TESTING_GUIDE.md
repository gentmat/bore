# Testing Guide for Bore GUI Changes

## Prerequisites

Before testing, ensure you have:
1. Bore client installed (`cargo install --path bore-client`)
2. Bore server running
3. Backend server running (`node server.js` in `/backend`)
4. Build the GUI (`cd bore-gui && cargo build` or use development mode)

## Test Scenario 1: New User Sign Up

### Steps:
1. Open bore-gui application
2. Click "Sign Up" button on login page
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: testpass123
   - Confirm Password: testpass123
4. Click "Sign Up"

### Expected Results:
- Account created successfully
- User automatically logged in
- Dashboard appears
- Blue banner shows "Setting up code-server environment..."
- First instance auto-created with name like "code-server-1234567890"
- Instance appears in the dashboard after a few seconds
- Status should change from "inactive" to "starting" to "active"

### Verification:
```bash
# Check if code-server is running
ps aux | grep code-server

# Check if port is listening (replace 8081 with actual port)
lsof -i :8081

# Check backend API
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/instances
```

## Test Scenario 2: Existing User Login

### Steps:
1. Use the demo account or previously created account
2. Log in with email/password
3. Dashboard loads

### Expected Results:
- Existing instances displayed
- No new instance auto-created
- User can see their existing instances
- Can manually create new instances if desired

## Test Scenario 3: Manual Instance Creation

### Steps:
1. Click "New Instance" button in dashboard
2. Edit the instance name (e.g., "my-dev-server")
3. Click "Create Instance"

### Expected Results:
- System finds available port (starting from 8081)
- Code-server starts on that port
- Bore tunnel starts for that port
- New instance appears in dashboard
- Status transitions from "starting" to "active"

## Test Scenario 4: Web Portal Sync

### Steps:
1. Keep bore-gui running with an active instance
2. Open web browser to `http://localhost:3000/dashboard`
3. Log in with same credentials

### Expected Results:
- Same instance(s) visible in web dashboard
- Status shows as "active" if running
- No need to click "Connect" - instances are already running

## Test Scenario 5: Code-Server Installation

### Steps:
1. Uninstall code-server: `sudo rm /usr/bin/code-server`
2. Open bore-gui and log in
3. Watch the logs

### Expected Results:
- System detects code-server is not installed
- Automatically downloads and installs code-server
- Installation script runs via curl
- After installation, continues with instance creation

## Test Scenario 6: Port Conflicts

### Steps:
1. Manually start a service on port 8081-8083
2. Create new instance in bore-gui

### Expected Results:
- System detects ports 8081-8083 are taken
- Finds next available port (8084 or higher)
- Instance starts successfully on available port

## Test Scenario 7: Multiple Instances

### Steps:
1. Create first instance
2. Create second instance
3. Create third instance

### Expected Results:
- Each instance gets unique port (8081, 8082, 8083, etc.)
- Each instance has separate code-server process
- Each instance has separate bore tunnel
- All visible in dashboard with different ports

## Common Issues & Solutions

### Issue: "bore client is not installed"
**Solution:** Install bore client
```bash
cd /home/maroun/Documents/bore
cargo install --path bore-client
```

### Issue: "Failed to connect to API"
**Solution:** Ensure backend server is running
```bash
cd /home/maroun/Documents/bore/backend
node server.js
```

### Issue: "Failed to start tunnel"
**Solution:** Ensure bore server is running
```bash
bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000
```

### Issue: Port already in use
**Solution:** Kill existing process or let system find next available port
```bash
# Find process using port
lsof -i :8081

# Kill process
kill -9 <PID>
```

### Issue: Code-server password prompt
**Solution:** Code-server generates a password. Check:
```bash
cat ~/.config/code-server/config.yaml
```

## Development Testing Commands

### Build and run bore-gui in development mode:
```bash
cd bore-gui
npm run tauri dev
```

### View logs:
```bash
# Tauri logs will appear in the terminal where you ran tauri dev
# Or check system logs
journalctl -f | grep bore
```

### Clean rebuild:
```bash
cd bore-gui
cargo clean
npm run tauri build
```

## API Testing with curl

### Test signup:
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"testpass123"}'
```

### Test login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}'
```

### Test list instances:
```bash
TOKEN="your_jwt_token_here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/instances
```

### Test create instance:
```bash
TOKEN="your_jwt_token_here"
curl -X POST http://localhost:3000/api/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-instance","localPort":8081,"region":"local"}'
```

## Checklist

- [ ] Signup works and auto-activates account
- [ ] Login works with created account
- [ ] Code-server auto-installs if missing
- [ ] First instance auto-creates on login
- [ ] Port auto-detection works (8081+)
- [ ] Bore tunnel starts correctly
- [ ] Code-server starts on correct port
- [ ] Instance appears in GUI dashboard
- [ ] Instance appears in web dashboard
- [ ] Manual instance creation works
- [ ] Can edit instance name
- [ ] Multiple instances can coexist
- [ ] Logout cleans up processes
- [ ] App restart restores state

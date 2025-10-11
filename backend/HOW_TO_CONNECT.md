# How to Connect Tunnels with Your Credentials

After signing up and claiming your plan, you can connect tunnels using your email and password. Here are the two methods:

## Method 1: Dashboard (Easiest)

1. **Sign up** at http://localhost:3000/signup
2. **Claim your plan** (Free 24-hour trial or Pro)
3. **Go to Dashboard** - You'll see your tunnel instances
4. **Click "Connect"** on any instance
5. **Copy the command** shown in the popup and run it in your terminal

The dashboard automatically generates the connection command with a temporary token.

## Method 2: CLI with Stored Credentials (Recommended for Production)

### Step 1: Sign Up and Claim Plan
```bash
# Visit http://localhost:3000/signup
# Create your account and claim your free trial or pro plan
```

### Step 2: Login via CLI (Future Feature)
```bash
# This will store your credentials securely
bore login --email your@email.com

# You'll be prompted for your password
# Password: ********
```

### Step 3: Connect Automatically
```bash
# After login, just run bore with your local port
bore 8080 --to 127.0.0.1

# The client will automatically:
# 1. Read your stored credentials
# 2. Authenticate with the backend
# 3. Get a temporary tunnel token
# 4. Connect to the tunnel server
```

## How It Works

### Authentication Flow

1. **User Signs Up**
   - Creates account with email/password
   - Receives JWT token
   - Gets redirected to claim trial/plan

2. **User Claims Plan**
   - Chooses Free Trial (24 hours) or Pro Plan
   - Plan is activated on their account
   - Default tunnel instance is created

3. **User Connects Tunnel**

   **Option A: Via Dashboard**
   - Dashboard calls `/api/user/instances/{id}/connect`
   - Backend generates temporary tunnel token
   - User runs command with token: `bore 8080 --to server.com --secret temp_token_xyz`

   **Option B: Via CLI (Future)**
   - CLI reads stored credentials from `~/.bore/credentials`
   - CLI calls `/api/auth/login` to get JWT
   - CLI calls `/api/user/instances/{id}/connect` to get tunnel token
   - CLI automatically connects with tunnel token

### Security

- **Passwords**: Hashed with bcrypt (10 rounds)
- **JWT Tokens**: Expire after 30 days
- **Tunnel Tokens**: Temporary, expire after 1 hour
- **Credentials Storage**: Stored in `~/.bore/credentials` (encrypted)

## Current Implementation

### What's Available Now:
✅ User registration and authentication
✅ Plan management (Free Trial / Pro)
✅ Dashboard with manual connection
✅ Temporary tunnel token generation
✅ User profile and instance management

### What Needs Implementation in bore-client:
⏳ `bore login` command to store credentials
⏳ Automatic authentication using stored credentials
⏳ Credential encryption in `~/.bore/credentials`
⏳ Auto-refresh of tunnel tokens

## Example User Journey

```bash
# 1. User signs up via web
Visit: http://localhost:3000/signup
Email: alice@example.com
Password: securepass123

# 2. User claims free trial
Clicks: "Claim Free Trial" button
Status: 24-hour trial activated

# 3. User goes to dashboard
Sees: "my-first-tunnel" instance (inactive)

# 4. User clicks "Connect"
Gets command: bore 8080 --to us-east-1.tunnels.example.com --secret temp_token_abc123

# 5. User runs command
$ bore 8080 --to us-east-1.tunnels.example.com --secret temp_token_abc123
✓ Connected! Public URL: us-east-1.tunnels.example.com:15234

# 6. Dashboard auto-refreshes
Shows: "my-first-tunnel" (active) - us-east-1.tunnels.example.com:15234
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with email/password
- `GET /api/user/profile` - Get user profile

### Plan Management
- `POST /api/user/claim-plan` - Claim trial or pro plan

### Tunnel Management
- `GET /api/user/instances` - List user's tunnel instances
- `POST /api/user/instances/{id}/connect` - Get connection token
- `POST /api/user/instances/{id}/disconnect` - Disconnect tunnel

## Next Steps for Full CLI Integration

To enable automatic credential-based connection in the bore client:

1. **Add Login Command** (`bore-client/src/main.rs`)
   ```rust
   bore login --email user@example.com
   // Prompts for password
   // Stores encrypted credentials in ~/.bore/credentials
   ```

2. **Add Credential Storage** (`bore-client/src/auth.rs`)
   ```rust
   // Read/write encrypted credentials
   // Auto-authenticate on tunnel start
   ```

3. **Modify Connect Flow** (`bore-client/src/client.rs`)
   ```rust
   // Before connecting:
   // 1. Check for stored credentials
   // 2. If found, authenticate with backend
   // 3. Get temporary tunnel token
   // 4. Use token to connect
   ```

4. **Add Token Refresh**
   ```rust
   // Monitor token expiration
   // Auto-refresh before expiry
   // Reconnect if needed
   ```

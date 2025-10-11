# Managed Tunnels User Guide

This guide shows you how to use bore's managed tunnel system, where you control your tunnels through a web dashboard and connect with simple CLI commands.

## Overview

With managed tunnels, you don't need to remember server addresses or manage API keys. Instead:

1. **Create instances in your web dashboard** (one-time setup)
2. **Login once from CLI** (`bore login`)
3. **Start tunnels by name** (`bore start my-server`)

No more copying server addresses or worrying about which port your tunnel is on!

---

## Getting Started

### Step 1: Create an Account

Go to your bore service dashboard (e.g., `https://dashboard.yourdomain.com`) and create an account.

### Step 2: Create Tunnel Instances

In the web dashboard, create tunnel instances for the services you want to expose:

**Example: Web Server Instance**
- Name: `my-web-server`
- Local Port: `8080`
- Region: `us-east-1`

**Example: API Instance**
- Name: `dev-api`
- Local Port: `3000`
- Region: `eu-west-1`

You can create as many instances as your plan allows.

### Step 3: Install the bore CLI

```bash
cargo install bore-client
```

Or download from [releases page](https://github.com/yourusername/bore/releases).

---

## CLI Commands

### Login

Authenticate with your account credentials:

```bash
bore login
```

You'll be prompted for:
- Email
- Password

Your credentials are securely stored in `~/.bore/credentials.json`.

**Example:**
```bash
$ bore login
Login to your bore account

Email: user@example.com
Password: 

Authenticating...
✓ Successfully logged in!
  User ID: user_123abc
```

---

### List Instances

View all your tunnel instances:

```bash
bore list
```

**Example output:**
```bash
$ bore list
Fetching your tunnel instances...

Available instances:

  🟢 my-web-server (inst_abc123)
     Local port: 8080
     Region: us-east-1
     Public URL: us-east-1.tunnels.yourdomain.com:15234

  ⚪ dev-api (inst_def456)
     Local port: 3000
     Region: eu-west-1

```

Legend:
- 🟢 Active (tunnel is running)
- ⚪ Inactive (tunnel is not running)

---

### Start a Tunnel

Start a tunnel by instance name or ID:

```bash
bore start <instance-name>
```

**Example:**
```bash
$ bore start my-web-server
Finding instance 'my-web-server'...
Connecting to 'my-web-server'...

✓ Connected to "my-web-server"
✓ Forwarding localhost:8080

# Your tunnel is now running!
# Press Ctrl+C to stop
```

**Using instance ID:**
```bash
$ bore start inst_abc123
```

---

### Stop a Tunnel

To stop a tunnel, press `Ctrl+C` in the terminal where it's running.

---

### Logout

Remove stored credentials:

```bash
bore logout
```

**Example:**
```bash
$ bore logout
✓ Successfully logged out
```

---

## Real-World Examples

### Example 1: Local Web Development

You're developing a web app on `localhost:8080` and want to share it with a client.

**Setup (one-time):**
1. Create instance "web-demo" in dashboard (port 8080)

**Every time you want to share:**
```bash
$ bore start web-demo

✓ Connected to "web-demo"
✓ Forwarding localhost:8080
```

Now check your dashboard for the public URL to share!

---

### Example 2: Testing Webhooks

You're testing webhook integrations on `localhost:3000`.

**Setup (one-time):**
1. Create instance "webhook-test" in dashboard (port 3000)

**Every time you test:**
```bash
$ bore start webhook-test

✓ Connected to "webhook-test"
✓ Forwarding localhost:3000
```

Configure the webhook provider to use the public URL from your dashboard.

---

### Example 3: Multiple Services

You have multiple services to expose simultaneously.

**Setup (one-time):**
1. Create instance "frontend" (port 3000)
2. Create instance "backend" (port 8080)

**Start both:**
```bash
# Terminal 1
$ bore start frontend

# Terminal 2
$ bore start backend
```

Both tunnels run simultaneously!

---

## Where to Find Public URLs

**Important:** The CLI doesn't show public URLs anymore. This is intentional!

To see your public URLs:
1. Open your web dashboard
2. Go to "Instances"
3. Active instances show their public URLs

This centralized approach ensures you always have a single source of truth for your tunnel URLs.

---

## Troubleshooting

### "credentials file not found"

You haven't logged in yet. Run:
```bash
bore login
```

### "instance 'xyz' not found"

The instance doesn't exist or the name is misspelled. Run:
```bash
bore list
```
to see all your instances.

### "authentication failed"

Your login token has expired. Run:
```bash
bore login
```
to log in again.

### Connection errors

- Check your internet connection
- Verify the local port is correct
- Make sure your local service is running on the specified port

---

## Security Best Practices

1. **Don't share credentials**: Your email/password is for you only
2. **Logout on shared computers**: Always run `bore logout` when using shared/public computers
3. **Secure your local services**: Even though the tunnel is authenticated, ensure your local services have proper security
4. **Delete unused instances**: Remove instances you no longer need from the dashboard

---

## Advanced Usage

### Custom API Endpoint

If you're self-hosting or using a custom deployment:

```bash
bore login --api-endpoint https://custom-api.example.com
```

### Environment Variables

You can set the API endpoint via environment variable:

```bash
export BORE_API_ENDPOINT=https://custom-api.example.com
bore login
```

---

## Comparison: Legacy vs Managed

### Legacy Mode (still supported)
```bash
bore 8080 --to tunnel.example.com --secret sk_live_abc123xyz

# Output:
# ✓ Tunnel established!
#   Public URL: tunnel.example.com:15234
#   Forwarding to: localhost:8080
```

**Pros:**
- Quick for one-off tunnels
- No account needed

**Cons:**
- Need to remember server address
- Need to copy/paste API key
- Hard to manage multiple tunnels
- No visibility into tunnel status

### Managed Mode (recommended)
```bash
bore start my-server

# Output:
# ✓ Connected to "my-server"
# ✓ Forwarding localhost:8080
```

**Pros:**
- No need to remember anything
- Manage everything in dashboard
- Easy to see all active tunnels
- Better for teams
- Centralized URL management

**Cons:**
- Requires account creation
- One-time login step

---

## Next Steps

- **Explore the dashboard**: Create instances, view analytics, manage your account
- **Read the FAQ**: Common questions and answers
- **Join the community**: Get help and share tips

Happy tunneling! 🚇

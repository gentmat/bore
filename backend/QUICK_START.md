# 🚀 Bore Tunnel - Quick Start Guide

## Complete User Flow with Sign Up & Credentials

### 1️⃣ Sign Up (New Users)

**URL:** http://localhost:3000/signup

- Enter your name, email, and password
- Password must be at least 8 characters
- Click "Create Account"
- You'll be automatically redirected to claim your plan

### 2️⃣ Claim Your Plan

**Free Trial Option:**
- ✓ 1 tunnel instance
- ✓ 24-hour access
- ✓ No credit card required

**Pro Plan Option:**
- ✓ Unlimited tunnels
- ✓ Custom domains
- ✓ Priority support
- ✓ $9.99/month

After claiming, you'll see connection instructions!

### 3️⃣ Connect Your Tunnel

#### Option A: Via Dashboard (Easiest)

1. Go to http://localhost:3000/dashboard
2. See your tunnel instances
3. Click **"Connect"** button
4. Copy the command shown
5. Run it in your terminal:
   ```bash
   bore 8080 --to us-east-1.tunnels.example.com --secret sk_tok_abcd1234
   ```

#### Option B: With Stored Credentials (Future)

```bash
# One-time login
bore login --email your@email.com
# Enter password when prompted

# Then just run bore anytime
bore 8080 --to 127.0.0.1
# Automatically authenticates with your credentials!
```

### 4️⃣ Manage Tunnels

**Dashboard Features:**
- ✓ View all your tunnel instances
- ✓ See connection status (active/inactive)
- ✓ Get public URLs for active tunnels
- ✓ Connect/disconnect with one click
- ✓ Auto-refresh every 10 seconds

---

## 🔐 How Authentication Works

### Current Flow (Dashboard):

```
User Signs Up → Claims Plan → Goes to Dashboard → Clicks Connect
                                                          ↓
Backend generates temporary token ← Dashboard requests connection
                                                          ↓
User runs: bore 8080 --secret sk_tok_abcd1234 ← Gets command with token
```

### Future Flow (CLI with Credentials):

```
User Signs Up → Claims Plan → Runs: bore login --email user@example.com
                                                          ↓
                                    Credentials stored in ~/.bore/credentials
                                                          ↓
User runs: bore 8080 --to 127.0.0.1 → CLI auto-authenticates
                                                          ↓
                              CLI gets temporary token from backend
                                                          ↓
                                    Tunnel connects automatically!
```

---

## 📋 Complete Example

### New User Journey:

```bash
# Step 1: Sign up via browser
Open: http://localhost:3000/signup
Name: John Doe
Email: john@example.com
Password: mypassword123

# Step 2: Claim free trial
Click: "Claim Free Trial"
Result: ✓ 24-hour trial activated!

# Step 3: View dashboard
URL: http://localhost:3000/dashboard
See: "my-first-tunnel" (inactive)

# Step 4: Connect tunnel
Click: "Connect" button
Copy command shown:
bore 8080 --to us-east-1.tunnels.example.com --secret sk_tok_abcd1234

# Step 5: Run in terminal
$ bore 8080 --to us-east-1.tunnels.example.com --secret sk_tok_abcd1234
✓ Connected!
✓ Public URL: us-east-1.tunnels.example.com:15234

# Step 6: Check dashboard
Refresh: http://localhost:3000/dashboard
Status: "my-first-tunnel" (active)
URL: us-east-1.tunnels.example.com:15234
```

### Returning User:

```bash
# Just login and go to dashboard
Open: http://localhost:3000/login
Email: john@example.com
Password: mypassword123

# Dashboard shows all your tunnels
# Click "Connect" on any tunnel to get the command
```

---

## 🎯 Key Features

### ✅ Implemented:
- User registration with email/password
- JWT-based authentication
- Free 24-hour trial
- Pro plan subscription
- Dashboard with tunnel management
- Temporary token generation
- Connect/disconnect functionality
- Auto-refresh dashboard

### ⏳ Coming Soon (Needs CLI Implementation):
- `bore login` command
- Stored credential authentication
- Automatic token refresh
- Seamless reconnection

---

## 🔗 Important URLs

- **Sign Up:** http://localhost:3000/signup
- **Login:** http://localhost:3000/login
- **Dashboard:** http://localhost:3000/dashboard
- **Claim Trial:** http://localhost:3000/claim-trial

## 🎨 Demo Account

Already have a demo account set up:
- **Email:** demo@bore.com
- **Password:** demo123
- **Plan:** Free trial (24 hours)

---

## 💡 Pro Tips

1. **Bookmark the dashboard** - Quick access to all your tunnels
2. **Use descriptive names** - Name your tunnel instances clearly
3. **Monitor expiration** - Free trial lasts 24 hours
4. **Keep tokens secure** - Temporary tokens expire after 1 hour
5. **Check status** - Dashboard auto-refreshes to show current status

---

## 🆘 Troubleshooting

**Can't sign up?**
- Check if email is already registered
- Ensure password is at least 8 characters

**Token expired?**
- Click "Connect" again to get a new token
- Tokens are valid for 1 hour

**Tunnel won't connect?**
- Verify the bore client is installed
- Check if the port is available
- Ensure you're using the correct command

---

## 📞 Support

For issues or questions:
- Check the documentation in `HOW_TO_CONNECT.md`
- Review the API spec in `BACKEND_API_SPEC.md`
- Contact support (coming soon)

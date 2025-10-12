# Quick Start Guide

## Step-by-Step Setup

### 1. Build All Components

```bash
cd /home/maroun/Documents/bore

# Build the workspace (bore-client, bore-server, etc.)
cargo build --release --workspace

# Install bore client globally
cargo install --path bore-client

# Install bore server globally (optional)
cargo install --path bore-server

# Add cargo bin to PATH if not already done
export PATH="$HOME/.cargo/bin:$PATH"
# For fish shell:
# set -Ux fish_user_paths $HOME/.cargo/bin $fish_user_paths
```

### 2. Start Backend Server (Terminal 1)

```bash
cd /home/maroun/Documents/bore/backend
node server.js
```

Expected output:
```
🚀 Bore Backend Server running on http://localhost:3000
📝 Sign Up: http://localhost:3000/signup
📝 Login page: http://localhost:3000/login
📊 Dashboard: http://localhost:3000/dashboard

👤 Demo credentials: demo@bore.com / demo123
```

### 3. Start Bore Server (Terminal 2)

```bash
bore-server --bind-addr 127.0.0.1 \
            --bind-tunnels 127.0.0.1 \
            --backend-url http://127.0.0.1:3000
```

### 4. Start Bore GUI (Terminal 3)

#### Development Mode:
```bash
cd /home/maroun/Documents/bore/bore-gui
npm install  # First time only
npm run tauri dev
```

#### Production Build:
```bash
cd /home/maroun/Documents/bore/bore-gui
npm run tauri build
# Then run the built binary
```

## Using the Application

### First Time User

1. **Open Bore GUI** - The application window will open
2. **Sign Up**:
   - Click "Sign Up" link
   - Enter your name, email, and password
   - Click "Sign Up"
3. **Auto Setup**:
   - You'll be automatically logged in
   - Code-server will be checked/installed
   - First instance will be auto-created
   - Bore tunnel will auto-start
4. **Access Code-Server**:
   - Check the dashboard for your instance
   - Note the public URL
   - Open in browser to access code-server

### Returning User

1. **Open Bore GUI**
2. **Login** with your email and password
3. **Dashboard** shows your existing instances
4. **Start/Stop** instances as needed
5. **Create** additional instances via "New Instance" button

## Accessing Your Instances

### Via GUI Dashboard
- All instances listed with status
- Start/Stop controls
- Public URL displayed when active

### Via Web Dashboard
1. Open browser to `http://localhost:3000/dashboard`
2. Login with same credentials
3. See same instances (synced via backend)

### Direct Access
- Each instance has a unique port (8081, 8082, etc.)
- Local access: `http://127.0.0.1:8081` (or assigned port)
- Public access: Via bore tunnel URL

## Typical Workflow

```bash
# Terminal 1: Backend
cd backend && node server.js

# Terminal 2: Bore Server
bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000

# Terminal 3: GUI (or just launch the app)
cd bore-gui && npm run tauri dev
```

Then:
1. Sign up or login in GUI
2. First instance auto-created
3. Code-server running on auto-selected port
4. Bore tunnel forwarding that port
5. Access via GUI, web, or public URL

## Configuration

### Backend (.env file)
Create `/backend/.env`:
```env
PORT=3000
JWT_SECRET=your_secret_key_here
BORE_SERVER_HOST=127.0.0.1
```

### Bore Server Options
```bash
bore-server --help
# Common options:
# --bind-addr: Address to bind control server
# --bind-tunnels: Address to bind tunnel connections  
# --backend-url: URL of backend API
```

### GUI Settings
- API endpoint: Defaults to `http://127.0.0.1:3000`
- Can be changed in code if needed
- Credentials stored locally for auto-login

## Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Use different port
PORT=3001 node server.js
```

### Bore server won't start
```bash
# Check if port 7835 is in use
lsof -i :7835

# Make sure bore-server is installed
which bore-server
```

### GUI build fails
```bash
# Clean and rebuild
cd bore-gui
rm -rf target node_modules
npm install
cargo clean
npm run tauri build
```

### Code-server not found
```bash
# Install code-server manually
curl -fsSL https://code-server.dev/install.sh | sh

# Or via npm
npm install -g code-server
```

### Bore client not found
```bash
# Install from workspace
cd /home/maroun/Documents/bore
cargo install --path bore-client

# Verify
which bore-client
bore-client --version
```

## Project Structure

```
bore/
├── backend/              # Node.js API server
│   ├── server.js        # Main server file
│   └── public/          # Web dashboard
├── bore-client/         # Bore tunnel client
├── bore-server/         # Bore tunnel server
├── bore-gui/            # Tauri desktop app
│   ├── src/            # React frontend
│   └── src-tauri/      # Rust backend
└── bore-shared/         # Shared protocol code
```

## Default Ports

- **3000**: Backend API server
- **7835**: Bore server (control)
- **8081+**: Code-server instances (auto-assigned)

## Useful Commands

```bash
# Check running processes
ps aux | grep bore
ps aux | grep code-server
ps aux | grep node

# Check open ports
lsof -i :3000
lsof -i :7835
lsof -i :8081

# View logs
journalctl -f | grep bore

# Stop all
killall bore-server
killall bore-client  
killall code-server
killall node
```

## Next Steps

1. Test signup flow
2. Test instance creation
3. Access code-server via public URL
4. Test web dashboard sync
5. Try multiple instances
6. Test stop/start controls

See `TESTING_GUIDE.md` for detailed test scenarios.

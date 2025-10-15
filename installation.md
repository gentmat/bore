# Bore Installation Guide

## Prerequisites

- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js**: v16+ (https://nodejs.org)
- **npm**: Included with Node.js

---

## 1. Build Bore Server

```bash
cd bore-server
cargo build --release
```

**Output**: `target/release/bore-server`

**Deploy to Server**:
- Copy `target/release/bore-server` to production server
- Run: `./bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000`
- Optional: Setup systemd service for auto-start

---

## 2. Build Bore Client

```bash
cd bore-client
cargo build --release
```

**Output**: `target/release/bore`

**Ship to Users**:
- Standalone binary: `target/release/bore`
- Bundle with GUI (see step 4)

---

## 3. Setup Backend API

```bash
cd backend
npm install
```

**Configure**:
- Copy `.env.example` to `.env`
- Set `PORT=3000` and database settings

**Run**:
- Development: `npm run dev`
- Production: `npm start` or use PM2

**Deploy**:
- Copy `backend/` folder to server
- Install dependencies: `npm install --production`
- Start with PM2: `pm2 start server.js --name bore-api`

---

## 4. Build GUI (Desktop App)

### Automated Build (Recommended)

```bash
cd bore-gui
./build-installers.sh    # Does everything: builds bore-client + GUI + installers
```

**Output**: Installers in `release/` folder

### Manual Build

```bash
cd bore-gui
./prepare-resources.sh   # Builds bore-client and copies to resources
npm install
npm run tauri build
```

**Outputs (Linux)**:
- AppImage: `src-tauri/target/release/bundle/appimage/*.AppImage`
- Deb: `src-tauri/target/release/bundle/deb/*.deb`

**Outputs (Windows)**:
- MSI: `src-tauri/target/release/bundle/msi/*.msi`
- EXE: `src-tauri/target/release/bundle/nsis/*.exe`

**Outputs (macOS)**:
- DMG: `src-tauri/target/release/bundle/dmg/*.dmg`
- App: `src-tauri/target/release/bundle/macos/*.app`

---

## Build Scripts Guide

### 🎯 Quick Answer: Which Script to Run?

```
Want GUI installers?
    │
    ├─► YES → Run: ./build-installers.sh  (DONE! ✅)
    │
    └─► Want manual control?
            │
            ├─► YES → Run: ./prepare-resources.sh
            │         Then: npm install && npm run tauri build
            │
            └─► NO  → Run: ./build-installers.sh  (DONE! ✅)
```

**TL;DR**: Run **ONLY** `./build-installers.sh` for production

---

### ⭐ RECOMMENDED: `./build-installers.sh` (Run This One!)
```bash
cd bore-gui
./build-installers.sh
```
- ✅ **All-in-one script** - Does everything automatically
- ✅ Checks prerequisites (Node.js, Rust, system deps)
- ✅ Auto-kills running instances (prevents "Text file busy" errors)
- ✅ Cleans previous builds
- ✅ Builds bore-client binary
- ✅ Builds GUI application
- ✅ Creates installers (AppImage/DEB/MSI/DMG)
- ✅ Copies to `release/` folder
- **This is the ONLY script you need to run**

---

### Alternative: Manual Build Process
Only use these if you DON'T want automated build:

**Step 1:** `./prepare-resources.sh`
```bash
cd bore-gui
./prepare-resources.sh    # Builds & prepares bore-client
```

**Step 2:** Build GUI manually
```bash
npm install
npm run tauri build       # Creates installers
```

---

### ℹ️ `prepare-build.sh` (Internal - Don't Run)
- Called automatically by `build-installers.sh`
- You never need to run this manually

---

## What to Ship to Clients

### Option A: GUI Only (Recommended)
- **Linux**: `bore-gui_0.1.0_amd64.AppImage` or `.deb`
- **Windows**: `bore-gui_0.1.0_x64.msi` or `.exe`
- **macOS**: `bore-gui_0.1.0_x64.dmg`
- ✅ Includes embedded bore-client
- ✅ Auto-installs dependencies

### Option B: CLI Only
- **Binary**: `bore` (from bore-client build)
- Place in `/usr/local/bin` or `~/.local/bin`

---

## Server Deployment Checklist

### Bore Server
- [ ] Build: `cargo build --release` in `bore-server/`
- [ ] Copy `target/release/bore-server` to server
- [ ] Run: `./bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000`
- [ ] Setup systemd service for auto-restart
- [ ] Configure firewall to allow port 7835

### Backend API
- [ ] Copy `backend/` folder to server
- [ ] Install deps: `npm install --production`
- [ ] Configure `.env` file
- [ ] Start with PM2: `pm2 start server.js`
- [ ] Setup nginx reverse proxy (port 3000)
- [ ] Configure CORS for GUI domains

---

## Development Setup

```bash
# Terminal 1: Backend API
cd backend
npm install
npm run dev

# Terminal 2: Bore Server
cd bore-server
cargo run --release -- --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000

# Terminal 3: GUI
cd bore-gui
npm install
npm run tauri dev
```

---

## Quick Build Commands

### Fastest: Automated GUI Build (Recommended)

```bash
cd bore-gui
./build-installers.sh
# ✅ Builds everything + creates installers in release/ folder
```

### Build Everything from Root

```bash
# Build all Rust components
cargo build --release --workspace

# Or install to ~/.cargo/bin
cargo install --path bore-client
cargo install --path bore-server

# Add to PATH (bash)
export PATH="$HOME/.cargo/bin:$PATH"

# Add to PATH (fish)
set -Ux fish_user_paths $HOME/.cargo/bin $fish_user_paths

# Build backend
cd backend && npm install

# Build GUI (choose one method)
cd bore-gui
./build-installers.sh        # Automated (recommended)
# OR
./prepare-resources.sh && npm install && npm run tauri build   # Manual
```

---

## Package Structure for Distribution

```
bore-distribution/
├── server/
│   ├── bore-server          # Rust binary
│   └── README-server.md
├── gui/
│   ├── linux/
│   │   ├── bore-gui.AppImage
│   │   └── bore-gui.deb
│   ├── windows/
│   │   ├── bore-gui.msi
│   │   └── bore-gui.exe
│   └── macos/
│       └── bore-gui.dmg
└── cli/
    ├── linux/bore
    ├── windows/bore.exe
    └── macos/bore
```

---

## Testing Server Setup

```bash
# Start bore server
bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000

# Start backend API
cd backend
npm start

# Test with bore client
bore local 8080 --to localhost:7835
```

---

## Ship to Clients Summary

- **GUI Users**: Send installer (AppImage/MSI/DMG)
- **CLI Users**: Send `bore` binary for their OS
- **Server Admins**: Send `bore-server` binary + backend API folder

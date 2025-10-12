# Complete Setup Guide - Bore Tunnel GUI

This guide walks you through setting up the Bore Tunnel GUI from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [GUI Setup](#gui-setup)
4. [Building for Production](#building-for-production)
5. [Distribution](#distribution)

---

## Prerequisites

### Install Development Tools

#### All Platforms

**Node.js (v16 or higher)**
```bash
# Download from https://nodejs.org/
# Or use package managers:

# macOS (Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows (Chocolatey)
choco install nodejs
```

**Rust (latest stable)**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Linux-Specific Dependencies

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Fedora:**
```bash
sudo dnf install -y \
  webkit2gtk3-devel \
  openssl-devel \
  curl \
  wget \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -S --needed \
  webkit2gtk \
  base-devel \
  curl \
  wget \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

#### macOS-Specific Setup

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Windows-Specific Setup

1. Install [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/downloads/)
   - Select "Desktop development with C++"
2. Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10+)

---

## Backend Setup

Before running the GUI, you need the bore backend API running.

### 1. Start the Backend Server

```bash
# Navigate to backend directory
cd bore/backend

# Install dependencies
npm install

# Start the server
node server.js
```

The backend should now be running on `http://127.0.0.1:3000`.

### 2. Verify Backend is Running

```bash
curl http://127.0.0.1:3000/health
# Should return: {"status":"ok"}
```

---

## GUI Setup

### 1. Navigate to GUI Directory

```bash
cd bore/bore-gui
```

### 2. Install JavaScript Dependencies

```bash
npm install
```

This installs:
- React and React DOM
- Tauri API bindings
- TailwindCSS
- TypeScript
- Vite build tool
- Lucide icons

### 3. Run in Development Mode

```bash
npm run tauri dev
```

This will:
1. Build the Rust backend
2. Start the Vite dev server
3. Launch the GUI application

**First run takes 5-10 minutes** as Rust compiles dependencies.

### 4. Test the Application

1. The login screen should appear
2. Try logging in with test credentials:
   - Email: test@example.com
   - Password: password123
3. You should see the dashboard

---

## Building for Production

### Linux

**Build all formats:**
```bash
npm run tauri build
```

This creates:
- **AppImage**: `src-tauri/target/release/bundle/appimage/bore-gui_0.1.0_amd64.AppImage`
- **Debian**: `src-tauri/target/release/bundle/deb/bore-gui_0.1.0_amd64.deb`
- **RPM**: `src-tauri/target/release/bundle/rpm/bore-gui-0.1.0-1.x86_64.rpm`

**Build specific format:**
```bash
# AppImage only
npm run tauri build -- --bundles appimage

# Debian package only
npm run tauri build -- --bundles deb

# RPM package only
npm run tauri build -- --bundles rpm
```

### macOS

**Build for macOS:**
```bash
npm run tauri build
```

This creates:
- **DMG**: `src-tauri/target/release/bundle/dmg/bore-gui_0.1.0_x64.dmg`
- **App Bundle**: `src-tauri/target/release/bundle/macos/bore-gui.app`

**Universal Binary (Intel + Apple Silicon):**
```bash
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### Windows

**Build for Windows:**
```bash
npm run tauri build
```

This creates:
- **MSI Installer**: `src-tauri/target/release/bundle/msi/bore-gui_0.1.0_x64_en-US.msi`
- **NSIS Installer**: `src-tauri/target/release/bundle/nsis/bore-gui_0.1.0_x64-setup.exe`

### Cross-Compilation

**From Linux to Windows:**
```bash
# Install cross-compilation tools
sudo apt install mingw-w64
rustup target add x86_64-pc-windows-gnu

# Build for Windows
npm run tauri build -- --target x86_64-pc-windows-gnu
```

---

## Distribution

### Creating Releases

1. **Update version** in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Build for all platforms**:
   ```bash
   # On Linux
   npm run tauri build

   # On macOS
   npm run tauri build

   # On Windows
   npm run tauri build
   ```

3. **Create GitHub release**:
   - Tag: `v0.1.0`
   - Upload all bundles from each platform

### Code Signing (Recommended for Production)

#### macOS
```bash
# Get signing identity
security find-identity -v -p codesigning

# Update tauri.conf.json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
      }
    }
  }
}
```

#### Windows
```bash
# Get code signing certificate
# Update tauri.conf.json with certificate path
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "THUMBPRINT",
        "digestAlgorithm": "sha256"
      }
    }
  }
}
```

---

## Configuration

### Customizing the Build

Edit `src-tauri/tauri.conf.json`:

```json
{
  "package": {
    "productName": "Bore Tunnel",
    "version": "0.1.0"
  },
  "tauri": {
    "bundle": {
      "identifier": "com.bore.tunnel",
      "icon": ["icons/icon.png"],
      "resources": [],
      "copyright": "",
      "category": "DeveloperTool",
      "shortDescription": "Tunnel management tool",
      "longDescription": "A cross-platform GUI for managing bore tunnels"
    }
  }
}
```

### Adding Custom Icons

1. Create a 1024x1024 PNG icon
2. Save as `src-tauri/icons/icon.png`
3. Generate all sizes:
   ```bash
   cargo tauri icon src-tauri/icons/icon.png
   ```

---

## Troubleshooting

### Build Fails on Linux

**Error: webkit2gtk not found**
```bash
sudo apt install libwebkit2gtk-4.0-dev
```

**Error: pkg-config not found**
```bash
sudo apt install pkg-config
```

### Build Fails on macOS

**Error: Xcode license not accepted**
```bash
sudo xcodebuild -license accept
```

### Build Fails on Windows

**Error: MSVC not found**
- Install Visual Studio 2022 Build Tools
- Select "Desktop development with C++"

### Runtime Errors

**Error: "Backend connection refused"**
- Ensure backend is running on port 3000
- Check firewall settings

**Error: "Failed to load credentials"**
- Check file permissions on config directory
- Linux: `~/.config/bore/`
- macOS: `~/Library/Application Support/bore/`
- Windows: `%APPDATA%\bore\`

---

## Performance Optimization

### Reduce Bundle Size

```bash
# Enable production optimizations
npm run tauri build -- --release

# Strip debug symbols (Linux/macOS)
strip src-tauri/target/release/bore-gui
```

### Faster Development Builds

```bash
# Use mold linker (Linux)
sudo apt install mold
export RUSTFLAGS="-C link-arg=-fuse-ld=mold"

# Or use lld (all platforms)
export RUSTFLAGS="-C link-arg=-fuse-ld=lld"
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build GUI

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - uses: dtolnay/rust-toolchain@stable
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.0-dev
      - name: Install frontend dependencies
        working-directory: bore-gui
        run: npm install
      - name: Build
        working-directory: bore-gui
        run: npm run tauri build
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: bore-gui-${{ matrix.platform }}
          path: bore-gui/src-tauri/target/release/bundle/
```

---

## Next Steps

1. **Test the application** on your target platforms
2. **Customize the UI** to match your branding
3. **Add more features** (see Feature Ideas below)
4. **Set up auto-updates** using Tauri's updater
5. **Deploy to production** and distribute to users

### Feature Ideas

- [ ] Settings panel for API endpoint configuration
- [ ] Dark mode support
- [ ] Tunnel usage statistics and graphs
- [ ] Multiple profile support
- [ ] Export/import tunnel configurations
- [ ] Custom domain mapping
- [ ] Notification when tunnel disconnects
- [ ] Auto-reconnect on network issues

---

## Support

- **Documentation**: See README.md
- **Issues**: Report on GitHub
- **Community**: Join our Discord/Slack

Happy building! 🚀

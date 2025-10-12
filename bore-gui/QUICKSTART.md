# Quick Start Guide - Bore Tunnel GUI

Get up and running with the Bore Tunnel GUI in 5 minutes!

## Step 1: Install Dependencies (First Time Only)

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### Linux (Fedora)
```bash
sudo dnf install webkit2gtk3-devel openssl-devel curl wget libappindicator-gtk3-devel librsvg2-devel
```

### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Windows
No additional dependencies needed!

## Step 2: Install Node.js & Rust

### Install Node.js
- Download from https://nodejs.org/ (v16 or higher)
- Or use your package manager

### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Step 3: Build the App

```bash
# Navigate to the GUI directory
cd bore-gui

# Install JavaScript dependencies
npm install

# Build the app (this takes a few minutes the first time)
npm run tauri build
```

## Step 4: Run the App

### Option A: Development Mode (recommended for testing)
```bash
npm run tauri dev
```

### Option B: Production Build

**Linux:**
```bash
# AppImage (portable)
./src-tauri/target/release/bundle/appimage/bore-gui_0.1.0_amd64.AppImage

# Or install the .deb package
sudo dpkg -i src-tauri/target/release/bundle/deb/bore-gui_0.1.0_amd64.deb
```

**macOS:**
```bash
# Open the DMG
open src-tauri/target/release/bundle/dmg/bore-gui_0.1.0_x64.dmg
# Then drag to Applications
```

**Windows:**
```bash
# Run the installer
src-tauri/target/release/bundle/msi/bore-gui_0.1.0_x64_en-US.msi
```

## Step 5: Use the App

1. **Launch** the application
2. **Login** with your bore account:
   - Email: your@email.com
   - Password: your_password

3. **Create a tunnel instance**:
   - Click "New Instance"
   - Name: "my-server"
   - Local Port: 8080
   - Region: us-east-1
   - Click "Create Instance"

4. **Start the tunnel**:
   - Click the "Start" button on your instance
   - The status will turn green (Active)
   - Copy the public URL to share

5. **Test it**:
   - Make sure you have a service running on localhost:8080
   - Visit the public URL in a browser
   - Your local service is now accessible!

## Common Issues

### "Command not found: npm"
Install Node.js from https://nodejs.org/

### "Command not found: cargo"
Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### Linux: Build fails with webkit errors
Install system dependencies (see Step 1)

### macOS: "App is damaged"
```bash
xattr -cr /Applications/bore-gui.app
```

### "Connection refused" when starting tunnel
Make sure your backend API is running at http://127.0.0.1:3000

## What's Next?

- Create multiple tunnel instances for different services
- Try different regions to optimize latency
- Use the system tray to minimize the app
- Check out the full README.md for advanced features

## Need Help?

- Read the full README.md
- Check the bore documentation
- Report issues on GitHub

Happy tunneling! 🚇

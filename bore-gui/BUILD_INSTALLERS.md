# 🔨 How to Build Installers (For Developers)

This guide shows YOU how to create the double-click installers for your users.

---

## 🎯 What You'll Create

After following this guide, you'll have:

- **Windows**: `bore-tunnel-setup.exe` (users just double-click)
- **macOS**: `bore-tunnel.dmg` (users drag to Applications)
- **Linux**: `bore-tunnel.deb`, `bore-tunnel.rpm`, `bore-tunnel.AppImage` (users double-click)

**No command line needed for users!**

---

## ⚙️ One-Time Setup (Do This Once)

### 1. Install Prerequisites

#### Install Node.js
```bash
# Download from: https://nodejs.org/
# Or use package manager
```

#### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Install System Dependencies (Linux only)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Fedora:**
```bash
sudo dnf install -y webkit2gtk3-devel openssl-devel curl wget libappindicator-gtk3-devel librsvg2-devel
```

### 2. Install Project Dependencies

```bash
cd bore-gui
npm install
```

---

## 🚀 Building Installers

### All Platforms: One Command

```bash
npm run tauri build
```

**That's it!** This builds everything automatically.

⏱️ **Time**: 
- First build: 5-10 minutes
- Subsequent builds: 1-2 minutes

---

## 📦 Where to Find the Installers

After building, find your installers here:

### Windows
```
bore-gui/src-tauri/target/release/bundle/
├── msi/
│   └── bore-tunnel_0.1.0_x64_en-US.msi      ← Give this to users
└── nsis/
    └── bore-tunnel_0.1.0_x64-setup.exe      ← Or this one (recommended)
```

**Rename for users:**
```bash
cp bore-tunnel_0.1.0_x64-setup.exe bore-tunnel-setup.exe
```

### macOS
```
bore-gui/src-tauri/target/release/bundle/
└── dmg/
    └── bore-tunnel_0.1.0_x64.dmg            ← Give this to users
```

**Rename for users:**
```bash
cp bore-tunnel_0.1.0_x64.dmg bore-tunnel.dmg
```

### Linux
```
bore-gui/src-tauri/target/release/bundle/
├── appimage/
│   └── bore-tunnel_0.1.0_amd64.AppImage     ← Universal (all distros)
├── deb/
│   └── bore-tunnel_0.1.0_amd64.deb          ← Ubuntu/Debian
└── rpm/
    └── bore-tunnel-0.1.0-1.x86_64.rpm       ← Fedora/RHEL
```

**Rename for users:**
```bash
cp bore-tunnel_0.1.0_amd64.AppImage bore-tunnel.AppImage
cp bore-tunnel_0.1.0_amd64.deb bore-tunnel.deb
cp bore-tunnel-0.1.0-1.x86_64.rpm bore-tunnel.rpm
```

---

## 🎁 Distribution

### Option 1: Direct File Sharing

1. **Copy** the installers from the bundle folders
2. **Upload** to your file server / cloud storage
3. **Share** the download links with users
4. **Include** the `USER_INSTALLATION_GUIDE.md`

### Option 2: GitHub Releases

1. Go to your GitHub repository
2. Click **Releases** → **Create new release**
3. Tag: `v0.1.0`
4. Upload all installer files
5. Add release notes
6. Publish!

Users can download from: `https://github.com/yourname/bore/releases/latest`

### Option 3: Website Download Page

Create a simple download page:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Download Bore Tunnel</title>
</head>
<body>
    <h1>Download Bore Tunnel</h1>
    
    <h2>Windows</h2>
    <a href="bore-tunnel-setup.exe">Download for Windows</a>
    
    <h2>macOS</h2>
    <a href="bore-tunnel.dmg">Download for macOS</a>
    
    <h2>Linux</h2>
    <a href="bore-tunnel.AppImage">Download AppImage (All distros)</a><br>
    <a href="bore-tunnel.deb">Download .deb (Ubuntu/Debian)</a><br>
    <a href="bore-tunnel.rpm">Download .rpm (Fedora/RHEL)</a>
</body>
</html>
```

---

## 🤖 Automated Build Script

Save this as `bore-gui/build-all.sh`:

```bash
#!/bin/bash

echo "🔨 Building Bore Tunnel Installers..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf src-tauri/target/release/bundle

# Build
echo "🚀 Building installers..."
npm run tauri build

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📦 Installers created:"
    echo ""
    
    # List all created installers
    find src-tauri/target/release/bundle -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) -exec ls -lh {} \;
    
    echo ""
    echo "📁 Location: src-tauri/target/release/bundle/"
    echo ""
    echo "👉 Share these files with your users!"
else
    echo ""
    echo "❌ Build failed!"
    echo "Check the error messages above."
fi
```

**Make it executable:**
```bash
chmod +x build-all.sh
```

**Run it:**
```bash
./build-all.sh
```

---

## 📝 Checklist Before Distribution

- [ ] Build completed successfully
- [ ] Test installer on clean machine
- [ ] Windows: Test both .exe and .msi
- [ ] macOS: Test on Intel and Apple Silicon (if possible)
- [ ] Linux: Test AppImage, .deb, and .rpm
- [ ] Verify app launches correctly
- [ ] Test login functionality
- [ ] Test creating a tunnel
- [ ] Test start/stop tunnel
- [ ] Include `USER_INSTALLATION_GUIDE.md` with downloads
- [ ] Update version number if needed
- [ ] Create release notes

---

## 🔄 Updating the Version

Before building new releases:

1. **Update version** in `package.json`:
```json
{
  "version": "0.2.0"
}
```

2. **Update version** in `src-tauri/Cargo.toml`:
```toml
[package]
version = "0.2.0"
```

3. **Update version** in `src-tauri/tauri.conf.json`:
```json
{
  "package": {
    "version": "0.2.0"
  }
}
```

4. **Build** new installers:
```bash
npm run tauri build
```

---

## 🐛 Troubleshooting Build Issues

### "npm: command not found"
Install Node.js from https://nodejs.org/

### "cargo: command not found"
Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Linux: "webkit2gtk not found"
```bash
sudo apt install libwebkit2gtk-4.0-dev
```

### macOS: "Xcode license not accepted"
```bash
sudo xcodebuild -license accept
```

### Windows: "MSVC not found"
Install Visual Studio 2022 Build Tools with C++ development tools.

### "Build takes too long"
First build compiles all dependencies (5-10 min). Subsequent builds are much faster.

---

## 📊 Installer Sizes

Typical sizes:

- **Windows .exe**: ~4-5 MB
- **Windows .msi**: ~4-5 MB
- **macOS .dmg**: ~4-6 MB
- **Linux .deb**: ~3-4 MB
- **Linux .rpm**: ~3-4 MB
- **Linux AppImage**: ~5-6 MB

**Why so small?** Tauri uses the system's web view instead of bundling Chrome like Electron apps.

---

## 🎯 Quick Reference

### Build Command
```bash
npm run tauri build
```

### Output Location
```
src-tauri/target/release/bundle/
```

### Files to Distribute
- Windows: `*.exe` or `*.msi`
- macOS: `*.dmg`
- Linux: `*.AppImage`, `*.deb`, `*.rpm`

---

## ✨ Pro Tips

### Build for Multiple Platforms

You can only build for the platform you're on:
- **On Windows**: Builds Windows installers
- **On macOS**: Builds macOS installers
- **On Linux**: Builds Linux installers

To support all platforms, you need access to each OS (or use CI/CD).

### Reduce Build Time

Use faster linker (Linux/macOS):
```bash
# Install mold
sudo apt install mold  # Ubuntu
brew install mold      # macOS

# Use it
export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
npm run tauri build
```

### CI/CD with GitHub Actions

See `SETUP_GUIDE.md` for automated building on GitHub.

---

## 🎉 You're Ready!

Now you can:
1. Run `npm run tauri build`
2. Get the installers from `bundle/` folders
3. Give them to your users
4. Users just **double-click** to install!

**No command line for users. Just click and use!** 🚀

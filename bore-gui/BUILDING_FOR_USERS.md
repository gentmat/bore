# 🎯 Building Installers for Non-Technical Users

**Goal**: Create simple double-click installers that anyone can use without command line.

---

## 📝 TL;DR (Too Long, Didn't Read)

```bash
# 1. One-time setup
cd bore-gui
npm install

# 2. Build installers
./build-installers.sh    # Linux/macOS
# or
build-installers.bat     # Windows

# 3. Share files from 'release' folder with users
```

**That's it!** Users just double-click the installers.

---

## 🚀 Quick Start

### Step 1: Build the Installers

**Linux/macOS:**
```bash
cd bore-gui
chmod +x build-installers.sh
./build-installers.sh
```

**Windows:**
```cmd
cd bore-gui
build-installers.bat
```

### Step 2: Get the Files

All installers are in the `release/` folder:

```
release/
├── bore-tunnel-setup.exe    (Windows)
├── bore-tunnel.msi          (Windows alternative)
├── bore-tunnel.dmg          (macOS)
├── bore-tunnel.AppImage     (Linux - all distros)
├── bore-tunnel.deb          (Ubuntu/Debian)
└── bore-tunnel.rpm          (Fedora/RHEL)
```

### Step 3: Distribute

**Option A: Direct File Sharing**
- Upload to Google Drive / Dropbox / your server
- Share the download link
- Include `USER_INSTALLATION_GUIDE.md`

**Option B: GitHub Releases**
- Create a release on GitHub
- Upload all installer files
- Users download from releases page

**Option C: Website**
- Host on your website
- Create a simple download page

---

## 👥 What Your Users Need to Do

### Windows Users
1. Download `bore-tunnel-setup.exe`
2. Double-click it
3. Click "Next" a few times
4. Done! ✅

### macOS Users
1. Download `bore-tunnel.dmg`
2. Double-click it
3. Drag app to Applications folder
4. Done! ✅

### Linux Users

**Easy Way (all distros):**
1. Download `bore-tunnel.AppImage`
2. Right-click → Properties → Permissions → Check "Execute"
3. Double-click it
4. Done! ✅

**Ubuntu/Debian:**
1. Download `bore-tunnel.deb`
2. Double-click it
3. Click "Install"
4. Done! ✅

**Fedora/RHEL:**
1. Download `bore-tunnel.rpm`
2. Double-click it
3. Click "Install"
4. Done! ✅

---

## 📋 Complete Workflow

### For YOU (The Developer)

1. **First Time Setup** (5-10 minutes)
   ```bash
   cd bore-gui
   npm install
   ```

2. **Build Installers** (2-5 minutes after first time)
   ```bash
   ./build-installers.sh    # or build-installers.bat on Windows
   ```

3. **Test Locally** (recommended)
   - Install on a clean machine
   - Verify it works
   - Test login and tunnel creation

4. **Distribute**
   - Upload installers from `release/` folder
   - Share download links
   - Provide `USER_INSTALLATION_GUIDE.md`

### For YOUR USERS (Non-Technical)

1. **Download** the installer for their platform
2. **Double-click** the installer
3. **Follow** simple installation wizard
4. **Launch** the app from their programs menu
5. **Use** it! No command line ever!

---

## 🎁 What to Give Your Users

Create a download package with:

```
bore-tunnel-v1.0/
├── Windows/
│   ├── bore-tunnel-setup.exe
│   └── Install Instructions.txt
├── macOS/
│   ├── bore-tunnel.dmg
│   └── Install Instructions.txt
├── Linux/
│   ├── bore-tunnel.AppImage
│   ├── bore-tunnel.deb
│   ├── bore-tunnel.rpm
│   └── Install Instructions.txt
└── USER_INSTALLATION_GUIDE.md
```

---

## 📝 Sample "Install Instructions.txt"

**For Windows:**
```
Bore Tunnel - Installation

1. Double-click "bore-tunnel-setup.exe"
2. If Windows asks "Do you want to allow?", click YES
3. Click NEXT → NEXT → INSTALL
4. Click FINISH
5. Find "Bore Tunnel" in your Start Menu
6. Double-click to launch!

First time use:
- Enter your email and password
- Click "New Instance" to create a tunnel
- Click "Start" to begin tunneling
- Copy the public URL and share it!

Need help? See USER_INSTALLATION_GUIDE.md
```

**For macOS:**
```
Bore Tunnel - Installation

1. Double-click "bore-tunnel.dmg"
2. Drag the Bore Tunnel icon to Applications folder
3. Close the window
4. Open Applications folder
5. Double-click Bore Tunnel
6. If macOS says "cannot open", right-click and choose "Open"

First time use:
- Enter your email and password
- Click "New Instance" to create a tunnel
- Click "Start" to begin tunneling
- Copy the public URL and share it!

Need help? See USER_INSTALLATION_GUIDE.md
```

**For Linux:**
```
Bore Tunnel - Installation

EASY WAY (works on all Linux):
1. Right-click "bore-tunnel.AppImage"
2. Choose Properties → Permissions
3. Check "Allow executing file as program"
4. Double-click the file
5. Done!

UBUNTU/DEBIAN:
1. Double-click "bore-tunnel.deb"
2. Click "Install"
3. Enter password
4. Find "Bore Tunnel" in applications menu

FEDORA/RHEL:
1. Double-click "bore-tunnel.rpm"
2. Click "Install"
3. Enter password
4. Find "Bore Tunnel" in applications menu

First time use:
- Enter your email and password
- Click "New Instance" to create a tunnel
- Click "Start" to begin tunneling
- Copy the public URL and share it!

Need help? See USER_INSTALLATION_GUIDE.md
```

---

## ❓ FAQ

### Do users need to install anything else?

**No!** Everything is included in the installers. Users just double-click and go.

### Do users need Node.js or Rust?

**No!** Only YOU (the developer) need those to BUILD the installers. End users don't need anything.

### Can I build for all platforms at once?

**No.** You can only build for the platform you're on:
- Build on Windows → Get Windows installers
- Build on macOS → Get macOS installers  
- Build on Linux → Get Linux installers

To support all platforms, build on each OS or use CI/CD (see `SETUP_GUIDE.md`).

### How big are the installers?

Very small! 3-5 MB each. Much smaller than Electron apps (100+ MB).

### Can users auto-update?

Not yet, but can be added. For now, users download and install new versions the same way.

### Do I need to rebuild often?

Only when you:
- Fix a bug
- Add a new feature
- Update dependencies
- Want to release a new version

---

## 🎯 Checklist

**Before First Distribution:**
- [ ] Build completed successfully
- [ ] Tested on clean machine
- [ ] Created `release/` folder with installers
- [ ] Created simple install instructions
- [ ] Included `USER_INSTALLATION_GUIDE.md`
- [ ] Tested login works
- [ ] Tested tunnel creation works
- [ ] Chose distribution method (files/GitHub/website)

**For Each New Release:**
- [ ] Update version number (package.json, Cargo.toml, tauri.conf.json)
- [ ] Run build script
- [ ] Test new installers
- [ ] Create release notes (what's new?)
- [ ] Upload to distribution channel
- [ ] Notify users

---

## 🎉 Summary

**You**: Run one script → Get installers → Share with users  
**Users**: Download → Double-click → Use!

**No command line. No technical knowledge needed. Just simple installers!** 🚀

---

## 📞 Need More Help?

- See `BUILD_INSTALLERS.md` for detailed build instructions
- See `USER_INSTALLATION_GUIDE.md` for user instructions
- See `SETUP_GUIDE.md` for advanced CI/CD setup

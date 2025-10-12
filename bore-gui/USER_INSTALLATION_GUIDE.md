# 📦 Bore Tunnel - Installation Guide for Users

**Simple, no-code installation. Just download and double-click!**

---

## 🪟 Windows Installation

### Step 1: Download
Download the installer:
- **`bore-tunnel-setup.exe`** (recommended)
- Or **`bore-tunnel.msi`**

### Step 2: Install
1. **Double-click** the downloaded file
2. If Windows asks "Do you want to allow this app?", click **Yes**
3. Click **Next** → **Next** → **Install**
4. Wait for installation to complete
5. Click **Finish**

### Step 3: Launch
- Find **Bore Tunnel** in your Start Menu
- Or double-click the desktop shortcut
- That's it! ✅

**Note**: Windows Defender might show a warning. Click "More info" → "Run anyway" (this is normal for new apps).

---

## 🍎 macOS Installation

### Step 1: Download
Download the installer:
- **`bore-tunnel.dmg`**

### Step 2: Install
1. **Double-click** the `.dmg` file
2. A window opens → **Drag the Bore Tunnel icon** to the **Applications folder**
3. Close the window
4. Eject the DMG (right-click the disk icon → Eject)

### Step 3: Launch
1. Open **Applications** folder
2. **Double-click** Bore Tunnel
3. If macOS says "Cannot open because it's from an unidentified developer":
   - Right-click the app
   - Click **Open**
   - Click **Open** again
   - (You only need to do this once!)

**That's it!** ✅

---

## 🐧 Linux Installation

Choose your distribution:

### Ubuntu / Debian / Pop!_OS / Linux Mint

**Option 1: Debian Package (Recommended)**

1. **Download**: `bore-tunnel.deb`
2. **Double-click** the file
3. Software Center opens → Click **Install**
4. Enter your password
5. Wait for installation
6. Done! ✅

**Launch**: Search for "Bore Tunnel" in your applications menu.

**Option 2: Command Line**
```bash
sudo dpkg -i bore-tunnel.deb
```

---

### Fedora / RHEL / CentOS

1. **Download**: `bore-tunnel.rpm`
2. **Double-click** the file
3. Software Center opens → Click **Install**
4. Enter your password
5. Wait for installation
6. Done! ✅

**Launch**: Search for "Bore Tunnel" in your applications menu.

**Option 2: Command Line**
```bash
sudo rpm -i bore-tunnel.rpm
```

---

### Any Linux (Universal)

**AppImage - Works on ALL Linux distributions!**

1. **Download**: `bore-tunnel.AppImage`
2. Right-click the file → **Properties**
3. Go to **Permissions** tab
4. Check **"Allow executing file as program"**
5. Close properties
6. **Double-click** the file
7. Done! ✅

**No installation needed** - just run it!

---

## 🎯 First Time Usage

After installation:

### 1. Launch the App
Open **Bore Tunnel** from your applications menu or desktop.

### 2. Login
- Enter your **email address**
- Enter your **password**
- Click **Sign In**

### 3. Create a Tunnel
- Click **"New Instance"** button
- Fill in:
  - **Name**: e.g., "my-website"
  - **Local Port**: e.g., 8080
  - **Region**: Choose closest to you
- Click **"Create Instance"**

### 4. Start Tunneling
- Find your instance in the dashboard
- Click the **"Start"** button
- Status turns green ✅
- Click the copy icon to copy your public URL
- Share the URL!

### 5. Stop Tunneling
- Click the **"Stop"** button when done
- That's it!

---

## ❓ Common Questions

### "Where do I download the installer?"

Your administrator or team lead will provide you with the download link.

### "Do I need to install anything else?"

**No!** Everything is included. Just install and use.

### "Can I use it without internet?"

No, you need an internet connection to create tunnels.

### "Is my data safe?"

Yes! All connections are encrypted, and your credentials are stored securely on your computer only.

### "How do I update?"

Download the new version and install it the same way. It will update automatically.

---

## 🆘 Troubleshooting

### Windows: "This app can't run on your PC"
- Make sure you're on Windows 10 or newer
- Download the correct version (64-bit)

### macOS: "App is damaged and can't be opened"
1. Open Terminal (search in Spotlight)
2. Type: `xattr -cr /Applications/Bore\ Tunnel.app`
3. Press Enter
4. Try opening the app again

### Linux: "Missing dependencies"
Install required packages:

**Ubuntu/Debian:**
```bash
sudo apt install libwebkit2gtk-4.0-37 libgtk-3-0
```

**Fedora:**
```bash
sudo dnf install webkit2gtk3 gtk3
```

### "Login failed"
- Check your email and password
- Make sure you have an internet connection
- Contact your administrator

### "Can't create tunnel"
- Make sure you're logged in
- Check that the port number is correct
- Verify the service is running on that port

---

## 📞 Need Help?

Contact your system administrator or IT support team.

---

## ✨ Tips & Tricks

### Minimize to Tray
- Click the minimize button to send the app to system tray
- Click the tray icon to bring it back

### Quick URL Copy
- Click the copy icon next to any active tunnel
- URL is copied to clipboard instantly

### System Startup
- Keep the app running in the background
- Your tunnels start automatically when you need them

---

**Enjoy using Bore Tunnel!** 🚀

*No command line required. No technical skills needed. Just simple, easy tunneling.*

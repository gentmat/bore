# Testing Dependency Installation

## How to check what's happening:

### 1. Check if bore-client is detected:
```bash
# In PATH?
which bore-client
bore-client --version

# In ~/.local/bin?
ls -la ~/.local/bin/bore-client
~/.local/bin/bore-client --version
```

### 2. Check if code-server is detected:
```bash
# In PATH?
which code-server
code-server --version

# In ~/.local/bin?
ls -la ~/.local/bin/code-server
```

### 3. View application logs:

When you run the installed AppImage or DEB package, the logs will show what's happening.

**For development mode:**
```bash
cd /home/maroun/Documents/bore/bore-gui
npm run tauri dev
# Watch the terminal output for dependency check logs
```

**For installed app:**
Run from terminal to see logs:
```bash
# If installed via DEB
/usr/bin/bore-tunnel

# If running AppImage
./release/bore-tunnel.AppImage
```

### 4. What should happen:

When you first open the app, you should see in the terminal:
```
Checking bore-client installation...
Searching for bundled bore-client binary...
  Checking: /path/to/resources/bore-client
✅ Found bore-client at: /path/to/resources/bore-client
bore-client not found, attempting installation...
bore-client installed to: /home/USER/.local/bin/bore-client
```

### 5. If bore-client isn't being installed:

The most likely issue is that the bundled binary isn't being found. Check:
```bash
# For AppImage - extract and check
./release/bore-tunnel.AppImage --appimage-extract
ls -la squashfs-root/usr/bin/resources/

# For DEB - check after install
dpkg -L bore-tunnel | grep bore-client
```

## Common Issues:

1. **Bundled binary not found** - Resource not included in build
2. **PATH not set** - ~/.local/bin not in PATH
3. **Permissions** - Binary exists but not executable
4. **code-server download fails** - Network issue or curl not available

## Debug Steps:

1. Rebuild with enhanced logging (already done)
2. Run in dev mode and check terminal output
3. Install fresh and run from terminal
4. Check ~/.local/bin after running

# Bore Tunnel GUI

A beautiful, cross-platform desktop application for managing bore tunnels. Built with Tauri, React, and TailwindCSS.

![Bore Tunnel GUI](screenshot.png)

## Features

- 🔐 **Secure Login** - Email/password authentication
- 📊 **Dashboard** - View all your tunnel instances at a glance
- ▶️ **One-Click Start/Stop** - Manage tunnels with a single click
- 📝 **Create Instances** - Easy instance creation with form validation
- 📈 **Live Status** - Real-time tunnel status updates
- 🎨 **Modern UI** - Beautiful, responsive interface
- 🔔 **System Tray** - Minimize to tray and run in background
- 🌍 **Cross-Platform** - Works on Linux, macOS, and Windows

## Prerequisites

### Development

- **Rust** (latest stable) - [Install Rust](https://rustup.rs/)
- **Node.js** (v16 or higher) - [Install Node.js](https://nodejs.org/)
- **System Dependencies** (Linux only):
  ```bash
  # Debian/Ubuntu
  sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
  # Ubuntu 24.04+: this transitional package pulls in the libwebkit2gtk-4.1 libraries
  
  # Fedora
  sudo dnf install webkit2gtk3-devel \
    openssl-devel \
    curl \
    wget \
    libappindicator-gtk3-devel \
    librsvg2-devel
  
  # Arch Linux
  sudo pacman -S webkit2gtk \
    base-devel \
    curl \
    wget \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
  ```

## Installation

### Runtime Dependencies

The Bore GUI application requires two dependencies to run:
- **bore-client**: The tunnel client (automatically bundled with the app)
- **code-server**: VS Code in the browser (automatically installed on first run)

The app will **automatically install these dependencies** when you first launch it. If automatic installation fails, see [DEPENDENCY_SETUP.md](DEPENDENCY_SETUP.md) for manual installation instructions.

### From Source

1. **Clone the repository**:
   ```bash
   cd bore/bore-gui
   ```

2. **Prepare resources** (build bore-client and copy to resources):
   ```bash
   ./prepare-resources.sh
   ```

3. **Install frontend dependencies**:
   ```bash
   npm install
   ```

4. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```

5. **Build for production**:
   ```bash
   npm run tauri build
   ```

   The built application will be in `src-tauri/target/release/bundle/`.

### Platform-Specific Builds

#### Linux

After building, you'll find packages in `src-tauri/target/release/bundle/`:
- **AppImage**: `bore-gui_0.1.0_amd64.AppImage` (portable, works on all distros)
- **Debian/Ubuntu**: `bore-gui_0.1.0_amd64.deb`
- **RPM**: `bore-gui-0.1.0-1.x86_64.rpm` (Fedora, CentOS, RHEL)

**Install on Debian/Ubuntu**:
```bash
sudo dpkg -i bore-gui_0.1.0_amd64.deb
```

**Install on Fedora/RHEL**:
```bash
sudo rpm -i bore-gui-0.1.0-1.x86_64.rpm
```

**Run AppImage**:
```bash
chmod +x bore-gui_0.1.0_amd64.AppImage
./bore-gui_0.1.0_amd64.AppImage
```

#### macOS

After building, you'll find:
- **DMG**: `bore-gui_0.1.0_x64.dmg`
- **App Bundle**: `bore-gui.app`

Double-click the DMG and drag the app to Applications.

#### Windows

After building, you'll find:
- **MSI Installer**: `bore-gui_0.1.0_x64_en-US.msi`
- **NSIS Installer**: `bore-gui_0.1.0_x64-setup.exe`

Run the installer and follow the installation wizard.

## Usage

### First Time Setup

1. **Launch the app**
2. **Login** with your bore account credentials
3. **Create an instance**:
   - Click "New Instance"
   - Enter a name (e.g., "my-web-server")
   - Enter local port (e.g., 8080)
   - Select a region
   - Click "Create Instance"

### Starting a Tunnel

1. Find your instance in the dashboard
2. Click the **Start** button
3. The status will change to "Active"
4. Copy the public URL to share

### Stopping a Tunnel

1. Find your active instance
2. Click the **Stop** button
3. The status will change to "Inactive"

### System Tray

- The app can run in the system tray
- Click the tray icon to show/hide the window
- Right-click for quick actions

## Configuration

The app stores configuration in:
- **Linux**: `~/.config/bore/credentials.json`
- **macOS**: `~/Library/Application Support/bore/credentials.json`
- **Windows**: `%APPDATA%\bore\credentials.json`

## Development

### Project Structure

```
bore-gui/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # React entry point
│   └── styles.css         # Tailwind styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Tauri setup
│   │   ├── commands.rs    # Tauri commands
│   │   ├── state.rs       # App state management
│   │   └── tunnel_manager.rs  # Tunnel logic
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── package.json           # Node dependencies
└── README.md             # This file
```

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build frontend for production
- `npm run tauri dev` - Run Tauri in development mode
- `npm run tauri build` - Build production app

### Adding Features

1. **Backend (Rust)**:
   - Add Tauri commands in `src-tauri/src/commands.rs`
   - Update state in `src-tauri/src/state.rs`
   - Register commands in `src-tauri/src/main.rs`

2. **Frontend (React)**:
   - Create components in `src/components/`
   - Call Tauri commands using `invoke()` from `@tauri-apps/api`

## Troubleshooting

### Dependency Installation Failed

If you see "Dependency setup failed" on startup:

1. **Check PATH**: Ensure `~/.local/bin` is in your PATH:
   ```bash
   echo $PATH | grep ".local/bin"
   ```

2. **Add to PATH** if missing:
   ```bash
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Manual installation**: See [DEPENDENCY_SETUP.md](DEPENDENCY_SETUP.md) for detailed instructions

4. **Try again**: Restart the application after updating PATH

### bore-client not found

```bash
# Build and install manually
cd bore-client
cargo build --release
mkdir -p ~/.local/bin
cp target/release/bore ~/.local/bin/bore-client
chmod +x ~/.local/bin/bore-client
```

### code-server not found

```bash
# Install using official script
curl -fsSL https://code-server.dev/install.sh | sh
```

### Linux: App won't start

Make sure you have all system dependencies installed:
```bash
sudo apt install libwebkit2gtk-4.0-37 libgtk-3-0
```

### macOS: "App is damaged" error

Remove the quarantine attribute:
```bash
xattr -cr /Applications/bore-gui.app
```

### Windows: Antivirus blocking

Add an exception for the bore-gui executable in your antivirus software.

### Connection errors

- Verify your backend API is running
- Check the API endpoint in settings
- Ensure your credentials are valid

## Building Icons

To generate app icons:

1. Create a 1024x1024 PNG icon
2. Place it in `src-tauri/icons/icon.png`
3. Run:
   ```bash
   npm install -g @tauri-apps/cli
   cargo tauri icon src-tauri/icons/icon.png
   ```

## Security

- Credentials are stored locally in an encrypted format
- HTTPS is used for all API communication
- API tokens are never logged or exposed
- The app uses Tauri's security features

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on your platform
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Built with:
- [Tauri](https://tauri.app/) - Desktop app framework
- [React](https://react.dev/) - UI framework
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icon library
- [Vite](https://vitejs.dev/) - Build tool

## Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/yourusername/bore/issues)
- Documentation: See the main bore README

---

Made with ❤️ for the bore community

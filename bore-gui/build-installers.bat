@echo off
REM Bore Tunnel - Automated Installer Build Script for Windows

echo.
echo ╔════════════════════════════════════════════════╗
echo ║   Bore Tunnel - Building User Installers      ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Check if package.json exists
if not exist package.json (
    echo ❌ Error: Run this script from the bore-gui directory
    pause
    exit /b 1
)

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Node.js is not installed
    echo    Install from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if cargo is installed
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Rust is not installed
    echo    Install from: https://rustup.rs/
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist src-tauri\target\release\bundle rmdir /s /q src-tauri\target\release\bundle
echo.

REM Build installers
echo 🚀 Building installers (this may take a few minutes)...
echo.
call npm run tauri build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════════╗
    echo ║            ✅ BUILD SUCCESSFUL!                ║
    echo ╚════════════════════════════════════════════════╝
    echo.
    echo 📦 Installers created:
    echo.
    
    REM Create release directory
    if not exist release mkdir release
    
    echo 🪟 Windows Installers:
    
    REM Copy NSIS installer
    if exist src-tauri\target\release\bundle\nsis\*-setup.exe (
        for %%f in (src-tauri\target\release\bundle\nsis\*-setup.exe) do (
            copy "%%f" release\bore-tunnel-setup.exe >nul
            echo    Setup.exe: release\bore-tunnel-setup.exe
        )
    )
    
    REM Copy MSI installer
    if exist src-tauri\target\release\bundle\msi\*.msi (
        for %%f in (src-tauri\target\release\bundle\msi\*.msi) do (
            copy "%%f" release\bore-tunnel.msi >nul
            echo    MSI:       release\bore-tunnel.msi
        )
    )
    
    echo.
    echo 📁 Installers copied to: .\release\
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo 👉 Next Steps:
    echo    1. Go to the 'release' folder
    echo    2. Copy the installer files
    echo    3. Share them with your users
    echo    4. Users just double-click to install!
    echo.
    echo 📝 Include USER_INSTALLATION_GUIDE.md with the files
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    
) else (
    echo.
    echo ╔════════════════════════════════════════════════╗
    echo ║              ❌ BUILD FAILED!                  ║
    echo ╚════════════════════════════════════════════════╝
    echo.
    echo Check the error messages above for details.
    echo.
)

pause

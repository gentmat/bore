#!/bin/bash
# Build bore client (Rust CLI)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

install_code_server() {
    if command -v code-server &> /dev/null; then
        echo "code-server already installed"
        return
    fi

    echo "Installing code-server..."

    if command -v curl &> /dev/null; then
        case "$(uname -s)" in
            Linux|Darwin)
                curl -fsSL https://code-server.dev/install.sh | sh
                return
                ;;
        esac
    fi

    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            if command -v npm &> /dev/null; then
                npm install --global code-server
            else
                echo "npm not found. Attempting to install Node.js and npm on Windows..."

                if command -v winget &> /dev/null; then
                    winget install --id OpenJS.NodeJS.LTS -e --silent || winget install --id OpenJS.NodeJS -e --silent || true
                elif command -v choco &> /dev/null; then
                    choco install -y nodejs-lts || choco install -y nodejs || true
                elif command -v scoop &> /dev/null; then
                    scoop install nodejs-lts || scoop install nodejs || true
                else
                    if command -v powershell.exe &> /dev/null; then
                        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; iwr get.scoop.sh -UseBasicParsing | iex; scoop install nodejs-lts" || true
                    elif command -v pwsh &> /dev/null; then
                        pwsh -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; iwr get.scoop.sh -UseBasicParsing | iex; scoop install nodejs-lts" || true
                    else
                        echo "Could not automatically install Node.js/npm. Please install Node.js 22.x and a C++ build toolchain (e.g. Visual Studio 2019 with C++ build tools), then run:"
                        echo "  npm install --global code-server"
                        return
                    fi
                fi

                if command -v npm &> /dev/null; then
                    npm install --global code-server
                else
                    echo "npm is still not available after attempting installation. Please install Node.js 22.x and a C++ build toolchain (e.g. Visual Studio 2019 with C++ build tools), then run:"
                    echo "  npm install --global code-server"
                    return
                fi
            fi
            return
            ;;
    esac

    if command -v npm &> /dev/null; then
        npm install --global code-server
    else
        echo "Could not install code-server automatically."
        echo "Please see https://coder.com/docs/code-server/install"
    fi
}

echo "=== Building Bore Client ==="

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    sudo pacman -S --needed --noconfirm rust
fi

cd "$PROJECT_ROOT"

echo ""
echo "Building bore-client..."
cargo build --release -p bore-client

echo ""
echo "Installing to /usr/local/bin..."
sudo cp target/release/bore /usr/local/bin/bore

install_code_server

echo ""
echo "✅ Bore client installed!"
echo ""
echo "Managed usage (recommended):"
echo "   bore signup --api-endpoint http://localhost:3000"
echo "   bore login --api-endpoint http://localhost:3000"
echo "   bore list"
echo "   bore start <instance-name-or-id>"

#!/bin/bash
# Install or update bore client with cargo (cross-platform helper)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

OS="$(uname -s)"

echo "=== Installing bore client with cargo ==="
echo "Detected OS: $OS"
echo ""

case "$OS" in
    Linux|Darwin)
        cd "$PROJECT_ROOT"
        cargo install --path bore-client --force

        echo ""
        echo "bore has been installed via cargo."
        echo "Make sure Cargo's bin directory is on your PATH, for example:"
        echo '  export PATH="$HOME/.cargo/bin:$PATH"'
        ;;

    MINGW*|MSYS*|CYGWIN*)
        cd "$PROJECT_ROOT"
        cargo install --path bore-client --force

        echo ""
        echo "bore has been installed via cargo."
        echo "On Windows, ensure Cargo's bin directory is on PATH."
        echo "PowerShell example:"
        echo '  $Env:Path = "$Env:USERPROFILE\.cargo\bin;$Env:Path"'
        echo "CMD example:"
        echo '  set PATH=%USERPROFILE%\.cargo\bin;%PATH%'
        ;;

    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

echo ""
echo "You can now run: bore --help"

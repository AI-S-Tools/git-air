#!/bin/bash

# Git Runner - One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/AI-S-Tools/git_runner/main/install.sh | bash

set -e

REPO="AI-S-Tools/git_runner"
VERSION="latest"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="git_runner"

echo "🚀 Installing Git Runner..."

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux*)
        PLATFORM="linux"
        BINARY_FILE="git_runner-linux"
        ;;
    darwin*)
        PLATFORM="macos"
        BINARY_FILE="git_runner-macos"
        ;;
    mingw*|msys*|cygwin*)
        PLATFORM="windows"
        BINARY_FILE="git_runner.exe"
        BINARY_NAME="git_runner.exe"
        INSTALL_DIR="$HOME/bin"
        ;;
    *)
        echo "❌ Unsupported operating system: $OS"
        exit 1
        ;;
esac

echo "📱 Detected platform: $PLATFORM"

# Create install directory if it doesn't exist
if [ "$PLATFORM" = "windows" ]; then
    mkdir -p "$INSTALL_DIR"
fi

# Download binary
DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$BINARY_FILE"
TEMP_FILE="/tmp/$BINARY_FILE"

echo "📥 Downloading from: $DOWNLOAD_URL"

if command -v curl &> /dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_FILE"
elif command -v wget &> /dev/null; then
    wget -q "$DOWNLOAD_URL" -O "$TEMP_FILE"
else
    echo "❌ Neither curl nor wget is available. Please install one of them."
    exit 1
fi

# Make executable
chmod +x "$TEMP_FILE"

# Install binary
INSTALL_PATH="$INSTALL_DIR/$BINARY_NAME"

if [ "$PLATFORM" = "windows" ]; then
    mv "$TEMP_FILE" "$INSTALL_PATH"
    echo "📁 Installed to: $INSTALL_PATH"
    echo "💡 Add $INSTALL_DIR to your PATH if not already done"
else
    if [ -w "$INSTALL_DIR" ]; then
        mv "$TEMP_FILE" "$INSTALL_PATH"
    else
        echo "🔐 Installing to system directory (requires sudo)..."
        sudo mv "$TEMP_FILE" "$INSTALL_PATH"
    fi
    echo "📁 Installed to: $INSTALL_PATH"
fi

# Verify installation
if command -v "$BINARY_NAME" &> /dev/null; then
    echo "✅ Git Runner installed successfully!"
else
    echo "⚠️  Installation completed, but $BINARY_NAME is not in PATH"
fi

echo ""
echo "🎯 Quick start:"
echo "   cd your-project-directory"
echo "   $BINARY_NAME"
echo ""
echo "🎮 Commands:"
echo "   r = manual re-scan"
echo "   R = reload script"
echo "   q = quit"
echo ""
echo "🤖 For AI-powered commit messages, install:"
echo "   • Gemini CLI (gemini)"
echo "   • Qwen CLI (qwen)"
echo "   • Claude CLI (claude)"
echo ""
echo "🔗 Repository: https://github.com/$REPO"
echo "📚 Documentation: https://github.com/$REPO#readme"
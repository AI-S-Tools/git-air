# Git Runner

**Automated Git Operations Tool with AI-Powered Commit Messages**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-green)](https://nodejs.org/)

Automated periodic git commits and push operations across multiple repositories with intelligent AI-generated commit messages. Designed for continuous development workflows with smart repository discovery.

## 🚀 Quick Start

### Package Manager Install (Recommended)

```bash
# Ubuntu (Snap) - Download .snap from releases
sudo snap install git-runner.snap --dangerous

# macOS (Homebrew) - Coming soon
brew install ai-s-tools/tap/git-runner

# Windows (Chocolatey) - Coming soon
choco install git-runner
```

### One-Line Install Script

```bash
curl -fsSL https://raw.githubusercontent.com/AI-S-Tools/git_runner/main/install.sh | bash
```

### Download Standalone Binary (Alternative)

Choose your platform and download the standalone executable:

```bash
# Linux
wget https://github.com/AI-S-Tools/git_runner/releases/latest/download/git_runner-linux
chmod +x git_runner-linux
sudo mv git_runner-linux /usr/local/bin/git_runner

# macOS
wget https://github.com/AI-S-Tools/git_runner/releases/latest/download/git_runner-macos
chmod +x git_runner-macos
sudo mv git_runner-macos /usr/local/bin/git_runner

# Windows
# Download git_runner.exe from releases and add to PATH
```

### Alternative: Install via npm

```bash
npm install -g @ai-s-tools/git-runner
```

### Usage

```bash
cd your-project-directory
git_runner
```

## ✨ Key Features

### 🤖 AI-Powered Commit Messages
- **Gemini**: Primary AI model for commit message generation
- **Qwen**: Secondary fallback AI model
- **Claude**: Tertiary fallback AI model
- **Automatic Fallback**: Uses timestamp-based messages if AI unavailable

### 📁 Smart Repository Discovery
- **Project Root Detection**: Automatically finds `.git` directories
- **Workspace Integration**: Parses VS Code `.code-workspace` files
- **Submodule Support**: Processes Git submodules from `.gitmodules`
- **Processing Order**: Submodules first, then main repositories (prevents conflicts)

### ⚡ Automation Capabilities
- **Periodic Commits**: Automatic commits every 5 minutes
- **Intelligent Push**: Only pushes when remote repositories exist
- **Multi-Repository**: Handles complex project structures
- **Interactive Control**: Real-time keyboard commands

### 🎮 Interactive Commands
- `r` - Manual re-scan and process all repositories
- `R` - Reload/restart the entire script
- `q` - Graceful shutdown with timer cleanup

## 🔧 Technical Details

### Repository Processing Logic
1. Scans upward from current directory to find project root
2. Identifies all Git repositories (main + workspace + submodules)
3. Processes submodules first to avoid merge conflicts
4. Generates AI commit messages or falls back to timestamps
5. Pushes to remote only when remotes exist

### AI Integration Requirements
Git Runner automatically detects and uses available AI CLI tools:
- **Gemini CLI** (`gemini`) - Highest priority
- **Qwen CLI** (`qwen`) - Medium priority
- **Claude CLI** (`claude`) - Lowest priority

Install any of these CLI tools for intelligent commit messages. No API tokens required!

### Supported Platforms
- **Linux** (x64)
- **macOS** (x64)
- **Windows** (x64)

## 📦 Development

### From Source
```bash
git clone https://github.com/AI-S-Tools/git_runner.git
cd git_runner
npm install
npm run build
npm start
```

### Build Binaries
```bash
npm run pkg:build    # All platforms
npm run pkg:linux    # Linux only
npm run pkg:macos    # macOS only
npm run pkg:windows  # Windows only
```

## 🔄 VS Code Integration

Add to `.vscode/tasks.json`:
```json
{
  "label": "Git Runner",
  "type": "shell",
  "command": "git_runner",
  "group": "build",
  "presentation": {
    "echo": true,
    "reveal": "always",
    "panel": "new"
  },
  "isBackground": true
}
```

## 🛡️ Error Handling
- **Repository Access**: Continues if individual repositories fail
- **Network Issues**: Skips push operations when remote unavailable
- **AI Dependencies**: Graceful fallback when AI tools unavailable
- **Process Management**: Proper cleanup on shutdown or restart

## 📊 Performance
- **Memory Usage**: Minimal - processes repositories sequentially
- **CPU Impact**: Low - only active during 5-minute intervals
- **Network Usage**: Only when pushing to remotes
- **Binary Size**: ~40-50MB standalone executables

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- AI integration via local CLI tools (Gemini, Qwen, Claude)
- Cross-platform binaries created with [pkg](https://github.com/vercel/pkg)
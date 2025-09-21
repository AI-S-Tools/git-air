# 🚀 Git Air - AI-Powered Git Automation

**Advanced Git automation tool that recursively discovers and synchronizes all Git repositories with AI-powered commit messages and intelligent problem-solving.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org/)

Git Air is designed for the **AI:DevOps paradigm** where humans orchestrate AI agents and tools provide AI-ready, actionable output.

## 🚀 Quick Start

### One-Line Install (Recommended)

**Linux:**
```bash
curl -L https://raw.githubusercontent.com/AI-S-Tools/git-air/main/binaries/git_air-linux -o /tmp/git-air && chmod +x /tmp/git-air && sudo mv /tmp/git-air /usr/local/bin/git-air && echo '✅ Git Air installed!'
```

**macOS:**
```bash
curl -L https://raw.githubusercontent.com/AI-S-Tools/git-air/main/binaries/git_air-macos -o /tmp/git-air && chmod +x /tmp/git-air && sudo mv /tmp/git-air /usr/local/bin/git-air && echo '✅ Git Air installed!'
```

**Windows (PowerShell as Admin):**
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AI-S-Tools/git-air/main/binaries/git_air.exe" -OutFile "$env:TEMP\git-air.exe"; Move-Item -Path "$env:TEMP\git-air.exe" -Destination "C:\Windows\System32\git-air.exe"; Write-Host "✅ Git Air installed!" -ForegroundColor Green
```

### Build from Source

```bash
git clone https://github.com/AI-S-Tools/git-air.git
cd git-air
npm install
npm run pkg:build
sudo mv binaries/git_air-linux /usr/local/bin/git-air  # Linux
```

### Usage

```bash
# One-time sync
git-air

# Continuous monitoring (background)
nohup git-air > git-air.log 2>&1 &
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
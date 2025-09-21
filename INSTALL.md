# Git Air - Installation

## 🚀 Quick Install (One-line)

### Linux:
```bash
curl -L https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air-linux -o /tmp/git-air && chmod +x /tmp/git-air && sudo mv /tmp/git-air /usr/local/bin/git-air && echo '✅ Git Air installed successfully! Run: git-air'
```

### macOS:
```bash
curl -L https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air-macos -o /tmp/git-air && chmod +x /tmp/git-air && sudo mv /tmp/git-air /usr/local/bin/git-air && echo '✅ Git Air installed successfully! Run: git-air'
```

### Windows (PowerShell as Admin):
```powershell
Invoke-WebRequest -Uri "https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air.exe" -OutFile "$env:TEMP\git-air.exe"; Move-Item -Path "$env:TEMP\git-air.exe" -Destination "C:\Windows\System32\git-air.exe"; Write-Host "✅ Git Air installed successfully! Run: git-air" -ForegroundColor Green
```

## 🔧 Alternative Install (Build from source)

### Prerequisites:
- Node.js 18+
- Git

### Build:
```bash
git clone https://github.com/AI-S-Tools/git-air.git
cd git-air
npm install
npm run pkg:build
sudo mv binaries/git_air-$(uname -s | tr '[:upper:]' '[:lower:]' | sed 's/darwin/macos/') /usr/local/bin/git-air
```

## 📦 Direct Binary Download

Download the binary for your platform and place it in your PATH:

- **Linux**: [git_air-linux](https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air-linux)
- **macOS**: [git_air-macos](https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air-macos)
- **Windows**: [git_air.exe](https://github.com/AI-S-Tools/git-air/releases/latest/download/git_air.exe)

## ✅ Verify Installation

```bash
git-air --version
```

## 🚀 Usage

### One-time sync:
```bash
git-air
```

### Continuous monitoring (background):
```bash
nohup git-air > git-air.log 2>&1 &
```

### As a systemd service (Linux):
```bash
# Create service file
sudo tee /etc/systemd/system/git-air.service > /dev/null <<EOF
[Unit]
Description=Git Air - Automated Git Synchronization
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
ExecStart=/usr/local/bin/git-air
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable git-air
sudo systemctl start git-air
sudo systemctl status git-air
```

## 🤖 AI:DevOps Integration

Git Air is designed for AI-powered DevOps workflows. When issues occur, it provides actionable lists that can be copied and pasted to AI assistants for automatic resolution.

Example workflow:
1. Run `git-air` to detect issues
2. Copy the failed repositories list
3. Paste to your AI assistant with: "Please fix these Git repository issues"
4. AI agent will resolve each issue systematically
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this project.

## Project Overview

Git Runner is a TypeScript-based automated Git operations tool designed for continuous development workflows. It performs periodic commits and pushes across multiple repositories with AI-powered commit messages using local CLI tools.

## Repository Information

**GitHub Repository**: https://github.com/AI-S-Tools/git_runner
**Published Project**: This is a completed and published project available via package managers.

## Installation Methods

### Homebrew (Recommended for macOS/Linux)
```bash
brew install ai-s-tools/tap/git-runner
```

### npm (Global installation)
```bash
npm install -g @ai-s-tools/git-runner
```

### Direct Binary Download
Download platform-specific binaries from GitHub releases:
- Linux: `git_runner-linux`
- macOS: `git_runner-macos`
- Windows: `git_runner.exe`

## Key Features

### AI Integration
- **Local CLI Integration**: Uses locally installed AI tools instead of API tokens
- **Priority Order**: Gemini → Qwen → Claude (automatic fallback)
- **No API Keys Required**: All AI models run via local CLI tools
- **Fallback**: Timestamp-based messages if no AI available

### Repository Discovery
- **Project Root Detection**: Automatically finds `.git` directories
- **Workspace Integration**: Parses VS Code `.code-workspace` files
- **Submodule Support**: Processes Git submodules from `.gitmodules`
- **Processing Order**: Submodules first, then main repositories

### Automation
- **Periodic Commits**: Every 5 minutes automatically
- **Intelligent Push**: Only pushes when remote repositories exist
- **Interactive Control**: Real-time keyboard commands (`r`, `R`, `q`)

## Architecture

### Core Files (Published Project)
- `src/git-runner.ts`: Main application logic
- `ai-agent/bin/ai-commit-agent.ts`: AI integration handler
- `package.json`: Node.js configuration and scripts
- `Formula/git-runner.rb`: Homebrew formula

### Cross-Platform Binaries
Built using `pkg` to create standalone executables:
- **Linux**: ~46MB executable
- **macOS**: ~51MB executable
- **Windows**: ~38MB executable

## Development Context

This project was converted from Dart to TypeScript and enhanced with:
- Local AI CLI integration (replacing token-based OpenRouter)
- Cross-platform binary distribution
- Package manager support (Homebrew, npm)
- Improved error handling and repository discovery

The project is feature-complete and published. Any development work should focus on maintenance, bug fixes, or feature enhancements to the published codebase.
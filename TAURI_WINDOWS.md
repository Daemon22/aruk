# Build Aruk Windows Desktop

## Quick Start

```powershell
# 1. Install prerequisites (one-time)
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools"
irm bun.sh/install.ps1 | iex

# 2. Build
bun install
bun run tauri:build

# Output: src-tauri/target/release/bundle/nsis/Aruk_0.2.0_x64-setup.exe
```

## Architecture

```
Tauri (Rust shell)
  ├─ Shows splash screen (loading/index.html)
  ├─ Finds free port (17321+)
  ├─ Sets DATABASE_URL=%APPDATA%/Aruk/data/aruk.db
  ├─ Spawns: bun.exe server/start.mjs
  ├─ Polls /api/health every 400ms (30s timeout)
  ├─ Navigates window to http://127.0.0.1:<port>
  └─ System tray: double-click=show, right-click=menu

Next.js Standalone (bundled in server/)
  ├─ start.mjs — ensures data dir, imports server.js
  ├─ server.js — Next.js standalone runtime
  ├─ .next/static/ — compiled assets
  ├─ public/ — static files
  └─ prisma/ — schema for runtime
```

## Self-Contained Build (with bun.exe)

To bundle the Bun runtime so users don't need it installed:

```powershell
# Download Bun for Windows
Invoke-WebRequest -Uri "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip" -OutFile bun.zip
Expand-Archive bun.zip -DestinationPath bun-temp -Force
mkdir -Force src-tauri/binaries
Copy-Item bun-temp/bun-windows-x64/bun.exe src-tauri/binaries/bun-x86_64-pc-windows-msvc.exe
Remove-Item -Recurse -Force bun.zip, bun-temp

# Then build normally
bun run tauri:build
```

## Features

- **System tray**: Minimizes to tray on close, double-click to restore
- **Single instance**: Only one Aruk runs at a time
- **Auto-start**: Optional launch on Windows startup
- **Database**: SQLite stored in `%APPDATA%/Aruk/data/`
- **Installer**: NSIS with desktop + start menu shortcuts

## Development

```powershell
# Dev mode (connects to Next.js dev server on :3000)
bun run tauri:dev
```

## CI/CD

Push a `v*` tag to trigger the GitHub Actions workflow:
```powershell
git tag v0.2.0
git push origin v0.2.0
```

The workflow builds on `windows-latest`, bundles bun.exe, and uploads the `.exe` installer as an artifact.
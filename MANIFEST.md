# Aruk — Complete Source Archive

**"Keeper of secrets and keys"** — Centralized API key management system.

All versions, all platforms, single archive.

---

## Archive Stats

| Platform | Files | Lines | Language(s) |
|----------|-------|-------|-------------|
| **Web Dashboard** | 95 | 12,713 | TypeScript, CSS, Prisma |
| **Tauri v2 Windows** | 9 | 552 | Rust, JSON, HTML, TOML |
| **Android SDK** | 48 | 4,594 | Kotlin, Gradle KTS, XML, TOML |
| **CLI** | 2 | 499 | TypeScript |
| **Docker / Caddy** | 3 | 104 | Dockerfile, YAML, Caddyfile |
| **TOTAL** | **157** | **18,462** | — |

---

## Directory Structure

```
aruk-archive/
├── MANIFEST.md              <-- this file
├── web/                      Next.js Web Dashboard (TypeScript)
│   ├── config/                Root configs (package.json, tsconfig, tailwind, etc.)
│   ├── prisma/                Database schema + seed
│   ├── scripts/               Build scripts (Tauri bundler, CLI)
│   └── src/
│       ├── app/                  App Router pages + 15 API routes
│       ├── components/
│       │   ├── api-bank/          9 dashboard tabs (main UI)
│       │   └── ui/                40 shadcn/ui primitives
│       ├── hooks/                Custom React hooks
│       └── lib/                  SDK client, DB, utils, agent plugin
├── tauri-windows/            Tauri v2 Desktop (Rust)
│   └── src-tauri/
│       ├── src/                 lib.rs (sidecar server, tray), main.rs
│       ├── capabilities/         Tauri v2 permissions
│       ├── loading/             Splash screen HTML
│       ├── icons/               Brand icon SVG
│       └── Cargo.toml, tauri.conf.json, build.rs
├── android-sdk/              Android SDK (Kotlin / Gradle)
│   └── android/
│       ├── build.gradle.kts, settings.gradle.kts
│       ├── gradle/               Version catalog (libs.versions.toml)
│       ├── aruk-core/           Library module: models, API, network, Room DB
│       ├── aruk-ui/             Compose UI: theme, glassmorphism, ViewModels
│       └── aruk-app/            App module: screens, navigation, resources, CI
├── cli/                      CLI tool + Tauri build guide
└── docker/                   Dockerfile, docker-compose, Caddy
```

---

## 1. Web Dashboard (Next.js)

**Stack:** Next.js App Router + Prisma + SQLite + Tailwind CSS + shadcn/ui + Recharts
**Style:** Glassmorphism, emerald green brand, oklch dark/light mode

### API Routes (15 endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api` | GET | Root API info |
| `/api/accounts` | GET, PUT | List/update accounts (13 protected read-only fields) |
| `/api/accounts/toggle` | POST | Enable/disable account |
| `/api/agent` | POST | AI agent endpoint |
| `/api/credits` | GET | Credit monitoring |
| `/api/export` | GET | Data export |
| `/api/health` | GET | Server health check |
| `/api/predictions` | GET | Credit predictions |
| `/api/providers` | GET | Provider list |
| `/api/routing` | POST | Smart key routing |
| `/api/secrets` | GET, POST, PUT, DELETE | Secrets CRUD |
| `/api/simulate` | POST | Load simulation |
| `/api/stats` | GET | Global statistics |
| `/api/usage/daily` | GET | Daily usage data |
| `/api/usage/logs` | GET | Usage logs |

### Dashboard Tabs (9)

| Tab | File | Description |
|-----|------|-------------|
| Overview | `overview-tab.tsx` | High-level status cards |
| Dashboard | `dashboard.tsx` | Main dashboard view |
| Accounts | `accounts-tab.tsx` | API key management with read-only credit panel |
| Analytics | `analytics-tab.tsx` | Usage charts (Recharts) |
| Routing | `routing-tab.tsx` | Smart routing configuration |
| Vault | `vault-tab.tsx` | Secrets management |
| Credit Monitor | `credit-monitor-tab.tsx` | Capitec-style credit balance view |
| Simulate | `simulate-tab.tsx` | Load testing simulation |
| CLI | `cli-tab.tsx` | Embedded CLI interface |

### Protected Fields Pattern

Server strips 13 system-tracked fields on PUT `/api/accounts`:
`totalCredits`, `usedCredits`, `creditUnit`, `healthScore`, `avgLatencyMs`,
`successRate`, `totalRequests`, `todayRequests`, `errorCount`, `lastUsedAt`,
`remainingCredits`, `remainingPercent`, `createdAt`, `updatedAt`

---

## 2. Tauri v2 Windows Desktop

**Stack:** Tauri 2 + Rust + NSIS installer + sidecar Next.js server
**Architecture:** Rust binary spawns embedded `bun start.mjs` → Next.js server, port scanning from 17321

### Key Files

| File | Lines | Description |
|------|-------|-------------|
| `src/lib.rs` | ~250 | ServerState, port scanner, server spawner (CREATE_NO_WINDOW), system tray, health poll, webview navigate, close-to-tray |
| `src/main.rs` | 3 | Windows subsystem entry point |
| `Cargo.toml` | 41 | tauri 2, plugins (single-instance, shell, dialog, fs, autostart), reqwest, tokio; Release: LTO+strip+panic=abort |
| `tauri.conf.json` | 66 | NSIS installer, 1200x800 window, CSP, single-instance, loading page as frontendDist |
| `loading/index.html` | 70 | Dark splash screen with emerald pulsing logo |
| `capabilities/default.json` | 27 | Full Tauri v2 permissions |
| `build.rs` | 2 | Tauri build hook |

### Startup Flow

1. Tauri loads `loading/index.html` as `frontendDist`
2. `setup()` spawns sidecar: `bun start.mjs` (which imports `./server.js` for Prisma DB init)
3. Polls `/api/health` every 500ms
4. On healthy response, navigates webview to `http://localhost:{port}`
5. Close button → hide to system tray (Show/Quit menu)

### Build Process

`scripts/prepare-tauri-bundle.mjs` copies:
- Next.js standalone build → `src-tauri/server/`
- Static files + public assets
- Prisma engine + schema
- Writes `start.mjs` wrapper that imports `./server.js`

---

## 3. Android SDK (Gradle)

**Stack:** AGP 8.7.3, Kotlin 2.1, Compose BOM 2024.12, Hilt DI, Room 2.6.1, Retrofit 2.11, OkHttp 4.12, Vico 2.0.0-beta.2, Coil 2.7, KSP
**Architecture:** 3-module Gradle project

### Module Breakdown

#### aruk-core (Library)

| Package | Files | Description |
|---------|-------|-------------|
| `model` | Models.kt, DataModels.kt | 7 enums + 15 @Serializable data classes (1:1 with web API) |
| `api` | ArukApi.kt | Retrofit interface: 13+ endpoints mapping to /api/* routes |
| `network` | ArukClient.kt | High-level client with retry logic, Hilt DI, ArukConfig |
| `db` | LocalCache.kt, DatabaseModule.kt | Room entities, DAOs (Flow + suspend), model mappers |
| `util` | Extensions.kt | NetworkMonitor, formatters, date parsing |

#### aruk-ui (Compose Library)

| Package | Files | Description |
|---------|-------|-------------|
| `theme` | ArukTheme.kt | Emerald palette, oklch colors, dark/light, ArukTypography |
| `components` | 4 files | GlassCard, StatCard, HealthBadge, CreditProgressBar, AccountCard, SecretCard, UsageLineChart, CreditsBarChart |
| `viewmodel` | 4 files | DashboardVM (30s auto-refresh), AccountsVM, SecretsVM, AnalyticsVM |

#### aruk-app (Application)

| File | Description |
|------|-------------|
| ArukApplication.kt | @HiltAndroidApp + WorkManager config |
| MainActivity.kt | Edge-to-edge, Scaffold, 6-tab NavigationBar |
| AppNavigation.kt | NavHost with 6 routes |
| DashboardScreen.kt | Stats grid, provider credits, connectivity |
| AccountsScreen.kt | TopAppBar + AccountList |
| SecretsScreen.kt | TopAppBar + SecretList |
| AnalyticsScreen.kt | Summary stats + line chart with cost/requests toggle |
| RoutingScreen.kt | Strategy selector, get-best-key, failover chain |
| SettingsScreen.kt | Server info, dark mode, clear cache, about |

### 6 Screens / Tabs

Dashboard, Accounts, Secrets, Analytics, Routing, Settings

### CI/CD

`android/.github/workflows/android-build.yml` — Debug/release matrix, unit tests, AAB+APK artifacts, GitHub release

---

## 4. CLI Tool

| File | Lines | Description |
|------|-------|-------------|
| `aruk-cli.ts` | 423 | Full CLI for interacting with Aruk API (list keys, add, route, status, etc.) |
| `TAURI_WINDOWS.md` | 76 | Build instructions for Tauri Windows version |

---

## 5. Docker / Caddy

| File | Lines | Description |
|------|-------|-------------|
| `Dockerfile` | 48 | Multi-stage Node.js build for containerized web dashboard |
| `docker-compose.yml` | 33 | Service orchestration (web + DB) |
| `Caddyfile` | 23 | Reverse proxy + auto-HTTPS configuration |

---

## Shared Design Language

All platforms share:
- **Emerald green** brand color (`#10B981`)
- **Glassmorphism** UI (frosted glass cards, blur, subtle borders)
- **Dark/light mode** with oklch color space
- **Protected read-only metrics** (Capitec bank-balance style credits)
- **1:1 API parity** across TypeScript SDK, Android Retrofit client, CLI

---

## Build Requirements

| Platform | Requirements |
|----------|-------------|
| Web | Node.js 18+ / Bun, SQLite3 |
| Tauri Windows | Rust toolchain, Windows SDK, NSIS, Bun (for sidecar) |
| Android | Android Studio, JDK 17, Android SDK 35, Gradle 8.11.1 |
| CLI | Bun or Node.js with tsx |
| Docker | Docker, Docker Compose |

## Pending Items

- Tauri: Generate Aruk-branded .ico for Windows installer (currently uses default Tauri icon)
- Android: Production keystore signing config (currently debug signing for release)
- Android: Run `gradle wrapper` once to generate `gradle-wrapper.jar`
- Tauri/Android: Cannot compile in Linux sandbox — needs Windows/Android SDK machine or CI

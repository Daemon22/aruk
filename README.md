# Aruk — Keeper of Secrets and Keys

> **Centralized API key management system with intelligent routing.**
> Store keys, monitor credits, and route requests through the best available account — automatically.

Aruk is a headless API key management platform. She watches your API accounts, tracks credit balances and health in real time, and routes each request to the best key based on your chosen strategy (cheapest, fastest, round-robin, etc.). She manages not just API keys, but all your secrets — passwords, OAuth tokens, service accounts, SSH keys, certificates — organized by provider and tagged by purpose.

Any agent or script can ask Aruk for a key or credential without ever knowing which provider or account is being used beneath.

---

## Architecture

Aruk follows a four-layer architecture:

```
  ┌─────────────────────────────────────────────────┐
  │  Layer 4: Agent Plugin                          │
  │  OpenAI-compatible chat, auto-key injection,    │
  │  credential resolution for agents               │
  │  (web/src/lib/agent-plugin/)                    │
  └────────┬────────────────────────────────────────┘
           │ imports & delegates through
  ┌────────┴────────────────────────────────────────┐
  │  Layer 3: SDK — ArukClient                      │
  │  HTTP client with auto-retry, typed responses   │
  │  (web/src/lib/sdk/)                             │
  └────────┬────────────────────────────────────────┘
           │ HTTP / REST API
  ┌────────┴────────────────────────────────────────┐
  │  Layer 2: API Routes (Next.js) / CLI            │
  │  REST endpoints + terminal interface            │
  │  (web/src/app/api/, cli/, web/scripts/)         │
  └────────┬────────────────────────────────────────┘
           │ direct import
  ┌────────┴────────────────────────────────────────┐
  │  Layer 1: Core Engine — ApiBank & SecretVault │
  │  Pure logic, no UI, no terminal                 │
  │  (web/src/lib/api-bank/)                        │
  └─────────────────────────────────────────────────┘
```

### Platform Clients

| Platform | Directory | Stack |
| -------- | --------- | ----- |
| **Web** | `web/` | Next.js 16, React 19, Prisma, Tailwind CSS, shadcn/ui |
| **Desktop** | `web/src-tauri/` | Rust / Tauri v2, bundled Next.js server |
| **Android** | `android-sdk/android/` | Kotlin, Jetpack Compose, Hilt, Room |
| **CLI** | `cli/` + `web/scripts/` | TypeScript (Bun runtime) |
| **Docker** | `docker/` | Multi-stage build, Caddy reverse proxy |

---

## Features

- **API Key Vault** — Store and organize keys by provider, tagged with priority and status (active, backup, expired, disabled).
- **Credit Monitoring** — Track remaining credits per account and provider. Get real-time health scores based on success rate and latency.
- **Intelligent Routing** — Choose from `best`, `fastest`, `cheapest`, `highest_quality`, `round_robin`, and `load_balance` strategies. Automatic failover to backup keys when active ones are exhausted.
- **Secret Vault** — Store passwords, OAuth tokens, service account JSON, SSH keys, certificates. Retrieve by purpose (e.g., `cloud_storage`, `database`, `email`).
- **Analytics & Simulation** — Simulate traffic across providers, visualize daily usage, and predict credit exhaustion dates.
- **Agent Integration** — OpenAI-compatible chat proxy and credential resolver so agents never hardcode keys.
- **Real-time** — WebSocket updates for live stats; terminal CLI for scripting.

---

## Quick Start

### Web (Development)

```bash
cd web

# Copy env config
cp .env.example .env

# Push the database schema
npx prisma db push

# Seed with sample data
npx prisma db seed

# Start dev server
bun dev    # or: npm run dev
```

Visit `http://localhost:3000`.

### Web (Docker)

```bash
cd docker
cp .env.example ../web/.env     # (or set DATABASE_URL in your environment)
docker compose up -d
```

### CLI

```bash
# Point at a running instance
export APIBANK_URL=http://localhost:3000

# Get the best key
bun web/scripts/apibank.ts use best

# Check status
bun web/scripts/apibank.ts status

# List vault secrets
bun web/scripts/apibank.ts vault
```

### Desktop (Tauri)

```bash
cd web
bun run tauri:dev      # Development
bun run tauri:build     # Production build (Windows)
```

### Android

Open `android-sdk/android/` in Android Studio and run the app. The Android client connects to a remote Aruk instance.

---

## API

### Key Routing

```bash
# Get a key (GET)
curl "http://localhost:3000/api/agent?strategy=fastest"

# Get a key (POST, for agents)
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"action":"get_key","provider":"Anthropic","strategy":"best"}'
```

### Agent Actions

| Action | Description |
| ------ | ----------- |
| `get_key` | Route to the best available API key |
| `status` | Full bank + vault status |
| `list` | List all accounts |
| `add_key` | Add a new API account |
| `add_keys` | Batch add accounts |
| `report_usage` | Log usage for credit/health tracking |
| `failover` | Get the failover chain |
| `get_secret` | Retrieve vault credentials by purpose |
| `list_secrets` | List all vault secrets |
| `add_secret` | Add a new secret to the vault |

---

## Project Structure

```
aruk/
├── web/                          # Next.js web app + Tauri desktop
│   ├── src/
│   │   ├── app/                  # Next.js App Router (pages + API routes)
│   │   ├── components/           # React components (dashboard, shadcn/ui)
│   │   ├── hooks/                # Custom React hooks
│   │   └── lib/
│   │       ├── api-bank/         # Layer 1: Core engine (ApiBank + SecretVault)
│   │       ├── sdk/              # Layer 3: ArukClient SDK
│   │       └── agent-plugin/     # Layer 4: Agent plugin
│   ├── prisma/                   # Database schema + seed data
│   ├── scripts/                  # CLI script + Tauri bundle preparer
│   ├── src-tauri/                # Rust/Tauri desktop app
│   ├── public/                   # Static assets
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
├── android-sdk/                  # Android SDK (Kotlin/Compose)
│   └── android/                  # Android Studio project
├── cli/                          # Standalone CLI (TypeScript)
│   └── aruk-cli.ts
├── docker/                       # Docker deployment
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── Caddyfile
├── MANIFEST.md
├── LICENSE                       # MIT
└── README.md
```

---

## License

MIT © 2025 Aruk Contributors

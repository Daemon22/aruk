# Aruk — Keeper of Secrets and Keys

> **Centralized API key management system with intelligent routing.**
> Store keys, monitor credits, and route requests through the best available account — automatically.

Aruk is a headless API key management platform. She watches your API accounts, tracks credit balances and health in real time, and routes each request to the best key based on your chosen strategy (cheapest, fastest, round-robin, etc.). She manages not just API keys, but all your secrets — passwords, OAuth tokens, service accounts, SSH keys, certificates — organized by provider and tagged by purpose.

Any agent or script can ask Aruk for a key or credential without ever knowing which provider or account is being used beneath.

See [ARUK_PRODUCTION_READINESS_AUDIT.md](ARUK_PRODUCTION_READINESS_AUDIT.md) for the current release-readiness findings and known blockers.

## Privacy and credential boundary

Aruk is a private, self-hosted Keeper. API keys, OAuth tokens, passwords,
service-account material, certificates, SSH keys, and cloud-provider
credentials are encrypted at rest with AES-256-GCM using `ARUK_ENCRYPTION_KEY`.
Plaintext credentials are released only through an authenticated, policy-gated
request; ordinary lists, exports, logs, and account metadata never contain
credential values.

Every account, secret, cloud account, daemon, policy, usage record, and audit
view is scoped to its owning user. The core `ApiBank`, `SecretVault`, and
`Keeper` services enforce that scope themselves, so callers cannot bypass
privacy by omitting a user identifier or guessing another user's record ID.
Conflicting cookie and bearer identities are rejected. Provider reference data
may be shared, but provider account metadata remains private to its owner.

Set both `ARUK_SESSION_SECRET` and `ARUK_ENCRYPTION_KEY` explicitly before
production deployment. Automatic bootstrap is intended for single-machine
local use; losing the encryption key makes stored credentials unrecoverable,
and different keys across instances invalidate sessions or prevent decryption.
Use TLS and a private network or reverse proxy/WAF for network deployments,
and never put credentials in URLs, source control, exports, or client logs.

---

## Architecture

Aruk follows a four-layer architecture:

```
  ┌─────────────────────────────────────────────────┐
  │  Layer 4: Agent Plugin                          │
  │  OpenAI-compatible chat, auto-key injection,    │
  │  credential resolution for agents               │
  │  (src/lib/agent-plugin/)                        │
  └────────┬────────────────────────────────────────┘
           │ imports & delegates through
  ┌────────┴────────────────────────────────────────┐
  │  Layer 3: SDK — ArukClient                      │
  │  HTTP client with auto-retry, typed responses   │
  │  (src/lib/sdk/)                                 │
  └────────┬────────────────────────────────────────┘
           │ HTTP / REST API
  ┌────────┴────────────────────────────────────────┐
  │  Layer 2: API Routes (Next.js) / CLI            │
  │  REST endpoints + terminal interface            │
  │  (src/app/api/, cli/, scripts/)                │
  └────────┬────────────────────────────────────────┘
           │ direct import
  ┌────────┴────────────────────────────────────────┐
  │  Layer 1: Core Engine — ApiBank & SecretVault │
  │  Pure logic, no UI, no terminal                 │
  │  (src/lib/api-bank/)                            │
  └─────────────────────────────────────────────────┘
```

### Platform Clients

| Platform | Directory | Stack |
| -------- | --------- | ----- |
| **Web** | `src/` | Next.js 16, React 19, Prisma, Tailwind CSS, shadcn/ui |
| **Desktop** | `src-tauri/` | Rust / Tauri v2, bundled Next.js server |
| **Android** | `android/` | Kotlin, Jetpack Compose, Hilt, Room |
| **CLI** | `cli/` + `scripts/` | TypeScript (Bun runtime) |
| **Docker** | `Dockerfile` + `docker-compose.yml` | Multi-stage build, Caddy reverse proxy |

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

### Root application (Development)

```bash
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
cp ../.env.example .env         # (or set DATABASE_URL in your environment)
docker compose up -d
```

### CLI

```bash
# Point at a running instance
export APIBANK_URL=http://localhost:3000

# Get the best key
bun scripts/apibank.ts use best

# Check status
bun scripts/apibank.ts status

# List vault secrets
bun scripts/apibank.ts vault
```

### Desktop (Tauri)

```bash
bun run tauri:dev      # Development
bun run tauri:build     # Production build (Windows)
```

### Android

Open `android/` in Android Studio and run the app. The Android client connects to a remote Aruk instance.
Debug builds use the debug signer. Release builds use an external signing configuration when
`ARUK_ANDROID_KEYSTORE`, `ARUK_ANDROID_KEYSTORE_PASSWORD`, `ARUK_ANDROID_KEY_ALIAS`, and
`ARUK_ANDROID_KEY_PASSWORD` are supplied as Gradle properties or environment variables; otherwise
the release build remains unsigned. No production signing credentials belong in this repository.

## Release support boundaries

Production-ready surfaces are the root Keeper/security implementation, the authenticated REST API,
the TypeScript SDK, and the CLI when connected to a configured Aruk instance. The SDK and agent
plugin are source-integrated APIs in this application repository, not separately published npm
packages. Docker image creation, native Tauri packaging, and signed Android artifacts depend on
their respective local toolchains and external credentials. The `web/` directory is a retained
legacy frontend and is excluded from the canonical build; it is not a production release surface.

---

## API

### Key Routing

```bash
# Get a key (GET; authenticated session or bearer token required)
curl "http://localhost:3000/api/agent?strategy=fastest" \
  -H "Authorization: Bearer $ARUK_SESSION_TOKEN"

# Get a key (POST, for agents)
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARUK_SESSION_TOKEN" \
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
├── src/                          # Canonical Next.js web app + API
├── src-tauri/                    # Rust/Tauri desktop app
├── public/                       # Static assets
├── package.json
├── next.config.ts
├── tsconfig.json
├── web/                          # Legacy tree; not authoritative
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

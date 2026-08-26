# Aruk - Production Readiness Audit

Audit date: 2026-09-01  
Repository: `Daemon22/aruk`  
Audited revision: `193e563eec90177528092e21ed6ea88aad226193` (`0.2.1`)

## 1. Product Definition

Aruk is a self-hosted Keeper boundary for API keys, encrypted secrets, cloud-account credentials, access policies, daemon identity, short-lived access passes, and audit/passage records. It exposes a Next.js application, REST routes, a TypeScript SDK, an agent plugin, CLI tooling, Docker deployment, Tauri desktop packaging, and an Android client. Aruk is not the orchestration or operating-system layer; future products should consume its contracts through HTTP/SDK boundaries.

## 2. Canonical Source

The authoritative implementation is the repository root:

- `src/` - Next.js UI, REST API, authentication, vault, Keeper, SDK, and agent plugin
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, and root styling/configuration
- `prisma/` - schema and migrations
- `cli/` and `scripts/` - CLI and validation/build scripts
- `src-tauri/` - current Tauri desktop application
- `android-sdk/` - current Android SDK/application
- `docker-compose.yml`, `Dockerfile`, `Caddyfile`, and `.github/`

`web/` is not authoritative and must not be used as the production build context.

## 3. `web/` Audit

### Duplicate - safe to retire after an explicit deprecation/removal change

- `web/src/app`, `web/src/components/ui`, `web/src/hooks`, and the overlapping `web/src/lib` files duplicate the older Next.js application, API Bank, SDK, and agent-plugin surfaces.
- `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, and `web/.env.example` describe the older `0.2.0` application. Its configuration permits wildcard API CORS and its documented auth variables are not the root contract.
- `web/prisma`, `web/scripts`, and `web/src-tauri` are older copies of root build/database/desktop support.

No root imports, package scripts, CI workflow, Docker build context, or Tauri configuration reference `web/`. The root application has the newer Keeper, perimeter, daemon, pass, audit, cloud-account, and PassageLog functionality that is absent from `web/`.

### Unique - preserve only if intentionally migrated

- `web/public/apple-touch-icon.png`, `favicon-16.png`, `favicon-32.png`, `favicon.png`, and `logo.png` are legacy branding assets with no demonstrated dependency from root `public/`.
- The older UI-only tabs and dependencies in `web/src/components/api-bank/` include analytics, credit-monitor, CLI, routing, simulation, and account views. They may contain presentation ideas, but are not security or data-layer authority.
- `web` has legacy-only packages such as `next-auth`, `next-intl`, `framer-motion`, `sharp`, and editor/table utilities. Their presence is not evidence that the root product requires them.

### Unknown - requires product-owner review before deletion

- Whether the legacy branding assets are still desired for desktop/mobile distribution.
- Whether any web-only dashboard presentation or dependency provides an intentional user-facing feature not yet represented in the root UI.

Recommended disposition: mark `web/` deprecated in a dedicated change, migrate any selected assets/UI intentionally, then remove the duplicate tree in a later release. No deletion was performed in this audit.

## 4. Build & Test Gate

| Gate | Result | Severity | Notes |
| --- | --- | --- | --- |
| Dependencies | Partial pass | HIGH | `bun.lock` was generated. An initial frozen install completed far enough to run builds, but the current local tree has an incomplete `react-hook-form` package; a forced repair was blocked by network connection refusals. `package-lock.json` remains present for npm consumers. |
| Prisma | Pass | LOW | `prisma validate --schema prisma/schema.prisma` and `prisma generate` pass with an explicit SQLite `DATABASE_URL`. |
| Typecheck | Fails in current install | HIGH | The canonical source errors were fixed, but `bunx tsc --noEmit` still reports only `react-hook-form` declaration resolution because the installed package lacks `dist/index.d.ts`. A clean reinstall could not complete due network refusal. `next.config.ts` still sets `typescript.ignoreBuildErrors: true`. |
| ESLint | Fail | HIGH | Root lint reports CommonJS imports in the static hardening script, generated Tauri output, and React hook-rule violations. Legacy `web/` also contributes errors. `next.config.ts` ignores lint during builds. |
| Tests | Pass, narrow scope | HIGH | Declared `bun run test` passes crypto and secret-bootstrap tests. `scripts/test-security-hardening.cjs` also passes, but is not included in `npm test`; no broad integration suite is present. |
| Production build | Pass with warnings | HIGH | `bun run build` completes with Webpack and cross-platform asset copying. Next reports invalid native SWC bindings, skipped build type validation, deprecated `eslint` config, and package tracing warnings. |
| CLI | Not independently validated | HIGH | CLI is present and now parses cleanly, but no dedicated smoke/contract test is declared. |
| Platform builds | Not run | HIGH | Tauri and Android require platform toolchains; repository manifest records Android release-signing and wrapper gaps. |

The Docker lockfile input was corrected during this task by generating `bun.lock` from the existing dependency manifest and lock state. Docker itself remains unverified because the Docker executable is unavailable in this environment.

## 5. Security Audit

### RELEASE BLOCKER / HIGH

- The public SDK accepts `ArukConfig.authToken` and sends `Authorization: Bearer ...`, but server session resolution currently reads only the `aruk_session` cookie. External SDK consumers therefore do not have a documented working bearer-auth contract. This must be resolved or explicitly removed/documented before publication.
- Build and lint failures are suppressed in Next configuration. A production security boundary should not publish artifacts without an enforced typecheck/lint gate, even though independent typecheck now passes.
- Root Docker deployment does not set an explicit `ARUK_CORS_ORIGIN`; the application falls back to localhost, which is restrictive but must be configured for deployed browser clients. The stale `docker/` configuration lacks the root bootstrap-secret environment wiring and is unsafe as a publication path.

### MEDIUM

- Bootstrap secrets are generated and persisted when environment values are absent. This is useful for single-instance desktop use, but production backups, restores, and multi-instance deployments require explicit `ARUK_SESSION_SECRET` and `ARUK_ENCRYPTION_KEY` management.
- SQLite is the only checked-in database provider and persistence is local-volume based. Operational backup, restore, migration, and concurrent/multi-instance guarantees need to be stated.
- `ARUK_BYPASS_AUTH` is guarded against production use, but deployment validation should explicitly assert it is false/unset.
- Rate limiting and abuse controls were not found in the audited API routes. This is a deployment-level risk for internet exposure and should be addressed or explicitly scoped to trusted/private deployments.

### Positive controls observed

- Passwords use scrypt and session tokens use HMAC with expiry.
- Session cookies are HttpOnly and SameSite=Lax.
- Secrets and cloud credentials are encrypted/masked through the root vault paths.
- Passage logs are append-only at the API contract; DELETE returns an explicit 405.
- Offload write/read paths pass through Keeper access evaluation and optional pass validation.
- Root CORS is an explicit configured origin rather than the legacy wildcard.

## 6. API / SDK Readiness

Stable enough to treat as an internal root contract: health/ping, key routing, usage reporting, secret lookup/listing, daemon registration, policy evaluation, pass issue/use/revoke, audit reads, perimeter rules, cloud-account operations, and append-only passage logging. The SDK types and common `AgentResponse` envelope provide a useful basis.

Not yet publication-stable: authentication/bootstrap semantics, exact error envelope consistency across all routes, pagination bounds, rate limits, provider credential semantics, and compatibility/version policy. The SDK contains several `any` return types, and the REST API has no generated OpenAPI or compatibility policy. CLI and Android clients should be pinned to a documented API version before external consumers depend on them.

## 7. Offload / PassageLog

`/api/offload` intentionally maps to `PassageLog`; there is no `Offload` model in the final schema. POST records an outbound/inbound passage metadata event, PUT `action=retrieve` records a new inbound event, GET lists/stats passage events, and DELETE is rejected because the log is append-only. Aruk records who/where/when and size metadata, not payload bytes. This is an intentional abstraction, but the public docs should use “passage log” consistently alongside the compatibility term “offload”.

## 8. Release Surface

Present: MIT license, root README, environment example, Prisma migrations, Docker/Compose, Caddy, Tauri Windows workflow, Android project, CLI, security-hardening notes, and version `0.2.1`.

Gaps: no formal API/SDK versioning policy; no generated API specification; no supported Node/Bun version pin; no clean-install CI for root npm dependencies; no general CI for typecheck/lint/tests/build; no documented backup/restore or secret rotation procedure; no support/security contact; the Docker image build remains unverified; platform signing/release prerequisites remain incomplete; lint is failing; Next emits build warnings; and only the crypto/bootstrap tests are wired into `npm test`.

## 9. HAEL Product Boundary

| Concern | Aruk | Manya | Manya-OS/SIOS | Authority |
| --- | --- | --- | --- | --- |
| Secrets and credentials | Keeper, vault, provider credentials | Consumer | Consumer | Aruk |
| Access policy and capability passes | Policies, perimeter, pass lifecycle | Requests/grants through adapter | Runtime enforcement consumer | Aruk |
| Daemon identity | Registers/associates daemon IDs | Connective identity consumer | Runtime identity consumer | Aruk for access identity; adapter required |
| Attestation/keyring | Credential boundary only | Ecosystem integration | Runtime/keyring/attestation concerns | Adapter required |
| Audit of access and passage | Audit events and PassageLog | Consumer/reporting | Consumer/reporting | Aruk for Keeper events |
| Ledger/economy | No final economy authority | Weaving/economy domain | Runtime accounting if applicable | Not related unless contracted |
| Agent execution | Credential resolution and provider proxy | Orchestration/connective workflows | Runtime execution | Manya / Manya-OS |
| Memory | No product ownership | Ecosystem memory | Runtime memory | Manya / Manya-OS |
| Networking | API boundary and optional proxy | Connective integration | Runtime networking | Adapter required |

No cross-repository code was changed or imported during this audit.

## 10. Release Blockers

1. Resolve the SDK bearer-token/server authentication mismatch.
2. Complete a clean dependency install and remove build-time suppression or add explicit enforced typecheck and lint release gates; clear the root lint failures.
3. Add CI coverage for dependency integrity, Prisma, typecheck, lint, tests, and production build.
4. Verify the Docker image from a clean Docker-enabled environment.

## 11. Recommended Finalization Work

1. Add a root CI matrix and a clean-environment release checklist; run Prisma validation from the repository root.
2. Publish a versioned REST/SDK contract, consistent error envelope, auth flow, pagination limits, and deprecation policy.
3. Document secret generation, rotation, backup/restore, SQLite limitations, CORS, reverse proxy, and private-network exposure assumptions.
4. Deprecate and later retire `web/` after explicit asset/UI review; retain only intentionally migrated assets.
5. Complete Tauri/Android release signing and artifact verification; add CLI smoke tests.
6. Add rate limiting or document the trusted-network boundary and require a hardened reverse proxy for public exposure.

## 12. Git State

- Branch: `main`
- HEAD: `193e563eec90177528092e21ed6ea88aad226193`
- Remote: `origin https://github.com/Daemon22/aruk.git`
- Working tree before this audit: clean
- Staged files: none
- Changes made during this task: this audit report, root-path corrections in `README.md`, generated `bun.lock`, cross-platform build asset copying, CLI comment fix, Webpack build selection, and Tauri wrapper path-escaping fix
- No commit, push, tag, or release was created.

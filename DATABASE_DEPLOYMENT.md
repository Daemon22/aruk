# Aruk Database Deployment

Aruk owns a separate Prisma schema for users, API accounts, secrets, daemons, policies, access passes, audit events, cloud accounts, and passage logs. It must not point `DATABASE_URL` at the Manya-OS Supabase schema: Manya-OS owns different tables and migration history for OS persistence.

## Offline and local mode

Use SQLite with a persistent local file:

```env
DATABASE_URL="file:./db/custom.db"
ARUK_BYPASS_AUTH=false
```

For Docker, the supported offline deployment stores the database under `/app/data` on the `aruk-data` volume. The volume must be backed up with the encryption and session secrets:

```env
ARUK_SESSION_SECRET=<server-only-secret>
ARUK_ENCRYPTION_KEY=<server-only-secret>
```

Run the Prisma schema lifecycle before starting the application:

```bash
npm run db:generate
npm run db:migrate
npm run build
npm start
```

## Online deployment

Online deployments must provision an Aruk-compatible Prisma database and set `DATABASE_URL` through the server environment or deployment secret manager. Do not place it in browser code, `NEXT_PUBLIC_*` variables, or committed files.

The current checked-in Prisma migration lock is SQLite-specific. Therefore an online PostgreSQL deployment requires a separately generated Prisma PostgreSQL migration set from the same `prisma/schema.prisma`; do not run the SQLite migration directory against PostgreSQL and do not point Aruk at Manya-OS migrations.

The application code remains the same after Prisma generation. The deployment-specific database URL and migration artifact determine the database connection. Health checks execute a database probe and report `database: "ready"` only when Prisma can execute `SELECT 1`.

## Reachability contract

- `GET /api/health` is the server-side liveness/readiness probe.
- `status: "healthy"` or `"degraded"` reports API-bank health.
- `database: "ready"` confirms the Prisma database connection.
- `database: "unavailable"` returns HTTP 503 and must be treated as not ready.
- The Prisma connection and all secrets remain server-side.

## Relationship to Manya-OS

Aruk and Manya-OS are separate bounded contexts:

```text
Aruk application data       -> Aruk Prisma schema/database
Manya-OS ledger/memory data  -> Manya-OS Supabase/PostgreSQL backbone
HTTP/runtime composition     -> Manya gateway or explicit service APIs
```

This preserves offline Aruk operation and lets both systems be deployed online without corrupting or conflating their migration histories.

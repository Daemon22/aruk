# Neon Postgres and account setup

Aruk keeps SQLite for local development and offline installs. Hosted deployments use Neon Postgres for application data and Better Auth for accounts and sessions. The configured Aruk Neon project is in São Paulo (`aws-sa-east-1`). Neon fixes a project's region when it is created, so choose it before creating a different project.

## Database configuration

In the Neon dashboard, open the Aruk project and copy both connection strings:

- Put the **pooled** connection string in `DATABASE_URL`. The running app uses this URL.
- Put the **direct** (non-pooled) connection string in `DIRECT_URL`. Prisma uses this URL for schema migrations.
- Keep both values in the hosting provider's server-side environment settings. Do not expose either as a `NEXT_PUBLIC_` variable or commit them.

For local development against Neon, put both variables in the ignored root `.env` file (or export them in the shell). Next.js also loads `.env.local`, but Prisma CLI does not load that filename automatically. Apply the checked-in PostgreSQL migrations with:

```bash
npm run db:postgres:migrate:deploy
```

Run this before a release that expects the new schema. The SQLite `db:push` command is for disposable local development only; do not use it against hosted/customer data. A Neon Free project may scale to zero after inactivity, so its first request after idle can take longer.

## Required application secrets

Set these in the host's private environment configuration:

- `DATABASE_URL`: Neon pooled connection URL.
- `DIRECT_URL`: Neon direct connection URL for migrations.
- `BETTER_AUTH_SECRET`: a random value of at least 32 characters, stable across app instances.
- `BETTER_AUTH_URL`: the canonical public origin, such as `https://aruk.example.com`.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated exact browser origins that may call auth endpoints.
- `ARUK_ENCRYPTION_KEY`: a separate stable, high-entropy key. Back it up securely; loss or rotation without re-encryption makes stored credentials and encrypted files unreadable.
- `RESEND_API_KEY` and `EMAIL_FROM`: required for production verification and recovery email. Verify the sender domain with Resend before release.

Never use `ARUK_BYPASS_AUTH=true` in production. Keep all secrets out of source control and browser code.

## Account providers

Email/password sign-up is available and requires email verification. Password recovery sends a one-time reset link. In development, when Resend is not configured, these links are written to the local app server terminal; this is not a production delivery method.

Aruk accounts use email/password, passkeys, and optional multi-factor authentication. Google and GitHub are not Aruk login providers; their accounts belong in separately scoped integrations inside the signed-in workspace.

Account settings include TOTP authenticator enrollment, backup codes, passkey registration/management, password management, session revocation on password changes, and account deletion. Passkeys require a secure browser context; localhost is accepted for local testing. Account deletion requires a recent session and explicit email confirmation.

## Region and plan

The current project uses Neon Free in São Paulo, selected as the closest available Neon region to South Africa. Neon states that a project's region cannot be changed after creation. Free compute scales to zero after inactivity; check the current [Neon plans](https://neon.com/docs/introduction/plans) before launch if uninterrupted availability or higher usage limits are needed. Review [Neon regions](https://neon.com/docs/introduction/regions) when choosing a new project region.

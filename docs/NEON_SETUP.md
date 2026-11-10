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
- `BETTER_AUTH_URL`: the canonical public origin, such as `https://aruk.example.com` or `https://aruk.vercel.app`.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated exact browser origins that may call auth endpoints.
- `ARUK_CORS_ORIGIN`: the single browser origin allowed by Aruk's API CORS headers.
- `ARUK_ENCRYPTION_KEY`: a separate stable, high-entropy key. Back it up securely; loss or rotation without re-encryption makes stored credentials and encrypted files unreadable.

Never use `ARUK_BYPASS_AUTH=true` in production. Keep all secrets out of source control and browser code.

## Account email delivery

Aruk owns account creation, verification, sessions, recovery, passkeys, and MFA through Better Auth. The email provider is only a transport for verification and recovery messages.

Supported transports are selected with `EMAIL_PROVIDER`:

- `resend`: set `RESEND_API_KEY` and `EMAIL_FROM`.
- `postmark`: set `POSTMARK_SERVER_TOKEN` and `EMAIL_FROM`; optionally set `POSTMARK_MESSAGE_STREAM` (defaults to `outbound`).

If `EMAIL_PROVIDER` is omitted, Aruk uses Postmark when only `POSTMARK_SERVER_TOKEN` is configured and otherwise uses Resend. In development, missing provider credentials print one-time links to the local server terminal. In production, missing credentials make account email unavailable.

`EMAIL_FROM` must use a sender domain verified with the selected provider. A Vercel-generated `*.vercel.app` hostname cannot be used for SPF/DKIM sender verification because Vercel does not let you control its DNS records. For real users, add a custom domain to the Vercel project, point its DNS to Vercel, then verify the same domain (or a mail subdomain) in Resend/Postmark and set `EMAIL_FROM` to an address on that domain, for example `Aruk <no-reply@mail.example.com>`.

Resend's `onboarding@resend.dev` sender is only a development/testing sender and cannot be used as the production account-email sender for arbitrary users.

## Vercel deployment checklist

The repository is linked to the `aruk` Vercel project through `.vercel/project.json`. Configure production environment variables in Vercel Project Settings or with `vercel env add`:

```bash
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add BETTER_AUTH_SECRET production
vercel env add ARUK_ENCRYPTION_KEY production
vercel env add BETTER_AUTH_URL production
vercel env add BETTER_AUTH_TRUSTED_ORIGINS production
vercel env add ARUK_CORS_ORIGIN production
vercel env add EMAIL_PROVIDER production
vercel env add RESEND_API_KEY production
# or: vercel env add POSTMARK_SERVER_TOKEN production
vercel env add EMAIL_FROM production
```

For the default Vercel deployment, set the URL variables to the same HTTPS origin:

```text
BETTER_AUTH_URL=https://YOUR-PROJECT.vercel.app
BETTER_AUTH_TRUSTED_ORIGINS=https://YOUR-PROJECT.vercel.app
ARUK_CORS_ORIGIN=https://YOUR-PROJECT.vercel.app
```

If you add a custom domain later, update all three values to that domain and add the domain in Vercel before changing DNS. After deployment, verify:

1. `GET /api/auth/config` returns `"emailDelivery": true`.
2. Registration sends a verification email and the link verifies the account.
3. Password recovery sends a reset link and the reset flow completes.
4. If Google/GitHub credentials are configured, both providers redirect back to `/api/auth/callback/<provider>` successfully.

## Account providers

Email/password sign-up is available and requires email verification. Password recovery sends a one-time reset link. In development, when no mail provider is configured, these links are written to the local app server terminal; this is not a production delivery method.

Aruk accounts remain owned by Better Auth. Google and GitHub are optional identity providers: when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are configured, Better Auth creates or links Aruk accounts and stores provider identities in the `Account` table. Users can still use email/password, passkeys, and MFA.

Google OAuth redirect URI:

```text
https://YOUR-PROJECT.vercel.app/api/auth/callback/google
```

GitHub OAuth callback URL:

```text
https://YOUR-PROJECT.vercel.app/api/auth/callback/github
```

For GitHub, enable the app's email-address permission so Better Auth can obtain a verified email for account creation. GitHub accounts with private email may not be able to create an Aruk account until they expose an email through the OAuth flow.

Account settings include TOTP authenticator enrollment, backup codes, passkey registration/management, password management, session revocation on password changes, and account deletion. Passkeys require a secure browser context; localhost is accepted for local testing. Account deletion requires a recent session and explicit email confirmation.

## Region and plan

The current project uses Neon Free in São Paulo, selected as the closest available Neon region to South Africa. Neon states that a project's region cannot be changed after creation. Free compute scales to zero after inactivity; check the current [Neon plans](https://neon.com/docs/introduction/plans) before launch if uninterrupted availability or higher usage limits are needed. Review [Neon regions](https://neon.com/docs/introduction/regions) when choosing a new project region.

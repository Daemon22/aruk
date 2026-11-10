# Customer privacy boundary

Aruk currently supports independent personal accounts. It does not provide shared workspaces, organization roles, or cross-customer access.

## Enforced by the application

- Better Auth verifies email/password accounts, issues and revokes sessions, and can authenticate users through configured Google/GitHub OAuth or registered passkeys.
- Browser sessions use Better Auth cookies. Auth mutations validate trusted origins; session checks run in server/API handlers.
- Aruk's API-account, secret, file, daemon, policy, pass, audit, cloud-account, and usage operations are scoped to the signed-in user's ID in the service layer.
- Guessed record IDs do not grant access to another user's records. Related records are checked at the Keeper/service boundary.
- Database query logging is disabled so credential-bearing parameters are not copied into ordinary application logs.
- The seed creates shared provider catalog entries only. It does not create demo users, credentials, fake activity, or vault records.
- Account deletion requires a recent session and explicit confirmation; deleting the user removes associated authentication and application records through the configured database relations.

## Enrollment and deployment requirements

- Email/password sign-up requires email verification. Account recovery uses a one-time password-reset link.
- TOTP multi-factor authentication, backup codes, and passkeys are available in account settings. Users are responsible for keeping recovery codes somewhere safe.
- Email delivery is logged to the local server terminal only during development. Production must configure a verified sender through `EMAIL_PROVIDER` plus the selected provider's credentials (`RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`) and `EMAIL_FROM`.
- Google and GitHub sign-in are enabled only when the corresponding OAuth client ID and secret are set. Better Auth owns the Aruk account and links provider identities; OAuth providers authenticate identity but do not own Aruk accounts.
- Production requires stable `BETTER_AUTH_SECRET` and `ARUK_ENCRYPTION_KEY` values in the hosting provider's secret manager. Share the same values across app instances. Back up the encryption key separately from the database.
- The hosted database is Neon Postgres. Configure the pooled `DATABASE_URL` for runtime and direct `DIRECT_URL` for migrations. Apply checked-in PostgreSQL migrations before deploying code that uses the schema.
- Production deployments require HTTPS, a trusted reverse proxy, persistent rate limiting, protected database backups, and a secret-rotation/recovery procedure. Do not set `ARUK_BYPASS_AUTH=true` in production.

## What “private” means here

Users are isolated through authentication and per-user data scoping. Credentials and files marked for encryption are encrypted at rest with the deployment's `ARUK_ENCRYPTION_KEY` and released only through Aruk's authenticated service path. The service operator who controls the running server and encryption key can technically decrypt stored data; this version is not zero-knowledge or client-side encrypted. Do not describe it as such.

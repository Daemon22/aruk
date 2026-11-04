# Customer privacy boundary

Aruk supports independent personal accounts. It does not provide shared workspaces, organization roles, or cross-customer access.

## Enforced by the current backend

- Each authenticated request resolves to one active `AuthSession` and one `User`.
- Session tokens are random opaque bearer values. The database stores only an HMAC digest, and sign-out revokes the current session.
- Deploying this session change invalidates older stateless session tokens; users must sign in again after the migration.
- Vault, API-account, daemon, policy, pass, audit, cloud-account, and usage operations are scoped to the authenticated user's ID in the core services.
- A guessed record ID does not grant access to another account's record. Cross-account daemon, policy, pass, API-account, and cloud-account references are checked at the Keeper/service boundary.
- Browser session cookies are HttpOnly, SameSite=Lax, and Secure in production. Auth mutations reject untrusted browser origins.
- Database query logging is disabled so credential-bearing query parameters are not copied into normal application logs.
- The seed creates shared provider catalog entries only. It does not create demo users, credentials, fake activity, or vault records.

## Enrollment and deployment boundaries

- `POST /api/auth/register` is disabled unless `ARUK_ALLOW_PUBLIC_SIGNUP=true`. Public registration is not ready for general release: email verification, account recovery, and MFA still need to be added before enabling it.
- `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/session` provide the initial account session API. Login and registration attempts also have a bounded in-process throttle; public deployments must enforce persistent rate limits at the trusted reverse proxy.
- Production startup requires explicit `ARUK_SESSION_SECRET` and `ARUK_ENCRYPTION_KEY` values of at least 32 characters. Keep them in the deployment secret manager, never in source control.
- The current supported deployment is one Aruk instance with one durable SQLite database. Do not run concurrent app replicas against this SQLite store. A hosted multi-instance service requires a separate database/storage architecture and database-enforced row-level tenant policies before release.
- TLS, a trusted reverse proxy, a specific `ARUK_CORS_ORIGIN`, protected database backups, and secret rotation procedures are required for network exposure.

## What “private” means here

Users are isolated from other users through authentication and per-user data scoping. Credentials are encrypted at rest with the deployment's `ARUK_ENCRYPTION_KEY` and released only through Aruk's policy gate. The service operator who controls the running server and that encryption key can technically decrypt stored credentials; this version is not zero-knowledge or client-side encrypted. Do not describe it as such.

Before accepting external customers, complete email verification/recovery, MFA or passkey enrollment, user-facing sign-in/sign-out, production reverse-proxy rate limits, and the supported hosted database design. Keep public sign-up disabled until those controls are in place.

# Aruk v0.2.1 — Security Hardening Notes

This revision tightens the secret/key boundary without changing Aruk's role as the keeper between agents and external services.


## Origin identity

This Aruk deployment is explicitly associated with the named Origin **Azura Daemon**.

Origin is a first-class identity/provenance concept, not a daemon role, provider, API account, or secret type. Daemons are trusted intelligences that may operate under the Origin; credentials remain independent typed secret material and are granted according to policy.

The configured value is `ARUK_ORIGIN_NAME`, defaulting to `Azura Daemon`. Agent response metadata and audit details carry this Origin marker so that integrations can distinguish the Origin context from the requesting daemon, provider, or credential.

## Credential model

Aruk now treats credentials as **typed secret material**, not merely API keys.

A secret may contain arbitrary named fields such as:

- `api_key`
- `access_token` / `refresh_token`
- `username` / `password`
- `client_id` / `client_secret`
- `client_email` / `private_key`
- certificates / SSH material
- provider-specific fields

The vault stores the credential bundle encrypted. Ordinary list/account/export responses do not expose plaintext credentials.

## Agent access

Agents can request:

- `get_key` — routed API key
- `get_key` with `accountId` — one specific API account
- `get_secret` with `id`, `name`, or `purpose` — arbitrary credential bundle
- `get_secret` with `field` — one named credential field
- `get_cloud_credentials` with `cloudAccountId` — credentials for a connected cloud account

All sensitive agent retrievals pass through Aruk's access-policy gate. Policies can be scoped to a particular daemon and resource ID.

Example policy concept:

```json
{
  "effect": "allow",
  "daemonId": "DAEMON_ID",
  "resourceType": "secret",
  "resourceId": "SECRET_ID",
  "scope": "read"
}
```

This lets one daemon receive one secret without granting it the entire vault.

## Important security changes

1. API-bank keys are encrypted at rest using the existing AES-256-GCM vault mechanism.
2. Legacy plaintext API-bank keys are migrated when they are encountered by the bank.
3. JSON API-bank exports no longer contain API keys.
4. Ordinary account responses never contain plaintext API keys.
5. Vault list responses mask credential values; explicit reveal is separate.
6. Cloud passage logging verifies cloud-account ownership inside the Keeper itself.
7. Direct offload endpoints now participate in the access-policy gate.
8. Production cannot run with `ARUK_BYPASS_AUTH=true`.
9. API CORS is explicit via `ARUK_CORS_ORIGIN`; wildcard CORS is removed.
10. Tauri's unnecessary frontend shell/filesystem command permissions were removed.

## Validation

`scripts/test-security-hardening.cjs` is a dependency-free contract test covering the security boundaries above.

The full TypeScript/Next/Prisma runtime suite still requires a complete dependency installation and generated Prisma client. The supplied test environment could not complete `npm ci` because a required package was not available in the local npm cache.

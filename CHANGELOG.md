# Changelog

## 0.2.1 - Release candidate hardening

- Enforced the root TypeScript check during production builds.
- Included security contract checks in the normal test command.
- Bound bearer access passes to their issued resource and scope before use.
- Removed bearer pass tokens from audit responses.
- Scoped linting to the canonical root application; the legacy `web/` tree remains retained but deprecated.
- Documented the application-only package boundary and environment-dependent native release surfaces.
- Added external-only Android release signing configuration without a debug-signing fallback.
- Added a safe CLI `--version` smoke-test command.
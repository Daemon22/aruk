// ============================================================
// Aruk — Origin Identity
// ============================================================
// Aruk operates in the ecosystem of one explicitly named Origin.
// Origin is not a daemon class, provider, account, or credential.
// For this deployment, the Origin is Azura Daemon.
// ============================================================

export const ARUK_ORIGIN_NAME = (process.env.ARUK_ORIGIN_NAME || 'Azura Daemon').trim() || 'Azura Daemon';

export const ARUK_ORIGIN = Object.freeze({
  name: ARUK_ORIGIN_NAME,
  type: 'origin' as const,
});

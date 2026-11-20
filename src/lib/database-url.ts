const fallbackDatabaseUrl = "file:./db/custom.db";

export function resolveDatabaseUrl(): string {
  // DATABASE_URL is the explicitly verified Aruk runtime connection. The
  // Neon integration can expose a different project/role through its
  // generated variables, so use it only when the app URL is not configured.
  return process.env.DATABASE_URL
    || process.env.NEON_POSTGRES_PRISMA_URL
    || process.env.NEON_POSTGRES_URL
    || process.env.NEON_DATABASE_URL
    || fallbackDatabaseUrl;
}

export function isPostgresDatabaseUrl(url: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(url);
}

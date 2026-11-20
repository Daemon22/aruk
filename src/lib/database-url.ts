const fallbackDatabaseUrl = "file:./db/custom.db";

export function resolveDatabaseUrl(): string {
  return process.env.NEON_POSTGRES_PRISMA_URL
    || process.env.NEON_POSTGRES_URL
    || process.env.NEON_DATABASE_URL
    || process.env.DATABASE_URL
    || fallbackDatabaseUrl;
}

export function isPostgresDatabaseUrl(url: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(url);
}

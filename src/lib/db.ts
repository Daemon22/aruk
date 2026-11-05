import { PrismaClient as SQLitePrismaClient } from "@prisma/client";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client-postgres";

const globalForPrisma = globalThis as unknown as {
  sqlitePrisma: SQLitePrismaClient | undefined;
  postgresPrisma: PostgresPrismaClient | undefined;
};

const log = process.env.NODE_ENV === "production" ? ["error"] as const : ["warn", "error"] as const;
const databaseUrl = process.env.DATABASE_URL || "file:./db/custom.db";
const usesPostgres = /^postgres(?:ql)?:\/\//i.test(databaseUrl);

const sqlite = globalForPrisma.sqlitePrisma ?? new SQLitePrismaClient({ log: [...log] });
const postgres = usesPostgres
  ? globalForPrisma.postgresPrisma ?? new PostgresPrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: [...log],
    })
  : null;

// Both generated clients use the same Aruk model shape. Select the engine from DATABASE_URL.
export const db = (postgres ?? sqlite) as unknown as SQLitePrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.sqlitePrisma = sqlite;
  if (postgres) globalForPrisma.postgresPrisma = postgres;
}

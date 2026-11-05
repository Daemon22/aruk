import { Prisma, PrismaClient as SQLitePrismaClient } from "@prisma/client";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client-postgres";

const destinationUrl = process.env.DATABASE_URL || "";
const sourceUrl = process.env.ARUK_SQLITE_SOURCE_URL || "file:./db/custom.db";

if (!/^postgres(?:ql)?:\/\//i.test(destinationUrl)) {
  throw new Error("DATABASE_URL must point to the target PostgreSQL database.");
}
if (!/^file:/i.test(sourceUrl)) {
  throw new Error("ARUK_SQLITE_SOURCE_URL must point to the existing SQLite database.");
}

// Start with dependency roots; skip AuthSession because local bearer sessions do
// not authenticate against Supabase Auth. Imported password hashes are discarded.
const tables = [
  "Provider",
  "User",
  "Secret",
  "Daemon",
  "AccessPolicy",
  "ApiAccount",
  "CloudAccount",
  "PassageRule",
  "VaultFile",
  "UsageLog",
  "RoutingEvent",
  "AccessPass",
  "AuditEvent",
  "PassageLog",
] as const;

const source = new SQLitePrismaClient({ datasources: { db: { url: sourceUrl } } });
const destination = new PostgresPrismaClient({ datasources: { db: { url: destinationUrl } } });

async function main() {
  const existingUsers = await destination.user.count();
  if (existingUsers !== 0) {
    throw new Error("The target Postgres database already contains Aruk users. Migration stopped without writing data.");
  }

  let copied = 0;
  await destination.$transaction(async (tx) => {
    for (const table of tables) {
      const rows = await source.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM "' + table + '"');
      for (const row of rows) {
        const values = { ...row };
        if (table === "User") {
          values.passwordHash = "";
          delete values.authUserId;
        }
        if (table === "Daemon") {
          values.parentId = null;
          values.creatorId = null;
        }
        // Raw SQLite booleans and timestamps need PostgreSQL parameter types.
        const model = Prisma.dmmf.datamodel.models.find((model) => model.name === table);
        for (const field of model?.fields || []) {
          const value = values[field.name];
          if (value == null) continue;
          if (field.type === "Boolean") values[field.name] = Boolean(value);
          if (field.type === "DateTime" && !(value instanceof Date)) {
            values[field.name] = new Date(typeof value === "bigint" ? Number(value) : value as string | number);
          }
        }
        const columns = Object.keys(values);
        const identifiers = columns.map((column) => '"' + column.replace(/"/g, '""') + '"').join(", ");
        const placeholders = columns.map((_, index) => "$" + (index + 1)).join(", ");
        await tx.$executeRawUnsafe(
          'INSERT INTO "' + table + '" (' + identifiers + ") VALUES (" + placeholders + ")",
          ...columns.map((column) => values[column]),
        );
        copied += 1;
      }
      if (table === "Daemon") {
        for (const row of rows) {
          await tx.$executeRawUnsafe('UPDATE "Daemon" SET "parentId" = $1, "creatorId" = $2 WHERE "id" = $3', row.parentId, row.creatorId, row.id);
        }
      }
      console.log(table + ": " + rows.length + " rows");
    }
  }, { timeout: 10 * 60 * 1000, maxWait: 30_000 });
  console.log("Migration complete. " + copied + " rows copied. Local AuthSession rows and password hashes were not transferred.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.$disconnect(), destination.$disconnect()]);
  });

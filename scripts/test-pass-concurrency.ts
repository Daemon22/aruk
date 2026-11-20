import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function main() {
  const databasePath = join(tmpdir(), `aruk-pass-test-${randomUUID()}.db`);
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.ARUK_ENCRYPTION_KEY = randomUUID() + randomUUID();

  try {
    execFileSync("npx", ["prisma", "db", "push", "--schema=prisma/schema.prisma", "--skip-generate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
    });

    const [{ db }, { keeper }] = await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/keeper"),
    ]);

    const user = await db.user.create({
      data: { email: `${randomUUID()}@aruk.test`, name: "Pass concurrency test" },
      select: { id: true },
    });
    const pass = await keeper.issuePass(user.id, {
      requesterName: "Concurrency test",
      resourceType: "secret",
      resourceId: "secret-test-id",
      scope: "read",
      maxUses: 1,
    });

    const wrongScope = await keeper.usePass(pass.token, {
      resourceType: "secret",
      resourceId: "secret-test-id",
      scope: "write",
    });
    assert(!wrongScope.allowed, "a wrong-scope pass attempt is denied");
    const afterWrongScope = await db.accessPass.findUnique({ where: { id: pass.id }, select: { usedCount: true } });
    assert(afterWrongScope?.usedCount === 0, "a denied scope check does not consume the pass");

    const attempts = await Promise.all(Array.from({ length: 12 }, () => keeper.usePass(pass.token, {
      resourceType: "secret",
      resourceId: "secret-test-id",
      scope: "read",
    })));
    assert(attempts.filter((result) => result.allowed).length === 1, "twelve simultaneous requests grant exactly one use of a one-use pass");
    const finalPass = await db.accessPass.findUnique({ where: { id: pass.id }, select: { usedCount: true, status: true } });
    assert(finalPass?.usedCount === 1 && finalPass.status === "consumed", "the pass records one use and becomes consumed");

    await db.$disconnect();
    console.log("\nAccess-pass concurrency checks passed.");
  } finally {
    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      const candidate = databasePath + suffix;
      if (existsSync(candidate)) rmSync(candidate, { force: true });
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

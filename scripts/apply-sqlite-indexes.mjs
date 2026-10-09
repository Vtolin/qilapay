// Applies prisma/sqlite-indexes.sql idempotently (fix F8).
// Usage: node scripts/apply-sqlite-indexes.mjs
// Uses DATABASE_URL from the environment (.env). Read-only except for
// CREATE INDEX IF NOT EXISTS. Fails closed on case-variant duplicate emails:
// dedupe first (canonical lowercase row wins).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, "..", "prisma", "sqlite-indexes.sql"), "utf8");

const db = new PrismaClient();
try {
  const dupes = await db.$queryRawUnsafe(
    "SELECT lower(email) e, COUNT(*) c FROM \"User\" GROUP BY lower(email) HAVING c > 1",
  );
  if (dupes.length > 0) {
    console.error("Refusing: case-variant duplicate emails exist:", JSON.stringify(dupes));
    process.exitCode = 1;
  } else {
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
    }
    console.log("sqlite extra indexes applied");
  }
} finally {
  await db.$disconnect();
}

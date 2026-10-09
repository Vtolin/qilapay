// Pre-deploy / pre-demo sanity gate (mitigation for F4).
// Usage: node scripts/boot-check.mjs
// Fails (non-zero exit) when the database file is missing, corrupt, empty,
// or drifted from prisma/schema.prisma. Run before `start` on deploys and
// before judging demos. Read-only.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error("[boot-check] FAIL: " + msg);
};

const db = new PrismaClient();
try {
  const integrity = await db.$queryRawUnsafe("PRAGMA integrity_check");
  if (JSON.stringify(integrity).toLowerCase().includes("ok") === false) {
    fail("integrity_check: " + JSON.stringify(integrity));
  }
  const tables = await db.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
  );
  const names = tables.map((t) => t.name);
  for (const required of ["User", "Wallet", "Quote", "Transfer", "TransferEvent", "Currency", "KycTierConfig"]) {
    if (!names.includes(required)) fail("missing table: " + required);
  }
  const indexes = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='index'");
  const idxNames = new Set(indexes.map((i) => i.name));
  // Fix F2/F8/F9: these must exist or the app's security assumptions are void.
  for (const required of ["Transfer_quoteId_key", "User_email_nocase", "Wallet_address_key"]) {
    if (!idxNames.has(required)) fail("missing index: " + required);
  }
  const users = await db.user.count();
  const tiers = await db.kycTierConfig.count();
  if (tiers === 0) fail("KycTierConfig is empty (seed never ran?)");
  console.log(`[boot-check] users=${users} tiers=${tiers} tables=${names.length}`);
} catch (e) {
  fail("exception: " + String(e).slice(0, 300));
} finally {
  await db.$disconnect();
}

// Schema drift: live DB must match prisma/schema.prisma (fix F2 root cause).
// NOTE: the migrate-diff CLI resolves relative file: URLs against the cwd,
// while the Prisma client runtime anchors them at prisma/. Absolutize here
// so both agree.
function absoluteDbUrl(url) {
  const m = /^file:(.+)$/.exec(url || "");
  if (!m || path.isAbsolute(m[1])) return url;
  // Mirror the client runtime: relative file: URLs anchor at prisma/.
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  return "file:" + path.resolve(scriptsDir, "..", "prisma", m[1]);
}
try {
  // Spawn the Prisma CLI JS directly: `npx` is a .cmd shim on Windows and
  // will not spawn from execFileSync without a shell.
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const prismaCli = path.join(scriptsDir, "..", "node_modules", "prisma", "build", "index.js");
  execFileSync(
    process.execPath,
    [prismaCli, "migrate", "diff", "--from-url", absoluteDbUrl(process.env.DATABASE_URL), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"],
    { stdio: "pipe", cwd: path.join(scriptsDir, "..") },
  );
  console.log("[boot-check] schema drift: none");
} catch {
  fail("schema drift detected (run prisma db push + scripts/apply-sqlite-indexes.mjs)");
}

if (failures > 0) {
  console.error(`[boot-check] ${failures} failure(s)`);
  process.exit(1);
}
console.log("[boot-check] OK");

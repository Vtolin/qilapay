-- SQLite-only constraints Prisma cannot express (applied idempotently by
-- scripts/apply-sqlite-indexes.mjs; safe to re-run).
--
-- F8: User.email UNIQUE is BINARY collation, so case variants
-- (sari@x vs Sari@x) were accepted as distinct rows. App code lowercases
-- on register/login, but the DB should enforce it too.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_nocase" ON "User"("email" COLLATE NOCASE);

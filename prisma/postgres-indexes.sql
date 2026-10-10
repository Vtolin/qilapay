-- Postgres-only constraints Prisma cannot express (applied idempotently by
-- scripts/apply-postgres-indexes.mjs; safe to re-run).
--
-- F8 (PG port): User.email UNIQUE is case-sensitive on Postgres, so case
-- variants (sari@x vs Sari@x) would be accepted as distinct rows. App code
-- lowercases on register/login, but the DB should enforce it too.
-- SQLite used COLLATE NOCASE; Postgres uses a lower() expression index.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower" ON "User"(lower(email));

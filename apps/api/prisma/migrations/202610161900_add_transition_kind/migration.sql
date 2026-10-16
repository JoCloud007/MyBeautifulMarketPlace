-- Transition kind PRODUCT/OS + OS-object sourcing.
-- Adds enum TransitionKind and nullable Transition.kind / fromOsVersionId /
-- toOsVersionId FKs to OsVersion. Legacy fromVersion/toVersion strings stay
-- and are auto-filled from OsVersion.version for kind=OS.
--
-- IDEMPOTENT: safe to re-run without error or data loss.
-- All new columns are nullable (kind has a PRODUCT default); existing rows
-- are untouched until the backfill classifies them.
--
-- Fallback for databases where `prisma db push` fails (P3005, DB created by
-- db push without _prisma_migrations) — used by `make fix-client-db-transition-kind`.

-- CreateEnum (guarded: CREATE TYPE has no IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransitionKind') THEN
        CREATE TYPE "TransitionKind" AS ENUM ('PRODUCT', 'OS');
    END IF;
END $$;

-- AlterTable (nullable / defaulted additions only)
ALTER TABLE "Transition" ADD COLUMN IF NOT EXISTS "kind" "TransitionKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "Transition" ADD COLUMN IF NOT EXISTS "fromOsVersionId" TEXT;
ALTER TABLE "Transition" ADD COLUMN IF NOT EXISTS "toOsVersionId" TEXT;

-- AddForeignKey (guarded DO $$ blocks so re-runs are no-ops)
-- Actions match Prisma defaults for optional relations (SetNull / Cascade).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Transition_fromOsVersionId_fkey'
    ) THEN
        ALTER TABLE "Transition"
            ADD CONSTRAINT "Transition_fromOsVersionId_fkey"
            FOREIGN KEY ("fromOsVersionId") REFERENCES "OsVersion"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Transition_toOsVersionId_fkey'
    ) THEN
        ALTER TABLE "Transition"
            ADD CONSTRAINT "Transition_toOsVersionId_fkey"
            FOREIGN KEY ("toOsVersionId") REFERENCES "OsVersion"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

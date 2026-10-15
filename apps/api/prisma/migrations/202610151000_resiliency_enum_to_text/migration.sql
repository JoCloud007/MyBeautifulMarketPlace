-- Resiliency enum -> text conversion (2026-10-15).
-- Prisma `db push` refuses to convert an enum column to text directly
-- ("possible data loss"), although the conversion is lossless. This script
-- performs the conversion manually and is IDEMPOTENT: it is a no-op once the
-- column is already text. Safe to run on a database with existing rows —
-- values are preserved by the ::text cast.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ForecastLine'
      AND column_name = 'resiliency'
      AND udt_name = 'resiliencylevel'
  ) THEN
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" DROP DEFAULT;
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" TYPE text USING "resiliency"::text;
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" SET DEFAULT 'STANDARD';
    RAISE NOTICE 'ForecastLine.resiliency converted from enum ResiliencyLevel to text';
  ELSE
    RAISE NOTICE 'ForecastLine.resiliency already text — nothing to do';
  END IF;
END $$;

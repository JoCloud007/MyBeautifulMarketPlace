-- Resiliency enum -> text conversion (2026-10-15, revised after client
-- reported "would be dropped and recreated" despite the type-name check).
-- Prisma `db push` refuses to convert an enum column to text directly
-- ("possible data loss"), although the conversion is lossless.
--
-- ROBUST DETECTION: instead of matching the type NAME (fragile — Prisma may
-- name it ResiliencyLevel in any case, or reuse another name), we detect ANY
-- enum-typed column named "resiliency" on ForecastLine. Enums are the only
-- column kind with data_type = 'e' in information_schema.columns. This also
-- covers a column whose DEFAULT is a typed enum literal, which must be
-- dropped before the ALTER TYPE or the conversion fails.
--
-- IDEMPOTENT: once the column is text (data_type <> 'e'), it is a no-op.
-- LOSSLESS: values are preserved by the ::text cast.
DO $$
DECLARE
  is_enum boolean;
BEGIN
  SELECT (c.data_type = 'USER-DEFINED' AND EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.oid = to_regtype('public."' || c.udt_name || '"') AND t.typtype = 'e'
  ))
    INTO is_enum
  FROM information_schema.columns c
  WHERE c.table_name = 'ForecastLine'
    AND c.column_name = 'resiliency'
    AND c.table_schema = 'public';

  IF is_enum IS NULL THEN
    RAISE NOTICE 'ForecastLine.resiliency does not exist — db push will create it';
  ELSIF is_enum THEN
    -- Enum-typed: drop the (typed) default, convert in place, re-apply text default
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" DROP DEFAULT;
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" TYPE text USING "resiliency"::text;
    ALTER TABLE "ForecastLine" ALTER COLUMN "resiliency" SET DEFAULT 'STANDARD';
    RAISE NOTICE 'ForecastLine.resiliency converted from enum to text (values preserved)';
  ELSE
    RAISE NOTICE 'ForecastLine.resiliency is already text — nothing to do';
  END IF;
END $$;

-- The enum TYPE itself (if no other column uses it) is dropped by the db push
-- that follows; leaving it in place is harmless.

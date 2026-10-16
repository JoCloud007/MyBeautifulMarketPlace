-- Profile × Size grid (AWS-style) for the Category > Product > Flavor hierarchy.
-- Adds FlavorProfile (owned per Category) and nullable Flavor columns
-- profileId / sizeLabel / sizeRank. No enum types: sizeLabel is free text,
-- specs stay in Flavor.attributes validated by FlavorFieldDefinition.
--
-- IDEMPOTENT: safe to re-run without error or data loss.
-- All new columns are nullable; existing rows and rendering are untouched
-- (fallback to grouped-by-flavor when profileId IS NULL).

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlavorProfile" (
    "id"          TEXT NOT NULL,
    "categoryId"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "icon"        TEXT,
    "color"       TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlavorProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable additions only)
ALTER TABLE "Flavor" ADD COLUMN IF NOT EXISTS "profileId" TEXT;
ALTER TABLE "Flavor" ADD COLUMN IF NOT EXISTS "sizeLabel" TEXT;
ALTER TABLE "Flavor" ADD COLUMN IF NOT EXISTS "sizeRank" INTEGER;

-- CreateIndex (slug unique per category)
CREATE UNIQUE INDEX IF NOT EXISTS "FlavorProfile_categoryId_slug_key"
    ON "FlavorProfile"("categoryId", "slug");

-- AddForeignKey (guarded DO $$ block so re-runs are no-ops)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FlavorProfile_categoryId_fkey'
          AND conrelid = '"FlavorProfile"'::regclass
    ) THEN
        ALTER TABLE "FlavorProfile"
            ADD CONSTRAINT "FlavorProfile_categoryId_fkey"
            FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Flavor_profileId_fkey'
          AND conrelid = '"Flavor"'::regclass
    ) THEN
        ALTER TABLE "Flavor"
            ADD CONSTRAINT "Flavor_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "FlavorProfile"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

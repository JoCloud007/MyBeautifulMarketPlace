-- Backfill seed for the Profile × Size grid (202610151200_add_flavor_profile).
-- Creates the default AWS-style profile rows per category that has flavors.
-- IDEMPOTENT: ON CONFLICT ("categoryId", "slug") DO NOTHING — safe to re-run.
-- Existing Flavor rows keep profileId = NULL (fallback rendering preserved);
-- no flavor data is modified here.

INSERT INTO "FlavorProfile"
    ("id", "categoryId", "name", "slug", "description", "order", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    p."name",
    p."slug",
    p."description",
    p."order",
    NOW(),
    NOW()
FROM "Category" c
CROSS JOIN (
    VALUES
        ('General Purpose',   'general-purpose',   'Balanced CPU to memory ratio', 0),
        ('Compute Optimized', 'compute-optimized', 'High CPU to memory ratio',     1),
        ('Memory Optimized',  'memory-optimized',  'High memory to CPU ratio',     2)
) AS p("name", "slug", "description", "order")
WHERE EXISTS (SELECT 1 FROM "Flavor" f WHERE f."categoryId" = c."id")
ON CONFLICT ("categoryId", "slug") DO NOTHING;

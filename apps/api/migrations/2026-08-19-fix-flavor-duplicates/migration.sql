-- Fix duplicate Flavor names before creating the UNIQUE index
-- Keeps the oldest flavor per name, renames duplicates with suffix

WITH duplicates AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt" ASC) as rn
  FROM "Flavor"
)
UPDATE "Flavor" f
SET name = d.name || ' - duplicate-' || (d.rn - 1)
FROM duplicates d
WHERE f.id = d.id AND d.rn > 1;

-- Make ProductVariant optional relation columns nullable to match the current
-- Prisma schema (osId/osVersionId/continuityLevelId/productVersionId are all
-- String? in schema.prisma). Databases provisioned by an older `db push` still
-- have NOT NULL on some of these, so clearing the OS of a storage variant
-- fails with "Null constraint violation on the fields: (osId)".
--
-- IDEMPOTENT: DROP NOT NULL on an already-nullable column is a no-op.
-- No data is modified; no row can be lost (constraint relaxation only).

ALTER TABLE "ProductVariant" ALTER COLUMN "osId" DROP NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "osVersionId" DROP NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "continuityLevelId" DROP NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "productVersionId" DROP NOT NULL;

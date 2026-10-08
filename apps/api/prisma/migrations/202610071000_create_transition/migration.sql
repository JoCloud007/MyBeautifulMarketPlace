-- Create Transition table, migrating existing UpgradePath rows into it
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "fromProductId" TEXT NOT NULL,
    "toProductId" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "toVersion" TEXT NOT NULL,
    "migrationType" "MigrationType" NOT NULL DEFAULT 'REBUILD',
    "status" "ProductStatus" NOT NULL DEFAULT 'BACKLOG',
    "availableFrom" TIMESTAMP(3),
    "eolDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("id")
);

-- Copy existing UpgradePath rows, generating a name/slug from the products
INSERT INTO "Transition" ("id", "name", "slug", "fromProductId", "toProductId", "fromVersion", "toVersion", "migrationType", "status", "notes", "createdAt", "updatedAt")
SELECT
    up."id",
    fp."name" || ' to ' || tp."name",
    lower(fp."slug") || '-to-' || lower(tp."slug") || '-' || substr(up."id", 1, 8),
    up."fromProductId",
    up."toProductId",
    up."fromVersion",
    up."toVersion",
    up."migrationType",
    'AVAILABLE',
    up."notes",
    up."createdAt",
    up."updatedAt"
FROM "UpgradePath" up
JOIN "Product" fp ON fp."id" = up."fromProductId"
JOIN "Product" tp ON tp."id" = up."toProductId";

CREATE UNIQUE INDEX "Transition_slug_key" ON "Transition"("slug");
CREATE INDEX "Transition_fromProductId_idx" ON "Transition"("fromProductId");
CREATE INDEX "Transition_toProductId_idx" ON "Transition"("toProductId");

ALTER TABLE "Transition" ADD CONSTRAINT "Transition_fromProductId_fkey" FOREIGN KEY ("fromProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_toProductId_fkey" FOREIGN KEY ("toProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

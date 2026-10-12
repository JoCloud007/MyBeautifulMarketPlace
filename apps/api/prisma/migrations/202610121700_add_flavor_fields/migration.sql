-- AlterTable
ALTER TABLE "Flavor" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "categoryId" TEXT,
ALTER COLUMN "vcpu" DROP NOT NULL,
ALTER COLUMN "ramGb" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FlavorFieldDefinition" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "type" TEXT NOT NULL DEFAULT 'string',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlavorFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlavorFieldDefinition_categoryId_key_key" ON "FlavorFieldDefinition"("categoryId", "key");

-- AddForeignKey
ALTER TABLE "FlavorFieldDefinition" ADD CONSTRAINT "FlavorFieldDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flavor" ADD CONSTRAINT "Flavor_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;


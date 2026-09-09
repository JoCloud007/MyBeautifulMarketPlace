-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "normalSupportEnd" TIMESTAMP(3),
    "extendedSupportEnd" TIMESTAMP(3),
    "eolDate" TIMESTAMP(3),
    "phase" "LifecyclePhase" NOT NULL DEFAULT 'RELEASED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_version_key" ON "ProductVersion"("productId", "version");

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "initialReleaseDate" TIMESTAMP(3),
ADD COLUMN     "productEOLDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "productVersionId" TEXT;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Flavor" ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "deprecationDate" TIMESTAMP(3),
ADD COLUMN     "eolDate" TIMESTAMP(3);

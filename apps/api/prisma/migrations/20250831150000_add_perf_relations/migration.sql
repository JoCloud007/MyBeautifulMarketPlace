-- AlterTable
ALTER TABLE "PerformanceProfile" ADD COLUMN     "flavorId" TEXT,
ADD COLUMN     "productId" TEXT;

-- AddForeignKey
ALTER TABLE "PerformanceProfile" ADD CONSTRAINT "PerformanceProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceProfile" ADD CONSTRAINT "PerformanceProfile_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor"("id") ON DELETE SET NULL ON UPDATE CASCADE;


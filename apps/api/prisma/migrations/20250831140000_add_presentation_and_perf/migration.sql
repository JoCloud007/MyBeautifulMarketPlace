-- CreateEnum
CREATE TYPE "PresentationStepType" AS ENUM ('COUNTRY', 'ZONE', 'PRODUCT', 'FLAVOR', 'USE_CASE', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PerformanceTargetType" AS ENUM ('PRODUCT', 'FLAVOR');

-- CreateEnum
CREATE TYPE "VisibilityType" AS ENUM ('SHOW_ALL', 'INTERNAL_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND');

-- DropForeignKey
ALTER TABLE "Forecast" DROP CONSTRAINT "Forecast_applicationId_fkey";

-- DropIndex
DROP INDEX "ProductVariantAvailabilityZone_variantId_availabilityZoneId_key";

-- AlterTable
ALTER TABLE "Forecast" ALTER COLUMN "applicationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ForecastLine" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "OperatingSystem" ADD COLUMN     "availabilityType" "AvailabilityType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "availabilityType" "AvailabilityType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "ProductVariantAvailabilityZone" DROP CONSTRAINT "ProductVariantAvailabilityZone_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "ProductVariantAvailabilityZone_pkey" PRIMARY KEY ("variantId", "availabilityZoneId");

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneAvailabilityZone" (
    "zoneId" TEXT NOT NULL,
    "availabilityZoneId" TEXT NOT NULL,

    CONSTRAINT "ZoneAvailabilityZone_pkey" PRIMARY KEY ("zoneId","availabilityZoneId")
);

-- CreateTable
CREATE TABLE "ProductVariantZone" (
    "variantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantZone_pkey" PRIMARY KEY ("variantId","zoneId")
);

-- CreateTable
CREATE TABLE "ProductZone" (
    "productId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "ProductZone_pkey" PRIMARY KEY ("productId","zoneId")
);

-- CreateTable
CREATE TABLE "FlavorZone" (
    "flavorId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "FlavorZone_pkey" PRIMARY KEY ("flavorId","zoneId")
);

-- CreateTable
CREATE TABLE "OperatingSystemZone" (
    "operatingSystemId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "OperatingSystemZone_pkey" PRIMARY KEY ("operatingSystemId","zoneId")
);

-- CreateTable
CREATE TABLE "PresentationOrder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationStep" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stepType" "PresentationStepType" NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "filterRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "PerformanceTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "scoreLabel" TEXT,
    "colorTheme" TEXT NOT NULL DEFAULT 'blue',
    "visibility" "VisibilityType" NOT NULL DEFAULT 'SHOW_ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "comparison" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_slug_key" ON "Zone"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationOrder_name_key" ON "PresentationOrder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationStep_orderId_position_key" ON "PresentationStep"("orderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceProfile_targetType_targetId_key" ON "PerformanceProfile"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Flavor_name_key" ON "Flavor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAvailabilityZone" ADD CONSTRAINT "ZoneAvailabilityZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAvailabilityZone" ADD CONSTRAINT "ZoneAvailabilityZone_availabilityZoneId_fkey" FOREIGN KEY ("availabilityZoneId") REFERENCES "AvailabilityZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantZone" ADD CONSTRAINT "ProductVariantZone_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantZone" ADD CONSTRAINT "ProductVariantZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductZone" ADD CONSTRAINT "ProductZone_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductZone" ADD CONSTRAINT "ProductZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorZone" ADD CONSTRAINT "FlavorZone_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorZone" ADD CONSTRAINT "FlavorZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingSystemZone" ADD CONSTRAINT "OperatingSystemZone_operatingSystemId_fkey" FOREIGN KEY ("operatingSystemId") REFERENCES "OperatingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingSystemZone" ADD CONSTRAINT "OperatingSystemZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationStep" ADD CONSTRAINT "PresentationStep_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PresentationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PerformanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


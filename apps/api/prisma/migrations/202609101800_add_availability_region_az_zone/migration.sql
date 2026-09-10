-- CreateEnum
CREATE TYPE "AvailabilityTargetType" AS ENUM ('PRODUCT', 'PRODUCT_VERSION', 'FLAVOR');

-- CreateTable
CREATE TABLE "ProductRegion" (
    "productId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "ProductRegion_pkey" PRIMARY KEY ("productId","regionId")
);

-- CreateTable
CREATE TABLE "ProductVersionRegion" (
    "productVersionId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "ProductVersionRegion_pkey" PRIMARY KEY ("productVersionId","regionId")
);

-- CreateTable
CREATE TABLE "FlavorRegion" (
    "flavorId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "FlavorRegion_pkey" PRIMARY KEY ("flavorId","regionId")
);

-- CreateTable
CREATE TABLE "ProductAvailabilityZone" (
    "productId" TEXT NOT NULL,
    "availabilityZoneId" TEXT NOT NULL,

    CONSTRAINT "ProductAvailabilityZone_pkey" PRIMARY KEY ("productId","availabilityZoneId")
);

-- CreateTable
CREATE TABLE "FlavorAvailabilityZone" (
    "flavorId" TEXT NOT NULL,
    "availabilityZoneId" TEXT NOT NULL,

    CONSTRAINT "FlavorAvailabilityZone_pkey" PRIMARY KEY ("flavorId","availabilityZoneId")
);

-- CreateTable
CREATE TABLE "AvailabilitySchedule" (
    "id" TEXT NOT NULL,
    "targetType" "AvailabilityTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "regionId" TEXT,
    "azId" TEXT,
    "zoneId" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "status" "AvailabilityType" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilitySchedule_targetType_targetId_idx" ON "AvailabilitySchedule"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "ProductRegion" ADD CONSTRAINT "ProductRegion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRegion" ADD CONSTRAINT "ProductRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionRegion" ADD CONSTRAINT "ProductVersionRegion_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionRegion" ADD CONSTRAINT "ProductVersionRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorRegion" ADD CONSTRAINT "FlavorRegion_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorRegion" ADD CONSTRAINT "FlavorRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAvailabilityZone" ADD CONSTRAINT "ProductAvailabilityZone_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAvailabilityZone" ADD CONSTRAINT "ProductAvailabilityZone_availabilityZoneId_fkey" FOREIGN KEY ("availabilityZoneId") REFERENCES "AvailabilityZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorAvailabilityZone" ADD CONSTRAINT "FlavorAvailabilityZone_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorAvailabilityZone" ADD CONSTRAINT "FlavorAvailabilityZone_availabilityZoneId_fkey" FOREIGN KEY ("availabilityZoneId") REFERENCES "AvailabilityZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySchedule" ADD CONSTRAINT "AvailabilitySchedule_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySchedule" ADD CONSTRAINT "AvailabilitySchedule_azId_fkey" FOREIGN KEY ("azId") REFERENCES "AvailabilityZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySchedule" ADD CONSTRAINT "AvailabilitySchedule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing regionId data to new join tables
INSERT INTO "ProductRegion" ("productId", "regionId")
SELECT id, "regionId" FROM "Product" WHERE "regionId" IS NOT NULL;

INSERT INTO "ProductVersionRegion" ("productVersionId", "regionId")
SELECT id, "regionId" FROM "ProductVersion" WHERE "regionId" IS NOT NULL;

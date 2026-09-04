-- AlterTable
ALTER TABLE "AvailabilityZone" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "eolDate" TIMESTAMP(3),
ADD COLUMN     "extendedSupportEnd" TIMESTAMP(3),
ADD COLUMN     "normalSupportEnd" TIMESTAMP(3),
ADD COLUMN     "phase" "LifecyclePhase" NOT NULL DEFAULT 'RELEASED',
ADD COLUMN     "releaseDate" TIMESTAMP(3);

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_regionId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVersion" DROP CONSTRAINT IF EXISTS "ProductVersion_regionId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN IF EXISTS "regionId";

-- AlterTable
ALTER TABLE "ProductVersion" DROP COLUMN IF EXISTS "regionId";

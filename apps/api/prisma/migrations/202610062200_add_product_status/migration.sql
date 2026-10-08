-- Add ProductStatus enum and Product.status column, defaulting all existing products to AVAILABLE
CREATE TYPE "ProductStatus" AS ENUM ('BACKLOG', 'OPPORTUNITY', 'AVAILABLE', 'AVAILABLE_PILOT_PENDING', 'DELAY_PENDING', 'CANCELLED');
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'AVAILABLE';

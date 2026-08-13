-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRateBpsSnapshot" INTEGER NOT NULL DEFAULT 1600;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 1600;

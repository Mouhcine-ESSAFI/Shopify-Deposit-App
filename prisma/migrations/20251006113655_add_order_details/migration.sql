-- AlterTable
ALTER TABLE "DepositOrder" ADD COLUMN "arrivalDate" DATETIME;
ALTER TABLE "DepositOrder" ADD COLUMN "campCategory" TEXT;
ALTER TABLE "DepositOrder" ADD COLUMN "customerName" TEXT;
ALTER TABLE "DepositOrder" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "DepositOrder" ADD COLUMN "pickupAddress" TEXT;
ALTER TABLE "DepositOrder" ADD COLUMN "tourName" TEXT;
ALTER TABLE "DepositOrder" ADD COLUMN "travelers" INTEGER;

-- CreateIndex
CREATE INDEX "DepositOrder_arrivalDate_idx" ON "DepositOrder"("arrivalDate");

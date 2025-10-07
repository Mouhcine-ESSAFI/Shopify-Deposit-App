-- CreateTable
CREATE TABLE "SellingPlanConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "sellingPlanGroupId" TEXT NOT NULL,
    "sellingPlanId" TEXT NOT NULL,
    "assignmentMode" TEXT NOT NULL,
    "selectedProductIds" TEXT,
    "selectedCollectionIds" TEXT,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SellingPlanConfig_sellingPlanGroupId_key" ON "SellingPlanConfig"("sellingPlanGroupId");

-- CreateIndex
CREATE INDEX "SellingPlanConfig_shopDomain_idx" ON "SellingPlanConfig"("shopDomain");

-- CreateIndex
CREATE INDEX "SellingPlanConfig_sellingPlanGroupId_idx" ON "SellingPlanConfig"("sellingPlanGroupId");

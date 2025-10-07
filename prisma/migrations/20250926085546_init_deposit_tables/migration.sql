-- CreateTable
CREATE TABLE "DepositPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "sellingPlanId" TEXT NOT NULL,
    "sellingPlanGid" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "merchantCode" TEXT NOT NULL,
    "description" TEXT,
    "depositPercent" REAL NOT NULL DEFAULT 15.0,
    "balanceDueDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DepositOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "orderNumber" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "depositAmount" REAL NOT NULL,
    "balanceAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT true,
    "balancePaid" BOOLEAN NOT NULL DEFAULT false,
    "balanceDueDate" DATETIME NOT NULL,
    "sellingPlanId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepositOrder_sellingPlanId_fkey" FOREIGN KEY ("sellingPlanId") REFERENCES "DepositPlan" ("sellingPlanId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "defaultDepositPercent" REAL NOT NULL DEFAULT 15.0,
    "defaultBalanceDays" INTEGER NOT NULL DEFAULT 365,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyToProducts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositPlan_sellingPlanId_key" ON "DepositPlan"("sellingPlanId");

-- CreateIndex
CREATE INDEX "DepositPlan_shopDomain_idx" ON "DepositPlan"("shopDomain");

-- CreateIndex
CREATE INDEX "DepositPlan_isActive_idx" ON "DepositPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DepositPlan_shopDomain_sellingPlanId_key" ON "DepositPlan"("shopDomain", "sellingPlanId");

-- CreateIndex
CREATE INDEX "DepositOrder_shopDomain_idx" ON "DepositOrder"("shopDomain");

-- CreateIndex
CREATE INDEX "DepositOrder_balancePaid_idx" ON "DepositOrder"("balancePaid");

-- CreateIndex
CREATE INDEX "DepositOrder_balanceDueDate_idx" ON "DepositOrder"("balanceDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "DepositOrder_shopDomain_orderId_key" ON "DepositOrder"("shopDomain", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfiguration_shopDomain_key" ON "AppConfiguration"("shopDomain");

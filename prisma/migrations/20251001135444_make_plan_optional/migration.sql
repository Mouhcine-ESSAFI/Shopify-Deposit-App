-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DepositOrder" (
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
    "sellingPlanId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepositOrder_sellingPlanId_fkey" FOREIGN KEY ("sellingPlanId") REFERENCES "DepositPlan" ("sellingPlanId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DepositOrder" ("balanceAmount", "balanceDueDate", "balancePaid", "createdAt", "customerEmail", "customerId", "depositAmount", "depositPaid", "id", "orderGid", "orderId", "orderNumber", "sellingPlanId", "shopDomain", "totalAmount", "updatedAt") SELECT "balanceAmount", "balanceDueDate", "balancePaid", "createdAt", "customerEmail", "customerId", "depositAmount", "depositPaid", "id", "orderGid", "orderId", "orderNumber", "sellingPlanId", "shopDomain", "totalAmount", "updatedAt" FROM "DepositOrder";
DROP TABLE "DepositOrder";
ALTER TABLE "new_DepositOrder" RENAME TO "DepositOrder";
CREATE INDEX "DepositOrder_shopDomain_idx" ON "DepositOrder"("shopDomain");
CREATE INDEX "DepositOrder_balancePaid_idx" ON "DepositOrder"("balancePaid");
CREATE INDEX "DepositOrder_balanceDueDate_idx" ON "DepositOrder"("balanceDueDate");
CREATE UNIQUE INDEX "DepositOrder_shopDomain_orderId_key" ON "DepositOrder"("shopDomain", "orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

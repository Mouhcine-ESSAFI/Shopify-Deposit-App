-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepositPlan" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "sellingPlanId" TEXT NOT NULL,
    "sellingPlanGid" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "merchantCode" TEXT NOT NULL,
    "description" TEXT,
    "depositPercent" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "balanceDueDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepositOrder" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "orderNumber" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "tourName" TEXT,
    "travelers" INTEGER,
    "arrivalDate" TIMESTAMP(3),
    "pickupAddress" TEXT,
    "campCategory" TEXT,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "balanceAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT true,
    "balancePaid" BOOLEAN NOT NULL DEFAULT false,
    "balanceDueDate" TIMESTAMP(3) NOT NULL,
    "sellingPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppConfiguration" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "defaultDepositPercent" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "defaultBalanceDays" INTEGER NOT NULL DEFAULT 365,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyToProducts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SellingPlanConfig" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "sellingPlanGroupId" TEXT NOT NULL,
    "sellingPlanId" TEXT NOT NULL,
    "assignmentMode" TEXT NOT NULL,
    "selectedProductIds" TEXT,
    "selectedCollectionIds" TEXT,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellingPlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositPlan_sellingPlanId_key" ON "public"."DepositPlan"("sellingPlanId");

-- CreateIndex
CREATE INDEX "DepositPlan_shopDomain_idx" ON "public"."DepositPlan"("shopDomain");

-- CreateIndex
CREATE INDEX "DepositPlan_isActive_idx" ON "public"."DepositPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DepositPlan_shopDomain_sellingPlanId_key" ON "public"."DepositPlan"("shopDomain", "sellingPlanId");

-- CreateIndex
CREATE INDEX "DepositOrder_shopDomain_idx" ON "public"."DepositOrder"("shopDomain");

-- CreateIndex
CREATE INDEX "DepositOrder_balancePaid_idx" ON "public"."DepositOrder"("balancePaid");

-- CreateIndex
CREATE INDEX "DepositOrder_balanceDueDate_idx" ON "public"."DepositOrder"("balanceDueDate");

-- CreateIndex
CREATE INDEX "DepositOrder_arrivalDate_idx" ON "public"."DepositOrder"("arrivalDate");

-- CreateIndex
CREATE UNIQUE INDEX "DepositOrder_shopDomain_orderId_key" ON "public"."DepositOrder"("shopDomain", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfiguration_shopDomain_key" ON "public"."AppConfiguration"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "SellingPlanConfig_sellingPlanGroupId_key" ON "public"."SellingPlanConfig"("sellingPlanGroupId");

-- CreateIndex
CREATE INDEX "SellingPlanConfig_shopDomain_idx" ON "public"."SellingPlanConfig"("shopDomain");

-- CreateIndex
CREATE INDEX "SellingPlanConfig_sellingPlanGroupId_idx" ON "public"."SellingPlanConfig"("sellingPlanGroupId");

-- AddForeignKey
ALTER TABLE "public"."DepositOrder" ADD CONSTRAINT "DepositOrder_sellingPlanId_fkey" FOREIGN KEY ("sellingPlanId") REFERENCES "public"."DepositPlan"("sellingPlanId") ON DELETE SET NULL ON UPDATE CASCADE;

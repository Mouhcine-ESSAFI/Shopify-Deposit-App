import prisma from "../db.server";

export interface CreateDepositPlanData {
  shopDomain: string;
  sellingPlanId: string;
  sellingPlanGid: string;
  groupId: string;
  planName: string;
  merchantCode: string;
  description?: string;
  depositPercent: number;
  balanceDueDays: number;
}

export async function createDepositPlan(data: CreateDepositPlanData) {
  return prisma.depositPlan.create({
    data: {
      shopDomain: data.shopDomain,
      sellingPlanId: data.sellingPlanId,
      sellingPlanGid: data.sellingPlanGid,
      groupId: data.groupId,
      planName: data.planName,
      merchantCode: data.merchantCode,
      description: data.description,
      depositPercent: data.depositPercent,
      balanceDueDays: data.balanceDueDays,
      isActive: true,
    },
  });
}

export async function getDepositPlansByShop(shopDomain: string) {
  return prisma.depositPlan.findMany({
    where: {
      shopDomain,
      isActive: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });
}

export async function getDepositPlanById(id: string) {
  return prisma.depositPlan.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
    },
  });
}

export async function updateDepositPlan(
  id: string,
  data: Partial<CreateDepositPlanData>
) {
  return prisma.depositPlan.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function deleteDepositPlan(id: string) {
  return prisma.depositPlan.update({
    where: { id },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });
}

export async function getDepositPlanBySellingPlanId(
  shopDomain: string,
  sellingPlanId: string
) {
  return prisma.depositPlan.findUnique({
    where: {
      shopDomain_sellingPlanId: {
        shopDomain,
        sellingPlanId,
      },
    },
  });
}
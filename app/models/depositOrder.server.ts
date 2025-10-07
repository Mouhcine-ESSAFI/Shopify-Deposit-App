// app/models/depositOrder.server.ts
import prisma from "../db.server";

export async function getDepositOrdersByShop(shopDomain: string) {
  return prisma.depositOrder.findMany({
    where: {
      shopDomain,
    },
    include: {
      plan: true,
    },
    orderBy: {
      arrivalDate: 'desc', // Sort by arrival date, newest first
    },
  });
}

export async function getDepositOrderById(id: string) {
  return prisma.depositOrder.findUnique({
    where: { id },
    include: {
      plan: true,
    },
  });
}

export async function updateDepositOrderBalanceStatus(
  shopDomain: string,
  orderId: string,
  balancePaid: boolean
) {
  return prisma.depositOrder.update({
    where: {
      shopDomain_orderId: {
        shopDomain,
        orderId,
      },
    },
    data: {
      balancePaid,
      updatedAt: new Date(),
    },
  });
}

export async function createDepositOrder(data: {
  shopDomain: string;
  orderId: string;
  orderGid: string;
  orderNumber: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  tourName?: string;
  travelers?: number;
  arrivalDate?: Date;
  pickupAddress?: string;
  campCategory?: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  sellingPlanId: string;
  balanceDueDate: Date;
}) {
  return prisma.depositOrder.create({
    data: {
      ...data,
      depositPaid: true,
      balancePaid: false,
    },
  });
}

// New function to update order with additional details
export async function updateDepositOrderDetails(
  shopDomain: string,
  orderId: string,
  data: {
    customerName?: string;
    customerPhone?: string;
    tourName?: string;
    travelers?: number;
    arrivalDate?: Date;
    pickupAddress?: string;
    campCategory?: string;
  }
) {
  return prisma.depositOrder.update({
    where: {
      shopDomain_orderId: {
        shopDomain,
        orderId,
      },
    },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}
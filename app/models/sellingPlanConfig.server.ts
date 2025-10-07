// app/models/sellingPlanConfig.server.ts

import prisma from "../db.server";

export interface SellingPlanConfigData {
  shopDomain: string;
  sellingPlanGroupId: string;
  sellingPlanId: string;
  assignmentMode: "specific" | "collection" | "all";
  selectedProductIds?: string[];
  selectedCollectionIds?: string[];
  productsCount?: number;
}

export async function createOrUpdateSellingPlanConfig(data: SellingPlanConfigData) {
  const {
    shopDomain,
    sellingPlanGroupId,
    sellingPlanId,
    assignmentMode,
    selectedProductIds,
    selectedCollectionIds,
    productsCount,
  } = data;

  return await prisma.sellingPlanConfig.upsert({
    where: {
      sellingPlanGroupId,
    },
    update: {
      assignmentMode,
      selectedProductIds: selectedProductIds ? JSON.stringify(selectedProductIds) : null,
      selectedCollectionIds: selectedCollectionIds ? JSON.stringify(selectedCollectionIds) : null,
      productsCount: productsCount || 0,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      shopDomain,
      sellingPlanGroupId,
      sellingPlanId,
      assignmentMode,
      selectedProductIds: selectedProductIds ? JSON.stringify(selectedProductIds) : null,
      selectedCollectionIds: selectedCollectionIds ? JSON.stringify(selectedCollectionIds) : null,
      productsCount: productsCount || 0,
      lastSyncedAt: new Date(),
    },
  });
}

export async function getSellingPlanConfig(sellingPlanGroupId: string) {
  const config = await prisma.sellingPlanConfig.findUnique({
    where: {
      sellingPlanGroupId,
    },
  });

  if (!config) return null;

  return {
    ...config,
    selectedProductIds: config.selectedProductIds 
      ? JSON.parse(config.selectedProductIds) 
      : [],
    selectedCollectionIds: config.selectedCollectionIds 
      ? JSON.parse(config.selectedCollectionIds) 
      : [],
  };
}

export async function getSellingPlanConfigsByShop(shopDomain: string) {
  const configs = await prisma.sellingPlanConfig.findMany({
    where: {
      shopDomain,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return configs.map(config => ({
    ...config,
    selectedProductIds: config.selectedProductIds 
      ? JSON.parse(config.selectedProductIds) 
      : [],
    selectedCollectionIds: config.selectedCollectionIds 
      ? JSON.parse(config.selectedCollectionIds) 
      : [],
  }));
}

export async function deleteSellingPlanConfig(sellingPlanGroupId: string) {
  return await prisma.sellingPlanConfig.delete({
    where: {
      sellingPlanGroupId,
    },
  });
}

export async function updateProductsCount(sellingPlanGroupId: string, count: number) {
  return await prisma.sellingPlanConfig.update({
    where: {
      sellingPlanGroupId,
    },
    data: {
      productsCount: count,
      lastSyncedAt: new Date(),
    },
  });
}
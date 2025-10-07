import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session } = await authenticate.webhook(request);

  if (!shop) {
    throw new Response("No shop provided", { status: 400 });
  }

  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean up app data when uninstalled
  await db.depositPlan.deleteMany({ where: { shopDomain: shop } });
  await db.depositOrder.deleteMany({ where: { shopDomain: shop } });
  await db.appConfiguration.deleteMany({ where: { shopDomain: shop } });
  
  console.log(`Cleaned up data for ${shop}`);

  return new Response("OK", { status: 200 });
};
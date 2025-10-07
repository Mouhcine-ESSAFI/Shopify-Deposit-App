// app/routes/webhooks.orders.updated.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateDepositOrderBalanceStatus } from "../models/depositOrder.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  console.log(`[Webhook Updated] Received ${topic} for shop ${shop}`);

  try {
    const order = payload as any;
    const orderId = order.id.toString();

    const depositOrder = await prisma.depositOrder.findFirst({
      where: { orderId: orderId }
    });

    if (!depositOrder || depositOrder.balancePaid) {
      return new Response("Not applicable", { status: 200 });
    }

    const hasBalancePayment = order.line_items?.some((item: any) => 
      item.name?.includes("Balance Payment") || 
      item.name?.includes("Processing Fee")
    );

    const financialStatus = order.financial_status;

    if ((financialStatus === "paid" || financialStatus === "partially_paid") && hasBalancePayment) {
      console.log(`[Webhook Updated] Marking balance as paid for order ${orderId}`);
      await updateDepositOrderBalanceStatus(shop, orderId, true);
      return new Response("Balance updated", { status: 200 });
    }

    return new Response("No action needed", { status: 200 });

  } catch (error) {
    console.error("[Webhook Updated] Error:", error);
    return new Response("Error", { status: 500 });
  }
};
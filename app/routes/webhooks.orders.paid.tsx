// app/routes/webhooks.orders.paid.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateDepositOrderBalanceStatus } from "../models/depositOrder.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    throw new Response();
  }

  console.log(`[Webhook] Received ${topic} for shop ${shop}`);

  try {
    // Parse the webhook payload
    const order = payload as any;
    const orderId = order.id.toString();
    const orderGid = `gid://shopify/Order/${orderId}`;

    console.log(`[Webhook] Processing order ${orderId}`);

    // Check if this is a deposit order in our database
    const depositOrder = await prisma.depositOrder.findFirst({
      where: {
        OR: [
          { orderId: orderId },
          { orderGid: orderGid }
        ]
      }
    });

    if (!depositOrder) {
      console.log(`[Webhook] Order ${orderId} is not a deposit order, skipping`);
      return new Response("Not a deposit order", { status: 200 });
    }

    // Check if balance is already marked as paid
    if (depositOrder.balancePaid) {
      console.log(`[Webhook] Balance already paid for order ${orderId}`);
      return new Response("Balance already paid", { status: 200 });
    }

    // Check order financial status
    const financialStatus = order.financial_status;
    console.log(`[Webhook] Order financial status: ${financialStatus}`);

    // Check if order has line items with "Balance Payment" or "Processing Fee"
    const hasBalancePayment = order.line_items?.some((item: any) => 
      item.name?.includes("Balance Payment") || 
      item.name?.includes("Processing Fee")
    );

    // Check order notes for processing fee indicator
    const hasProcessingFeeNote = order.note?.includes("Processing fee") || 
                                  order.note_attributes?.some((attr: any) => 
                                    attr.name === "processing_fee" || 
                                    attr.value?.includes("Processing fee")
                                  );

    console.log(`[Webhook] Has balance payment item: ${hasBalancePayment}`);
    console.log(`[Webhook] Has processing fee note: ${hasProcessingFeeNote}`);

    // If order is paid or partially paid, and has balance payment indicators
    if ((financialStatus === "paid" || financialStatus === "partially_paid") && 
        (hasBalancePayment || hasProcessingFeeNote)) {
      
      console.log(`[Webhook] Marking balance as paid for order ${orderId}`);
      
      // Update the deposit order to mark balance as paid
      await updateDepositOrderBalanceStatus(shop, orderId, true);

      console.log(`[Webhook] Successfully updated balance status for order ${orderId}`);

      // Optional: Tag the order in Shopify for easier filtering
      try {
        const tagsToAdd = ["balance-paid", "deposit-order-complete"];
        const currentTags = order.tags ? order.tags.split(", ") : [];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])].join(", ");

        const TAG_ORDER_MUTATION = `
          mutation orderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) {
              order {
                id
                tags
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        await admin.graphql(TAG_ORDER_MUTATION, {
          variables: {
            input: {
              id: orderGid,
              tags: newTags
            }
          }
        });

        console.log(`[Webhook] Added tags to order ${orderId}`);
      } catch (tagError) {
        console.error(`[Webhook] Error adding tags:`, tagError);
        // Continue anyway - the important part (updating DB) is done
      }

      return new Response("Balance payment recorded", { status: 200 });
    }

    console.log(`[Webhook] Order ${orderId} does not meet criteria for balance payment`);
    return new Response("No balance payment detected", { status: 200 });

  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};
// app/routes/webhooks.orders.create.tsx - Enhanced Version

import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  console.log(`[Webhook Create] Received ${topic} for shop ${shop}`);

  if (!session) {
    console.error("[Webhook Create] No session found");
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    // Wait a bit to ensure order is fully created in Shopify
    console.log("[Webhook Create] Waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract order ID from webhook payload
    const orderId = payload.id;
    const orderNumber = payload.order_number || payload.name;

    console.log(`[Webhook Create] Processing order ${orderNumber} (ID: ${orderId})`);

    // Enhanced query to fetch ALL order data including customer info and metafields
    const orderQuery = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          email
          phone
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          shippingAddress {
            address1
            address2
            city
            province
            country
            zip
          }
          customAttributes {
            key
            value
          }
          metafields(first: 20) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                name
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  title
                  product {
                    id
                    title
                  }
                }
                sellingPlan {
                  name
                  sellingPlanId
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(orderQuery, {
      variables: {
        id: `gid://shopify/Order/${orderId}`
      }
    });

    const responseJson = await response.json();
    
    if (responseJson.errors) {
      console.error("[Webhook Create] GraphQL Errors:", JSON.stringify(responseJson.errors, null, 2));
      throw new Error(`GraphQL Error: ${responseJson.errors[0].message}`);
    }

    const orderData = responseJson.data?.order;

    if (!orderData) {
      console.log("[Webhook Create] Order not found in GraphQL response");
      return new Response("Order not found", { status: 404 });
    }

    console.log("[Webhook Create] Order data retrieved successfully");

    // Check if order has selling plan items
    const hasSellingPlan = orderData.lineItems.edges.some(
      (edge: any) => edge.node.sellingPlan !== null
    );

    if (!hasSellingPlan) {
      console.log("[Webhook Create] Order has no selling plans, skipping");
      return new Response("No selling plans", { status: 200 });
    }

    // Extract selling plan details
    const lineItemsWithPlans = orderData.lineItems.edges
      .filter((edge: any) => edge.node.sellingPlan !== null)
      .map((edge: any) => ({
        lineItemId: edge.node.id,
        productTitle: edge.node.variant?.product?.title || edge.node.name,
        variantTitle: edge.node.variant?.title,
        quantity: edge.node.quantity,
        sellingPlanId: edge.node.sellingPlan.sellingPlanId,
        sellingPlanName: edge.node.sellingPlan.name,
        lineItemTotal: parseFloat(edge.node.originalTotalSet.shopMoney.amount),
        customAttributes: edge.node.customAttributes || []
      }));

    console.log("[Webhook Create] Line items with plans:", lineItemsWithPlans);

    // Get the first selling plan ID to look up our deposit plan
    const shopifySellingPlanId = lineItemsWithPlans[0].sellingPlanId;
    
    console.log("[Webhook Create] Looking for selling plan ID:", shopifySellingPlanId);

    // Find our deposit plan in the database
    const depositPlan = await db.depositPlan.findFirst({
      where: { 
        sellingPlanGid: shopifySellingPlanId 
      }
    });

    if (!depositPlan) {
      console.log("[Webhook Create] No matching deposit plan found in database");
      return new Response("No matching plan", { status: 200 });
    }

    console.log("[Webhook Create] Found deposit plan:", {
      id: depositPlan.id,
      name: depositPlan.planName,
      percentage: depositPlan.depositPercent
    });

    // Extract customer information
    const customerName = orderData.customer 
      ? `${orderData.customer.firstName || ''} ${orderData.customer.lastName || ''}`.trim()
      : null;
    
    const customerEmail = orderData.customer?.email || orderData.email || '';
    const customerPhone = orderData.customer?.phone || orderData.phone || null;

    // Helper function to find custom attribute or metafield
    const findValue = (key: string, altKeys: string[] = []) => {
      // Check order custom attributes
      const orderAttr = orderData.customAttributes?.find(
        (attr: any) => attr.key === key || altKeys.includes(attr.key)
      );
      if (orderAttr) return orderAttr.value;

      // Check line item custom attributes
      for (const item of lineItemsWithPlans) {
        const itemAttr = item.customAttributes?.find(
          (attr: any) => attr.key === key || altKeys.includes(attr.key)
        );
        if (itemAttr) return itemAttr.value;
      }

      // Check metafields
      const metafield = orderData.metafields?.edges?.find((edge: any) => 
        edge.node.key === key || altKeys.includes(edge.node.key)
      );
      if (metafield) {
        try {
          return JSON.parse(metafield.node.value);
        } catch {
          return metafield.node.value;
        }
      }

      return null;
    };

    // Extract tour details from custom attributes or metafields
    const tourName = findValue('tour_name', ['Tour Name', 'tour', 'Tour']) || 
                     lineItemsWithPlans[0]?.productTitle || 
                     null;
    
    const travelersValue = findValue('travelers', ['Travelers', 'number_of_travelers', 'guests']);
    const travelers = travelersValue ? parseInt(travelersValue) : null;
    
    const arrivalDateValue = findValue('arrival_date', ['Arrival Date', 'arrival', 'check_in_date']);
    const arrivalDate = arrivalDateValue ? new Date(arrivalDateValue) : null;
    
    const pickupAddress = findValue('pickup_address', ['Pickup Address', 'pickup', 'pickup_location']) || 
                         orderData.shippingAddress?.address1 || 
                         null;
    
    const campCategory = findValue('camp_category', ['Camp Category', 'category', 'accommodation_type']) || null;

    console.log("[Webhook Create] Extracted tour details:", {
      tourName,
      travelers,
      arrivalDate,
      pickupAddress,
      campCategory,
      customerName,
      customerPhone
    });

    const totalAmount = parseFloat(orderData.totalPriceSet.shopMoney.amount);
    
    // Calculate deposit based on percentage from our plan
    const depositAmount = (totalAmount * depositPlan.depositPercent) / 100;
    const balanceAmount = totalAmount - depositAmount;

    console.log("[Webhook Create] Deposit calculation:", {
      totalAmount,
      depositPercentage: depositPlan.depositPercent,
      depositAmount,
      balanceAmount
    });

    // Check if order already exists to avoid duplicates
    const existingOrder = await db.depositOrder.findFirst({
      where: {
        orderId: orderId.toString(),
        shopDomain: shop
      }
    });

    if (existingOrder) {
      console.log("[Webhook Create] Order already exists in database, skipping");
      return new Response("Order already processed", { status: 200 });
    }

    // Store deposit order in database with ALL extracted data
    const depositOrder = await db.depositOrder.create({
      data: {
        orderId: orderId.toString(),
        orderGid: `gid://shopify/Order/${orderId}`,
        orderNumber: orderData.name,
        customerEmail,
        customerName,
        customerPhone,
        tourName,
        travelers,
        arrivalDate,
        pickupAddress,
        campCategory,
        totalAmount,
        depositAmount,
        balanceAmount,
        sellingPlanId: depositPlan.sellingPlanId,
        depositPaid: true,
        balancePaid: false,
        balanceDueDate: arrivalDate || new Date(),
        shopDomain: shop,
      }
    });

    console.log("[Webhook Create] ✅ Deposit order created successfully:", {
      id: depositOrder.id,
      orderNumber: depositOrder.orderNumber,
      customerName: depositOrder.customerName,
      tourName: depositOrder.tourName,
      travelers: depositOrder.travelers,
      arrivalDate: depositOrder.arrivalDate,
      depositAmount: depositOrder.depositAmount,
      balanceAmount: depositOrder.balanceAmount
    });

    return new Response("Success", { status: 200 });

  } catch (error) {
    console.error("[Webhook Create] ❌ Error occurred:", error);
    
    if (error instanceof Error) {
      console.error("[Webhook Create] Error message:", error.message);
      console.error("[Webhook Create] Error stack:", error.stack);
    }
    
    return new Response("Error logged", { status: 200 });
  }
};
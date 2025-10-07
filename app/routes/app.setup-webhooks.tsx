// app/routes/app.setup-webhooks.tsx - UPDATED VERSION
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Button, Banner, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  return json({
    appUrl: process.env.SHOPIFY_APP_URL || "Not set"
  });
};

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { admin } = await authenticate.admin(request);

//   const appUrl = process.env.SHOPIFY_APP_URL;
  
//   if (!appUrl) {
//     return json({ 
//       success: false, 
//       error: "SHOPIFY_APP_URL is not set in environment variables" 
//     });
//   }

//   try {
//     // First, fetch existing webhooks
//     const existingResponse = await admin.graphql(`
//       query {
//         webhookSubscriptions(first: 50) {
//           edges {
//             node {
//               id
//               topic
//             }
//           }
//         }
//       }
//     `);

//     const existingResult = await existingResponse.json();
//     const existingWebhooks = existingResult.data?.webhookSubscriptions?.edges || [];
    
//     const results = [];
//     const webhooksToCreate = [
//       { topic: "ORDERS_CREATE", url: `${appUrl}/webhooks/orders/create` },
//       { topic: "ORDERS_PAID", url: `${appUrl}/webhooks/orders/paid` },
//       { topic: "ORDERS_UPDATED", url: `${appUrl}/webhooks/orders/updated` },
//     ];

//     for (const webhook of webhooksToCreate) {
//       // Check if webhook already exists
//       const exists = existingWebhooks.some((w: any) => w.node.topic === webhook.topic);
      
//       if (exists) {
//         results.push({
//           topic: webhook.topic,
//           status: "already_exists",
//           message: "Already registered"
//         });
//         continue;
//       }

//       // Create the webhook
//       const response = await admin.graphql(`
//         mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
//           webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
//             webhookSubscription {
//               id
//               topic
//             }
//             userErrors {
//               field
//               message
//             }
//           }
//         }
//       `, {
//         variables: {
//           topic: webhook.topic,
//           webhookSubscription: {
//             format: "JSON",
//             callbackUrl: webhook.url
//           }
//         }
//       });

//       const result = await response.json();
      
//       if (result.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
//         results.push({
//           topic: webhook.topic,
//           status: "error",
//           errors: result.data.webhookSubscriptionCreate.userErrors
//         });
//       } else {
//         results.push({
//           topic: webhook.topic,
//           status: "created",
//           message: "Successfully registered"
//         });
//       }
//     }

//     const hasErrors = results.some(r => r.status === "error");
//     const allExist = results.every(r => r.status === "already_exists");
    
//     if (hasErrors) {
//       return json({ 
//         success: false, 
//         error: "Some webhooks failed to register",
//         results
//       });
//     }

//     if (allExist) {
//       return json({
//         success: true,
//         message: "All webhooks are already registered!",
//         results
//       });
//     }

//     return json({ 
//       success: true, 
//       message: "Webhooks registered successfully!",
//       results
//     });

//   } catch (error) {
//     console.error("Webhook registration error:", error);
//     return json({ 
//       success: false, 
//       error: error instanceof Error ? error.message : "Unknown error" 
//     });
//   }
// };

export default function SetupWebhooks() {
  const { appUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const isLoading = navigation.state === "submitting";

  const handleRegister = () => {
    const formData = new FormData();
    submit(formData, { method: "post" });
  };

  return (
    <Page 
      title="Setup Webhooks"
      backAction={{ url: "/app" }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">
              {actionData.message}
              <br /><br />
              {actionData.results && (
                <div style={{ marginTop: '12px' }}>
                  {actionData.results.map((result: any, index: number) => (
                    <div key={index}>
                      <strong>{result.topic}:</strong> {result.message || result.status}
                    </div>
                  ))}
                </div>
              )}
              <br />
              Go to <strong>/app/verify-webhooks</strong> to confirm.
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">
              <p><strong>Error:</strong> {actionData.error}</p>
              {actionData.results && (
                <div style={{ marginTop: '12px' }}>
                  {actionData.results.map((result: any, index: number) => (
                    <div key={index}>
                      <strong>{result.topic}:</strong>
                      {result.errors?.map((err: any, i: number) => (
                        <div key={i}>• {err.message}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Register Order Payment Webhooks
              </Text>
              
              <Text as="p" variant="bodyMd">
                This will register the following webhooks:
              </Text>
              
              <ul>
                <li><strong>ORDERS_CREATE</strong> - Captures new orders with deposits</li>
                <li><strong>ORDERS_PAID</strong> - Triggers when an order is fully paid</li>
                <li><strong>ORDERS_UPDATED</strong> - Triggers when an order is updated</li>
              </ul>
              
              <Text as="p" variant="bodySm" tone="subdued">
                App URL: {appUrl}
              </Text>
              
              <Button 
                variant="primary" 
                onClick={handleRegister}
                loading={isLoading}
              >
                Register Webhooks
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
// app/routes/app.setup-webhooks.tsx - Add detailed response logging
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const appUrl = process.env.SHOPIFY_APP_URL;
  
  if (!appUrl) {
    return json({ 
      success: false, 
      error: "SHOPIFY_APP_URL is not set in environment variables" 
    });
  }

  try {
    const results = [];

    // First, check what's currently registered
    const checkResponse = await admin.graphql(`
      query {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      }
    `);

    const checkResult = await checkResponse.json();
    console.log("Current webhooks:", JSON.stringify(checkResult, null, 2));

    const webhooksToCreate = [
      { topic: "ORDERS_CREATE", url: `${appUrl}/webhooks/orders/create` },
      { topic: "ORDERS_PAID", url: `${appUrl}/webhooks/orders/paid` },
      { topic: "ORDERS_UPDATED", url: `${appUrl}/webhooks/orders/updated` },
    ];

    for (const webhook of webhooksToCreate) {
      console.log(`Attempting to create ${webhook.topic} webhook...`);
      
      const response = await admin.graphql(`
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          topic: webhook.topic,
          webhookSubscription: {
            format: "JSON",
            callbackUrl: webhook.url
          }
        }
      });

      const result = await response.json();
      console.log(`Result for ${webhook.topic}:`, JSON.stringify(result, null, 2));
      
      results.push({
        topic: webhook.topic,
        result: result,
        errors: result.data?.webhookSubscriptionCreate?.userErrors
      });
    }

    return json({ 
      success: true, 
      message: "Check server console for detailed logs",
      results,
      currentAppUrl: appUrl
    });

  } catch (error) {
    console.error("Webhook registration error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};
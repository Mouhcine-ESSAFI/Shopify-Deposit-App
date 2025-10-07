// app/routes/app.verify-webhooks.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Badge,
  BlockStack,
  InlineStack,
  Banner,
  Box
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      query {
        webhookSubscriptions(first: 20) {
          edges {
            node {
              id
              topic
              format
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

    const result = await response.json();
    const webhooks = result.data?.webhookSubscriptions?.edges || [];

    // Check specifically for our webhooks
    const ordersPaid = webhooks.find((w: any) => w.node.topic === "ORDERS_PAID");
    const ordersUpdated = webhooks.find((w: any) => w.node.topic === "ORDERS_UPDATED");

    return json({ 
      webhooks,
      ordersPaid,
      ordersUpdated,
      appUrl: process.env.SHOPIFY_APP_URL
    });
  } catch (error) {
    return json({ 
      webhooks: [], 
      error: error instanceof Error ? error.message : "Unknown error",
      appUrl: process.env.SHOPIFY_APP_URL
    });
  }
};

export default function VerifyWebhooks() {
  const { webhooks, ordersPaid, ordersUpdated, appUrl, error } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Webhook Status"
      subtitle="Verify that webhooks are properly registered"
      backAction={{ url: "/app" }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical">
              Error loading webhooks: {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Required Webhooks Status
              </Text>

              <Box>
                <BlockStack gap="300">
                  {/* ORDERS_PAID Status */}
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyLg" fontWeight="semibold">
                        ORDERS_PAID
                      </Text>
                      {ordersPaid && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {ordersPaid.node.endpoint.callbackUrl}
                        </Text>
                      )}
                    </BlockStack>
                    <Badge tone={ordersPaid ? "success" : "critical"}>
                      {ordersPaid ? "Registered" : "Not Found"}
                    </Badge>
                  </InlineStack>

                  {/* ORDERS_UPDATED Status */}
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyLg" fontWeight="semibold">
                        ORDERS_UPDATED
                      </Text>
                      {ordersUpdated && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {ordersUpdated.node.endpoint.callbackUrl}
                        </Text>
                      )}
                    </BlockStack>
                    <Badge tone={ordersUpdated ? "success" : "critical"}>
                      {ordersUpdated ? "Registered" : "Not Found"}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </Box>

              {ordersPaid && ordersUpdated && (
                <Banner tone="success">
                  All required webhooks are registered and ready!
                </Banner>
              )}

              {(!ordersPaid || !ordersUpdated) && (
                <Banner tone="warning">
                  Some webhooks are missing. Go to <strong>/app/setup-webhooks</strong> to register them.
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Configuration
              </Text>
              
              <Box>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      App URL:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {appUrl || "Not set"}
                    </Text>
                  </InlineStack>

                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Expected Endpoints:
                    </Text>
                    <BlockStack gap="100" align="end">
                      <Text as="p" variant="bodySm">
                        {appUrl}/webhooks/orders/paid
                      </Text>
                      <Text as="p" variant="bodySm">
                        {appUrl}/webhooks/orders/updated
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                All Registered Webhooks ({webhooks.length})
              </Text>

              {webhooks.length > 0 ? (
                <Box>
                  <BlockStack gap="300">
                    {webhooks.map((webhook: any, index: number) => (
                      <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <InlineStack align="space-between">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              {webhook.node.topic}
                            </Text>
                            <Badge tone="info">{webhook.node.format}</Badge>
                          </InlineStack>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {webhook.node.endpoint.callbackUrl}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            ID: {webhook.node.id.split('/').pop()}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                </Box>
              ) : (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No webhooks found
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
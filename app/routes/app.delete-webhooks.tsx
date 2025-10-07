// app/routes/app.delete-webhooks.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Button, Banner, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Fetch all webhooks
    const response = await admin.graphql(`
      query {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              topic
            }
          }
        }
      }
    `);

    const result = await response.json();
    const webhooks = result.data?.webhookSubscriptions?.edges || [];

    // Delete each webhook
    for (const webhook of webhooks) {
      await admin.graphql(`
        mutation webhookSubscriptionDelete($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: { id: webhook.node.id }
      });
    }

    return json({
      success: true,
      message: `Deleted ${webhooks.length} webhooks. Now go to Setup Webhooks to register new ones.`
    });

  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export default function DeleteWebhooks() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const isLoading = navigation.state === "submitting";

  return (
    <Page title="Delete All Webhooks" backAction={{ url: "/app" }}>
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">{actionData.message}</Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">Error: {actionData.error}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                This will delete ALL webhook subscriptions. Use this when your app URL changes.
              </Text>
              <Button
                variant="primary"
                tone="critical"
                onClick={() => submit({}, { method: "post" })}
                loading={isLoading}
              >
                Delete All Webhooks
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
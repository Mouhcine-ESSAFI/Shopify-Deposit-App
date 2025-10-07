// app/routes/app.check-webhooks.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      webhookSubscriptions(first: 10) {
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

  const result = await response.json();
  return json({ webhooks: result.data.webhookSubscriptions.edges });
};

export default function CheckWebhooks() {
  const { webhooks } = useLoaderData<typeof loader>();

  return (
    <Page title="Current Webhooks">
      <Layout>
        <Layout.Section>
          <Card>
            <pre>{JSON.stringify(webhooks, null, 2)}</pre>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
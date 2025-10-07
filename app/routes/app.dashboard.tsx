// Replace your app/routes/app.dashboard.tsx with this corrected version

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Banner,
  Box,
  InlineStack,
  BlockStack,
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Fixed GraphQL query - removed the ellipsis
  const response = await admin.graphql(`
    query getSellingPlans {
      sellingPlanGroups(first: 10) {
        edges {
          node {
            id
            name
            merchantCode
            sellingPlans(first: 5) {
              edges {
                node {
                  id
                  name
                  category
                }
              }
            }
          }
        }
      }
    }
  `);
  
  const data = await response.json();
  
  return json({
    sellingPlanGroups: data.data?.sellingPlanGroups?.edges || []
  });
};

interface SellingPlanNode {
  id: string;
  name: string;
  merchantCode: string;
  sellingPlans: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        category: string;
      };
    }>;
  };
}

export default function Dashboard() {
  const { sellingPlanGroups } = useLoaderData<typeof loader>();
  
  return (
    <Page
      title="Deposit System Dashboard"
      subtitle="Manage your deposit payment plans"
    >
      <Layout>
        <Layout.Section>
          <Banner tone="success">
            <p>Welcome to Deposit System Pro! Your deposit system is ready to configure.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Current Selling Plans
                </Text>
                
                {sellingPlanGroups.length > 0 ? (
                  <BlockStack gap="200">
                    {sellingPlanGroups.map(({ node }: { node: SellingPlanNode }, index: number) => (
                      <Box 
                        key={node.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              {node.name}
                            </Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              Code: {node.merchantCode}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Plan ID: {node.sellingPlans.edges[0]?.node.id.split('/').pop()}
                            </Text>
                          </BlockStack>
                          <Badge>
                            {node.sellingPlans.edges[0]?.node.category || 'Unknown'}
                          </Badge>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Box 
                    padding="800"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <div style={{ textAlign: 'center' }}>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        No selling plans found. Let's create your first deposit plan!
                      </Text>
                    </div>
                  </Box>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="200">
                  <Box 
                    padding="300"
                    background="bg-fill-info"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">
                        🚀 <strong>Next:</strong> Create your first deposit selling plan
                      </Text>
                      <Link to="/app/selling-plans">
                        <Button variant="primary">
                          Create Plan
                        </Button>
                      </Link>
                    </InlineStack>
                  </Box>
                  <Box 
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodyMd" tone="subdued">
                      📊 Coming soon: Advanced analytics and reporting
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  System Status
                </Text>
                <BlockStack gap="200">
                  <Box 
                    padding="300"
                    background="bg-fill-success"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodyMd">
                      ✅ <strong>Selling Plans:</strong> {sellingPlanGroups.length} active
                    </Text>
                  </Box>
                  <Box 
                    padding="300"
                    background="bg-fill-success"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodyMd">
                      ✅ <strong>Database:</strong> Connected and ready
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
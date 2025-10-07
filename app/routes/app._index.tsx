// app/routes/app._index.tsx

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
  EmptyState,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSellingPlanConfigsByShop } from "../models/sellingPlanConfig.server";

const GET_SELLING_PLANS_QUERY = `
  query getSellingPlans {
    sellingPlanGroups(first: 50) {
      edges {
        node {
          id
          name
          merchantCode
          description
          products(first: 1) {
            edges {
              node {
                id
              }
            }
          }
          sellingPlans(first: 5) {
            edges {
              node {
                id
                name
                category
                billingPolicy {
                  ... on SellingPlanFixedBillingPolicy {
                    checkoutCharge {
                      type
                      value {
                        ... on SellingPlanCheckoutChargePercentageValue {
                          percentage
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const GET_PRODUCTS_COUNT_QUERY = `
  query getProductsCount($id: ID!) {
    sellingPlanGroup(id: $id) {
      products(first: 250) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const response = await admin.graphql(GET_SELLING_PLANS_QUERY);
  const data = await response.json();
  
  const sellingPlanGroups = data.data?.sellingPlanGroups?.edges || [];
  
  // Fetch configs from database
  const configs = await getSellingPlanConfigsByShop(session.shop);
  
  // Get products count for each selling plan
  const enrichedPlans = await Promise.all(
    sellingPlanGroups.map(async ({ node }: any) => {
      const countResponse = await admin.graphql(GET_PRODUCTS_COUNT_QUERY, {
        variables: { id: node.id }
      });
      const countData = await countResponse.json();
      const productsCount = countData.data?.sellingPlanGroup?.products?.edges?.length || 0;
      
      // Find config for this plan
      const config = configs.find(c => c.sellingPlanGroupId === node.id);
      
      return {
        ...node,
        productsCount,
        config: config || null,
      };
    })
  );
  
  return json({
    sellingPlanGroups: enrichedPlans,
    totalPlans: enrichedPlans.length,
    totalProducts: enrichedPlans.reduce((sum, plan) => sum + plan.productsCount, 0),
  });
};

interface SellingPlanNode {
  id: string;
  name: string;
  merchantCode: string;
  description: string;
  productsCount: number;
  config: {
    assignmentMode: string;
    productsCount: number;
    selectedCollectionIds: string[];
    selectedProductIds: string[];
  } | null;
  sellingPlans: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        category: string;
        billingPolicy: {
          checkoutCharge?: {
            type: string;
            value: {
              percentage?: number;
            };
          };
        };
      };
    }>;
  };
}

export default function Dashboard() {
  const { sellingPlanGroups, totalPlans, totalProducts } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  
  const getAssignmentModeLabel = (mode: string) => {
    switch (mode) {
      case "specific":
        return "Specific Products";
      case "collection":
        return "Collections";
      case "all":
        return "All Products";
      default:
        return "Not Set";
    }
  };
  
  const getAssignmentModeTone = (mode: string): "success" | "info" | "attention" | "warning" => {
    switch (mode) {
      case "all":
        return "success";
      case "collection":
        return "info";
      case "specific":
        return "attention";
      default:
        return "warning";
    }
  };
  
  return (
    <Page
      title="Deposit System Dashboard"
      subtitle="Manage your deposit payment plans"
      primaryAction={{
        content: "Create Selling Plan",
        onAction: () => navigate("/app/selling-plans"),
      }}
    >
      <Layout>
        {/* Stats Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false} align="space-around" blockAlign="center">
            <Box width="50%">
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Total Selling Plans
                    </Text>
                    <Text as="h2" variant="heading2xl">
                      {totalPlans}
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </Box>
            
            <Box width="50%">
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Total Products Assigned
                    </Text>
                    <Text as="h2" variant="heading2xl">
                      {totalProducts}
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Selling Plans List */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Your Selling Plans
                  </Text>
                  <Button onClick={() => navigate("/app/selling-plans")}>
                    Manage Plans
                  </Button>
                </InlineStack>
                
                <Divider />
                
                {sellingPlanGroups.length > 0 ? (
                  <BlockStack gap="300">
                    {sellingPlanGroups.map((plan: SellingPlanNode) => {
                      const sellingPlan = plan.sellingPlans.edges[0]?.node;
                      const percentage = sellingPlan?.billingPolicy?.checkoutCharge?.value?.percentage;
                      
                      return (
                        <Card key={plan.id}>
                          <Box padding="400">
                            <BlockStack gap="300">
                              <InlineStack align="space-between" blockAlign="start">
                                <BlockStack gap="200">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Text as="h3" variant="headingMd">
                                      {plan.name}
                                    </Text>
                                    {percentage && (
                                      <Badge tone="success">{percentage}% Deposit</Badge>
                                    )}
                                  </InlineStack>
                                  <Text as="p" variant="bodyMd" tone="subdued">
                                    {plan.description || 'No description'}
                                  </Text>
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Code: {plan.merchantCode}
                                  </Text>
                                </BlockStack>
                                
                                <InlineStack gap="200">
                                  <Button
                                    onClick={() => {
                                      const planId = plan.id.split('/').pop();
                                      navigate(`/app/selling-plan/${planId}/products`);
                                    }}
                                  >
                                    Assign Products
                                  </Button>
                                  <Button
                                    variant="primary"
                                    onClick={() => navigate("/app/selling-plans")}
                                  >
                                    Edit
                                  </Button>
                                </InlineStack>
                              </InlineStack>
                              
                              <Divider />
                              
                              <InlineStack gap="400" wrap={false}>
                                <Box>
                                  <BlockStack gap="100">
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      Products Assigned
                                    </Text>
                                    <Text as="p" variant="bodyLg" fontWeight="semibold">
                                      {plan.productsCount}
                                    </Text>
                                  </BlockStack>
                                </Box>
                                
                                <Box>
                                  <BlockStack gap="100">
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      Assignment Mode
                                    </Text>
                                    {plan.config ? (
                                      <Badge tone={getAssignmentModeTone(plan.config.assignmentMode)}>
                                        {getAssignmentModeLabel(plan.config.assignmentMode)}
                                      </Badge>
                                    ) : (
                                      <Badge tone="warning">Not Configured</Badge>
                                    )}
                                  </BlockStack>
                                </Box>
                                
                                {plan.config?.assignmentMode === "collection" && (
                                  <Box>
                                    <BlockStack gap="100">
                                      <Text as="p" variant="bodySm" tone="subdued">
                                        Collections
                                      </Text>
                                      <Text as="p" variant="bodyLg" fontWeight="semibold">
                                        {plan.config.selectedCollectionIds?.length || 0}
                                      </Text>
                                    </BlockStack>
                                  </Box>
                                )}
                                
                                <Box>
                                  <BlockStack gap="100">
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      Plan ID
                                    </Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      {sellingPlan?.id.split('/').pop()}
                                    </Text>
                                  </BlockStack>
                                </Box>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </Card>
                      );
                    })}
                  </BlockStack>
                ) : (
                  <EmptyState
                    heading="No selling plans yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Create your first deposit selling plan to get started.</p>
                    <Button variant="primary" onClick={() => navigate("/app/selling-plans")}>
                      Create Selling Plan
                    </Button>
                  </EmptyState>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="300">
                  <Box padding="300" background="bg-surface-success-hover" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Create New Selling Plan
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Set up a new deposit payment option for your products
                        </Text>
                      </BlockStack>
                      <Button onClick={() => navigate("/app/selling-plans")}>
                        Create
                      </Button>
                    </InlineStack>
                  </Box>
                  
                  <Box padding="300" background="bg-surface-info-hover" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          View All Orders
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Monitor deposit orders and balance payments
                        </Text>
                      </BlockStack>
                      <Button onClick={() => navigate("/app/orders")}>
                        View Orders
                      </Button>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* System Status */}
        <Layout.Section>
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                💡 Pro Tip
              </Text>
              <Text as="p" variant="bodyMd">
                Assign your selling plans to products using the "Assign Products" button. You can choose specific products, entire collections, or all products at once.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
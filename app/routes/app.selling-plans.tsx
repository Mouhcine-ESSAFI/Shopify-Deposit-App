// app/routes/app.selling-plans.tsx - Fixed with DB persistence

import { useNavigate } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  Badge,
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  EmptyState,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { getSellingPlanConfigsByShop } from "../models/sellingPlanConfig.server";
import { 
  createDepositPlan, 
  updateDepositPlan, 
  deleteDepositPlan,
  getDepositPlanBySellingPlanId 
} from "../models/depositPlan.server";

interface SellingPlanNode {
  id: string;
  name: string;
  merchantCode: string;
  description: string;
  productsCount: number;
  config: any;
  sellingPlans: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        category: string;
        billingPolicy: {
          __typename: string;
          checkoutCharge?: {
            type: string;
            value: {
              __typename: string;
              percentage?: number;
            };
          };
          remainingBalanceChargeTimeAfterCheckout?: string;
        };
      };
    }>;
  };
}

const CREATE_SELLING_PLAN_MUTATION = `
  mutation createDepositSellingPlanGroup($input: SellingPlanGroupInput!) {
    sellingPlanGroupCreate(input: $input) {
      sellingPlanGroup {
        id
        name
        merchantCode
        description
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
                  remainingBalanceChargeTrigger
                  remainingBalanceChargeTimeAfterCheckout
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_SELLING_PLAN_MUTATION = `
  mutation updateSellingPlanGroup($id: ID!, $input: SellingPlanGroupInput!) {
    sellingPlanGroupUpdate(id: $id, input: $input) {
      sellingPlanGroup {
        id
        name
        merchantCode
        description
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
                  remainingBalanceChargeTrigger
                  remainingBalanceChargeTimeAfterCheckout
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_SELLING_PLAN_MUTATION = `
  mutation deleteSellingPlanGroup($id: ID!) {
    sellingPlanGroupDelete(id: $id) {
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_SELLING_PLANS_QUERY = `
  query getSellingPlans {
    sellingPlanGroups(first: 50) {
      edges {
        node {
          id
          name
          merchantCode
          description
          products(first: 250) {
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
                    remainingBalanceChargeTrigger
                    remainingBalanceChargeTimeAfterCheckout
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const response = await admin.graphql(GET_SELLING_PLANS_QUERY);
  const shopifyData = await response.json();
  
  const sellingPlanGroups = shopifyData.data?.sellingPlanGroups?.edges || [];
  
  // Fetch configs from database
  const configs = await getSellingPlanConfigsByShop(session.shop);
  
  // Enrich plans with config and products count
  const enrichedPlans = sellingPlanGroups.map(({ node }: any) => {
    const productsCount = node.products?.edges?.length || 0;
    const config = configs.find(c => c.sellingPlanGroupId === node.id);
    
    return {
      ...node,
      productsCount,
      config: config || null,
    };
  });
  
  return json({
    sellingPlanGroups: enrichedPlans,
    shop: session.shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  
  if (actionType === "create_selling_plan") {
    const planName = formData.get("planName") as string;
    const depositPercentage = parseFloat(formData.get("depositPercentage") as string);
    const description = formData.get("description") as string;
    const merchantCode = formData.get("merchantCode") as string;
    
    const balanceDueDays = 3650;
    
    const variables = {
      input: {
        name: planName,
        merchantCode: merchantCode,
        description: description,
        options: ["Deposit Payment"],
        sellingPlansToCreate: [
          {
            name: `${depositPercentage}% Deposit - ${100 - depositPercentage}% Balance Due on Tour Day`,
            description: description,
            options: `Pay ${depositPercentage}% now, remaining balance on tour day`,
            category: "PRE_ORDER",
            billingPolicy: {
              fixed: {
                checkoutCharge: {
                  type: "PERCENTAGE",
                  value: {
                    percentage: depositPercentage
                  }
                },
                remainingBalanceChargeTrigger: "TIME_AFTER_CHECKOUT",
                remainingBalanceChargeTimeAfterCheckout: `P${balanceDueDays}D`
              }
            },
            inventoryPolicy: {
              reserve: "ON_SALE"
            },
            deliveryPolicy: {
              fixed: {
                fulfillmentTrigger: "ASAP"
              }
            }
          }
        ]
      }
    };

    try {
      const response = await admin.graphql(CREATE_SELLING_PLAN_MUTATION, { variables });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupCreate?.userErrors?.length > 0) {
        return json({ 
          success: false, 
          errors: result.data.sellingPlanGroupCreate.userErrors 
        });
      }
      
      // ✅ SAVE TO DATABASE
      const sellingPlanGroup = result.data.sellingPlanGroupCreate.sellingPlanGroup;
      const sellingPlan = sellingPlanGroup.sellingPlans.edges[0]?.node;
      
      if (sellingPlanGroup && sellingPlan) {
        await createDepositPlan({
          shopDomain: session.shop,
          sellingPlanId: sellingPlan.id.split('/').pop()!,
          sellingPlanGid: sellingPlan.id,
          groupId: sellingPlanGroup.id,
          planName: planName,
          merchantCode: merchantCode,
          description: description,
          depositPercent: depositPercentage,
          balanceDueDays: balanceDueDays,
        });
      }
      
      return json({ 
        success: true, 
        message: "Selling plan created and saved successfully!"
      });
    } catch (error) {
      console.error("Error creating selling plan:", error);
      return json({ 
        success: false, 
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }] 
      });
    }
  }
  
  if (actionType === "update_selling_plan") {
    const planId = formData.get("planId") as string;
    const planName = formData.get("planName") as string;
    const depositPercentage = parseFloat(formData.get("depositPercentage") as string);
    const description = formData.get("description") as string;
    const merchantCode = formData.get("merchantCode") as string;
    const sellingPlanId = formData.get("sellingPlanId") as string;
    
    const balanceDueDays = 3650;
    
    const variables = {
      id: planId,
      input: {
        name: planName,
        merchantCode: merchantCode,
        description: description,
        sellingPlansToUpdate: [
          {
            id: sellingPlanId,
            name: `${depositPercentage}% Deposit - ${100 - depositPercentage}% Balance Due on Tour Day`,
            description: description,
            options: `Pay ${depositPercentage}% now, remaining balance on tour day`,
            billingPolicy: {
              fixed: {
                checkoutCharge: {
                  type: "PERCENTAGE",
                  value: {
                    percentage: depositPercentage
                  }
                },
                remainingBalanceChargeTrigger: "TIME_AFTER_CHECKOUT",
                remainingBalanceChargeTimeAfterCheckout: `P${balanceDueDays}D`
              }
            }
          }
        ]
      }
    };

    try {
      const response = await admin.graphql(UPDATE_SELLING_PLAN_MUTATION, { variables });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupUpdate?.userErrors?.length > 0) {
        return json({ 
          success: false, 
          errors: result.data.sellingPlanGroupUpdate.userErrors 
        });
      }
      
      // ✅ UPDATE IN DATABASE
      const sellingPlanIdNumeric = sellingPlanId.split('/').pop()!;
      const existingPlan = await getDepositPlanBySellingPlanId(session.shop, sellingPlanIdNumeric);
      
      if (existingPlan) {
        await updateDepositPlan(existingPlan.id, {
          planName: planName,
          merchantCode: merchantCode,
          description: description,
          depositPercent: depositPercentage,
          balanceDueDays: balanceDueDays,
          shopDomain: session.shop,
          sellingPlanId: sellingPlanIdNumeric,
          sellingPlanGid: sellingPlanId,
          groupId: planId,
        });
      } else {
        // Plan doesn't exist in DB, create it
        await createDepositPlan({
          shopDomain: session.shop,
          sellingPlanId: sellingPlanIdNumeric,
          sellingPlanGid: sellingPlanId,
          groupId: planId,
          planName: planName,
          merchantCode: merchantCode,
          description: description,
          depositPercent: depositPercentage,
          balanceDueDays: balanceDueDays,
        });
      }
      
      return json({ 
        success: true, 
        message: "Selling plan updated and saved successfully!"
      });
    } catch (error) {
      console.error("Error updating selling plan:", error);
      return json({ 
        success: false, 
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }] 
      });
    }
  }
  
  if (actionType === "delete_selling_plan") {
    const planId = formData.get("planId") as string;
    const sellingPlanId = formData.get("sellingPlanId") as string;
    
    try {
      const response = await admin.graphql(DELETE_SELLING_PLAN_MUTATION, { 
        variables: { id: planId } 
      });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupDelete?.userErrors?.length > 0) {
        return json({ 
          success: false, 
          errors: result.data.sellingPlanGroupDelete.userErrors 
        });
      }
      
      // ✅ SOFT DELETE IN DATABASE
      const sellingPlanIdNumeric = sellingPlanId.split('/').pop()!;
      const existingPlan = await getDepositPlanBySellingPlanId(session.shop, sellingPlanIdNumeric);
      
      if (existingPlan) {
        await deleteDepositPlan(existingPlan.id);
      }
      
      return json({ 
        success: true, 
        message: "Selling plan deleted successfully!"
      });
    } catch (error) {
      console.error("Error deleting selling plan:", error);
      return json({ 
        success: false, 
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }] 
      });
    }
  }
  
  return json({ success: false, errors: [{ message: "Unknown action" }] });
};

export default function SellingPlans() {
  const { sellingPlanGroups } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SellingPlanNode | null>(null);
  
  const [formData, setFormData] = useState({
    planName: "Tour Deposit Plan",
    depositPercentage: "15",
    description: "Pay deposit today, balance due on tour day",
    merchantCode: "tour-deposit"
  });
  
  const isLoading = navigation.state === "submitting";
  
  const handleCreatePlan = useCallback(() => {
    const data = new FormData();
    data.set("_action", "create_selling_plan");
    data.set("planName", formData.planName);
    data.set("depositPercentage", formData.depositPercentage);
    data.set("description", formData.description);
    data.set("merchantCode", formData.merchantCode);
    
    submit(data, { method: "post" });
    setShowCreateModal(false);
  }, [formData, submit]);
  
  const handleEditPlan = useCallback(() => {
    if (!selectedPlan) return;
    
    const data = new FormData();
    data.set("_action", "update_selling_plan");
    data.set("planId", selectedPlan.id);
    data.set("sellingPlanId", selectedPlan.sellingPlans.edges[0].node.id);
    data.set("planName", formData.planName);
    data.set("depositPercentage", formData.depositPercentage);
    data.set("description", formData.description);
    data.set("merchantCode", formData.merchantCode);
    
    submit(data, { method: "post" });
    setShowEditModal(false);
    setSelectedPlan(null);
  }, [formData, selectedPlan, submit]);
  
  const handleDeletePlan = useCallback(() => {
    if (!selectedPlan) return;
    
    const data = new FormData();
    data.set("_action", "delete_selling_plan");
    data.set("planId", selectedPlan.id);
    data.set("sellingPlanId", selectedPlan.sellingPlans.edges[0].node.id); // ✅ Added
    
    submit(data, { method: "post" });
    setShowDeleteModal(false);
    setSelectedPlan(null);
  }, [selectedPlan, submit]);
  
  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const openEditModal = useCallback((plan: SellingPlanNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlan(plan);
    const sellingPlan = plan.sellingPlans.edges[0]?.node;
    const percentage = sellingPlan?.billingPolicy?.checkoutCharge?.value?.percentage || 15;
    
    setFormData({
      planName: plan.name,
      depositPercentage: percentage.toString(),
      description: plan.description || "",
      merchantCode: plan.merchantCode
    });
    setShowEditModal(true);
  }, []);

  const openDeleteModal = useCallback((plan: SellingPlanNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlan(plan);
    setShowDeleteModal(true);
  }, []);

  const handlePlanClick = useCallback((planId: string) => {
    const id = planId.split('/').pop();
    navigate(`/app/selling-plan/${id}/products`);
  }, [navigate]);

  const getAssignmentModeLabel = (mode: string) => {
    switch (mode) {
      case "specific": return "Specific Products";
      case "collection": return "Collections";
      case "all": return "All Products";
      default: return "Not Configured";
    }
  };

  const getAssignmentModeTone = (mode: string): "success" | "info" | "attention" | "warning" => {
    switch (mode) {
      case "all": return "success";
      case "collection": return "info";
      case "specific": return "attention";
      default: return "warning";
    }
  };

  return (
    <Page
      title="Selling Plans"
      subtitle="Manage deposit payment plans for your products"
      primaryAction={{
        content: "Create Selling Plan",
        onAction: () => setShowCreateModal(true),
      }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">
              {actionData.message}
            </Banner>
          </Layout.Section>
        )}
        
        {actionData?.errors && (
          <Layout.Section>
            <Banner tone="critical">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Error:</Text>
                {actionData.errors.map((error: any, index: number) => (
                  <Text as="p" variant="bodyMd" key={index}>• {error.message}</Text>
                ))}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          {sellingPlanGroups.length > 0 ? (
            <BlockStack gap="400">
              {sellingPlanGroups.map((plan: SellingPlanNode) => {
                const sellingPlan = plan.sellingPlans.edges[0]?.node;
                const percentage = sellingPlan?.billingPolicy?.checkoutCharge?.value?.percentage;
                
                return (
                  <Card key={plan.id}>
                    <Box
                      padding="400"
                      onClick={() => handlePlanClick(plan.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="start">
                          <BlockStack gap="200">
                            <InlineStack gap="300" blockAlign="center">
                              <Text as="h2" variant="headingLg">
                                {plan.name}
                              </Text>
                              {percentage && (
                                <Badge tone="success" size="large">
                                  {percentage}% Deposit
                                </Badge>
                              )}
                            </InlineStack>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {plan.description || 'No description'}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Merchant Code: {plan.merchantCode}
                            </Text>
                          </BlockStack>
                          
                          <InlineStack gap="200">
                            <Button
                              onClick={(e: React.MouseEvent) => openEditModal(plan, e)}
                            >
                              Edit
                            </Button>
                            <Button
                              tone="critical"
                              onClick={(e: React.MouseEvent) => openDeleteModal(plan, e)}
                            >
                              Delete
                            </Button>
                          </InlineStack>
                        </InlineStack>
                        
                        <Divider />
                        
                        <InlineStack gap="600" wrap={false}>
                          <Box>
                            <BlockStack gap="100">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Products Assigned
                              </Text>
                              <Text as="p" variant="headingMd">
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
                                <Badge tone="warning">Click to Configure</Badge>
                              )}
                            </BlockStack>
                          </Box>
                          
                          {plan.config?.assignmentMode === "collection" && (
                            <Box>
                              <BlockStack gap="100">
                                <Text as="p" variant="bodySm" tone="subdued">
                                  Collections
                                </Text>
                                <Text as="p" variant="headingMd">
                                  {plan.config.selectedCollectionIds?.length || 0}
                                </Text>
                              </BlockStack>
                            </Box>
                          )}
                        </InlineStack>
                        
                        <Box paddingBlockStart="200">
                          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                            Click anywhere on this card to assign products
                          </Text>
                        </Box>
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
            </EmptyState>
          )}
        </Layout.Section>
      </Layout>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Selling Plan"
        primaryAction={{
          content: 'Create Plan',
          onAction: handleCreatePlan,
          loading: isLoading,
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowCreateModal(false),
        }]}
      >
        <Modal.Section>
          <Banner tone="info">
            <Text as="p" variant="bodyMd">
              <Text as="span" fontWeight="semibold">Manual Payment Mode:</Text> The remaining balance will NOT be charged automatically. You will manually charge customers on the day of the tour.
            </Text>
          </Banner>
        </Modal.Section>
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Plan Name"
              value={formData.planName}
              onChange={(value) => handleFormChange('planName', value)}
              autoComplete="off"
              helpText="Enter a descriptive name for your selling plan"
            />
            
            <TextField
              label="Deposit Percentage"
              type="number"
              value={formData.depositPercentage}
              onChange={(value) => handleFormChange('depositPercentage', value)}
              suffix="%"
              min="1"
              max="99"
              autoComplete="off"
              helpText="Percentage to charge as deposit (1-99%)"
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => handleFormChange('description', value)}
              multiline={2}
              autoComplete="off"
              helpText="Description shown to customers"
            />
            
            <TextField
              label="Merchant Code"
              value={formData.merchantCode}
              onChange={(value) => handleFormChange('merchantCode', value)}
              autoComplete="off"
              helpText="Internal code for this plan (lowercase, no spaces)"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlan(null);
        }}
        title="Edit Selling Plan"
        primaryAction={{
          content: 'Update Plan',
          onAction: handleEditPlan,
          loading: isLoading,
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => {
            setShowEditModal(false);
            setSelectedPlan(null);
          },
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Plan Name"
              value={formData.planName}
              onChange={(value) => handleFormChange('planName', value)}
              autoComplete="off"
            />
            
            <TextField
              label="Deposit Percentage"
              type="number"
              value={formData.depositPercentage}
              onChange={(value) => handleFormChange('depositPercentage', value)}
              suffix="%"
              min="1"
              max="99"
              autoComplete="off"
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => handleFormChange('description', value)}
              multiline={2}
              autoComplete="off"
            />
            
            <TextField
              label="Merchant Code"
              value={formData.merchantCode}
              onChange={(value) => handleFormChange('merchantCode', value)}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPlan(null);
        }}
        title="Delete Selling Plan"
        primaryAction={{
          content: 'Delete Plan',
          onAction: handleDeletePlan,
          loading: isLoading,
          destructive: true,
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => {
            setShowDeleteModal(false);
            setSelectedPlan(null);
          },
        }]}
      >
        <Modal.Section>
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              <Text as="span" fontWeight="semibold">Warning:</Text> This action cannot be undone.
            </Text>
          </Banner>
        </Modal.Section>
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Are you sure you want to delete "<Text as="span" fontWeight="semibold">{selectedPlan?.name}</Text>"?
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This will permanently delete the selling plan and it will no longer be available for new purchases. Existing orders will not be affected.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
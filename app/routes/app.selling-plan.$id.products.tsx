// app/routes/app.selling-plan.$id.products.tsx
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
  RadioButton,
  BlockStack,
  Box,
  Thumbnail,
  Modal,
  Checkbox,
  TextField,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { ImageIcon } from "@shopify/polaris-icons";
import { 
  createOrUpdateSellingPlanConfig, 
  getSellingPlanConfig 
} from "../models/sellingPlanConfig.server";

// GraphQL queries
const GET_SELLING_PLAN_QUERY = `
  query getSellingPlan($id: ID!) {
    sellingPlanGroup(id: $id) {
      id
      name
      merchantCode
      description
      products(first: 50) {
        edges {
          node {
            id
            title
            featuredImage {
              url
              altText
            }
          }
        }
      }
    }
  }
`;

const ASSIGN_PRODUCTS_MUTATION = `
  mutation sellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
    sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
      sellingPlanGroup {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const REMOVE_PRODUCTS_MUTATION = `
  mutation sellingPlanGroupRemoveProducts($id: ID!, $productIds: [ID!]!) {
    sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
      removedProductIds
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_ALL_PRODUCTS_QUERY = `
  query getAllProducts {
    products(first: 250) {
      edges {
        node {
          id
          title
          featuredImage {
            url
            altText
          }
        }
      }
    }
  }
`;

const GET_COLLECTIONS_QUERY = `
  query getCollections {
    collections(first: 250) {
      edges {
        node {
          id
          title
          productsCount {
            count
          }
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

const GET_COLLECTION_PRODUCTS_QUERY = `
  query getCollectionProducts($id: ID!) {
    collection(id: $id) {
      id
      title
      products(first: 250) {
        edges {
          node {
            id
            title
            featuredImage {
              url
              altText
            }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const planId = params.id;
  
  if (!planId) {
    throw new Response("Plan ID is required", { status: 400 });
  }
  
  const fullPlanId = `gid://shopify/SellingPlanGroup/${planId}`;
  
  try {
    const planResponse = await admin.graphql(GET_SELLING_PLAN_QUERY, {
      variables: { id: fullPlanId }
    });
    const planData = await planResponse.json();
    
    const productsResponse = await admin.graphql(GET_ALL_PRODUCTS_QUERY);
    const productsData = await productsResponse.json();
    
    const collectionsResponse = await admin.graphql(GET_COLLECTIONS_QUERY);
    const collectionsData = await collectionsResponse.json();
    
    const collections = collectionsData.data?.collections?.edges?.map((edge: any) => ({
      ...edge,
      node: {
        ...edge.node,
        productsCount: edge.node.productsCount?.count || 0
      }
    })) || [];
    
    // Load saved configuration from database
    const savedConfig = await getSellingPlanConfig(fullPlanId);
    
    return json({
      sellingPlan: planData.data?.sellingPlanGroup,
      allProducts: productsData.data?.products?.edges || [],
      allCollections: collections,
      planId: fullPlanId,
      savedConfig,
    });
  } catch (error) {
    console.error("Loader error:", error);
    throw new Response("Failed to load data", { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const planId = `gid://shopify/SellingPlanGroup/${params.id}`;
  
  if (actionType === "assign_products") {
    const productIdsJson = formData.get("productIds") as string;
    const productIds = JSON.parse(productIdsJson);
    
    if (productIds.length === 0) {
      return json({
        success: false,
        errors: [{ message: "No products to assign" }]
      });
    }
    
    try {
      const response = await admin.graphql(ASSIGN_PRODUCTS_MUTATION, {
        variables: { id: planId, productIds }
      });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupAddProducts?.userErrors?.length > 0) {
        const errors = result.data.sellingPlanGroupAddProducts.userErrors;
        const allAlreadyTaken = errors.every((err: any) => 
          err.message.toLowerCase().includes('already been taken')
        );
        
        if (allAlreadyTaken) {
          return json({
            success: true,
            message: `${productIds.length} product(s) are already assigned to this selling plan.`
          });
        }
        
        return json({
          success: false,
          errors: errors
        });
      }
      
      await createOrUpdateSellingPlanConfig({
        shopDomain: session.shop,
        sellingPlanGroupId: planId,
        sellingPlanId: params.id!,
        assignmentMode: "specific",
        selectedProductIds: productIds,
        productsCount: productIds.length,
      });
      
      return json({
        success: true,
        message: `${productIds.length} product(s) assigned successfully!`
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  
  if (actionType === "remove_products") {
    const productIdsJson = formData.get("productIds") as string;
    const productIds = JSON.parse(productIdsJson);
    
    try {
      const response = await admin.graphql(REMOVE_PRODUCTS_MUTATION, {
        variables: { id: planId, productIds }
      });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupRemoveProducts?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: result.data.sellingPlanGroupRemoveProducts.userErrors
        });
      }
      
      return json({
        success: true,
        message: `${productIds.length} product(s) removed successfully!`
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  
  if (actionType === "assign_all_products") {
    const allProductIdsJson = formData.get("allProductIds") as string;
    const allProductIds = JSON.parse(allProductIdsJson);
    
    if (allProductIds.length === 0) {
      return json({
        success: false,
        errors: [{ message: "No products found to assign" }]
      });
    }
    
    try {
      const response = await admin.graphql(ASSIGN_PRODUCTS_MUTATION, {
        variables: { id: planId, productIds: allProductIds }
      });
      const result = await response.json();
      
      if (result.data?.sellingPlanGroupAddProducts?.userErrors?.length > 0) {
        const errors = result.data.sellingPlanGroupAddProducts.userErrors;
        const allAlreadyTaken = errors.every((err: any) => 
          err.message.toLowerCase().includes('already been taken')
        );
        
        if (allAlreadyTaken) {
          return json({
            success: true,
            message: `All selected products are already assigned to this selling plan.`
          });
        }
        
        return json({
          success: false,
          errors: errors
        });
      }
      
      // Save configuration to database
      await createOrUpdateSellingPlanConfig({
        shopDomain: session.shop,
        sellingPlanGroupId: planId,
        sellingPlanId: params.id!,
        assignmentMode: "all",
        productsCount: allProductIds.length,
      });
      
      return json({
        success: true,
        message: `All ${allProductIds.length} products assigned successfully!`
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  
  if (actionType === "assign_collection_products") {
    const collectionIdsJson = formData.get("collectionIds") as string;
    const collectionIds = JSON.parse(collectionIdsJson);
    
    try {
      let totalAssigned = 0;
      const allErrors: any[] = [];
      
      // Process each collection
      for (const collectionId of collectionIds) {
        const collectionResponse = await admin.graphql(GET_COLLECTION_PRODUCTS_QUERY, {
          variables: { id: collectionId }
        });
        const collectionData = await collectionResponse.json();
        
        const collectionProductIds = collectionData.data?.collection?.products?.edges?.map(
          (edge: any) => edge.node.id
        ) || [];
        
        if (collectionProductIds.length === 0) {
          continue;
        }
        
        const response = await admin.graphql(ASSIGN_PRODUCTS_MUTATION, {
          variables: { id: planId, productIds: collectionProductIds }
        });
        const result = await response.json();
        
        if (result.data?.sellingPlanGroupAddProducts?.userErrors?.length > 0) {
          const errors = result.data.sellingPlanGroupAddProducts.userErrors;
          const notAlreadyTaken = errors.filter((err: any) => 
            !err.message.toLowerCase().includes('already been taken')
          );
          allErrors.push(...notAlreadyTaken);
        } else {
          totalAssigned += collectionProductIds.length;
        }
      }
      
      // Save configuration to database
      await createOrUpdateSellingPlanConfig({
        shopDomain: session.shop,
        sellingPlanGroupId: planId,
        sellingPlanId: params.id!,
        assignmentMode: "collection",
        selectedCollectionIds: collectionIds,
        productsCount: totalAssigned,
      });
      
      if (allErrors.length > 0) {
        return json({
          success: false,
          errors: allErrors
        });
      }
      
      if (totalAssigned === 0) {
        return json({
          success: true,
          message: `Products from selected collections are already assigned to this selling plan.`
        });
      }
      
      return json({
        success: true,
        message: `${totalAssigned} products from ${collectionIds.length} collection(s) assigned successfully!`
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  
  return json({ success: false, errors: [{ message: "Unknown action" }] });
};

export default function AssignProducts() {
  const { sellingPlan, allProducts, allCollections, savedConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  
  const [productType, setProductType] = useState<"specific" | "collection" | "all">("specific");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");
  const [tempSelectedProducts, setTempSelectedProducts] = useState<string[]>([]);
  const [tempSelectedCollections, setTempSelectedCollections] = useState<string[]>([]);
  const [selectedProductsToRemove, setSelectedProductsToRemove] = useState<string[]>([]);
  const [selectedCollectionsToRemove, setSelectedCollectionsToRemove] = useState<string[]>([]);
  
  const isLoading = navigation.state === "submitting";
  
  useEffect(() => {
    // Load saved configuration if available
    if (savedConfig) {
      setProductType(savedConfig.assignmentMode as "specific" | "collection" | "all");
      
      if (savedConfig.assignmentMode === "collection" && savedConfig.selectedCollectionIds) {
        const collections = allCollections
          .map((edge: any) => edge.node)
          .filter((c: any) => savedConfig.selectedCollectionIds.includes(c.id));
        setSelectedCollections(collections);
      }
    }
    
    // Load assigned products
    if (sellingPlan?.products?.edges) {
      const assignedProducts = sellingPlan.products.edges.map((edge: any) => edge.node);
      setSelectedProducts(assignedProducts);
    }
  }, [sellingPlan, savedConfig, allCollections]);
  
  const handleProductTypeChange = useCallback((value: string) => {
    setProductType(value as "specific" | "collection" | "all");
    setSelectedProductsToRemove([]);
    setSelectedCollectionsToRemove([]);
  }, []);
  
  const handleSelectProducts = useCallback(() => {
    setTempSelectedProducts(selectedProducts.map(p => p.id));
    setShowProductPicker(true);
  }, [selectedProducts]);
  
  const handleSelectCollections = useCallback(() => {
    setTempSelectedCollections(selectedCollections.map(c => c.id));
    setShowCollectionPicker(true);
  }, [selectedCollections]);
  
  const handleProductSelection = useCallback(() => {
    const products = allProducts
      .map((edge: any) => edge.node)
      .filter((product: any) => tempSelectedProducts.includes(product.id));
    
    setSelectedProducts(products);
    setShowProductPicker(false);
    setSearchQuery("");
  }, [tempSelectedProducts, allProducts]);
  
  const handleCollectionSelection = useCallback(() => {
    const collections = allCollections
      .map((edge: any) => edge.node)
      .filter((collection: any) => tempSelectedCollections.includes(collection.id));
    
    setSelectedCollections(collections);
    setShowCollectionPicker(false);
    setCollectionSearchQuery("");
  }, [tempSelectedCollections, allCollections]);
  
  const toggleProductSelection = useCallback((productId: string) => {
    setTempSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  }, []);
  
  const toggleCollectionSelection = useCallback((collectionId: string) => {
    setTempSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId);
      } else {
        return [...prev, collectionId];
      }
    });
  }, []);
  
  const filteredProducts = allProducts
    .map((edge: any) => edge.node)
    .filter((product: any) => 
      product.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  
  const filteredCollections = allCollections
    .map((edge: any) => edge.node)
    .filter((collection: any) => 
      collection.title.toLowerCase().includes(collectionSearchQuery.toLowerCase())
    );
  
  const toggleProductToRemove = useCallback((productId: string) => {
    setSelectedProductsToRemove(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  }, []);
  
  const toggleCollectionToRemove = useCallback((collectionId: string) => {
    setSelectedCollectionsToRemove(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId);
      } else {
        return [...prev, collectionId];
      }
    });
  }, []);
  
  const handleBulkRemoveProducts = useCallback(() => {
    if (selectedProductsToRemove.length === 0) return;
    
    setSelectedProducts(prev => prev.filter(p => !selectedProductsToRemove.includes(p.id)));
    
    const data = new FormData();
    data.set("_action", "remove_products");
    data.set("productIds", JSON.stringify(selectedProductsToRemove));
    submit(data, { method: "post" });
    
    setSelectedProductsToRemove([]);
  }, [selectedProductsToRemove, submit]);
  
  const handleBulkRemoveCollections = useCallback(() => {
    if (selectedCollectionsToRemove.length === 0) return;
    
    setSelectedCollections(prev => prev.filter(c => !selectedCollectionsToRemove.includes(c.id)));
    setSelectedCollectionsToRemove([]);
  }, [selectedCollectionsToRemove]);
  
  const handleSelectAllProducts = useCallback(() => {
    if (selectedProductsToRemove.length === selectedProducts.length) {
      setSelectedProductsToRemove([]);
    } else {
      setSelectedProductsToRemove(selectedProducts.map(p => p.id));
    }
  }, [selectedProducts, selectedProductsToRemove]);
  
  const handleSelectAllCollections = useCallback(() => {
    if (selectedCollectionsToRemove.length === selectedCollections.length) {
      setSelectedCollectionsToRemove([]);
    } else {
      setSelectedCollectionsToRemove(selectedCollections.map(c => c.id));
    }
  }, [selectedCollections, selectedCollectionsToRemove]);
  
  const handleSave = useCallback(() => {
    if (productType === "specific") {
      const productIds = selectedProducts.map(p => p.id);
      const currentProductIds = sellingPlan?.products?.edges?.map((edge: any) => edge.node.id) || [];
      const newProductIds = productIds.filter(id => !currentProductIds.includes(id));
      
      if (newProductIds.length === 0) {
        return;
      }
      
      const data = new FormData();
      data.set("_action", "assign_products");
      data.set("productIds", JSON.stringify(newProductIds));
      submit(data, { method: "post" });
    } else if (productType === "collection") {
      if (selectedCollections.length === 0) {
        return;
      }
      
      const collectionIds = selectedCollections.map(c => c.id);
      const data = new FormData();
      data.set("_action", "assign_collection_products");
      data.set("collectionIds", JSON.stringify(collectionIds));
      submit(data, { method: "post" });
    } else if (productType === "all") {
      const allProductIds = allProducts.map((edge: any) => edge.node.id);
      const currentProductIds = sellingPlan?.products?.edges?.map((edge: any) => edge.node.id) || [];
      const newProductIds = allProductIds.filter(id => !currentProductIds.includes(id));
      
      if (newProductIds.length === 0) {
        return;
      }
      
      const data = new FormData();
      data.set("_action", "assign_all_products");
      data.set("allProductIds", JSON.stringify(newProductIds));
      submit(data, { method: "post" });
    }
  }, [productType, selectedProducts, selectedCollections, allProducts, sellingPlan, submit]);
  
  return (
    <Page
      title="Assign Products"
      subtitle={sellingPlan?.name || "Selling Plan"}
      backAction={{ onAction: () => navigate("/app/selling-plans") }}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isLoading,
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
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Product type
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Set the type of products you want to sell.
                </Text>
              </BlockStack>
              
              <BlockStack gap="300">
                <Card background={productType === "specific" ? "bg-surface-selected" : undefined}>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <RadioButton
                        label="Specific products"
                        checked={productType === "specific"}
                        id="specific"
                        onChange={() => handleProductTypeChange("specific")}
                      />
                      <Box paddingInlineStart="800">
                        <BlockStack gap="300">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Select specific products to sell in this offer. Products can be in stock or out of stock.
                          </Text>
                          {productType === "specific" && (
                            <Box>
                              <Button onClick={handleSelectProducts}>
                                Select Products
                              </Button>
                            </Box>
                          )}
                        </BlockStack>
                      </Box>
                    </BlockStack>
                  </Box>
                </Card>

                <Card background={productType === "collection" ? "bg-surface-selected" : undefined}>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <RadioButton
                        label="Collection"
                        checked={productType === "collection"}
                        id="collection"
                        onChange={() => handleProductTypeChange("collection")}
                      />
                      <Box paddingInlineStart="800">
                        <BlockStack gap="300">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Select collections to assign all products from those collections to this selling plan.
                          </Text>
                          {productType === "collection" && (
                            <Box>
                              <Button onClick={handleSelectCollections}>
                                Select Collections
                              </Button>
                            </Box>
                          )}
                        </BlockStack>
                      </Box>
                    </BlockStack>
                  </Box>
                </Card>

                <Card background={productType === "all" ? "bg-surface-selected" : undefined}>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <RadioButton
                        label="All products"
                        checked={productType === "all"}
                        id="all"
                        onChange={() => handleProductTypeChange("all")}
                      />
                      <Box paddingInlineStart="800">
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Automatically assign this selling plan to all products in your store.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Box>
                </Card>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {productType === "specific" && selectedProducts.length > 0 && (
          <Layout.Section>
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Checkbox
                        label="Select all"
                        checked={selectedProductsToRemove.length === selectedProducts.length && selectedProducts.length > 0}
                        onChange={handleSelectAllProducts}
                      />
                      <Text as="h2" variant="headingMd">
                        Selected Products ({selectedProducts.length})
                      </Text>
                    </InlineStack>
                    {selectedProductsToRemove.length > 0 && (
                      <Button
                        variant="primary"
                        tone="critical"
                        onClick={handleBulkRemoveProducts}
                      >
                        Remove ({selectedProductsToRemove.length})
                      </Button>
                    )}
                  </InlineStack>
                  
                  <Divider />
                  
                  <BlockStack gap="0">
                    {selectedProducts.map((product, index) => (
                      <Box key={product.id}>
                        <Box padding="300">
                          <InlineStack gap="400" blockAlign="center">
                            <Checkbox
                              label=""
                              labelHidden
                              checked={selectedProductsToRemove.includes(product.id)}
                              onChange={() => toggleProductToRemove(product.id)}
                            />
                            <Thumbnail
                              source={product.featuredImage?.url || ImageIcon}
                              alt={product.featuredImage?.altText || product.title}
                              size="small"
                            />
                            <Text as="p" variant="bodyMd">
                              {product.title}
                            </Text>
                          </InlineStack>
                        </Box>
                        {index < selectedProducts.length - 1 && <Divider />}
                      </Box>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}
        
        {productType === "collection" && selectedCollections.length > 0 && (
          <Layout.Section>
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Checkbox
                        label="Select all"
                        checked={selectedCollectionsToRemove.length === selectedCollections.length && selectedCollections.length > 0}
                        onChange={handleSelectAllCollections}
                      />
                      <Text as="h2" variant="headingMd">
                        Selected Collections ({selectedCollections.length})
                      </Text>
                    </InlineStack>
                    {selectedCollectionsToRemove.length > 0 && (
                      <Button
                        variant="primary"
                        tone="critical"
                        onClick={handleBulkRemoveCollections}
                      >
                        Remove ({selectedCollectionsToRemove.length})
                      </Button>
                    )}
                  </InlineStack>
                  
                  <Divider />
                  
                  <BlockStack gap="0">
                    {selectedCollections.map((collection, index) => (
                      <Box key={collection.id}>
                        <Box padding="300">
                          <InlineStack gap="400" blockAlign="center">
                            <Checkbox
                              label=""
                              labelHidden
                              checked={selectedCollectionsToRemove.includes(collection.id)}
                              onChange={() => toggleCollectionToRemove(collection.id)}
                            />
                            <Thumbnail
                              source={collection.image?.url || ImageIcon}
                              alt={collection.image?.altText || collection.title}
                              size="small"
                            />
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyMd">
                                {collection.title}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {collection.productsCount} products
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                        {index < selectedCollections.length - 1 && <Divider />}
                      </Box>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Banner tone="info">
            <Text as="p" variant="bodyMd">
              <Text as="span" fontWeight="semibold">Note:</Text> Changes will be applied when you click the "Save" button. 
              {productType === "all" && " This will assign the selling plan to all products in your store."}
              {productType === "specific" && " Only selected products will have this selling plan available."}
              {productType === "collection" && " All products from the selected collections will have this selling plan available."}
            </Text>
          </Banner>
        </Layout.Section>
      </Layout>

      <Modal
        open={showProductPicker}
        onClose={() => {
          setShowProductPicker(false);
          setSearchQuery("");
        }}
        title="Select Products"
        primaryAction={{
          content: `Add ${tempSelectedProducts.length} product${tempSelectedProducts.length !== 1 ? 's' : ''}`,
          onAction: handleProductSelection,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setShowProductPicker(false);
              setSearchQuery("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Search products"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by product name"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
            />
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--p-color-border)', borderRadius: '8px' }}>
              <BlockStack gap="0">
                {filteredProducts.map((product: any, index: number) => (
                  <Box key={product.id}>
                    <Box padding="300" onClick={() => toggleProductSelection(product.id)} style={{ cursor: 'pointer' }}>
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          <Thumbnail
                            source={product.featuredImage?.url || ImageIcon}
                            alt={product.featuredImage?.altText || product.title}
                            size="small"
                          />
                          <Text as="p" variant="bodyMd">
                            {product.title}
                          </Text>
                        </InlineStack>
                        <Checkbox
                          label=""
                          labelHidden
                          checked={tempSelectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                      </InlineStack>
                    </Box>
                    {index < filteredProducts.length - 1 && <Divider />}
                  </Box>
                ))}
              </BlockStack>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={showCollectionPicker}
        onClose={() => {
          setShowCollectionPicker(false);
          setCollectionSearchQuery("");
        }}
        title="Select Collections"
        primaryAction={{
          content: `Add ${tempSelectedCollections.length} collection${tempSelectedCollections.length !== 1 ? 's' : ''}`,
          onAction: handleCollectionSelection,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setShowCollectionPicker(false);
              setCollectionSearchQuery("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Search collections"
              value={collectionSearchQuery}
              onChange={setCollectionSearchQuery}
              placeholder="Search by collection name"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setCollectionSearchQuery("")}
            />
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--p-color-border)', borderRadius: '8px' }}>
              <BlockStack gap="0">
                {filteredCollections.map((collection: any, index: number) => (
                  <Box key={collection.id}>
                    <Box padding="300" onClick={() => toggleCollectionSelection(collection.id)} style={{ cursor: 'pointer' }}>
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          <Thumbnail
                            source={collection.image?.url || ImageIcon}
                            alt={collection.image?.altText || collection.title}
                            size="small"
                          />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd">
                              {collection.title}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {collection.productsCount} products
                            </Text>
                          </BlockStack>
                        </InlineStack>
                        <Checkbox
                          label=""
                          labelHidden
                          checked={tempSelectedCollections.includes(collection.id)}
                          onChange={() => toggleCollectionSelection(collection.id)}
                        />
                      </InlineStack>
                    </Box>
                    {index < filteredCollections.length - 1 && <Divider />}
                  </Box>
                ))}
              </BlockStack>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
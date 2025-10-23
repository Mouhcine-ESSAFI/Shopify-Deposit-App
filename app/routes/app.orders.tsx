// app/routes/app.orders.tsx - Complete Version
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Button,
  Banner,
  Modal,
  Divider,
  IndexTable,
  useIndexResourceState,
  EmptySearchResult,
  Filters,
  ChoiceList,
  Thumbnail,
} from "@shopify/polaris";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "../shopify.server";

// GraphQL Mutations for balance collection
const ADD_LINE_ITEM_MUTATION = `
  mutation orderEditBegin($id: ID!) {
    orderEditBegin(id: $id) {
      calculatedOrder {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ADD_CUSTOM_ITEM_MUTATION = `
  mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!, $taxable: Boolean!) {
    orderEditAddCustomItem(
      id: $id, 
      title: $title, 
      price: $price, 
      quantity: $quantity,
      taxable: $taxable
    ) {
      calculatedLineItem {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const COMMIT_ORDER_EDIT_MUTATION = `
  mutation orderEditCommit($id: ID!, $notifyCustomer: Boolean, $staffNote: String) {
    orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
      order {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL query to fetch orders
const GET_ORDERS_QUERY = `
  query getOrders($query: String!) {
    orders(first: 250, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
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
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  title
                  image {
                    url
                  }
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
          transactions(first: 10) {
            id
            kind
            status
            amountSet {
              shopMoney {
                amount
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
  
  // Query for orders with selling plans
  const response = await admin.graphql(GET_ORDERS_QUERY, {
    variables: { 
      query: "tag:deposit OR financial_status:partially_paid OR financial_status:paid" 
    }
  });
  
  const data = await response.json();
  const orders = data.data?.orders?.edges || [];
  
  // Transform and enrich order data
  const enrichedOrders = orders.map(({ node }: any) => {
    const lineItems = node.lineItems.edges;
    const firstItem = lineItems[0]?.node;
    
    // Extract custom attributes
    const customAttributes: Record<string, string> = {};
    firstItem?.customAttributes?.forEach((attr: any) => {
      customAttributes[attr.key] = attr.value;
    });
    
    // Calculate deposit info more accurately
    const totalAmount = parseFloat(node.currentTotalPriceSet.shopMoney.amount);
    
    // Get all successful transactions
    const successfulTransactions = node.transactions.filter((t: any) => 
      t.kind === "SALE" && t.status === "SUCCESS"
    );
    
    // Sum all successful payments
    const totalPaid = successfulTransactions.reduce((sum: number, t: any) => 
      sum + parseFloat(t.amountSet.shopMoney.amount), 0
    );
    
    // First payment is usually the deposit
    const depositAmount = successfulTransactions.length > 0
      ? parseFloat(successfulTransactions[0].amountSet.shopMoney.amount)
      : 0;
    
    const balanceAmount = totalAmount - totalPaid;
    
    // Balance is paid if remaining amount is very small or order is marked as paid
    const balancePaid = balanceAmount < 0.01 || node.displayFinancialStatus === "PAID";
    
    return {
      id: node.id,
      orderNumber: node.name,
      createdAt: node.createdAt,
      
      // Customer info
      customerName: node.customer 
        ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim()
        : 'Guest',
      customerEmail: node.customer?.email || '',
      customerPhone: node.customer?.phone || '',
      
      // Tour/Product info
      tourName: firstItem?.title || '',
      tourImage: firstItem?.variant?.image?.url || '',
      quantity: firstItem?.quantity || 1,
      
      // Custom attributes from tours
      arrivalDate: customAttributes['Arrival Date'] || customAttributes['arrival_date'] || '',
      pickupAddress: customAttributes['Pickup Address'] || customAttributes['pickup_address'] || '',
      campCategory: customAttributes['Camp Category'] || customAttributes['camp_category'] || '',
      travelers: customAttributes['Travelers'] || customAttributes['travelers'] || '',
      
      // Financial info
      totalAmount,
      depositAmount,
      totalPaid,
      balanceAmount: Math.max(0, balanceAmount),
      balancePaid,
      currency: node.currentTotalPriceSet.shopMoney.currencyCode,
      
      // Status
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
    };
  });
  
  return json({
    orders: enrichedOrders,
    shop: session.shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "collect_balance") {
    const orderGid = formData.get("orderGid") as string;
    const balanceAmount = parseFloat(formData.get("balanceAmount") as string);

    try {
      const processingFee = balanceAmount * 0.03;

      // Begin order edit
      const beginResponse = await admin.graphql(ADD_LINE_ITEM_MUTATION, {
        variables: { id: orderGid }
      });
      const beginResult = await beginResponse.json();

      if (beginResult.data?.orderEditBegin?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: beginResult.data.orderEditBegin.userErrors
        });
      }

      const calculatedOrderId = beginResult.data.orderEditBegin.calculatedOrder.id;

      // Add processing fee as custom item
      const addItemResponse = await admin.graphql(ADD_CUSTOM_ITEM_MUTATION, {
        variables: {
          id: calculatedOrderId,
          title: "Processing Fee (3%)",
          price: {
            amount: processingFee.toFixed(2),
            currencyCode: "EUR"
          },
          quantity: 1,
          taxable: false
        }
      });
      const addItemResult = await addItemResponse.json();

      if (addItemResult.data?.orderEditAddCustomItem?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: addItemResult.data.orderEditAddCustomItem.userErrors
        });
      }

      // Commit the order edit
      const commitResponse = await admin.graphql(COMMIT_ORDER_EDIT_MUTATION, {
        variables: {
          id: calculatedOrderId,
          notifyCustomer: true,
          staffNote: `Processing fee: €${processingFee.toFixed(2)} (3%) added for balance payment collection`
        }
      });
      const commitResult = await commitResponse.json();

      if (commitResult.data?.orderEditCommit?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: commitResult.data.orderEditCommit.userErrors
        });
      }

      return json({
        success: true,
        message: `Payment request sent! Customer will pay €${(balanceAmount + processingFee).toFixed(2)} (€${balanceAmount.toFixed(2)} balance + €${processingFee.toFixed(2)} fee)`
      });

    } catch (error) {
      console.error("Error collecting balance:", error);
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }

  return json({ success: false, errors: [{ message: "Unknown action" }] });
};

type SortKey = 'orderNumber' | 'customerName' | 'arrivalDate' | 'totalAmount' | 'balanceAmount' | 'createdAt';
type SortDirection = 'ascending' | 'descending';

export default function Orders() {
  const { orders } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Filter and sort states
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('arrivalDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');

  const isLoading = navigation.state === "submitting";

  // Format functions
  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Sort and filter logic
  const sortedAndFilteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchValue) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter((order: any) => 
        order.orderNumber?.toLowerCase().includes(search) ||
        order.customerEmail?.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search) ||
        order.customerPhone?.includes(search) ||
        order.tourName?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter((order: any) => {
        if (statusFilter.includes('paid') && order.balancePaid) return true;
        if (statusFilter.includes('pending') && !order.balancePaid) return true;
        return false;
      });
    }

    // Sort
    return filtered.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      switch (sortKey) {
        case 'arrivalDate':
          aVal = a.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
          bVal = b.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'totalAmount':
        case 'balanceAmount':
          aVal = a[sortKey];
          bVal = b[sortKey];
          break;
        default:
          aVal = (a[sortKey] || '').toString().toLowerCase();
          bVal = (b[sortKey] || '').toString().toLowerCase();
      }

      if (aVal === 0 && bVal === 0) return 0;
      if (aVal === 0) return 1;
      if (bVal === 0) return -1;

      if (sortDirection === 'ascending') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [orders, searchValue, statusFilter, sortKey, sortDirection]);

  const resourceName = {
    singular: 'order',
    plural: 'orders',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(sortedAndFilteredOrders);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending');
    } else {
      setSortKey(key);
      setSortDirection('descending');
    }
  }, [sortKey, sortDirection]);

  const handleViewDetails = useCallback((order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  }, []);

  const handleCollectBalance = useCallback((order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  }, []);

  const confirmCollectBalance = useCallback(() => {
    if (!selectedOrder) return;

    const data = new FormData();
    data.set("_action", "collect_balance");
    data.set("orderGid", selectedOrder.id);
    data.set("balanceAmount", selectedOrder.balanceAmount.toString());

    submit(data, { method: "post" });
    setShowPaymentModal(false);
    setSelectedOrder(null);
  }, [selectedOrder, submit]);

  const calculateProcessingFee = (amount: number) => amount * 0.03;
  const calculateTotalWithFee = (amount: number) => amount + calculateProcessingFee(amount);

  // Filters
  const filters = [
    {
      key: 'status',
      label: 'Payment Status',
      filter: (
        <ChoiceList
          title="Payment Status"
          titleHidden
          choices={[
            { label: 'Balance Paid', value: 'paid' },
            { label: 'Balance Pending', value: 'pending' },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const handleClearFilters = useCallback(() => {
    setSearchValue('');
    setStatusFilter([]);
  }, []);

  // Table rows
  const rowMarkup = sortedAndFilteredOrders.map((order: any, index: number) => (
    <IndexTable.Row
      id={order.id}
      key={order.id}
      selected={selectedResources.includes(order.id)}
      position={index}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          {order.tourImage && (
            <Thumbnail
              source={order.tourImage}
              alt={order.tourName}
              size="small"
            />
          )}
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {order.orderNumber}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {formatDateTime(order.createdAt)}
            </Text>
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {order.customerName}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {order.customerEmail}
          </Text>
          {order.customerPhone && (
            <Text as="span" variant="bodySm" tone="subdued">
              {order.customerPhone}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd">
            {order.tourName}
          </Text>
          {order.travelers && (
            <Text as="span" variant="bodySm" tone="subdued">
              {order.travelers} traveler(s)
            </Text>
          )}
          {order.campCategory && (
            <Text as="span" variant="bodySm" tone="subdued">
              {order.campCategory}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        {order.arrivalDate ? (
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {formatDate(order.arrivalDate)}
            </Text>
            {order.pickupAddress && (
              <Text as="span" variant="bodySm" tone="subdued">
                {order.pickupAddress}
              </Text>
            )}
          </BlockStack>
        ) : (
          <Text as="span" tone="subdued">-</Text>
        )}
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end" fontWeight="semibold">
          {formatCurrency(order.totalAmount, order.currency)}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {formatCurrency(order.depositAmount, order.currency)}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <BlockStack gap="100" inlineAlign="end">
          <Text 
            as="span" 
            variant="bodyMd" 
            alignment="end"
            fontWeight="semibold"
          >
            {formatCurrency(order.balanceAmount, order.currency)}
          </Text>
          <Badge tone={order.balancePaid ? 'success' : 'warning'}>
            {order.balancePaid ? 'Paid' : 'Pending'}
          </Badge>
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200" align="end">
          <Button size="slim" onClick={() => handleViewDetails(order)}>
            View
          </Button>
          {!order.balancePaid && (
            <Button 
              size="slim" 
              variant="primary"
              onClick={() => handleCollectBalance(order)}
            >
              Collect
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup = (
    <EmptySearchResult
      title="No orders found"
      description={searchValue || statusFilter.length > 0 ? "Try changing the filters or search term" : "Orders with deposits will appear here"}
      withIllustration
    />
  );

  return (
    <Page 
      title="Deposit Orders" 
      subtitle={`${sortedAndFilteredOrders.length} order${sortedAndFilteredOrders.length !== 1 ? 's' : ''}`}
      fullWidth
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
                <Text as="p" fontWeight="semibold">Error:</Text>
                {actionData.errors.map((error: any, index: number) => (
                  <Text as="p" key={index}>{error.message}</Text>
                ))}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            <Box padding="400" paddingBlockEnd="400">
              <Filters
                queryValue={searchValue}
                filters={filters}
                onQueryChange={setSearchValue}
                onQueryClear={() => setSearchValue('')}
                onClearAll={handleClearFilters}
              />
            </Box>

            <IndexTable
              resourceName={resourceName}
              itemCount={sortedAndFilteredOrders.length}
              selectedItemsCount={
                allResourcesSelected ? 'All' : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: 'Order' },
                { title: 'Customer' },
                { title: 'Tour Details' },
                { title: 'Arrival Date' },
                { title: 'Total', alignment: 'end' },
                { title: 'Deposit', alignment: 'end' },
                { title: 'Balance', alignment: 'end' },
                { title: 'Actions', alignment: 'end' },
              ]}
              sortable={[true, true, false, true, true, false, true, false]}
              sortDirection={sortDirection}
              sortColumnIndex={
                sortKey === 'orderNumber' ? 0 :
                sortKey === 'customerName' ? 1 :
                sortKey === 'arrivalDate' ? 3 :
                sortKey === 'totalAmount' ? 4 :
                sortKey === 'balanceAmount' ? 6 : undefined
              }
              onSort={(headingIndex) => {
                const keys: SortKey[] = ['orderNumber', 'customerName', 'tourName', 'arrivalDate', 'totalAmount', 'depositAmount', 'balanceAmount'];
                handleSort(keys[headingIndex]);
              }}
            >
              {rowMarkup.length > 0 ? rowMarkup : emptyStateMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Order Details Modal */}
      <Modal
        large
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedOrder(null);
        }}
        title={`Order ${selectedOrder?.orderNumber || ''}`}
      >
        {selectedOrder && (
          <Modal.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Customer Information</Text>
                  <Divider />
                  <InlineStack gap="400">
                    <Box minWidth="150px">
                      <Text as="p" tone="subdued">Name:</Text>
                    </Box>
                    <Text as="p" fontWeight="semibold">{selectedOrder.customerName}</Text>
                  </InlineStack>
                  <InlineStack gap="400">
                    <Box minWidth="150px">
                      <Text as="p" tone="subdued">Email:</Text>
                    </Box>
                    <Text as="p">{selectedOrder.customerEmail}</Text>
                  </InlineStack>
                  {selectedOrder.customerPhone && (
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Phone:</Text>
                      </Box>
                      <Text as="p">{selectedOrder.customerPhone}</Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Tour Information</Text>
                  <Divider />
                  <InlineStack gap="400">
                    <Box minWidth="150px">
                      <Text as="p" tone="subdued">Tour:</Text>
                    </Box>
                    <Text as="p" fontWeight="semibold">{selectedOrder.tourName}</Text>
                  </InlineStack>
                  {selectedOrder.travelers && (
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Travelers:</Text>
                      </Box>
                      <Text as="p">{selectedOrder.travelers}</Text>
                    </InlineStack>
                  )}
                  {selectedOrder.arrivalDate && (
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Arrival Date:</Text>
                      </Box>
                      <Text as="p" fontWeight="medium">{formatDate(selectedOrder.arrivalDate)}</Text>
                    </InlineStack>
                  )}
                  {selectedOrder.pickupAddress && (
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Pickup:</Text>
                      </Box>
                      <Text as="p">{selectedOrder.pickupAddress}</Text>
                    </InlineStack>
                  )}
                  {selectedOrder.campCategory && (
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Category:</Text>
                      </Box>
                      <Text as="p">{selectedOrder.campCategory}</Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Payment Information</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="p" tone="subdued">Total Amount:</Text>
                    <Text as="p" variant="headingMd" fontWeight="semibold">
                      {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" tone="subdued">Deposit Paid:</Text>
                    <Text as="p" fontWeight="medium">
                      {formatCurrency(selectedOrder.depositAmount, selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="p" fontWeight="semibold">Remaining Balance:</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">
                      {formatCurrency(selectedOrder.balanceAmount, selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                  <Box paddingBlockStart="200">
                    <Badge tone={selectedOrder.balancePaid ? 'success' : 'warning'} size="large">
                      {selectedOrder.balancePaid ? 'Balance Paid' : 'Balance Pending'}
                    </Badge>
                  </Box>
                </BlockStack>
              </Card>
            </BlockStack>
          </Modal.Section>
        )}
      </Modal>

      {/* Payment Collection Modal */}
      <Modal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedOrder(null);
        }}
        title="Collect Remaining Balance"
        primaryAction={{
          content: 'Send Payment Request',
          onAction: confirmCollectBalance,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setShowPaymentModal(false);
              setSelectedOrder(null);
            },
          },
        ]}
      >
        {selectedOrder && (
          <>
            <Modal.Section>
              <Banner tone="info">
                <Text as="p">A 3% processing fee will be added to the balance amount.</Text>
              </Banner>
            </Modal.Section>

            <Modal.Section>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Order {selectedOrder.orderNumber}
                </Text>
                <Divider />
                
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">Customer: {selectedOrder.customerEmail}</Text>
                  
                  <InlineStack align="space-between">
                    <Text as="p">Remaining Balance:</Text>
                    <Text as="p" fontWeight="semibold">
                      {formatCurrency(selectedOrder.balanceAmount, selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text as="p" tone="subdued">Processing Fee (3%):</Text>
                    <Text as="p" tone="subdued">
                      {formatCurrency(calculateProcessingFee(selectedOrder.balanceAmount), selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                  
                  <Divider />
                  
                  <InlineStack align="space-between">
                    <Text as="p" variant="headingMd" fontWeight="bold">Total to Collect:</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">
                      {formatCurrency(calculateTotalWithFee(selectedOrder.balanceAmount), selectedOrder.currency)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Modal.Section>

            <Modal.Section>
              <Banner>
                <BlockStack gap="200">
                  <Text as="p" fontWeight="semibold">What happens next:</Text>
                  <BlockStack gap="100">
                    <Text as="p">• A 3% processing fee will be added to the order</Text>
                    <Text as="p">• Customer will receive an email with a payment link</Text>
                    <Text as="p">• They can pay the outstanding balance via Shopify checkout</Text>
                    <Text as="p">• Order will be automatically updated when payment is received</Text>
                  </BlockStack>
                </BlockStack>
              </Banner>
            </Modal.Section>
          </>
        )}
      </Modal>
    </Page>
  );
}
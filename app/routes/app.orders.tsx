// app/routes/app.orders.tsx - Enhanced Version with Pagination and Dynamic Details
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation, useSearchParams, useNavigate } from "@remix-run/react";
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
  Pagination,
  Spinner,
  TextField,
  Select,
} from "@shopify/polaris";
import { useState, useCallback, useMemo, useEffect } from "react";
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

// Enhanced GraphQL query to fetch orders with pagination
const GET_ORDERS_QUERY = `
  query getOrders($first: Int, $last: Int, $after: String, $before: String, $query: String!) {
    orders(first: $first, last: $last, after: $after, before: $before, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          updatedAt
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
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalDiscountsSet {
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
            numberOfOrders
          }
          shippingAddress {
            address1
            address2
            city
            province
            country
            zip
            name
            phone
          }
          billingAddress {
            address1
            address2
            city
            province
            country
            zip
            name
            phone
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                sku
                variantTitle
                variant {
                  id
                  title
                  price
                  image {
                    url
                    altText
                  }
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
          transactions(first: 20) {
            id
            kind
            status
            createdAt
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          customAttributes {
            key
            value
          }
          tags
          note
          cancelledAt
          cancelReason
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get URL params for pagination
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const direction = url.searchParams.get("direction") || "next";
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
  const searchQuery = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  
  // Build query string for GraphQL
  let query = "tag:deposit OR financial_status:partially_paid OR financial_status:paid";
  if (searchQuery) {
    query += ` AND (name:*${searchQuery}* OR email:*${searchQuery}*)`;
  }
  if (statusFilter && statusFilter !== "all") {
    query += ` AND financial_status:${statusFilter}`;
  }
  
  // Prepare variables for pagination
  const variables: any = {
    query,
  };
  
  if (direction === "next") {
    variables.first = pageSize;
    if (cursor) variables.after = cursor;
  } else {
    variables.last = pageSize;
    if (cursor) variables.before = cursor;
  }
  
  // Query for orders with pagination
  const response = await admin.graphql(GET_ORDERS_QUERY, { variables });
  
  const data = await response.json();
  const orders = data.data?.orders?.edges || [];
  const pageInfo = data.data?.orders?.pageInfo || {};
  
  // Transform and enrich order data with all details
  const enrichedOrders = orders.map(({ node, cursor: edgeCursor }: any) => {
    const lineItems = node.lineItems.edges;
    const firstItem = lineItems[0]?.node;
    
    // Extract custom attributes from order
    const orderCustomAttributes: Record<string, string> = {};
    node.customAttributes?.forEach((attr: any) => {
      orderCustomAttributes[attr.key] = attr.value;
    });
    
    // Extract custom attributes from ALL line items (not just first)
    const itemCustomAttributes: Record<string, string> = {};
    lineItems.forEach((edge: any) => {
      edge.node.customAttributes?.forEach((attr: any) => {
        // Store with both original key and normalized key
        itemCustomAttributes[attr.key] = attr.value;
        // Also store with lowercase/underscore version for better matching
        const normalizedKey = attr.key.toLowerCase().replace(/\s+/g, '_');
        itemCustomAttributes[normalizedKey] = attr.value;
      });
    });
    
    // Merge attributes (item attributes take precedence)
    const customAttributes = { ...orderCustomAttributes, ...itemCustomAttributes };
    
    // Debug: Log custom attributes to see what we're getting
    if (Object.keys(customAttributes).length > 0) {
      console.log(`Order ${node.name} custom attributes:`, customAttributes);
    }
    
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
    
    // Check if balance collection was already sent
    const balanceCollectionSent = node.tags?.includes('balance-collection-sent') || false;
    
    return {
      id: node.id,
      cursor: edgeCursor,
      orderNumber: node.name,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      
      // Customer info
      customerName: node.customer 
        ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim()
        : 'Guest',
      customerEmail: node.customer?.email || '',
      customerPhone: node.customer?.phone || '',
      customerId: node.customer?.id || null,
      customerOrders: node.customer?.numberOfOrders || 0,
      
      // Tour/Product info
      tourName: firstItem?.title || '',
      tourImage: firstItem?.variant?.image?.url || '',
      quantity: lineItems.reduce((sum: number, item: any) => sum + item.node.quantity, 0),
      lineItemsCount: lineItems.length,
      
      // All line items for details
      lineItems: lineItems.map((item: any) => ({
        id: item.node.id,
        title: item.node.title,
        variantTitle: item.node.variantTitle,
        quantity: item.node.quantity,
        sku: item.node.sku,
        price: parseFloat(item.node.originalUnitPriceSet.shopMoney.amount),
        image: item.node.variant?.image?.url,
        customAttributes: item.node.customAttributes,
      })),
      
      // Custom attributes from tours - check multiple variations
      arrivalDate: customAttributes['Arrival Date'] || 
                   customAttributes['arrival_date'] || 
                   customAttributes['Arrival date'] ||
                   customAttributes['arrival date'] ||
                   customAttributes['Date_arrivée'] ||
                   customAttributes['date_arrivée'] || '',
      departureDate: customAttributes['Departure Date'] || 
                     customAttributes['departure_date'] ||
                     customAttributes['Departure date'] ||
                     customAttributes['departure date'] || '',
      pickupAddress: customAttributes['Pickup Address'] || customAttributes['pickup_address'] || '',
      dropoffAddress: customAttributes['Dropoff Address'] || customAttributes['dropoff_address'] || '',
      campCategory: customAttributes['Camp Category'] || customAttributes['camp_category'] || '',
      travelers: customAttributes['Travelers'] || customAttributes['travelers'] || '',
      specialRequests: customAttributes['Special Requests'] || customAttributes['special_requests'] || '',
      
      // Financial info
      totalAmount,
      subtotalAmount: parseFloat(node.subtotalPriceSet.shopMoney.amount),
      shippingAmount: parseFloat(node.totalShippingPriceSet.shopMoney.amount),
      taxAmount: parseFloat(node.totalTaxSet.shopMoney.amount),
      discountAmount: parseFloat(node.totalDiscountsSet.shopMoney.amount),
      depositAmount,
      totalPaid,
      balanceAmount: Math.max(0, balanceAmount),
      balancePaid,
      balanceCollectionSent,
      currency: node.currentTotalPriceSet.shopMoney.currencyCode,
      
      // Transactions
      transactions: node.transactions.map((t: any) => ({
        id: t.id,
        kind: t.kind,
        status: t.status,
        amount: parseFloat(t.amountSet.shopMoney.amount),
        createdAt: t.createdAt,
      })),
      
      // Addresses
      shippingAddress: node.shippingAddress,
      billingAddress: node.billingAddress,
      
      // Status
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      
      // Other
      tags: node.tags || [],
      note: node.note || '',
      cancelledAt: node.cancelledAt,
      cancelReason: node.cancelReason,
    };
  });
  
  // Calculate statistics
  const stats = {
    totalOrders: enrichedOrders.length,
    totalRevenue: enrichedOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    totalDeposits: enrichedOrders.reduce((sum, o) => sum + o.depositAmount, 0),
    totalBalance: enrichedOrders.reduce((sum, o) => sum + o.balanceAmount, 0),
    paidOrders: enrichedOrders.filter(o => o.financialStatus === 'PAID').length,
    partiallyPaidOrders: enrichedOrders.filter(o => o.financialStatus === 'PARTIALLY_PAID').length,
    pendingOrders: enrichedOrders.filter(o => o.financialStatus === 'PENDING').length,
    ordersWithBalance: enrichedOrders.filter(o => o.balanceAmount > 0).length,
  };
  
  return json({
    orders: enrichedOrders,
    pageInfo,
    stats,
    shop: session.shop,
    currentPage: cursor,
    pageSize,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const action = formData.get("action");
  const orderId = formData.get("orderId") as string;
  
  if (action === "collectBalance") {
    const balanceAmount = parseFloat(formData.get("balanceAmount") as string);
    const processingFee = balanceAmount * 0.03;
    const totalToCollect = balanceAmount + processingFee;
    
    try {
      // Step 1: Begin order edit
      const beginEditResponse = await admin.graphql(ADD_LINE_ITEM_MUTATION, {
        variables: { id: orderId }
      });
      
      const beginEditData = await beginEditResponse.json();
      
      if (beginEditData.data?.orderEditBegin?.userErrors?.length > 0) {
        throw new Error(beginEditData.data.orderEditBegin.userErrors[0].message);
      }
      
      const calculatedOrderId = beginEditData.data.orderEditBegin.calculatedOrder.id;
      
      // Step 2: Add processing fee as custom line item
      const addItemResponse = await admin.graphql(ADD_CUSTOM_ITEM_MUTATION, {
        variables: {
          id: calculatedOrderId,
          title: "Processing Fee (3%)",
          price: { amount: processingFee.toFixed(2), currencyCode: "MAD" },
          quantity: 1,
          taxable: false
        }
      });
      
      const addItemData = await addItemResponse.json();
      
      if (addItemData.data?.orderEditAddCustomItem?.userErrors?.length > 0) {
        throw new Error(addItemData.data.orderEditAddCustomItem.userErrors[0].message);
      }
      
      // Step 3: Commit the edit and notify customer
      const commitResponse = await admin.graphql(COMMIT_ORDER_EDIT_MUTATION, {
        variables: {
          id: calculatedOrderId,
          notifyCustomer: true,
          staffNote: `Remaining balance collection requested. Balance: ${balanceAmount.toFixed(2)} MAD + Processing fee: ${processingFee.toFixed(2)} MAD = Total: ${totalToCollect.toFixed(2)} MAD`
        }
      });
      
      const commitData = await commitResponse.json();
      
      if (commitData.data?.orderEditCommit?.userErrors?.length > 0) {
        throw new Error(commitData.data.orderEditCommit.userErrors[0].message);
      }
      
      // Step 4: Add tag to mark balance collection as sent
      const updateTagsQuery = `
        mutation tagsAdd($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      await admin.graphql(updateTagsQuery, {
        variables: {
          id: orderId,
          tags: ["balance-collection-sent"]
        }
      });
      
      return json({ 
        success: true, 
        message: "Payment request sent successfully! The customer will receive an email with payment instructions." 
      });
      
    } catch (error: any) {
      return json({ 
        success: false, 
        message: `Failed to send payment request: ${error.message}` 
      }, { status: 400 });
    }
  }
  
  return json({ success: false, message: "Unknown action" }, { status: 400 });
};

// Helper functions
function calculateProcessingFee(amount: number): number {
  return amount * 0.03;
}

function calculateTotalWithFee(amount: number): number {
  return amount + calculateProcessingFee(amount);
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    // Handle various date formats
    let date: Date;
    
    // Check if it's already a valid date string
    if (dateString.includes('T') || dateString.includes('-')) {
      date = new Date(dateString);
    } else if (dateString.includes('/')) {
      // Handle MM/DD/YYYY or DD/MM/YYYY format
      const parts = dateString.split('/');
      if (parts.length === 3) {
        // Assume MM/DD/YYYY format
        date = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date format:', dateString);
      return dateString; // Return original string if can't parse
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    console.error('Date formatting error:', error, dateString);
    return dateString;
  }
}

function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Define sort key type
type SortKey = 'orderNumber' | 'customerName' | 'tourName' | 'arrivalDate' | 'totalAmount' | 'depositAmount' | 'balanceAmount';

export default function OrdersPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const { orders, pageInfo, stats, shop } = loaderData;
  
  const isLoading = navigation.state === "submitting" || navigation.state === "loading";
  
  // State management
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [detailedOrder, setDetailedOrder] = useState<any>(null);
  
  // Filter states
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string[]>([searchParams.get("status") || "all"]);
  const [dateFilter, setDateFilter] = useState("");
  
  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('orderNumber');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');
  
  // Index table resource state
  const resourceName = {
    singular: 'order',
    plural: 'orders',
  };
  
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = 
    useIndexResourceState(orders);
  
  // Filter orders (but don't re-paginate, use server pagination)
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    
    // Note: Search and status filters should be handled server-side via URL params
    // This local filtering is just for display while waiting for server response
    
    // Sort only (no filtering as it should be done server-side)
    filtered.sort((a, b) => {
      let aValue: any = a[sortKey];
      let bValue: any = b[sortKey];
      
      // Special handling for arrival date - sort by proximity to today
      if (sortKey === 'arrivalDate') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const aDate = aValue ? new Date(aValue) : new Date('9999-12-31');
        const bDate = bValue ? new Date(bValue) : new Date('9999-12-31');
        
        // If sorting ascending, show dates closest to today first
        if (sortDirection === 'ascending') {
          // Dates in the future come first, sorted by proximity to today
          const aDiff = aDate >= today ? Math.abs(aDate.getTime() - today.getTime()) : Number.MAX_VALUE;
          const bDiff = bDate >= today ? Math.abs(bDate.getTime() - today.getTime()) : Number.MAX_VALUE;
          return aDiff - bDiff;
        } else {
          // Descending: furthest dates first
          if (aDate < bDate) return 1;
          if (aDate > bDate) return -1;
          return 0;
        }
      }
      
      // Regular sorting for other fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }
      
      if (aValue < bValue) return sortDirection === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'ascending' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [orders, sortKey, sortDirection]);
  
  // Handlers
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
    // We already have all order details from the loader, no need to fetch again
    setDetailedOrder(order);
  }, []);
  
  const handleCollectBalance = useCallback((order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  }, []);
  
  const confirmCollectBalance = useCallback(() => {
    if (!selectedOrder) return;
    
    const formData = new FormData();
    formData.append("action", "collectBalance");
    formData.append("orderId", selectedOrder.id);
    formData.append("balanceAmount", selectedOrder.balanceAmount.toString());
    
    submit(formData, { method: "post" });
    setShowPaymentModal(false);
  }, [selectedOrder, submit]);
  
  // Pagination handlers
  const handleNextPage = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("cursor", pageInfo.endCursor);
    params.set("direction", "next");
    navigate(`?${params.toString()}`);
  }, [pageInfo, searchParams, navigate]);
  
  const handlePreviousPage = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("cursor", pageInfo.startCursor);
    params.set("direction", "prev");
    navigate(`?${params.toString()}`);
  }, [pageInfo, searchParams, navigate]);
  
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    // Don't navigate on every keystroke, user should press enter or click search
  }, []);
  
  const handleSearchSubmit = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    params.delete("cursor"); // Reset to first page
    navigate(`?${params.toString()}`);
  }, [searchValue, searchParams, navigate]);
  
  const handleStatusFilterChange = useCallback((value: string[]) => {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams);
    if (value.length > 0 && !value.includes('all')) {
      params.set("status", value[0]);
    } else {
      params.delete("status");
    }
    params.delete("cursor"); // Reset to first page
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);
  
  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    setStatusFilter(["all"]);
    setDateFilter("");
    navigate("?");
  }, [navigate]);
  
  // Applied filters for display
  const appliedFilters: Array<{key: string; label: string; onRemove: () => void}> = [];
  if (searchValue && searchParams.get("search")) {
    appliedFilters.push({
      key: 'search',
      label: `Search: ${searchValue}`,
      onRemove: () => {
        setSearchValue('');
        const params = new URLSearchParams(searchParams);
        params.delete("search");
        params.delete("cursor");
        navigate(`?${params.toString()}`);
      },
    });
  }
  if (statusFilter.length > 0 && !statusFilter.includes('all')) {
    appliedFilters.push({
      key: 'status',
      label: `Status: ${statusFilter[0]}`,
      onRemove: () => {
        setStatusFilter(['all']);
        const params = new URLSearchParams(searchParams);
        params.delete("status");
        params.delete("cursor");
        navigate(`?${params.toString()}`);
      },
    });
  }
  
  // Effect to show action result
  useEffect(() => {
    if (actionData?.success && actionData?.message) {
      // The banner will show the message
    }
  }, [actionData]);
  
  // Table row markup
  const rowMarkup = filteredOrders.map((order, index) => (
    <IndexTable.Row
      id={order.id}
      key={order.id}
      selected={selectedResources.includes(order.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {order.orderNumber}
        </Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200" align="start">
          <Box>
            <Text as="p" fontWeight="semibold">{order.customerName}</Text>
            <Text as="p" tone="subdued" variant="bodySm">{order.customerEmail}</Text>
            {order.customerPhone && (
              <Text as="p" tone="subdued" variant="bodySm">{order.customerPhone}</Text>
            )}
          </Box>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200" align="start">
          {order.tourImage && (
            <Thumbnail source={order.tourImage} alt={order.tourName} size="small" />
          )}
          <Box>
            <Text as="p" fontWeight="medium">{order.tourName}</Text>
            {order.lineItemsCount > 1 && (
              <Text as="p" tone="subdued" variant="bodySm">
                +{order.lineItemsCount - 1} more items
              </Text>
            )}
            <Text as="p" tone="subdued" variant="bodySm">
              Qty: {order.quantity}
            </Text>
          </Box>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {order.arrivalDate ? (
          <Box>
            <Badge tone="info">{formatDate(order.arrivalDate)}</Badge>
            {order.departureDate && order.departureDate !== order.arrivalDate && (
              <Text as="p" tone="subdued" variant="bodySm">
                to {formatDate(order.departureDate)}
              </Text>
            )}
          </Box>
        ) : (
          <Text tone="subdued" variant="bodySm">No date</Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {formatCurrency(order.totalAmount, order.currency)}
        </Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {order.depositAmount > 0 ? (
          <Box>
            <Text as="p" tone="success" fontWeight="medium">
              {formatCurrency(order.depositAmount, order.currency)}
            </Text>
            <Text as="p" tone="subdued" variant="bodySm">
              {((order.depositAmount / order.totalAmount) * 100).toFixed(0)}% paid
            </Text>
          </Box>
        ) : (
          <Text tone="subdued">—</Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        {order.balanceAmount > 0 ? (
          <Box>
            <Text as="p" tone="warning" fontWeight="bold">
              {formatCurrency(order.balanceAmount, order.currency)}
            </Text>
            {order.balanceCollectionSent && (
              <Badge tone="info" size="small">Sent</Badge>
            )}
          </Box>
        ) : (
          <Badge tone="success">Paid</Badge>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => handleViewDetails(order)}>
            View Details
          </Button>
          {order.balanceAmount > 0 && !order.balancePaid && !order.balanceCollectionSent && (
            <Button primary size="slim" onClick={() => handleCollectBalance(order)}>
              Collect Balance
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));
  
  // Empty state markup
  const emptyStateMarkup = (
    <EmptySearchResult
      title="No orders found"
      description="Try adjusting your search or filters"
      withIllustration
    />
  );
  
  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    setStatusFilter(["all"]);
    setDateFilter("");
    navigate("?");
  }, [navigate]);
  
  return (
    <Page
      title="Tour Orders Management"
      subtitle={`${filteredOrders.length} orders found`}
    >
      <Layout>
        {actionData?.message && (
          <Layout.Section>
            <Banner tone={actionData.success ? "success" : "critical"}>
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}
        
        {/* Filters and Search */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" align="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search"
                    labelHidden
                    value={searchValue}
                    onChange={(value) => setSearchValue(value)}
                    placeholder="Search orders, customers, or tours..."
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => {
                      setSearchValue('');
                      const params = new URLSearchParams(searchParams);
                      params.delete("search");
                      params.delete("cursor");
                      navigate(`?${params.toString()}`);
                    }}
                    connectedRight={
                      <Button onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        if (searchValue) {
                          params.set("search", searchValue);
                        } else {
                          params.delete("search");
                        }
                        params.delete("cursor");
                        navigate(`?${params.toString()}`);
                      }}>
                        Search
                      </Button>
                    }
                  />
                </div>
                <Select
                  label="Status"
                  labelHidden
                  options={[
                    { label: 'All Orders', value: 'all' },
                    { label: 'Paid', value: 'paid' },
                    { label: 'Has Deposit', value: 'deposit' },
                    { label: 'Balance Pending', value: 'pending' },
                  ]}
                  value={statusFilter[0]}
                  onChange={(value) => {
                    setStatusFilter([value]);
                    const params = new URLSearchParams(searchParams);
                    if (value !== 'all') {
                      params.set("status", value);
                    } else {
                      params.delete("status");
                    }
                    params.delete("cursor");
                    navigate(`?${params.toString()}`);
                  }}
                />
              </InlineStack>
              {appliedFilters.length > 0 && (
                <InlineStack gap="200">
                  {appliedFilters.map((filter) => (
                    <Badge key={filter.key} onRemove={filter.onRemove}>
                      {filter.label}
                    </Badge>
                  ))}
                  <Button plain onClick={handleClearFilters}>
                    Clear all
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Orders Table - Full Width */}
        <Layout.Section fullWidth>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredOrders.length}
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
              loading={isLoading}
            >
              {rowMarkup.length > 0 ? rowMarkup : emptyStateMarkup}
            </IndexTable>
            
            {/* Pagination */}
            <Box padding="400" background="bg-surface">
              <InlineStack align="center">
                <Pagination
                  hasPrevious={pageInfo.hasPreviousPage}
                  onPrevious={handlePreviousPage}
                  hasNext={pageInfo.hasNextPage}
                  onNext={handleNextPage}
                />
              </InlineStack>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Enhanced Order Details Modal */}
      <Modal
        large
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedOrder(null);
          setDetailedOrder(null);
        }}
        title={`Order ${selectedOrder?.orderNumber || ''}`}
      >
        {selectedOrder && (
          <Modal.Section>
            <BlockStack gap="400">
              {/* Customer Information */}
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
                    {selectedOrder.customerOrders > 0 && (
                      <InlineStack gap="400">
                        <Box minWidth="150px">
                          <Text as="p" tone="subdued">Total Orders:</Text>
                        </Box>
                        <Badge>{selectedOrder.customerOrders} orders</Badge>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>

                {/* Tour/Product Information */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Tour Information</Text>
                    <Divider />
                    
                    {/* Line Items */}
                    {selectedOrder.lineItems.map((item: any, index: number) => (
                      <Box key={item.id} paddingBlockEnd={index < selectedOrder.lineItems.length - 1 ? "200" : "0"}>
                        <InlineStack gap="400" align="space-between">
                          <InlineStack gap="300">
                            {item.image && (
                              <Thumbnail source={item.image} alt={item.title} size="small" />
                            )}
                            <BlockStack gap="100">
                              <Text as="p" fontWeight="semibold">{item.title}</Text>
                              {item.variantTitle && (
                                <Text as="p" tone="subdued" variant="bodySm">{item.variantTitle}</Text>
                              )}
                              {item.sku && (
                                <Text as="p" tone="subdued" variant="bodySm">SKU: {item.sku}</Text>
                              )}
                            </BlockStack>
                          </InlineStack>
                          <Box minWidth="150px">
                            <Text as="p" alignment="end">
                              {item.quantity} × {formatCurrency(item.price, selectedOrder.currency)}
                            </Text>
                            <Text as="p" alignment="end" fontWeight="semibold">
                              {formatCurrency(item.quantity * item.price, selectedOrder.currency)}
                            </Text>
                          </Box>
                        </InlineStack>
                        
                        {/* Custom Attributes for Line Item */}
                        {item.customAttributes && item.customAttributes.length > 0 && (
                          <Box paddingBlockStart="200">
                            {item.customAttributes.map((attr: any) => (
                              <InlineStack key={attr.key} gap="200">
                                <Text as="p" tone="subdued" variant="bodySm">{attr.key}:</Text>
                                <Text as="p" variant="bodySm">{attr.value}</Text>
                              </InlineStack>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                    
                    <Divider />
                    
                    {/* Tour Details */}
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
                    {selectedOrder.departureDate && (
                      <InlineStack gap="400">
                        <Box minWidth="150px">
                          <Text as="p" tone="subdued">Departure Date:</Text>
                        </Box>
                        <Text as="p" fontWeight="medium">{formatDate(selectedOrder.departureDate)}</Text>
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
                    {selectedOrder.dropoffAddress && (
                      <InlineStack gap="400">
                        <Box minWidth="150px">
                          <Text as="p" tone="subdued">Dropoff:</Text>
                        </Box>
                        <Text as="p">{selectedOrder.dropoffAddress}</Text>
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
                    {selectedOrder.specialRequests && (
                      <InlineStack gap="400">
                        <Box minWidth="150px">
                          <Text as="p" tone="subdued">Special Requests:</Text>
                        </Box>
                        <Text as="p">{selectedOrder.specialRequests}</Text>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>

                {/* Addresses */}
                {(selectedOrder.shippingAddress || selectedOrder.billingAddress) && (
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">Addresses</Text>
                      <Divider />
                      
                      <InlineStack gap="600" wrap>
                        {selectedOrder.shippingAddress && (
                          <Box minWidth="250px">
                            <BlockStack gap="200">
                              <Text as="p" fontWeight="semibold">Shipping Address</Text>
                              <Text as="p">{selectedOrder.shippingAddress.name}</Text>
                              <Text as="p">{selectedOrder.shippingAddress.address1}</Text>
                              {selectedOrder.shippingAddress.address2 && (
                                <Text as="p">{selectedOrder.shippingAddress.address2}</Text>
                              )}
                              <Text as="p">
                                {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.province} {selectedOrder.shippingAddress.zip}
                              </Text>
                              <Text as="p">{selectedOrder.shippingAddress.country}</Text>
                              {selectedOrder.shippingAddress.phone && (
                                <Text as="p">Phone: {selectedOrder.shippingAddress.phone}</Text>
                              )}
                            </BlockStack>
                          </Box>
                        )}
                        
                        {selectedOrder.billingAddress && (
                          <Box minWidth="250px">
                            <BlockStack gap="200">
                              <Text as="p" fontWeight="semibold">Billing Address</Text>
                              <Text as="p">{selectedOrder.billingAddress.name}</Text>
                              <Text as="p">{selectedOrder.billingAddress.address1}</Text>
                              {selectedOrder.billingAddress.address2 && (
                                <Text as="p">{selectedOrder.billingAddress.address2}</Text>
                              )}
                              <Text as="p">
                                {selectedOrder.billingAddress.city}, {selectedOrder.billingAddress.province} {selectedOrder.billingAddress.zip}
                              </Text>
                              <Text as="p">{selectedOrder.billingAddress.country}</Text>
                              {selectedOrder.billingAddress.phone && (
                                <Text as="p">Phone: {selectedOrder.billingAddress.phone}</Text>
                              )}
                            </BlockStack>
                          </Box>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                )}

                {/* Payment Information */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Payment Information</Text>
                    <Divider />
                    
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" tone="subdued">Subtotal:</Text>
                        <Text as="p">
                          {formatCurrency(selectedOrder.subtotalAmount, selectedOrder.currency)}
                        </Text>
                      </InlineStack>
                      
                      {selectedOrder.shippingAmount > 0 && (
                        <InlineStack align="space-between">
                          <Text as="p" tone="subdued">Shipping:</Text>
                          <Text as="p">
                            {formatCurrency(selectedOrder.shippingAmount, selectedOrder.currency)}
                          </Text>
                        </InlineStack>
                      )}
                      
                      {selectedOrder.taxAmount > 0 && (
                        <InlineStack align="space-between">
                          <Text as="p" tone="subdued">Tax:</Text>
                          <Text as="p">
                            {formatCurrency(selectedOrder.taxAmount, selectedOrder.currency)}
                          </Text>
                        </InlineStack>
                      )}
                      
                      {selectedOrder.discountAmount > 0 && (
                        <InlineStack align="space-between">
                          <Text as="p" tone="subdued">Discount:</Text>
                          <Text as="p" tone="success">
                            -{formatCurrency(selectedOrder.discountAmount, selectedOrder.currency)}
                          </Text>
                        </InlineStack>
                      )}
                      
                      <Divider />
                      
                      <InlineStack align="space-between">
                        <Text as="p" fontWeight="semibold">Total Amount:</Text>
                        <Text as="p" variant="headingMd" fontWeight="semibold">
                          {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                        </Text>
                      </InlineStack>
                      
                      <InlineStack align="space-between">
                        <Text as="p" tone="subdued">Total Paid:</Text>
                        <Text as="p" tone="success" fontWeight="medium">
                          {formatCurrency(selectedOrder.totalPaid, selectedOrder.currency)}
                        </Text>
                      </InlineStack>
                      
                      <Divider />
                      
                      <InlineStack align="space-between">
                        <Text as="p" fontWeight="semibold">Remaining Balance:</Text>
                        <Text as="p" variant="headingMd" fontWeight="bold" tone={selectedOrder.balanceAmount > 0 ? "warning" : "success"}>
                          {formatCurrency(selectedOrder.balanceAmount, selectedOrder.currency)}
                        </Text>
                      </InlineStack>
                      
                      <Box paddingBlockStart="200">
                        <InlineStack gap="200">
                          <Badge tone={selectedOrder.balancePaid ? 'success' : 'warning'} size="large">
                            {selectedOrder.balancePaid ? 'Balance Paid' : 'Balance Pending'}
                          </Badge>
                          {selectedOrder.balanceCollectionSent && (
                            <Badge tone="info">Collection Request Sent</Badge>
                          )}
                        </InlineStack>
                      </Box>
                    </BlockStack>
                    
                    {/* Transaction History */}
                    {selectedOrder.transactions && selectedOrder.transactions.length > 0 && (
                      <>
                        <Divider />
                        <Text as="p" fontWeight="semibold">Transaction History</Text>
                        <BlockStack gap="200">
                          {selectedOrder.transactions.map((transaction: any) => (
                            <InlineStack key={transaction.id} align="space-between">
                              <InlineStack gap="200">
                                <Badge tone={transaction.status === 'SUCCESS' ? 'success' : 'warning'}>
                                  {transaction.kind}
                                </Badge>
                                <Text as="p" tone="subdued" variant="bodySm">
                                  {formatDateTime(transaction.createdAt)}
                                </Text>
                              </InlineStack>
                              <Text as="p" fontWeight="medium">
                                {formatCurrency(transaction.amount, selectedOrder.currency)}
                              </Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </>
                    )}
                  </BlockStack>
                </Card>

                {/* Order Notes */}
                {selectedOrder.note && (
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">Order Notes</Text>
                      <Divider />
                      <Text as="p">{selectedOrder.note}</Text>
                    </BlockStack>
                  </Card>
                )}

                {/* Order Status & Tags */}
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Order Status</Text>
                    <Divider />
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Financial Status:</Text>
                      </Box>
                      <Badge tone={selectedOrder.financialStatus === 'PAID' ? 'success' : 'warning'}>
                        {selectedOrder.financialStatus}
                      </Badge>
                    </InlineStack>
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Fulfillment Status:</Text>
                      </Box>
                      <Badge tone={selectedOrder.fulfillmentStatus === 'FULFILLED' ? 'success' : 'info'}>
                        {selectedOrder.fulfillmentStatus || 'UNFULFILLED'}
                      </Badge>
                    </InlineStack>
                    {selectedOrder.tags && selectedOrder.tags.length > 0 && (
                      <>
                        <InlineStack gap="400">
                          <Box minWidth="150px">
                            <Text as="p" tone="subdued">Tags:</Text>
                          </Box>
                          <InlineStack gap="100">
                            {selectedOrder.tags.map((tag: string) => (
                              <Badge key={tag}>{tag}</Badge>
                            ))}
                          </InlineStack>
                        </InlineStack>
                      </>
                    )}
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Created:</Text>
                      </Box>
                      <Text as="p">{formatDateTime(selectedOrder.createdAt)}</Text>
                    </InlineStack>
                    <InlineStack gap="400">
                      <Box minWidth="150px">
                        <Text as="p" tone="subdued">Updated:</Text>
                      </Box>
                      <Text as="p">{formatDateTime(selectedOrder.updatedAt)}</Text>
                    </InlineStack>
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
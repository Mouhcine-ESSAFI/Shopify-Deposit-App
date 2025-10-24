import { useLoaderData, useSubmit, useFetcher, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, DataTable, Badge, Text, BlockStack, Button, TextField,
  Select, InlineStack, EmptyState, Modal, Banner, Pagination, Divider, Spinner
} from "@shopify/polaris";
import { useState, useEffect, useCallback } from "react";

export const loader = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const direction = url.searchParams.get("direction") || "next";

    const response = await admin.graphql(
      `#graphql
        query getOrders($first: Int, $last: Int, $after: String, $before: String) {
          orders(first: $first, last: $last, after: $after, before: $before, sortKey: CREATED_AT, reverse: true) {
            edges {
              cursor
              node {
                id
                legacyResourceId
                name
                email
                phone
                createdAt
                updatedAt
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                subtotalPriceSet { shopMoney { amount currencyCode } }
                totalShippingPriceSet { shopMoney { amount currencyCode } }
                totalTaxSet { shopMoney { amount currencyCode } }
                totalDiscountsSet { shopMoney { amount currencyCode } }
                customAttributes { key value }
                tags
                note
                lineItems(first: 100) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      variantTitle
                      sku
                      originalUnitPriceSet { shopMoney { amount currencyCode } }
                      customAttributes { key value }
                    }
                  }
                }
                customer {
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
      `,
      {
        variables: direction === "next" 
          ? { first: 50, after: cursor }
          : { last: 50, before: cursor }
      }
    );

    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].message);

    return json({
      orders: data.data.orders.edges.map(e => e.node),
      pageInfo: data.data.orders.pageInfo,
      shopDomain: session.shop,
      success: true
    });
  } catch (error) {
    console.error("Error:", error);
    return json({ 
      orders: [], 
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
      error: error.message,
      success: false 
    });
  }
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    if (formData.get("action") === "collectBalance") {
      const response = await admin.graphql(
        `#graphql
          mutation draftOrderCreate($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder { id invoiceUrl }
              userErrors { field message }
            }
          }
        `,
        {
          variables: {
            input: {
              lineItems: [{
                title: `Solde restant pour commande ${formData.get("orderName")}`,
                originalUnitPrice: parseFloat(formData.get("remainingBalance")).toFixed(2),
                quantity: 1
              }],
              email: formData.get("customerEmail"),
              tags: [`balance-collection`, `original-order-${formData.get("orderId")}`]
            }
          }
        }
      );

      const data = await response.json();
      if (data.data.draftOrderCreate.userErrors.length > 0) {
        throw new Error(data.data.draftOrderCreate.userErrors[0].message);
      }

      return json({ 
        success: true, 
        message: "Lien de paiement créé!",
        invoiceUrl: data.data.draftOrderCreate.draftOrder.invoiceUrl 
      });
    }

    return json({ success: false, message: "Action inconnue" });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function Orders() {
  const { orders, pageInfo, shopDomain, error } = useLoaderData();
  const submit = useSubmit();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [orderToCollect, setOrderToCollect] = useState(null);

  const getCustomAttribute = (order, key) => {
    const attr = order.customAttributes?.find(a => a.key.toLowerCase() === key.toLowerCase());
    return attr?.value || null;
  };

  const getDepositInfo = (order) => {
    const depositKeys = ['deposit_amount', 'deposit', 'acompte'];
    for (const key of depositKeys) {
      const value = getCustomAttribute(order, key);
      if (value) return { amount: parseFloat(value), exists: true };
    }
    
    if (order.tags) {
      const depositTag = order.tags.find(tag => tag.toLowerCase().includes('deposit'));
      if (depositTag) {
        const match = depositTag.match(/[\d.]+/);
        if (match) return { amount: parseFloat(match[0]), exists: true };
      }
    }
    
    if (order.displayFinancialStatus === 'PARTIALLY_PAID') {
      return { amount: parseFloat(order.totalPriceSet.shopMoney.amount) * 0.3, exists: true, isEstimated: true };
    }
    
    return { amount: 0, exists: false };
  };

  const getArrivalDate = (order) => {
    const dateKeys = ['arrival_date', 'delivery_date'];
    for (const key of dateKeys) {
      const value = getCustomAttribute(order, key);
      if (value) return new Date(value);
    }
    return null;
  };

  const getRemainingBalance = (order) => {
    const depositInfo = getDepositInfo(order);
    if (!depositInfo.exists) return 0;
    return parseFloat(order.totalPriceSet.shopMoney.amount) - depositInfo.amount;
  };

  const hasDeposit = (order) => getDepositInfo(order).exists;

  const isBalanceCollectionSent = (order) => {
    return order.tags?.some(tag => tag.toLowerCase().includes('balance-collection-sent'));
  };

  useEffect(() => {
    let filtered = [...orders];

    if (searchValue) {
      filtered = filtered.filter(order => 
        order.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.email?.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.customer?.firstName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.customer?.lastName?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.displayFinancialStatus === statusFilter.toUpperCase());
    }

    const sorted = filtered.sort((a, b) => {
      const arrivalA = getArrivalDate(a);
      const arrivalB = getArrivalDate(b);
      if (arrivalA && arrivalB) return arrivalB - arrivalA;
      if (arrivalA) return -1;
      if (arrivalB) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    setFilteredOrders(sorted);
  }, [searchValue, statusFilter, orders]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const map = {
      'PAID': { status: 'success', label: 'Payé' },
      'PARTIALLY_PAID': { status: 'warning', label: 'Acompte payé' },
      'PENDING': { status: 'warning', label: 'En attente' },
      'REFUNDED': { status: 'critical', label: 'Remboursé' }
    };
    const config = map[status] || { status: 'default', label: status };
    return <Badge status={config.status}>{config.label}</Badge>;
  };

  const getFulfillmentBadge = (status) => {
    const map = {
      'FULFILLED': { status: 'success', label: 'Expédié' },
      'UNFULFILLED': { status: 'default', label: 'Non expédié' }
    };
    const config = map[status] || { status: 'default', label: status || 'Non expédié' };
    return <Badge status={config.status}>{config.label}</Badge>;
  };

  const handleCollectBalance = useCallback((order) => {
    setOrderToCollect(order);
    setShowCollectModal(true);
  }, []);

  const confirmCollectBalance = useCallback(() => {
    if (!orderToCollect) return;
    
    const formData = new FormData();
    formData.append("action", "collectBalance");
    formData.append("orderId", orderToCollect.legacyResourceId);
    formData.append("orderName", orderToCollect.name);
    formData.append("remainingBalance", getRemainingBalance(orderToCollect));
    formData.append("customerEmail", orderToCollect.email || orderToCollect.customer?.email);

    submit(formData, { method: "post" });
    setShowCollectModal(false);
    setOrderToCollect(null);
  }, [orderToCollect, submit]);

  const getTableColumns = () => {
    const cols = ['Commande', 'Client', 'Date', 'Montant', 'Statut', 'Expédition'];
    if (orders?.some(o => getArrivalDate(o))) cols.push('Arrivée');
    if (orders?.some(o => hasDeposit(o))) cols.push('Acompte', 'Solde');
    cols.push('Actions');
    return cols;
  };

  const rows = filteredOrders.map(order => {
    const depositInfo = getDepositInfo(order);
    const remainingBalance = getRemainingBalance(order);
    const arrivalDate = getArrivalDate(order);
    const currency = order.totalPriceSet.shopMoney.currencyCode;

    const row = [
      <Button plain onClick={() => setSelectedOrder(order)}>{order.name}</Button>,
      order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.email : order.email || 'Guest',
      formatDate(order.createdAt),
      `${parseFloat(order.totalPriceSet.shopMoney.amount).toFixed(2)} ${currency}`,
      <InlineStack gap="200">
        {getStatusBadge(order.displayFinancialStatus)}
        {hasDeposit(order) && <Badge status="info">Acompte</Badge>}
      </InlineStack>,
      getFulfillmentBadge(order.displayFulfillmentStatus)
    ];

    if (orders?.some(o => getArrivalDate(o))) {
      row.push(arrivalDate ? <Text as="span" tone="success" fontWeight="semibold">{formatDate(arrivalDate)}</Text> : '-');
    }

    if (orders?.some(o => hasDeposit(o))) {
      row.push(
        depositInfo.exists ? <Text as="span" tone="success">{depositInfo.amount.toFixed(2)} {currency}</Text> : '-',
        depositInfo.exists && remainingBalance > 0 ? <Text as="span" tone="warning" fontWeight="bold">{remainingBalance.toFixed(2)} {currency}</Text> : '-'
      );
    }

    row.push(
      <InlineStack gap="200">
        <Button plain onClick={() => setSelectedOrder(order)}>Détails</Button>
        {depositInfo.exists && remainingBalance > 0 && !isBalanceCollectionSent(order) && (
          <Button primary size="slim" onClick={() => handleCollectBalance(order)}>Collecter</Button>
        )}
        {isBalanceCollectionSent(order) && <Badge status="success">Envoyé</Badge>}
      </InlineStack>
    );

    return row;
  });

  const stats = {
    total: orders.length,
    totalAmount: orders.reduce((sum, o) => sum + parseFloat(o.totalPriceSet.shopMoney.amount), 0),
    paid: orders.filter(o => o.displayFinancialStatus === 'PAID').length,
    withDeposit: orders.filter(o => hasDeposit(o)).length,
    pendingBalance: orders.reduce((sum, o) => hasDeposit(o) ? sum + getRemainingBalance(o) : sum, 0)
  };

  const currency = orders?.[0]?.totalPriceSet.shopMoney.currencyCode || '';

  if (error) {
    return (
      <Page title="Commandes">
        <Layout>
          <Layout.Section>
            <Banner tone="critical" title="Erreur">
              <p>Impossible de charger les commandes: {error}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page 
      title="Commandes" 
      subtitle={`${filteredOrders.length} commande(s)`}
      primaryAction={{ content: 'Actualiser', onAction: () => window.location.reload() }}
    >
      <Layout>
        {fetcher.data?.success && (
          <Layout.Section>
            <Banner tone="success" title="Succès!">
              <p>{fetcher.data.message}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="400" wrap>
            <Card><BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Total</Text><Text as="h2" variant="headingLg">{stats.total}</Text></BlockStack></Card>
            <Card><BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Montant</Text><Text as="h2" variant="headingLg">{stats.totalAmount.toFixed(2)} {currency}</Text></BlockStack></Card>
            <Card><BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Payées</Text><Text as="h2" variant="headingLg">{stats.paid}</Text></BlockStack></Card>
            {stats.withDeposit > 0 && (
              <>
                <Card><BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Avec acompte</Text><Text as="h2" variant="headingLg">{stats.withDeposit}</Text></BlockStack></Card>
                <Card><BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Solde à collecter</Text><Text as="h2" variant="headingLg" tone="warning">{stats.pendingBalance.toFixed(2)} {currency}</Text></BlockStack></Card>
              </>
            )}
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <InlineStack gap="400" wrap={false}>
              <div style={{ flex: 1 }}>
                <TextField label="Rechercher" value={searchValue} onChange={setSearchValue} placeholder="Numéro, client, email..." autoComplete="off" clearButton onClearButtonClick={() => setSearchValue("")} />
              </div>
              <div style={{ width: '200px' }}>
                <Select label="Statut" options={[
                  { label: 'Tous', value: 'all' },
                  { label: 'Payé', value: 'paid' },
                  { label: 'Acompte payé', value: 'partially_paid' },
                  { label: 'En attente', value: 'pending' }
                ]} value={statusFilter} onChange={setStatusFilter} />
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {filteredOrders.length === 0 ? (
              <EmptyState heading="Aucune commande trouvée" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
                <p>Essayez de modifier vos filtres</p>
              </EmptyState>
            ) : (
              <>
                <DataTable columnContentTypes={getTableColumns().map(() => 'text')} headings={getTableColumns()} rows={rows} hoverable verticalAlign="middle" />
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #E1E3E5' }}>
                  <Pagination 
                    hasPrevious={pageInfo.hasPreviousPage} 
                    onPrevious={() => navigate(`?cursor=${pageInfo.startCursor}&direction=prev`)}
                    hasNext={pageInfo.hasNextPage} 
                    onNext={() => navigate(`?cursor=${pageInfo.endCursor}&direction=next`)}
                  />
                </div>
              </>
            )}
          </Card>
        </Layout.Section>

        {showCollectModal && orderToCollect && (
          <Modal open={showCollectModal} onClose={() => { setShowCollectModal(false); setOrderToCollect(null); }} title="Collecter le solde restant"
            primaryAction={{ content: 'Envoyer le lien de paiement', onAction: confirmCollectBalance, loading: fetcher.state === "submitting" }}
            secondaryActions={[{ content: 'Annuler', onAction: () => { setShowCollectModal(false); setOrderToCollect(null); } }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text>Créer un lien de paiement pour <strong>{orderToCollect.name}</strong></Text>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between"><Text tone="subdued">Total:</Text><Text fontWeight="bold">{parseFloat(orderToCollect.totalPriceSet.shopMoney.amount).toFixed(2)} {orderToCollect.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                    <Divider />
                    <InlineStack align="space-between"><Text tone="subdued">Acompte:</Text><Text tone="success" fontWeight="semibold">{getDepositInfo(orderToCollect).amount.toFixed(2)} {orderToCollect.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                    <Divider />
                    <InlineStack align="space-between"><Text fontWeight="bold">Solde:</Text><Text fontWeight="bold" tone="warning" variant="headingMd">{getRemainingBalance(orderToCollect).toFixed(2)} {orderToCollect.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                  </BlockStack>
                </Card>
                <Banner tone="info"><p>Lien envoyé à: <strong>{orderToCollect.email || orderToCollect.customer?.email}</strong></p></Banner>
                {getArrivalDate(orderToCollect) && (
                  <Card><InlineStack align="space-between"><Text tone="subdued">Arrivée:</Text><Text tone="success" fontWeight="bold">{formatDate(getArrivalDate(orderToCollect))}</Text></InlineStack></Card>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {selectedOrder && (
          <Modal large open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Commande ${selectedOrder.name}`}
            secondaryActions={[{ content: 'Fermer', onAction: () => setSelectedOrder(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingMd">Client</Text>
                  <Card>
                    <BlockStack gap="200">
                      {selectedOrder.customer && (
                        <>
                          <Text>{selectedOrder.customer.firstName} {selectedOrder.customer.lastName}</Text>
                          <Text tone="subdued">{selectedOrder.customer.email}</Text>
                          {selectedOrder.customer.phone && <Text>{selectedOrder.customer.phone}</Text>}
                          <Text tone="subdued">{selectedOrder.customer.numberOfOrders} commande(s)</Text>
                        </>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>

                <BlockStack gap="200">
                  <Text variant="headingMd">Montants</Text>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between"><Text>Sous-total:</Text><Text>{parseFloat(selectedOrder.subtotalPriceSet.shopMoney.amount).toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                      <InlineStack align="space-between"><Text>Expédition:</Text><Text>{parseFloat(selectedOrder.totalShippingPriceSet.shopMoney.amount).toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                      <InlineStack align="space-between"><Text>Taxes:</Text><Text>{parseFloat(selectedOrder.totalTaxSet.shopMoney.amount).toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                      <Divider />
                      <InlineStack align="space-between"><Text fontWeight="bold">Total:</Text><Text fontWeight="bold">{parseFloat(selectedOrder.totalPriceSet.shopMoney.amount).toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                      {hasDeposit(selectedOrder) && (
                        <>
                          <Divider />
                          <InlineStack align="space-between"><Text>Acompte:</Text><Text tone="success" fontWeight="semibold">{getDepositInfo(selectedOrder).amount.toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                          <InlineStack align="space-between"><Text fontWeight="bold">Solde:</Text><Text fontWeight="bold" tone="warning" variant="headingMd">{getRemainingBalance(selectedOrder).toFixed(2)} {selectedOrder.totalPriceSet.shopMoney.currencyCode}</Text></InlineStack>
                        </>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>

                {getArrivalDate(selectedOrder) && (
                  <BlockStack gap="200">
                    <Text variant="headingMd">Date d'arrivée</Text>
                    <Card><InlineStack align="space-between"><Text tone="subdued">Date prévue:</Text><Text tone="success" fontWeight="bold" variant="headingMd">{formatDate(getArrivalDate(selectedOrder))}</Text></InlineStack></Card>
                  </BlockStack>
                )}

                <BlockStack gap="200">
                  <Text variant="headingMd">Articles ({selectedOrder.lineItems.edges.length})</Text>
                  <Card>
                    <BlockStack gap="300">
                      {selectedOrder.lineItems.edges.map(edge => {
                        const item = edge.node;
                        return (
                          <BlockStack key={item.id} gap="200">
                            <InlineStack align="space-between">
                              <BlockStack gap="100">
                                <Text fontWeight="semibold">{item.name}</Text>
                                {item.variantTitle && <Text tone="subdued">{item.variantTitle}</Text>}
                                {item.sku && <Text tone="subdued">SKU: {item.sku}</Text>}
                                <Text tone="subdued">Qté: {item.quantity}</Text>
                              </BlockStack>
                              <Text>{parseFloat(item.originalUnitPriceSet.shopMoney.amount).toFixed(2)} {item.originalUnitPriceSet.shopMoney.currencyCode}</Text>
                            </InlineStack>
                            <Divider />
                          </BlockStack>
                        );
                      })}
                    </BlockStack>
                  </Card>
                </BlockStack>

                {selectedOrder.customAttributes?.length > 0 && (
                  <BlockStack gap="200">
                    <Text variant="headingMd">Attributs personnalisés</Text>
                    <Card>
                      <BlockStack gap="200">
                        {selectedOrder.customAttributes.map((attr, i) => (
                          <InlineStack key={i} align="space-between"><Text fontWeight="medium">{attr.key}:</Text><Text>{attr.value}</Text></InlineStack>
                        ))}
                      </BlockStack>
                    </Card>
                  </BlockStack>
                )}

                {selectedOrder.shippingAddress && (
                  <BlockStack gap="200">
                    <Text variant="headingMd">Adresse de livraison</Text>
                    <Card>
                      <BlockStack gap="100">
                        <Text>{selectedOrder.shippingAddress.name}</Text>
                        <Text>{selectedOrder.shippingAddress.address1}</Text>
                        {selectedOrder.shippingAddress.address2 && <Text>{selectedOrder.shippingAddress.address2}</Text>}
                        <Text>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.province} {selectedOrder.shippingAddress.zip}</Text>
                        <Text>{selectedOrder.shippingAddress.country}</Text>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                )}

                {selectedOrder.tags?.length > 0 && (
                  <BlockStack gap="200">
                    <Text variant="headingMd">Tags</Text>
                    <Card><InlineStack gap="200" wrap>{selectedOrder.tags.map((tag, i) => <Badge key={i}>{tag}</Badge>)}</InlineStack></Card>
                  </BlockStack>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </Layout>
    </Page>
  );
}
import { useLoaderData, useSubmit, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
  Button,
  TextField,
  Select,
  InlineStack,
  EmptyState,
  Modal,
  Banner,
  Spinner
} from "@shopify/polaris";
import { useState, useEffect, useCallback } from "react";

// LOADER - Récupère les données
export const loader = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    // Récupérer les commandes via Shopify API
    const ordersResponse = await admin.rest.resources.Order.all({
      session: session,
      status: "any",
      limit: 250, // Maximum par requête
      fields: "id,name,email,total_price,created_at,financial_status,fulfillment_status,line_items,customer,currency,note_attributes,tags"
    });

    return json({
      orders: ordersResponse.data,
      shopDomain: session.shop,
      success: true
    });

  } catch (error) {
    console.error("Error loading orders:", error);
    return json({ 
      orders: [], 
      error: error.message,
      success: false 
    });
  }
};

// ACTION - Gérer les actions (collect balance, etc.)
export const action = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("action");

    if (actionType === "collectBalance") {
      const orderId = formData.get("orderId");
      const orderName = formData.get("orderName");
      const remainingBalance = parseFloat(formData.get("remainingBalance"));
      const currency = formData.get("currency");

      // Créer un draft order pour le solde restant
      const draftOrder = await admin.rest.resources.DraftOrder.create({
        session: session,
        data: {
          line_items: [
            {
              title: `Solde restant pour commande ${orderName}`,
              price: remainingBalance.toFixed(2),
              quantity: 1
            }
          ],
          note: `Solde restant de la commande ${orderName}`,
          email: formData.get("customerEmail"),
          tags: `balance-collection,original-order-${orderId}`
        }
      });

      return json({ 
        success: true, 
        message: "Lien de paiement créé avec succès!",
        invoiceUrl: draftOrder.invoice_url 
      });
    }

    return json({ success: false, message: "Action inconnue" });

  } catch (error) {
    console.error("Action error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};

export default function Orders() {
  const { orders, shopDomain, error } = useLoaderData();
  const submit = useSubmit();
  const fetcher = useFetcher();
  
  // États
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [sortedOrders, setSortedOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [orderToCollect, setOrderToCollect] = useState(null);

  // Trier par date d'arrivée (arrival date) depuis note_attributes
  const getArrivalDate = (order) => {
    const arrivalAttr = order.note_attributes?.find(
      attr => attr.name === "arrival_date" || attr.name === "Arrival Date"
    );
    return arrivalAttr ? new Date(arrivalAttr.value) : null;
  };

  // Extraire le montant du deposit depuis note_attributes ou tags
  const getDepositInfo = (order) => {
    // Chercher dans note_attributes
    const depositAttr = order.note_attributes?.find(
      attr => attr.name === "deposit_amount" || 
             attr.name === "Deposit Amount" ||
             attr.name === "deposit"
    );
    
    if (depositAttr) {
      return {
        amount: parseFloat(depositAttr.value),
        exists: true
      };
    }
    
    // Chercher dans les tags (format: "deposit:100" ou "deposit_100")
    if (order.tags) {
      const depositTag = order.tags.split(',').find(tag => 
        tag.trim().toLowerCase().includes('deposit')
      );
      
      if (depositTag) {
        const match = depositTag.match(/[\d.]+/);
        if (match) {
          return {
            amount: parseFloat(match[0]),
            exists: true
          };
        }
      }
    }
    
    // Vérifier si c'est un paiement partiel (partially_paid)
    if (order.financial_status === 'partially_paid') {
      // Le montant payé est indiqué dans Shopify
      // On peut estimer que c'est un deposit
      return {
        amount: 0, // On ne peut pas le calculer sans API supplémentaire
        exists: true,
        isPartiallyPaid: true
      };
    }
    
    return { amount: 0, exists: false };
  };

  // Calculer le solde restant
  const getRemainingBalance = (order) => {
    const depositInfo = getDepositInfo(order);
    if (!depositInfo.exists) return 0;
    
    const totalPrice = parseFloat(order.total_price);
    
    if (depositInfo.isPartiallyPaid) {
      // Pour les partially_paid, on ne peut pas calculer exactement sans API supplémentaire
      // On retourne un indicateur
      return totalPrice * 0.5; // Estimation 50% (à ajuster selon ton business)
    }
    
    return totalPrice - depositInfo.amount;
  };

  // Vérifier si c'est une commande avec deposit
  const hasDeposit = (order) => {
    return getDepositInfo(order).exists;
  };

  // Vérifier si le lien de paiement a déjà été envoyé (via tags)
  const isBalanceCollectionSent = (order) => {
    if (!order.tags) return false;
    return order.tags.includes('balance-collection-sent');
  };

  // Filtrage et tri
  useEffect(() => {
    let filtered = [...orders];

    // Filtre par recherche
    if (searchValue) {
      filtered = filtered.filter(order => 
        order.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.email?.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.customer?.email?.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.customer?.first_name?.toLowerCase().includes(searchValue.toLowerCase()) ||
        order.customer?.last_name?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    // Filtre par statut de paiement
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.financial_status === statusFilter);
    }

    // Filtre par date
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch(dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(order => new Date(order.created_at) >= filterDate);
          break;
      }
    }

    // Trier par arrival date si disponible, sinon par created_at
    const sorted = filtered.sort((a, b) => {
      const arrivalA = getArrivalDate(a);
      const arrivalB = getArrivalDate(b);
      
      // Si les deux ont une arrival date
      if (arrivalA && arrivalB) {
        return arrivalB - arrivalA; // Plus récent en premier
      }
      // Si seulement A a une arrival date
      if (arrivalA) return -1;
      // Si seulement B a une arrival date
      if (arrivalB) return 1;
      // Sinon, trier par created_at
      return new Date(b.created_at) - new Date(a.created_at);
    });

    setSortedOrders(sorted);
    setFilteredOrders(sorted);
  }, [searchValue, statusFilter, dateFilter, orders]);

  // Formater la date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Badge de statut de paiement
  const getStatusBadge = (order) => {
    const status = order.financial_status;
    const statusMap = {
      'paid': { status: 'success', label: 'Payé' },
      'pending': { status: 'warning', label: 'En attente' },
      'authorized': { status: 'info', label: 'Autorisé' },
      'refunded': { status: 'critical', label: 'Remboursé' },
      'voided': { status: 'critical', label: 'Annulé' },
      'partially_paid': { status: 'warning', label: 'Acompte payé' },
      'partially_refunded': { status: 'warning', label: 'Partiellement remboursé' }
    };

    const config = statusMap[status] || { status: 'default', label: status };
    
    // Si c'est un deposit, ajouter une indication
    if (hasDeposit(order)) {
      return (
        <InlineStack gap="200">
          <Badge status={config.status}>{config.label}</Badge>
          <Badge status="info">Acompte</Badge>
        </InlineStack>
      );
    }
    
    return <Badge status={config.status}>{config.label}</Badge>;
  };

  // Badge de fulfillment
  const getFulfillmentBadge = (status) => {
    if (!status || status === 'unfulfilled') {
      return <Badge>Non expédié</Badge>;
    }
    
    const statusMap = {
      'fulfilled': { status: 'success', label: 'Expédié' },
      'partial': { status: 'warning', label: 'Partiellement expédié' }
    };

    const config = statusMap[status] || { status: 'default', label: status };
    return <Badge status={config.status}>{config.label}</Badge>;
  };

  // Gérer la collecte du solde
  const handleCollectBalance = useCallback((order) => {
    setOrderToCollect(order);
    setShowCollectModal(true);
  }, []);

  const confirmCollectBalance = useCallback(() => {
    if (!orderToCollect) return;

    const remainingBalance = getRemainingBalance(orderToCollect);
    
    const formData = new FormData();
    formData.append("action", "collectBalance");
    formData.append("orderId", orderToCollect.id);
    formData.append("orderName", orderToCollect.name);
    formData.append("remainingBalance", remainingBalance);
    formData.append("currency", orderToCollect.currency);
    formData.append("customerEmail", orderToCollect.email || orderToCollect.customer?.email);

    submit(formData, { method: "post" });
    setShowCollectModal(false);
    setOrderToCollect(null);
  }, [orderToCollect, submit]);

  // Préparer les données pour le DataTable
  const rows = sortedOrders.map(order => {
    const depositInfo = getDepositInfo(order);
    const remainingBalance = getRemainingBalance(order);
    const arrivalDate = getArrivalDate(order);
    const balanceCollectionSent = isBalanceCollectionSent(order);

    return [
      // Numéro de commande
      <Button plain onClick={() => setSelectedOrder(order)}>
        {order.name}
      </Button>,
      
      // Client
      order.customer ? 
        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.email :
        order.email || 'Guest',
      
      // Date de création
      formatDate(order.created_at),
      
      // Arrival Date (si existe)
      arrivalDate ? (
        <Text as="span" tone="success" fontWeight="semibold">
          {formatDate(arrivalDate)}
        </Text>
      ) : '-',
      
      // Montant total
      `${parseFloat(order.total_price).toFixed(2)} ${order.currency}`,
      
      // Acompte payé (si deposit)
      depositInfo.exists ? (
        <Text as="span" tone="success">
          {depositInfo.isPartiallyPaid ? 
            "Partiel" : 
            `${depositInfo.amount.toFixed(2)} ${order.currency}`
          }
        </Text>
      ) : '-',
      
      // Solde restant (si deposit)
      depositInfo.exists && remainingBalance > 0 ? (
        <Text as="span" tone="warning" fontWeight="bold">
          {remainingBalance.toFixed(2)} {order.currency}
        </Text>
      ) : '-',
      
      // Statut
      getStatusBadge(order),
      
      // Expédition
      getFulfillmentBadge(order.fulfillment_status),
      
      // Articles
      order.line_items?.length || 0,
      
      // Actions
      <InlineStack gap="200">
        <Button 
          plain 
          onClick={() => window.open(`https://${shopDomain}/admin/orders/${order.id}`, '_blank')}
        >
          Voir
        </Button>
        {depositInfo.exists && remainingBalance > 0 && !balanceCollectionSent && (
          <Button
            primary
            size="slim"
            onClick={() => handleCollectBalance(order)}
          >
            Collecter solde
          </Button>
        )}
        {balanceCollectionSent && (
          <Badge status="success">Envoyé</Badge>
        )}
      </InlineStack>
    ];
  });

  // Calculer les statistiques
  const stats = {
    total: orders.length,
    totalAmount: orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0),
    paid: orders.filter(o => o.financial_status === 'paid').length,
    withDeposit: orders.filter(o => hasDeposit(o)).length,
    pendingBalance: orders.reduce((sum, order) => {
      if (hasDeposit(order)) {
        return sum + getRemainingBalance(order);
      }
      return sum;
    }, 0)
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = [
      'Commande',
      'Client',
      'Email',
      'Date création',
      'Date arrivée',
      'Montant total',
      'Acompte',
      'Solde restant',
      'Statut paiement',
      'Statut expédition'
    ];
    
    const csvData = sortedOrders.map(order => {
      const depositInfo = getDepositInfo(order);
      const arrivalDate = getArrivalDate(order);
      const remainingBalance = getRemainingBalance(order);
      
      return [
        order.name,
        order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : '',
        order.email || order.customer?.email || '',
        formatDate(order.created_at),
        arrivalDate ? formatDate(arrivalDate) : '',
        order.total_price,
        depositInfo.exists ? (depositInfo.isPartiallyPaid ? 'Partiel' : depositInfo.amount.toFixed(2)) : '',
        depositInfo.exists && remainingBalance > 0 ? remainingBalance.toFixed(2) : '',
        order.financial_status,
        order.fulfillment_status || 'unfulfilled'
      ];
    });

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
      subtitle={`${filteredOrders.length} commande${filteredOrders.length > 1 ? 's' : ''}`}
      primaryAction={{
        content: 'Actualiser',
        onAction: () => window.location.reload()
      }}
      secondaryActions={[
        {
          content: 'Exporter CSV',
          onAction: exportToCSV
        }
      ]}
    >
      <Layout>
        {/* Message de succès */}
        {fetcher.data?.success && (
          <Layout.Section>
            <Banner tone="success" title="Succès!" onDismiss={() => {}}>
              <p>{fetcher.data.message}</p>
              {fetcher.data.invoiceUrl && (
                <p>
                  <Button 
                    plain 
                    url={fetcher.data.invoiceUrl} 
                    external
                  >
                    Voir le lien de paiement
                  </Button>
                </p>
              )}
            </Banner>
          </Layout.Section>
        )}

        {/* Statistiques */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Total commandes</Text>
                <Text as="h2" variant="headingLg">{stats.total}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Montant total</Text>
                <Text as="h2" variant="headingLg">
                  {stats.totalAmount.toFixed(2)} {orders[0]?.currency || ''}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Payées intégralement</Text>
                <Text as="h2" variant="headingLg">{stats.paid}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Avec acompte</Text>
                <Text as="h2" variant="headingLg">{stats.withDeposit}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Solde à collecter</Text>
                <Text as="h2" variant="headingLg" tone="warning">
                  {stats.pendingBalance.toFixed(2)} {orders[0]?.currency || ''}
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Filtres */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" align="space-between" wrap={false}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <TextField
                    label="Rechercher"
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Numéro, client, email..."
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearchValue("")}
                  />
                </div>
                <div style={{ width: '180px' }}>
                  <Select
                    label="Statut"
                    options={[
                      { label: 'Tous', value: 'all' },
                      { label: 'Payé', value: 'paid' },
                      { label: 'Acompte payé', value: 'partially_paid' },
                      { label: 'En attente', value: 'pending' },
                      { label: 'Autorisé', value: 'authorized' },
                      { label: 'Remboursé', value: 'refunded' }
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                </div>
                <div style={{ width: '180px' }}>
                  <Select
                    label="Période"
                    options={[
                      { label: 'Toutes', value: 'all' },
                      { label: "Aujourd'hui", value: 'today' },
                      { label: '7 derniers jours', value: 'week' },
                      { label: '30 derniers jours', value: 'month' }
                    ]}
                    value={dateFilter}
                    onChange={setDateFilter}
                  />
                </div>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Table des commandes */}
        <Layout.Section>
          <Card padding="0">
            {filteredOrders.length === 0 ? (
              <EmptyState
                heading="Aucune commande trouvée"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Essayez de modifier vos filtres de recherche</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={[
                  'text',      // Commande
                  'text',      // Client
                  'text',      // Date création
                  'text',      // Arrival date
                  'numeric',   // Montant
                  'numeric',   // Acompte
                  'numeric',   // Solde restant
                  'text',      // Statut paiement
                  'text',      // Statut expédition
                  'numeric',   // Items
                  'text'       // Actions
                ]}
                headings={[
                  'Commande',
                  'Client',
                  'Date création',
                  'Date arrivée',
                  'Montant total',
                  'Acompte',
                  'Solde restant',
                  'Paiement',
                  'Expédition',
                  'Articles',
                  'Actions'
                ]}
                rows={rows}
                hoverable
                verticalAlign="middle"
              />
            )}
          </Card>
        </Layout.Section>

        {/* Modal de confirmation pour collecter le solde */}
        {showCollectModal && orderToCollect && (
          <Modal
            open={showCollectModal}
            onClose={() => {
              setShowCollectModal(false);
              setOrderToCollect(null);
            }}
            title="Collecter le solde restant"
            primaryAction={{
              content: 'Envoyer le lien de paiement',
              onAction: confirmCollectBalance,
              loading: fetcher.state === "submitting"
            }}
            secondaryActions={[
              {
                content: 'Annuler',
                onAction: () => {
                  setShowCollectModal(false);
                  setOrderToCollect(null);
                }
              }
            ]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text variant="bodyMd">
                  Vous allez créer un lien de paiement pour le solde restant de la commande <strong>{orderToCollect.name}</strong>.
                </Text>
                
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text>Montant total:</Text>
                      <Text fontWeight="bold">
                        {parseFloat(orderToCollect.total_price).toFixed(2)} {orderToCollect.currency}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text>Acompte payé:</Text>
                      <Text tone="success">
                        {getDepositInfo(orderToCollect).isPartiallyPaid ? 
                          'Paiement partiel effectué' :
                          `${getDepositInfo(orderToCollect).amount.toFixed(2)} ${orderToCollect.currency}`
                        }
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text>Solde restant:</Text>
                      <Text fontWeight="bold" tone="warning">
                        {getRemainingBalance(orderToCollect).toFixed(2)} {orderToCollect.currency}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Card>
                
                <Text variant="bodyMd" tone="subdued">
                  Un lien de paiement sera envoyé à: <strong>{orderToCollect.email || orderToCollect.customer?.email}</strong>
                </Text>
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {/* Modal détails de commande */}
        {selectedOrder && (
          <Modal
            large
            open={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            title={`Commande ${selectedOrder.name}`}
            secondaryActions={[
              {
                content: 'Fermer',
                onAction: () => setSelectedOrder(null)
              }
            ]}
          >
            <Modal.Section>
              <BlockStack gap="500">
                {/* Infos client */}
                <BlockStack gap="200">
                  <Text variant="headingMd">Client</Text>
                  <Card>
                    <BlockStack gap="200">
                      <Text>
                        {selectedOrder.customer?.first_name} {selectedOrder.customer?.last_name}
                      </Text>
                      <Text tone="subdued">{selectedOrder.email || selectedOrder.customer?.email}</Text>
                    </BlockStack>
                  </Card>
                </BlockStack>

                {/* Infos dates */}
                <BlockStack gap="200">
                  <Text variant="headingMd">Dates</Text>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text>Date de création:</Text>
                        <Text>{formatDate(selectedOrder.created_at)}</Text>
                      </InlineStack>
                      {getArrivalDate(selectedOrder) && (
                        <InlineStack align="space-between">
                          <Text>Date d'arrivée:</Text>
                          <Text tone="success" fontWeight="semibold">
                            {formatDate(getArrivalDate(selectedOrder))}
                          </Text>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>

                {/* Articles */}
                <BlockStack gap="200">
                  <Text variant="headingMd">Articles ({selectedOrder.line_items?.length || 0})</Text>
                  <Card>
                    <BlockStack gap="300">
                      {selectedOrder.line_items?.map(item => (
                        <InlineStack key={item.id} align="space-between">
                          <BlockStack gap="100">
                            <Text fontWeight="semibold">{item.name}</Text>
                            <Text tone="subdued">Quantité: {item.quantity}</Text>
                          </BlockStack>
                          <Text>{parseFloat(item.price).toFixed(2)} {selectedOrder.currency}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </Card>
                </BlockStack>

                {/* Montants */}
                <BlockStack gap="200">
                  <Text variant="headingMd">Montants</Text>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text>Montant total:</Text>
                        <Text fontWeight="bold">
                          {parseFloat(selectedOrder.total_price).toFixed(2)} {selectedOrder.currency}
                        </Text>
                      </InlineStack>
                      
                      {hasDeposit(selectedOrder) && (
                        <>
                          <InlineStack align="space-between">
                            <Text>Acompte payé:</Text>
                            <Text tone="success">
                              {getDepositInfo(selectedOrder).isPartiallyPaid ?
                                'Paiement partiel' :
                                `${getDepositInfo(selectedOrder).amount.toFixed(2)} ${selectedOrder.currency}`
                              }
                            </Text>
                          </InlineStack>
                          <InlineStack align="space-between">
                            <Text fontWeight="semibold">Solde restant:</Text>
                            <Text fontWeight="bold" tone="warning">
                              {getRemainingBalance(selectedOrder).toFixed(2)} {selectedOrder.currency}
                            </Text>
                          </InlineStack>
                        </>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>

                {/* Statuts */}
                <BlockStack gap="200">
                  <Text variant="headingMd">Statuts</Text>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text>Paiement:</Text>
                        {getStatusBadge(selectedOrder)}
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text>Expédition:</Text>
                        {getFulfillmentBadge(selectedOrder.fulfillment_status)}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </Layout>
    </Page>
  );
}
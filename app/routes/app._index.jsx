import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { 
  getOrders, 
  saveSerialNumber, 
  getAllSerialNumbers,
  exportSerialNumbersToCSV 
} from "~/services/orders.server.js";


export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('search');
  
  // Load ALL orders by paginating through everything
  let allOrders = [];
  let hasNextPage = true;
  let cursor = null;
  
  while (hasNextPage) {
    const { orders, pageInfo } = await getOrders(admin, { cursor, searchQuery });
    allOrders = [...allOrders, ...orders];
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  
  // Get serial numbers for all orders
  const ordersWithSerials = await Promise.all(
    allOrders.map(async (order) => {
      const metafields = await getAllSerialNumbers(admin, order.id);
      const serialMap = {};
      
      metafields.forEach(mf => {
        const lineItemId = `gid://shopify/LineItem/${mf.key.replace('line_item_', '')}`;
        serialMap[lineItemId] = mf.value;
      });
      
      return {
        ...order,
        lineItems: order.lineItems.map(item => ({
          ...item,
          serialNumber: serialMap[item.id] || '',
        })),
      };
    })
  );
  
  return { 
    orders: ordersWithSerials,
    searchQuery: searchQuery || '',
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get('actionType');
  
  if (actionType === 'saveSerial') {
    const orderId = formData.get('orderId');
    const lineItemId = formData.get('lineItemId');
    const serialNumber = formData.get('serialNumber');
    
    await saveSerialNumber(admin, orderId, lineItemId, serialNumber);
    
    return { success: true, message: 'Serial number saved!' };
  }
  
  if (actionType === 'exportCSV') {
    const csvContent = await exportSerialNumbersToCSV(admin);
    
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="saddle-serial-numbers.csv"',
      },
    });
  }
  
  return { success: false };
};

export default function Index() {
  const { orders, searchQuery } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [search, setSearch] = useState(searchQuery);
  const [serialInputs, setSerialInputs] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 20;

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const handleSerialChange = (lineItemId, value) => {
    setSerialInputs(prev => ({
      ...prev,
      [lineItemId]: value,
    }));
  };

  const handleSerialSave = (orderId, lineItemId) => {
    const serialNumber = serialInputs[lineItemId];
    if (!serialNumber) return;
    
    const formData = new FormData();
    formData.append('actionType', 'saveSerial');
    formData.append('orderId', orderId);
    formData.append('lineItemId', lineItemId);
    formData.append('serialNumber', serialNumber);
    
    fetcher.submit(formData, { method: 'POST' });
  };

  const handleExport = () => {
    const formData = new FormData();
    formData.append('actionType', 'exportCSV');
    fetcher.submit(formData, { method: 'POST' });
  };

  // Pagination logic
  const totalPages = Math.ceil(orders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const visibleOrders = orders.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <s-page heading="Saddle Serial Number Manager">
      <s-button slot="primary-action" onClick={handleExport}>
        Export to CSV
      </s-button>

      <s-section heading="Search Orders">
        <s-stack direction="inline" gap="base">
          <s-text-field
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number (e.g., #1001)"
          />
          <s-button
            onClick={() => {
              window.location.href = search ? `?search=${search}` : '/app';
            }}
          >
            Search
          </s-button>
          {searchQuery && (
            <s-button
              variant="tertiary"
              onClick={() => {
                setSearch('');
                window.location.href = '/app';
              }}
            >
              Clear
            </s-button>
          )}
        </s-stack>
      </s-section>

      <s-section heading={`Orders with Saddles (${orders.length} total)`}>
        {/* Pagination Controls - Top */}
        {orders.length > ordersPerPage && (
          <s-stack direction="inline" gap="base" alignment="center" style={{ marginBottom: '16px' }}>
            <s-button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
            >
              ← Previous
            </s-button>
            <s-text variant="bodyMd">
              Page {currentPage} of {totalPages} (showing {startIndex + 1}-{Math.min(endIndex, orders.length)} of {orders.length})
            </s-text>
            <s-button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next →
            </s-button>
          </s-stack>
        )}

        {orders && orders.length > 0 ? (
          <s-stack direction="block" gap="base">
            {visibleOrders.map((order) => {
              const saddleItems = order.lineItems.filter(item => item.isSaddle);
              
              return (
                <s-box
                  key={order.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="base">
                    {/* Order Header */}
                    <s-stack direction="block" gap="tight">
                      <s-text variant="headingMd">Order {order.orderNumber}</s-text>
                      <s-text variant="bodyMd" fontWeight="semibold">
                        Customer: {order.customer.name}
                      </s-text>
                      {order.customer.email && (
                        <s-text variant="bodySm">{order.customer.email}</s-text>
                      )}
                      <s-text variant="bodySm">
                        {new Date(order.createdAt).toLocaleDateString()} • 
                        {order.total} {order.currency} • 
                        {order.financialStatus} • 
                        {order.fulfillmentStatus}
                      </s-text>
                    </s-stack>

                    {/* Saddle Line Items */}
                    <s-stack direction="block" gap="base">
                      {saddleItems.map((item) => {
                        const hasSerial = !!item.serialNumber;
                        const currentInput = serialInputs[item.id] || '';
                        
                        return (
                          <s-box
                            key={item.id}
                            padding="base"
                            borderWidth="base"
                            borderRadius="base"
                            background="surface"
                          >
                            <s-stack direction="block" gap="tight">
                              <s-text variant="bodyMd" fontWeight="semibold">
                                {item.title}
                              </s-text>
                              
                              {/* Variant details (color, size, etc.) */}
                              {Object.keys(item.options).length > 0 && (
                                <s-stack direction="inline" gap="tight">
                                  {Object.entries(item.options).map(([key, value]) => (
                                    <s-text key={key} variant="bodySm">
                                      <strong>{key}:</strong> {value}
                                    </s-text>
                                  ))}
                                </s-stack>
                              )}
                              
                              {/* Custom attributes (customizations) */}
                              {Object.keys(item.customAttributes).length > 0 && (
                                <s-stack direction="block" gap="extraTight">
                                  <s-text variant="bodySm" fontWeight="semibold">Customizations:</s-text>
                                  {Object.entries(item.customAttributes).map(([key, value]) => (
                                    <s-text key={key} variant="bodySm">
                                      • {key}: {value}
                                    </s-text>
                                  ))}
                                </s-stack>
                              )}
                              
                              <s-text variant="bodySm">
                                SKU: {item.sku || 'N/A'} • Quantity: {item.quantity}
                              </s-text>
                              
                              {/* Serial Number Input or Display */}
                              {hasSerial ? (
                                <s-stack direction="inline" gap="tight">
                                  <s-text variant="bodyMd" tone="success">
                                    ✓ Serial: {item.serialNumber}
                                  </s-text>
                                </s-stack>
                              ) : (
                                <s-stack direction="inline" gap="base">
                                  <s-text-field
                                    value={currentInput}
                                    onChange={(e) => handleSerialChange(item.id, e.target.value)}
                                    placeholder="Enter serial number"
                                    style={{ flexGrow: 1 }}
                                  />
                                  <s-button
                                    onClick={() => handleSerialSave(order.id, item.id)}
                                    disabled={!currentInput}
                                  >
                                    Save
                                  </s-button>
                                </s-stack>
                              )}
                            </s-stack>
                          </s-box>
                        );
                      })}
                    </s-stack>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        ) : (
          <s-paragraph>
            {searchQuery 
              ? `No orders found matching "${searchQuery}"`
              : 'No orders with saddles found.'}
          </s-paragraph>
        )}

        {/* Pagination Controls - Bottom */}
        {orders.length > ordersPerPage && (
          <s-stack direction="inline" gap="base" alignment="center" style={{ marginTop: '16px' }}>
            <s-button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
            >
              ← Previous
            </s-button>
            <s-text variant="bodyMd">
              Page {currentPage} of {totalPages}
            </s-text>
            <s-button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next →
            </s-button>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

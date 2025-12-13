import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { 
  getOrders, 
  saveSerialNumber, 
  getAllSerialNumbers,
  exportSerialNumbersToCSV 
} from "../services/orders.server.js";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const searchQuery = url.searchParams.get('search');
  
  const { orders, pageInfo } = await getOrders(admin, { cursor, searchQuery });
  
  // Get serial numbers for all orders
  const ordersWithSerials = await Promise.all(
    orders.map(async (order) => {
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
    pageInfo,
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
  const { orders, pageInfo, searchQuery } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [search, setSearch] = useState(searchQuery);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  const toggleOrder = (orderId) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleSerialSave = (orderId, lineItemId, serialNumber) => {
    const formData = new FormData();
    formData.append('actionType', 'saveSerial');
    formData.append('orderId', orderId);
    formData.append('lineItemId', lineItemId);
    formData.append('serialNumber', serialNumber);
    
    fetcher.submit(formData, { method: 'POST' });
    shopify.toast.show('Serial number saved!');
  };

  const handleExport = () => {
    const formData = new FormData();
    formData.append('actionType', 'exportCSV');
    fetcher.submit(formData, { method: 'POST' });
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

      <s-section heading={`Orders with Saddles (${orders.length})`}>
        {orders && orders.length > 0 ? (
          <s-stack direction="block" gap="base">
            {orders.map((order) => {
              const saddleItems = order.lineItems.filter(item => item.isSaddle);
              const isExpanded = expandedOrders.has(order.id);
              
              return (
                <s-box
                  key={order.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="base">
                    <s-stack direction="inline" gap="base" alignment="space-between">
                      <s-stack direction="block" gap="tight">
                        <s-text variant="headingSm">Order {order.orderNumber}</s-text>
                        <s-text variant="bodySm">
                          {new Date(order.createdAt).toLocaleDateString()} • 
                          {order.total} {order.currency} • 
                          {order.financialStatus}
                        </s-text>
                        <s-text variant="bodySm">
                          {saddleItems.length} saddle{saddleItems.length !== 1 ? 's' : ''}
                        </s-text>
                      </s-stack>
                      <s-button
                        variant="tertiary"
                        onClick={() => toggleOrder(order.id)}
                      >
                        {isExpanded ? 'Collapse' : 'Add Serial Numbers'}
                      </s-button>
                    </s-stack>

                    {isExpanded && (
                      <s-stack direction="block" gap="base">
                        {saddleItems.map((item) => (
                          <SerialNumberEntry
                            key={item.id}
                            item={item}
                            orderId={order.id}
                            onSave={handleSerialSave}
                          />
                        ))}
                      </s-stack>
                    )}
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

        {pageInfo.hasNextPage && (
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() => {
                window.location.href = `?cursor=${pageInfo.endCursor}${searchQuery ? `&search=${searchQuery}` : ''}`;
              }}
            >
              Load More Orders
            </s-button>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

function SerialNumberEntry({ item, orderId, onSave }) {
  const [serial, setSerial] = useState(item.serialNumber || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(orderId, item.id, serial);
    setIsSaving(false);
  };

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="surface"
    >
      <s-stack direction="block" gap="tight">
        <s-text variant="bodyMd" fontWeight="semibold">
          {item.title}
        </s-text>
        <s-text variant="bodySm">
          SKU: {item.sku || 'N/A'} • Quantity: {item.quantity}
        </s-text>
        
        <s-stack direction="inline" gap="base">
          <s-text-field
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Enter serial number"
            style={{ flexGrow: 1 }}
          />
          <s-button
            onClick={handleSave}
            {...(isSaving ? { loading: true } : {})}
            disabled={!serial || serial === item.serialNumber}
          >
            Save
          </s-button>
        </s-stack>
        
        {item.serialNumber && (
          <s-text variant="bodySm" tone="success">
            ✓ Saved: {item.serialNumber}
          </s-text>
        )}
      </s-stack>
    </s-box>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

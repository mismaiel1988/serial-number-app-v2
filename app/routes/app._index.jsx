import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import db from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = 10;

    // Get total count from database
    const totalOrders = await db.saddleOrder.count();
    
    // Get paginated orders from database
    const orders = await db.saddleOrder.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const totalPages = Math.ceil(totalOrders / perPage);
    
    console.log(`Showing ${orders.length} orders from database (page ${page} of ${totalPages})`);
    
    return { 
      orders: orders.map(order => ({
        ...order,
        lineItems: JSON.parse(order.lineItems),
        customer: JSON.parse(order.customer)
      })),
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      fromDatabase: true
    };
  } catch (error) {
    console.error("Loader error:", error);
    return { 
      orders: [], 
      error: error.message,
      currentPage: 1,
      totalPages: 0,
      totalOrders: 0,
      fromDatabase: false
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "syncOrders") {
    try {
      console.log("Starting sync of all saddle orders...");
      
      // Clear existing orders
      await db.saddleOrder.deleteMany({});
      console.log("Cleared existing orders from database");
      
      // Fetch ALL orders from Shopify
      let allOrders = [];
      let hasNextPage = true;
      let cursor = null;
      let fetchCount = 0;
      
      while (hasNextPage) {
        fetchCount++;
        const queryArgs = cursor 
          ? `first: 250, after: "${cursor}", query: "tag:saddles"` 
          : `first: 250, query: "tag:saddles"`;
        
        console.log(`Fetching batch ${fetchCount}...`);
        
        const response = await admin.graphql(
          `#graphql
            query {
              orders(${queryArgs}) {
                edges {
                  node {
                    id
                    name
                    createdAt
                    displayFulfillmentStatus
                    customer {
                      firstName
                      lastName
                      email
                    }
                    lineItems(first: 50) {
                      edges {
                        node {
                          id
                          title
                          quantity
                          variant {
                            selectedOptions {
                              name
                              value
                            }
                          }
                          product {
                            id
                            tags
                          }
                        }
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `
        );

        const data = await response.json();
        
        if (data.errors) {
          console.error("GraphQL errors:", data.errors);
          break;
        }
        
        const batchOrders = data?.data?.orders?.edges?.map(({ node }) => ({
          shopifyOrderId: node.id,
          orderName: node.name,
          createdAt: new Date(node.createdAt),
          fulfillmentStatus: node.displayFulfillmentStatus,
          customer: JSON.stringify({
            name: node.customer 
              ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim() 
              : "Guest",
            email: node.customer?.email || "",
          }),
          lineItems: JSON.stringify(
            node.lineItems.edges.map(({ node: item }) => ({
              id: item.id,
              title: item.title,
              quantity: item.quantity,
              productId: item.product?.id,
              tags: item.product?.tags || [],
              options: (item.variant?.selectedOptions || []).reduce((acc, opt) => {
                acc[opt.name] = opt.value;
                return acc;
              }, {}),
              hasSaddleTag: (item.product?.tags || []).includes("saddles"),
            }))
          ),
        })) || [];
        
        // Filter for orders with saddle items
        const saddleOrders = batchOrders.filter(order => {
          const items = JSON.parse(order.lineItems);
          return items.some(item => item.hasSaddleTag);
        });
        
        allOrders = [...allOrders, ...saddleOrders];
        
        hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage || false;
        cursor = data?.data?.orders?.pageInfo?.endCursor;
        
        console.log(`Batch ${fetchCount}: found ${saddleOrders.length} saddle orders, total so far: ${allOrders.length}`);
      }
      
      console.log(`Total saddle orders to save: ${allOrders.length}`);
      
      // Save all orders to database
      if (allOrders.length > 0) {
        await db.saddleOrder.createMany({
          data: allOrders
        });
        console.log(`Saved ${allOrders.length} orders to database`);
      }
      
      return { 
        success: true, 
        message: `Successfully synced ${allOrders.length} saddle orders from Shopify`,
        orderCount: allOrders.length
      };
    } catch (error) {
      console.error("Sync error:", error);
      return { success: false, error: error.message };
    }
  }

  if (actionType === "saveSerial") {
    const orderId = formData.get("orderId");
    const lineItemId = formData.get("lineItemId");
    const serialNumber = formData.get("serialNumber");

    try {
      const order = await db.saddleOrder.findUnique({
        where: { id: parseInt(orderId) }
      });
      
      if (order) {
        const lineItems = JSON.parse(order.lineItems);
        const updatedLineItems = lineItems.map(item => {
          if (item.id === lineItemId) {
            return { ...item, serialNumber };
          }
          return item;
        });
        
        await db.saddleOrder.update({
          where: { id: parseInt(orderId) },
          data: { lineItems: JSON.stringify(updatedLineItems) }
        });
        
        return { success: true, message: "Serial number saved" };
      }
      
      return { success: false, error: "Order not found" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Unknown action" };
};

export default function App() {
  const { orders, error, currentPage, totalPages, totalOrders, fromDatabase } = useLoaderData();

  return (
    <s-page heading="Saddle Serial Number Manager">
      <s-section>
        <s-button 
          variant="primary" 
          onClick={() => {
            const formData = new FormData();
            formData.append("actionType", "syncOrders");
            fetch("", { method: "POST", body: formData }).then(() => window.location.reload());
          }}
        >
          Sync Orders from Shopify
        </s-button>
      </s-section>

      {error && (
        <s-section>
          <s-banner tone="critical">
            <s-text>Error: {error}</s-text>
          </s-banner>
        </s-section>
      )}

      <s-section heading={`Orders with Saddles (${totalOrders} total)`}>
        {totalPages > 1 && (
          <s-stack direction="inline" gap="tight" alignment="center">
            <a href={`?page=${currentPage - 1}`} style={{ pointerEvents: currentPage === 1 ? 'none' : 'auto' }}>
              <s-button disabled={currentPage === 1}>← Previous</s-button>
            </a>
            <s-text>Page {currentPage} of {totalPages}</s-text>
            <a href={`?page=${currentPage + 1}`} style={{ pointerEvents: currentPage === totalPages ? 'none' : 'auto' }}>
              <s-button disabled={currentPage === totalPages}>Next →</s-button>
            </a>
          </s-stack>
        )}

        {orders && orders.length > 0 ? (
          <s-stack direction="block" gap="base">
            {orders.map((order) => {
              const saddleItems = order.lineItems.filter(item => item.hasSaddleTag);
              
              return (
                <s-box key={order.id} padding="base" borderWidth="base" borderRadius="base" background="subdued">
                  <s-stack direction="block" gap="tight">
                    <s-text variant="headingMd">Order {order.orderName}</s-text>
                    <s-text variant="bodyMd" fontWeight="semibold">Customer: {order.customer.name}</s-text>
                    {order.customer.email && <s-text variant="bodySm">{order.customer.email}</s-text>}
                    <s-text variant="bodySm">Date: {new Date(order.createdAt).toLocaleDateString()}</s-text>
                    
                    <s-stack direction="block" gap="tight">
                      <s-text variant="bodySm" fontWeight="semibold">Saddles:</s-text>
                      {saddleItems.map((item) => (
                        <s-box key={item.id} padding="base" background="surface" borderRadius="base" borderWidth="base">
                          <s-stack direction="block" gap="tight">
                            <s-text variant="bodyMd" fontWeight="semibold">{item.title} (Qty: {item.quantity})</s-text>
                            {Object.keys(item.options).length > 0 && (
                              <s-stack direction="inline" gap="tight">
                                {Object.entries(item.options).map(([key, value]) => (
                                  <s-text key={key} variant="bodySm">{key}: {value}</s-text>
                                ))}
                              </s-stack>
                            )}
                            <input
                              type="text"
                              defaultValue={item.serialNumber || ""}
                              placeholder="Enter serial number"
                              onBlur={(e) => {
                                const formData = new FormData();
                                formData.append("actionType", "saveSerial");
                                formData.append("orderId", order.id);
                                formData.append("lineItemId", item.id);
                                formData.append("serialNumber", e.target.value);
                                fetch("", { method: "POST", body: formData });
                              }}
                              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '300px' }}
                            />
                            {item.serialNumber && (
                              <s-text variant="bodySm" tone="success">✓ Saved: {item.serialNumber}</s-text>
                            )}
                          </s-stack>
                        </s-box>
                      ))}
                    </s-stack>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        ) : (
          <s-text>No orders in database. Click "Sync Orders from Shopify" to load orders.</s-text>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

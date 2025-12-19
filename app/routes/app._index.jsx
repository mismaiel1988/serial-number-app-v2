import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  TextField,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 10;

  try {
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
    
    return json({ 
      orders: orders.map(order => ({
        ...order,
        lineItems: JSON.parse(order.lineItems),
        customer: JSON.parse(order.customer)
      })),
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      fromDatabase: true
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({ 
      orders: [], 
      error: error.message,
      currentPage: 1,
      totalPages: 0,
      totalOrders: 0,
      fromDatabase: false
    });
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
      
      return json({ 
        success: true, 
        message: `Successfully synced ${allOrders.length} saddle orders from Shopify`,
        orderCount: allOrders.length
      });
    } catch (error) {
      console.error("Sync error:", error);
      return json({ success: false, error: error.message });
    }
  }

  if (actionType === "saveSerial") {
    const orderId = formData.get("orderId");
    const lineItemId = formData.get("lineItemId");
    const serialNumber = formData.get("serialNumber");

    try {
      // Update serial number in database
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
        
        return json({ success: true, message: "Serial number saved" });
      }
      
      return json({ success: false, error: "Order not found" });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  return json({ success: false, error: "Unknown action" });
};

export default function Index() {
  const { orders, error, currentPage, totalPages, totalOrders, fromDatabase } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    const formData = new FormData();
    formData.append("actionType", "syncOrders");
    submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (actionData) {
      setIsSyncing(false);
    }
  }, [actionData]);

  return (
    <Page
      title="Saddle Serial Number Manager"
      subtitle={fromDatabase ? `${totalOrders} orders in database` : "No orders synced yet"}
      primaryAction={{
        content: isSyncing ? "Syncing..." : "Sync Orders from Shopify",
        onAction: handleSync,
        loading: isSyncing,
        disabled: isSyncing
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical">
              <p>Error: {error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success === false && (
          <Layout.Section>
            <Banner tone="critical">
              <p>Error: {actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success === true && (
          <Layout.Section>
            <Banner tone="success">
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">
                  Orders with Saddles ({totalOrders} total)
                </Text>
                {totalPages > 1 && (
                  <InlineStack gap="200">
                    <Button
                      disabled={currentPage === 1}
                      url={`?page=${currentPage - 1}`}
                    >
                      ← Previous
                    </Button>
                    <Text variant="bodySm">
                      Page {currentPage} of {totalPages}
                    </Text>
                    <Button
                      disabled={currentPage === totalPages}
                      url={`?page=${currentPage + 1}`}
                    >
                      Next →
                    </Button>
                  </InlineStack>
                )}
              </InlineStack>

              <Divider />

              {orders && orders.length > 0 ? (
                <BlockStack gap="400">
                  {orders.map((order) => {
                    const saddleItems = order.lineItems.filter(
                      (item) => item.hasSaddleTag
                    );

                    return (
                      <Card key={order.id}>
                        <BlockStack gap="300">
                          <Text variant="headingMd">Order {order.orderName}</Text>
                          
                          <BlockStack gap="200">
                            <Text variant="bodyMd">
                              <strong>Customer:</strong> {order.customer.name}
                            </Text>
                            {order.customer.email && (
                              <Text variant="bodySm">{order.customer.email}</Text>
                            )}
                            <Text variant="bodySm">
                              <strong>Date:</strong>{" "}
                              {new Date(order.createdAt).toLocaleDateString()}
                            </Text>
                            <Text variant="bodySm">
                              <strong>Status:</strong> {order.fulfillmentStatus}
                            </Text>
                          </BlockStack>

                          <Divider />

                          <BlockStack gap="300">
                            <Text variant="headingSm">Saddles:</Text>
                            {saddleItems.map((item) => (
                              <Card key={item.id} background="bg-surface-secondary">
                                <BlockStack gap="200">
                                  <Text variant="bodyMd">
                                    <strong>{item.title}</strong> (Qty: {item.quantity})
                                  </Text>
                                  {Object.keys(item.options).length > 0 && (
                                    <InlineStack gap="200">
                                      {Object.entries(item.options).map(
                                        ([key, value]) => (
                                          <Text key={key} variant="bodySm">
                                            {key}: {value}
                                          </Text>
                                        )
                                      )}
                                    </InlineStack>
                                  )}
                                  <TextField
                                    label="Serial Number"
                                    placeholder="Enter serial number"
                                    defaultValue={item.serialNumber || ""}
                                    autoComplete="off"
                                    onBlur={(e) => {
                                      const formData = new FormData();
                                      formData.append("actionType", "saveSerial");
                                      formData.append("orderId", order.id);
                                      formData.append("lineItemId", item.id);
                                      formData.append("serialNumber", e.target.value);
                                      submit(formData, { method: "post" });
                                    }}
                                  />
                                  {item.serialNumber && (
                                    <Text variant="bodySm" tone="success">
                                      ✓ Saved: {item.serialNumber}
                                    </Text>
                                  )}
                                </BlockStack>
                              </Card>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Card>
                    );
                  })}
                </BlockStack>
              ) : (
                <BlockStack gap="300">
                  <Text>No orders in database. Click "Sync Orders from Shopify" to load orders.</Text>
                </BlockStack>
              )}

              {totalPages > 1 && (
                <>
                  <Divider />
                  <InlineStack align="center" gap="200">
                    <Button
                      disabled={currentPage === 1}
                      url={`?page=${currentPage - 1}`}
                    >
                      ← Previous
                    </Button>
                    <Text variant="bodySm">
                      Page {currentPage} of {totalPages}
                    </Text>
                    <Button
                      disabled={currentPage === totalPages}
                      url={`?page=${currentPage + 1}`}
                    >
                      Next →
                    </Button>
                  </InlineStack>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

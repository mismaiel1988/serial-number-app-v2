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

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 10;

  try {
    console.log("Fetching ALL orders with saddles tag...");
    
    // Fetch ALL orders by paginating through everything
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
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        fulfillmentStatus: node.displayFulfillmentStatus,
        customer: {
          name: node.customer 
            ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim() 
            : "Guest",
          email: node.customer?.email || "",
        },
        lineItems: node.lineItems.edges.map(({ node: item }) => ({
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
        })),
      })) || [];
      
      allOrders = [...allOrders, ...batchOrders];
      
      hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage || false;
      cursor = data?.data?.orders?.pageInfo?.endCursor;
      
      console.log(`Batch ${fetchCount}: fetched ${batchOrders.length} orders, total so far: ${allOrders.length}`);
    }
    
    console.log("Total orders fetched:", allOrders.length);
    
    // Filter for orders that have at least one saddle item
    const saddleOrders = allOrders.filter(order => 
      order.lineItems.some(item => item.hasSaddleTag)
    );
    
    console.log("Total saddle orders found:", saddleOrders.length);
    
    // Paginate the saddle orders - 10 per page
    const totalPages = Math.ceil(saddleOrders.length / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedOrders = saddleOrders.slice(startIndex, endIndex);
    
    console.log(`Showing orders ${startIndex + 1} to ${Math.min(endIndex, saddleOrders.length)} of ${saddleOrders.length}`);
    
    return json({ 
      orders: paginatedOrders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: saddleOrders.length,
      totalFetched: allOrders.length
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({ 
      orders: [], 
      error: error.message,
      currentPage: 1,
      totalPages: 0,
      totalOrders: 0,
      totalFetched: 0
    });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveSerial") {
    const orderId = formData.get("orderId");
    const lineItemId = formData.get("lineItemId");
    const serialNumber = formData.get("serialNumber");

    try {
      // Save serial number logic here
      return json({ success: true, message: "Serial number saved" });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  return json({ success: false, error: "Unknown action" });
};

export default function Index() {
  const { orders, error, currentPage, totalPages, totalOrders, totalFetched } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();

  return (
    <Page
      title="Saddle Serial Number Manager"
      subtitle={`Showing ${totalOrders} orders with saddles (searched ${totalFetched} total orders)`}
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
                          <Text variant="headingMd">Order {order.name}</Text>
                          
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
                                    autoComplete="off"
                                  />
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
                <Text>No orders with saddles found.</Text>
              )}

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
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

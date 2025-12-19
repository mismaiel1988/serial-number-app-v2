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
    const totalOrders = await db.saddle_orders.count();
    // Get paginated orders from database
    const orders = await db.saddle_orders.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: {
        created_at: 'desc'
      }
    });
    const totalPages = Math.ceil(totalOrders / perPage);
    console.log(`Showing ${orders.length} orders from database (page ${page} of ${totalPages})`);
    return {
      orders: orders.map(order => ({
        ...order,
        serialNumbers: order.serial_numbers ? JSON.parse(order.serial_numbers) : [],
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
      await db.saddle_orders.deleteMany({});
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
          order_id: node.id,
          order_name: node.name,
          created_at: new Date(node.createdAt),
          customer_name: node.customer ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim() : "Guest",
          customer_email: node.customer?.email || "",
          line_item_id: null, // Not used in this context
          product_title: null, // Not used in this context
          product_sku: null, // Not used in this context
          product_options: null, // Not used in this context
          quantity: null, // Not used in this context
          last_synced: new Date(),
          // Add more fields as needed
          serial_numbers: JSON.stringify(
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
          const items = order.serial_numbers ? JSON.parse(order.serial_numbers) : [];
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
        await db.saddle_orders.createMany({
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
      const order = await db.saddle_orders.findUnique({
        where: { db_id: parseInt(orderId) }
      });
      if (order) {
        let serialNumbers = order.serial_numbers ? JSON.parse(order.serial_numbers) : [];
        if (!Array.isArray(serialNumbers)) serialNumbers = [];
        const idx = serialNumbers.findIndex(sn => sn.lineItemId === lineItemId);
        if (idx > -1) {
          serialNumbers[idx].serialNumber = serialNumber;
        } else {
          serialNumbers.push({ lineItemId, serialNumber });
        }
        await db.saddle_orders.update({
          where: { db_id: parseInt(orderId) },
          data: { serial_numbers: JSON.stringify(serialNumbers) }
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

import OrdersIndexPage from "./orders._index.jsx";
export default OrdersIndexPage;

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

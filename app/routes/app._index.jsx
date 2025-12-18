import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(
      `#graphql
        query {
          orders(first: 50) {
            edges {
              node {
                id
                name
                createdAt
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      product {
                        tags
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    );

    const data = await response.json();
    
    if (data.errors) {
      return { orders: [], error: data.errors[0].message };
    }
    
    // Get all orders
    const allOrders = data?.data?.orders?.edges?.map(({ node }) => ({
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      lineItems: node.lineItems.edges.map(({ node: item }) => ({
        id: item.id,
        title: item.title,
        tags: item.product?.tags || [],
        hasSaddleTag: (item.product?.tags || []).includes('saddles'),
      })),
    })) || [];
    
    // Filter to only orders that have at least one product with "saddles" tag
    const saddleOrders = allOrders.filter(order => 
      order.lineItems.some(item => item.hasSaddleTag)
    );
    
    return { orders: saddleOrders };
  } catch (error) {
    return { orders: [], error: error.message };
  }
};

export default function Index() {
  const { orders, error } = useLoaderData();

  return (
    <s-page heading="Saddle Serial Number Manager">
      {error && (
        <s-section>
          <s-banner tone="critical">
            <s-text>Error: {error}</s-text>
          </s-banner>
        </s-section>
      )}
      
      <s-section heading={`Orders with Saddles (${orders?.length || 0})`}>
        {orders && orders.length > 0 ? (
          <s-stack direction="block" gap="base">
            {orders.map((order) => (
              <s-box
                key={order.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-text variant="headingMd">Order {order.name}</s-text>
                <s-text variant="bodySm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </s-text>
                <s-text variant="bodySm">
                  Products: {order.lineItems.filter(item => item.hasSaddleTag).map(item => item.title).join(', ')}
                </s-text>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No orders with saddles found.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

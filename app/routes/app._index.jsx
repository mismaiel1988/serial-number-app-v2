import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(
      `#graphql
        query getOrders {
          orders(first: 20, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
              }
            }
          }
        }
      `
    );

    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { orders: [], error: data.errors[0].message };
    }
    
    // Safely extract orders
    const orders = data?.data?.orders?.edges?.map(({ node }) => node) || [];
    
    return { orders };
  } catch (error) {
    console.error('Loader error:', error);
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
      
      <s-section heading={`Orders (${orders?.length || 0})`}>
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
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No orders found.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

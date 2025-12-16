import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
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
  const orders = data.data.orders.edges.map(({ node }) => node);
  
  return { orders };
};

export default function Index() {
  const { orders } = useLoaderData();

  return (
    <s-page heading="Saddle Serial Number Manager">
      <s-section heading={`Orders (${orders.length})`}>
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

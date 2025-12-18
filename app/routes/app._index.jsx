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
      fulfillmentStatus: node.displayFulfillmentStatus,
      customer: {
        name: node.customer 
          ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() 
          : 'Guest',
        email: node.customer?.email || '',
      },
      lineItems: node.lineItems.edges.map(({ node: item }) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        tags: item.product?.tags || [],
        options: (item.variant?.selectedOptions || []).reduce((acc, opt) => {
          acc[opt.name] = opt.value;
          return acc;
        }, {}),
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
            {orders.map((order) => {
              const saddleItems = order.lineItems.filter(item => item.hasSaddleTag);
              
              return (
                <s-box
                  key={order.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="tight">
                    <s-text variant="headingMd">Order {order.name}</s-text>
                    
                    <s-text variant="bodyMd" fontWeight="semibold">
                      Customer: {order.customer.name}
                    </s-text>
                    
                    {order.customer.email && (
                      <s-text variant="bodySm">{order.customer.email}</s-text>
                    )}
                    
                    <s-text variant="bodySm">
                      Date: {new Date(order.createdAt).toLocaleDateString()}
                    </s-text>
                    
                    <s-text variant="bodySm">
                      Fulfillment: {order.fulfillmentStatus}
                    </s-text>
                    
                    <s-stack direction="block" gap="tight">
                      <s-text variant="bodySm" fontWeight="semibold">Saddles:</s-text>
                      {saddleItems.map((item) => (
                        <s-box key={item.id} padding="tight" background="surface" borderRadius="base">
                          <s-stack direction="block" gap="extraTight">
                            <s-text variant="bodySm" fontWeight="semibold">
                              {item.title} (Qty: {item.quantity})
                            </s-text>
                            {Object.keys(item.options).length > 0 && (
                              <s-stack direction="inline" gap="tight">
                                {Object.entries(item.options).map(([key, value]) => (
                                  <s-text key={key} variant="bodySm">
                                    {key}: {value}
                                  </s-text>
                                ))}
                              </s-stack>
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
          <s-paragraph>No orders with saddles found.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

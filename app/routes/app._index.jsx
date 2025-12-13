import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(
    `#graphql
      query {
        orders(first: 50, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              customer {
                firstName
                lastName
                email
              }
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                    sku
                    product {
                      tags
                    }
                    variant {
                      selectedOptions {
                        name
                        value
                      }
                    }
                    customAttributes {
                      key
                      value
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

  const result = await response.json();
  
  const allOrders = result.data.orders.edges.map(({ node }) => ({
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    customer: {
      name: node.customer 
        ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() 
        : 'Guest',
      email: node.customer?.email || '',
    },
    total: node.totalPriceSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
    lineItems: node.lineItems.edges.map(({ node: item }) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      sku: item.sku || '',
      tags: item.product?.tags || [],
      options: (item.variant?.selectedOptions || []).reduce((acc, opt) => {
        acc[opt.name] = opt.value;
        return acc;
      }, {}),
      customAttributes: (item.customAttributes || []).reduce((acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {}),
      isSaddle: (item.product?.tags || []).includes('saddles'),
    })),
  }));
  
  const saddleOrders = allOrders.filter(order => 
    order.lineItems.some(item => item.isSaddle)
  );
  
  return { orders: saddleOrders };
};

export default function Index() {
  const { orders } = useLoaderData();

  return (
    <s-page heading="Saddle Serial Number Manager">
      <s-section heading={`Orders with Saddles (${orders.length})`}>
        {orders.length > 0 ? (
          <s-stack direction="block" gap="base">
            {orders.map((order) => {
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
                    <s-stack direction="block" gap="tight">
                      <s-text variant="headingMd">Order {order.name}</s-text>
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

                    <s-stack direction="block" gap="base">
                      {saddleItems.map((item) => (
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
                            
                            {Object.keys(item.options).length > 0 && (
                              <s-stack direction="inline" gap="tight">
                                {Object.entries(item.options).map(([key, value]) => (
                                  <s-text key={key} variant="bodySm">
                                    <strong>{key}:</strong> {value}
                                  </s-text>
                                ))}
                              </s-stack>
                            )}
                            
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

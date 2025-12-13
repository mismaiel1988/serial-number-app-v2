import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
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
                lineItems(first: 20) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      variantTitle
                      product {
                        id
                        productType
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

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }
    
    const orders = data?.data?.orders?.edges?.map(({ node }) => ({
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
      total: node.totalPriceSet?.shopMoney?.amount || '0',
      currency: node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
      lineItems: node.lineItems.edges.map(({ node: item }) => {
        const options = item.variant?.selectedOptions || [];
        const customAttributes = item.customAttributes || [];
        const tags = item.product?.tags || [];
        
        return {
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          sku: item.sku,
          variantTitle: item.variantTitle,
          productType: item.product?.productType,
          tags: tags,
          options: options.reduce((acc, opt) => {
            acc[opt.name] = opt.value;
            return acc;
          }, {}),
          customAttributes: customAttributes.reduce((acc, attr) => {
            acc[attr.key] = attr.value;
            return acc;
          }, {}),
          isSaddle: tags.some(tag => tag.toLowerCase().includes('saddle')),
        };
      }),
    })) || [];
    
    // Filter to only show orders with saddles (by tag)
    const saddleOrders = orders.filter(order => 
      order.lineItems.some(item => item.isSaddle)
    );
    
    return { orders: saddleOrders };
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
            <s-text>Error loading orders: {error}</s-text>
          </s-banner>
        </s-section>
      )}
      
      <s-section heading={`Orders with Saddles (${orders?.length || 0})`}>
        {orders && orders.length > 0 ? (
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
                    {/* Order Header */}
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

                    {/* Saddle Line Items */}
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
                            
                            {/* Variant details (color, size, etc.) */}
                            {Object.keys(item.options).length > 0 && (
                              <s-stack direction="inline" gap="tight">
                                {Object.entries(item.options).map(([key, value]) => (
                                  <s-text key={key} variant="bodySm">
                                    <strong>{key}:</strong> {value}
                                  </s-text>
                                ))}
                              </s-stack>
                            )}
                            
                            {/* Custom attributes (customizations) */}
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

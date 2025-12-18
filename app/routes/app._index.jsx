import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const direction = url.searchParams.get('direction') || 'next';
    
    // Build the query with cursor for pagination
    let queryArgs = 'first: 50';
    if (cursor && direction === 'next') {
      queryArgs = `first: 50, after: "${cursor}"`;
    } else if (cursor && direction === 'previous') {
      queryArgs = `last: 50, before: "${cursor}"`;
    }
    
    const response = await admin.graphql(
      `#graphql
        query {
          orders(${queryArgs}) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                id
                name
                createdAt
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
      return { orders: [], error: data.errors[0].message, pageInfo: {} };
    }
    
    const pageInfo = data?.data?.orders?.pageInfo || {};
    
    const allOrders = data?.data?.orders?.edges?.map(({ node }) => ({
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      customer: {
        name: node.customer 
          ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() 
          : 'Guest',
        email: node.customer?.email || '',
      },
      lineItems: node.lineItems.edges.map(({ node: item }) => {
        const customAttributes = item.customAttributes || [];
        const serialNumber = customAttributes.find(attr => attr.key === 'serial_number')?.value || '';
        
        return {
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          tags: item.product?.tags || [],
          options: (item.variant?.selectedOptions || []).reduce((acc, opt) => {
            acc[opt.name] = opt.value;
            return acc;
          }, {}),
          serialNumber: serialNumber,
          hasSaddleTag: (item.product?.tags || []).includes('saddles'),
        };
      }),
    })) || [];
    
    const saddleOrders = allOrders.filter(order => 
      order.lineItems.some(item => item.hasSaddleTag)
    );
    
    return { 
      orders: saddleOrders,
      pageInfo: pageInfo
    };
  } catch (error) {
    return { orders: [], error: error.message, pageInfo: {} };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const lineItemId = formData.get('lineItemId');
  const serialNumber = formData.get('serialNumber');
  const orderId = formData.get('orderId');
  
  try {
    const response = await admin.graphql(
      `#graphql
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          input: {
            id: orderId,
            customAttributes: [
              {
                key: `serial_number_${lineItemId.split('/').pop()}`,
                value: serialNumber
              }
            ]
          }
        }
      }
    );
    
    const result = await response.json();
    
    if (result.data?.orderUpdate?.userErrors?.length > 0) {
      return { success: false, error: result.data.orderUpdate.userErrors[0].message };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default function Index() {
  const { orders, error, pageInfo } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSerialNumberSave = async (orderId, lineItemId, serialNumber) => {
    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('lineItemId', lineItemId);
    formData.append('serialNumber', serialNumber);
    
    const response = await fetch('', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      window.location.reload();
    } else {
      alert('Error saving serial number: ' + result.error);
    }
  };

  const handleNextPage = () => {
    if (pageInfo.hasNextPage) {
      setSearchParams({ cursor: pageInfo.endCursor, direction: 'next' });
    }
  };

  const handlePreviousPage = () => {
    if (pageInfo.hasPreviousPage) {
      setSearchParams({ cursor: pageInfo.startCursor, direction: 'previous' });
    }
  };

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
        {/* Pagination Controls - Top */}
        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <s-box padding="base" background="surface" borderRadius="base" marginBlockEnd="base">
            <s-stack direction="inline" gap="tight" alignment="center">
              <button
                onClick={handlePreviousPage}
                disabled={!pageInfo.hasPreviousPage}
                style={{
                  padding: '8px 16px',
                  backgroundColor: pageInfo.hasPreviousPage ? '#008060' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pageInfo.hasPreviousPage ? 'pointer' : 'not-allowed'
                }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pageInfo.hasNextPage}
                style={{
                  padding: '8px 16px',
                  backgroundColor: pageInfo.hasNextPage ? '#008060' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pageInfo.hasNextPage ? 'pointer' : 'not-allowed'
                }}
              >
                Next →
              </button>
            </s-stack>
          </s-box>
        )}

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
                    
                    <s-stack direction="block" gap="tight">
                      <s-text variant="bodySm" fontWeight="semibold">Saddles:</s-text>
                      {saddleItems.map((item) => (
                        <s-box key={item.id} padding="base" background="surface" borderRadius="base" borderWidth="base">
                          <s-stack direction="block" gap="tight">
                            <s-text variant="bodyMd" fontWeight="semibold">
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
                            
                            <s-stack direction="inline" gap="tight" alignment="center">
                              <s-text variant="bodySm" fontWeight="semibold">Serial Number:</s-text>
                              <input
                                type="text"
                                id={`serial-${item.id}`}
                                defaultValue={item.serialNumber}
                                placeholder="Enter serial number"
                                style={{
                                  padding: '8px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  flex: '1',
                                  maxWidth: '300px'
                                }}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`serial-${item.id}`);
                                  handleSerialNumberSave(order.id, item.id, input.value);
                                }}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#008060',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Save
                              </button>
                            </s-stack>
                            
                            {item.serialNumber && (
                              <s-text variant="bodySm" tone="success">
                                ✓ Serial number saved: {item.serialNumber}
                              </s-text>
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

        {/* Pagination Controls - Bottom */}
        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <s-box padding="base" background="surface" borderRadius="base" marginBlockStart="base">
            <s-stack direction="inline" gap="tight" alignment="center">
              <button
                onClick={handlePreviousPage}
                disabled={!pageInfo.hasPreviousPage}
                style={{
                  padding: '8px 16px',
                  backgroundColor: pageInfo.hasPreviousPage ? '#008060' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pageInfo.hasPreviousPage ? 'pointer' : 'not-allowed'
                }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pageInfo.hasNextPage}
                style={{
                  padding: '8px 16px',
                  backgroundColor: pageInfo.hasNextPage ? '#008060' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pageInfo.hasNextPage ? 'pointer' : 'not-allowed'
                }}
              >
                Next →
              </button>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

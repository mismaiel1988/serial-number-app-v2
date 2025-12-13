export async function getOrders(admin, { cursor = null, searchQuery = null } = {}) {
  const query = searchQuery ? `name:${searchQuery}` : '';
  
  const response = await admin.graphql(
    `#graphql
      query getOrders($cursor: String, $query: String) {
        orders(first: 50, reverse: true, after: $cursor, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              customer {
                id
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
                    customAttributes {
                      key
                      value
                    }
                    variantTitle
                    product {
                      id
                      productType
                      title
                    }
                    variant {
                      id
                      title
                      selectedOptions {
                        name
                        value
                      }
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
    `,
    {
      variables: {
        cursor,
        query,
      },
    }
  );

  const data = await response.json();
  
  // Transform and filter for saddle orders
  const allOrders = data.data.orders.edges.map(({ node }) => ({
    id: node.id,
    orderNumber: node.name,
    createdAt: node.createdAt,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    total: node.totalPriceSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
    customer: {
      name: node.customer 
        ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() 
        : 'Guest',
      email: node.customer?.email || '',
    },
    lineItems: node.lineItems.edges.map(({ node: item }) => {
      // Extract variant options (color, size, etc.)
      const options = item.variant?.selectedOptions || [];
      const customAttributes = item.customAttributes || [];
      
      return {
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        sku: item.sku,
        variantTitle: item.variantTitle,
        productType: item.product?.productType,
        productId: item.product?.id,
        variantId: item.variant?.id,
        options: options.reduce((acc, opt) => {
          acc[opt.name] = opt.value;
          return acc;
        }, {}),
        customAttributes: customAttributes.reduce((acc, attr) => {
          acc[attr.key] = attr.value;
          return acc;
        }, {}),
        isSaddle: item.product?.productType?.toLowerCase().includes('saddle') || 
                  item.title?.toLowerCase().includes('saddle'),
      };
    }),
  }));

  // Only return orders that have at least one saddle item
  const saddleOrders = allOrders.filter(order => 
    order.lineItems.some(item => item.isSaddle)
  );

  return {
    orders: saddleOrders,
    pageInfo: data.data.orders.pageInfo,
  };
}

export async function getSerialNumbers(admin, lineItemId) {
  // Query metafield for serial numbers on this line item
  const response = await admin.graphql(
    `#graphql
      query getLineItemMetafield($id: ID!) {
        lineItem(id: $id) {
          id
          customAttributes {
            key
            value
          }
        }
      }
    `,
    {
      variables: {
        id: lineItemId,
      },
    }
  );

  const data = await response.json();
  const serialAttr = data.data?.lineItem?.customAttributes?.find(
    attr => attr.key === 'serial_number'
  );
  
  return serialAttr?.value || '';
}

export async function saveSerialNumber(admin, orderId, lineItemId, serialNumber) {
  // Save serial number as order metafield with line item reference
  const namespace = 'saddle_serials';
  const key = `line_item_${lineItemId.split('/').pop()}`;
  
  const response = await admin.graphql(
    `#graphql
      mutation setOrderMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
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
        metafields: [
          {
            ownerId: orderId,
            namespace: namespace,
            key: key,
            value: serialNumber,
            type: 'single_line_text_field',
          },
        ],
      },
    }
  );

  const data = await response.json();
  
  if (data.data?.metafieldsSet?.userErrors?.length > 0) {
    throw new Error(data.data.metafieldsSet.userErrors[0].message);
  }
  
  return data.data?.metafieldsSet?.metafields[0];
}

export async function getAllSerialNumbers(admin, orderId) {
  const response = await admin.graphql(
    `#graphql
      query getOrderMetafields($id: ID!) {
        order(id: $id) {
          id
          name
          metafields(first: 100, namespace: "saddle_serials") {
            edges {
              node {
                id
                key
                value
                namespace
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: orderId,
      },
    }
  );

  const data = await response.json();
  return data.data?.order?.metafields?.edges.map(({ node }) => node) || [];
}

export async function exportSerialNumbersToCSV(admin) {
  // This will fetch all orders with serial numbers and format as CSV
  let allSerials = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { orders, pageInfo } = await getOrders(admin, { cursor });
    
    for (const order of orders) {
      const metafields = await getAllSerialNumbers(admin, order.id);
      
      for (const metafield of metafields) {
        const lineItemId = `gid://shopify/LineItem/${metafield.key.replace('line_item_', '')}`;
        const lineItem = order.lineItems.find(item => item.id === lineItemId);
        
        if (lineItem) {
          allSerials.push({
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            productTitle: lineItem.title,
            sku: lineItem.sku,
            serialNumber: metafield.value,
            lineItemId: lineItem.id,
          });
        }
      }
    }
    
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  // Convert to CSV
  const headers = ['Order Number', 'Order Date', 'Product', 'SKU', 'Serial Number', 'Line Item ID'];
  const rows = allSerials.map(s => [
    s.orderNumber,
    new Date(s.orderDate).toLocaleDateString(),
    s.productTitle,
    s.sku || '',
    s.serialNumber,
    s.lineItemId,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

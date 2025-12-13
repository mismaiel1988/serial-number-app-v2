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

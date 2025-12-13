export async function getOrders(admin) {
    const response = await admin.graphql(
      `#graphql
        query getOrders {
          orders(first: 50, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      product {
                        id
                        productType
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
    
    // Transform to simpler format
    return data.data.orders.edges.map(({ node }) => ({
      id: node.id,
      orderNumber: node.name,
      createdAt: node.createdAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      total: node.totalPriceSet.shopMoney.amount,
      currency: node.totalPriceSet.shopMoney.currencyCode,
      lineItems: node.lineItems.edges.map(({ node: item }) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        productType: item.product?.productType,
      })),
    }));
  }
  
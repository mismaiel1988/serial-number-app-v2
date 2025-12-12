import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response("Ignored", { status: 200 });
  }

  const order = payload;

  await prisma.order.upsert({
    where: { shopifyOrderId: String(order.id) },
    update: {},
    create: {
      shopifyOrderId: String(order.id),
      orderNumber: order.order_number,
      shopDomain: shop,
      lineItems: {
        create: order.line_items.map((item) => ({
          shopifyLineItemId: String(item.id),
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          isSaddle:
            item.product_type?.toLowerCase().includes("saddle") ?? false,
        })),
      },
    },
  });

  return new Response("OK", { status: 200 });
};

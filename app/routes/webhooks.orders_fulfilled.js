import { authenticate } from "../shopify.server.js";
import { prisma } from "../db.server.js";

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  // Only handle order fulfillment
  if (topic !== "ORDERS_FULFILLED") {
    return new Response("Ignored", { status: 200 });
  }

  const order = payload;

  // Fetch the order and its saddle line items
  const existingOrder = await prisma.order.findUnique({
    where: {
      shopifyOrderId: String(order.id),
    },
    include: {
      lineItems: true,
    },
  });

  if (!existingOrder) {
    return new Response("Order not found", { status: 200 });
  }

  // For each saddle line item, create serial placeholders
  for (const item of existingOrder.lineItems) {
    if (!item.isSaddle) continue;

    // Create one serial record per quantity
    for (let i = 0; i < item.quantity; i++) {
      await prisma.serialNumber.create({
        data: {
          orderId: existingOrder.id,
          lineItemId: item.id,
          shopDomain: shop,
          status: "PENDING", // no serial assigned yet
        },
      });
    }
  }

  return new Response("OK", { status: 200 });
};
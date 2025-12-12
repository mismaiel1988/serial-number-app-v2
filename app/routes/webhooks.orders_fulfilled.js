import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

/**
 * Shopify ORDERS_FULFILLED webhook
 * - Assigns serial numbers to saddle line items
 * - Supports multiple saddles per order
 * - Prevents duplicate serial assignment
 */
export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_FULFILLED") {
    return new Response("Ignored", { status: 200 });
  }

  const order = payload;

  // Find the order we already stored on ORDERS_CREATE
  const dbOrder = await prisma.order.findUnique({
    where: { shopifyOrderId: String(order.id) },
    include: {
      lineItems: true,
      serialNumbers: true,
    },
  });

  if (!dbOrder) {
    console.warn("Order not found for fulfillment:", order.id);
    return new Response("Order not found", { status: 200 });
  }

  // Prevent double-fulfillment / duplicate serials
  if (dbOrder.serialNumbers.length > 0) {
    console.log("Serials already assigned for order:", order.id);
    return new Response("Already processed", { status: 200 });
  }

  // Helper to generate serial numbers (XX-XXXXX)
  const generateSerial = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix =
      letters[Math.floor(Math.random() * 26)] +
      letters[Math.floor(Math.random() * 26)];

    const number = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${number}`;
  };

  // Assign serials to saddle line items
  for (const lineItem of dbOrder.lineItems) {
    if (!lineItem.isSaddle) continue;

    for (let i = 0; i < lineItem.quantity; i++) {
      let serial;
      let created = false;

      // Ensure uniqueness (retry on collision)
      while (!created) {
        serial = generateSerial();
        try {
          await prisma.serialNumber.create({
            data: {
              serial,
              shopDomain: shop,
              orderId: dbOrder.id,
              lineItemId: lineItem.id,
            },
          });
          created = true;
        } catch (err) {
          // Prisma unique constraint violation → retry
          if (err.code !== "P2002") {
            throw err;
          }
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
};

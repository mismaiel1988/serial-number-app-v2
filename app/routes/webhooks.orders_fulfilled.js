import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const action = async ({ request }) => {
  const { topic, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_FULFILLED") {
    return new Response("Ignored", { status: 200 });
  }

  const order = payload;

  await prisma.order.update({
    where: { shopifyOrderId: String(order.id) },
    data: {
      fulfilledAt: new Date(),
      status: "FULFILLED",
    },
  });

  return new Response("OK", { status: 200 });
};

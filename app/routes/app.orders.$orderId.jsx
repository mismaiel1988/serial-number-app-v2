import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      lineItems: {
        where: { isSaddle: true },
        include: { serialNumbers: true },
      },
    },
  });

  if (!order) {
    throw new Response("Order not found", { status: 404 });
  }

  return { order };
};

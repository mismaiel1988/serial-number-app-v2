import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrders } from "../services/orders.server";

import prisma from "../db.server";

export async function loader({ request }) {
  await authenticate.admin(request);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { orders };
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const orders = await getOrders(admin);
  
  return { orders };
}


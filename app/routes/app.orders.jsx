import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  await authenticate.admin(request);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { orders };
}

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <div style={{ padding: 24 }}>
      <h1>Orders</h1>

      <ul>
        {orders.map((o) => (
          <li key={o.id}>Order #{o.orderNumber}</li>
        ))}
      </ul>
    </div>
  );
}

import { useLoaderData, Link } from "react-router";
import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const orders = await prisma.order.findMany({
    include: {
      lineItems: {
        where: { isSaddle: true },
        include: { serialNumbers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ orders });
};

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Saddle Orders</h1>

      {orders.map((order) => (
        <div
          key={order.id}
          style={{
            marginBottom: "16px",
            padding: "12px",
            border: "1px solid #ddd",
          }}
        >
          <strong>Order #{order.orderNumber}</strong>
          <br />
          <Link to={`/app/orders/${order.id}`}>View serial numbers</Link>
        </div>
      ))}
    </div>
  );
}

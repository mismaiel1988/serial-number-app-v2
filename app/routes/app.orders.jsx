import { useLoaderData, Link } from "react-router";
import prisma from "../db.server.js";
import shopify from "../shopify.server.js";

export const loader = async ({ request }) => {
  // ✅ Embedded admin auth (no login UI)
  await shopify.authenticate.admin(request);

  const orders = await prisma.order.findMany({
    include: {
      lineItems: {
        where: { isSaddle: true },
        include: { serialNumbers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

return new Response(JSON.stringify({ orders }), {
  headers: { "Content-Type": "application/json" },
});
};

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Saddle Orders</h1>

      {orders.length === 0 && <p>No orders found.</p>}

      <ul>
        {orders.map((order) => (
          <li key={order.id} style={{ marginBottom: "12px" }}>
            <Link to={`/app/orders/${order.id}`}>
              Order #{order.orderNumber}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
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

  return json({ orders });
};

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Saddle Orders</h1>

      {orders.length === 0 && <p>No orders found.</p>}

      {orders.map((order) => (
        <div
          key={order.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3>
            Order #{order.orderNumber}
          </h3>

          <p>
            Shop: <strong>{order.shopDomain}</strong>
          </p>

          {order.lineItems.length === 0 ? (
            <p>No saddles in this order.</p>
          ) : (
            <ul>
              {order.lineItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong> — Qty: {item.quantity}
                  <br />
                  Serials:{" "}
                  {item.serialNumbers.length > 0
                    ? item.serialNumbers.map((s) => s.serial).join(", ")
                    : "Not assigned yet"}
                </li>
              ))}
            </ul>
          )}

          <Link to={`/app/orders/${order.id}`}>
            View order →
          </Link>
        </div>
      ))}
    </div>
  );
}
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "react-router";
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

  return json({ order });
};

export default function OrderDetailPage() {
  const { order } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Order #{order.orderNumber}</h1>

      {order.lineItems.map((item) => (
        <div
          key={item.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3>{item.title}</h3>
          <p>Quantity: {item.quantity}</p>

          <p>
            Serials:
            {item.serialNumbers.length === 0 ? (
              <em> Not assigned yet</em>
            ) : (
              <ul>
                {item.serialNumbers.map((serial) => (
                  <li key={serial.id}>{serial.serial}</li>
                ))}
              </ul>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

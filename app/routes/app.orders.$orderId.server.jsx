// app/routes/app.orders.$orderId.server.jsx

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

  return { order };
};

export default function OrderDetailPage() {
  const { order } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <Link to="/app/orders">← Back to orders</Link>
      <h1>Order #{order.orderNumber}</h1>

      {order.lineItems.map((item) => (
        <div key={item.id}>
          <h3>{item.title}</h3>
          <ul>
            {item.serialNumbers.map((sn) => (
              <li key={sn.id}>{sn.value}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

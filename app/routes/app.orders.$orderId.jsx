import { useLoaderData, Link } from "react-router";
import prisma from "../db.server.js";
import shopify from "../shopify.server.js";

export const loader = async ({ request, params }) => {
  // ✅ Embedded admin auth (NO login redirect)
  await shopify.authenticate.admin(request);

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

return new Response(JSON.stringify({ order }), {
  headers: { "Content-Type": "application/json" },
});
};

export default function OrderDetailPage() {
  const { order } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <Link to="/app/orders">← Back to orders</Link>

      <h1>Order #{order.orderNumber}</h1>

      {order.lineItems.map((item) => (
        <div key={item.id} style={{ marginTop: "16px" }}>
          <h3>{item.title}</h3>

          {item.serialNumbers.length === 0 && <p>No serial numbers yet</p>}

          <ul>
            {item.serialNumbers.map((sn) => (
              <li key={sn.id}>{sn.serial}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

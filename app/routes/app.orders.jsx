import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// SERVER
export async function loader({ request }) {
  await authenticate.admin(request);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { orders };
}

// CLIENT
export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Orders</h1>

      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <Link to={`/app/orders/${order.id}`}>
                Order #{order.orderNumber || order.id}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

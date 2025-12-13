import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrders } from "../services/orders.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const orders = await getOrders(admin);
  
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

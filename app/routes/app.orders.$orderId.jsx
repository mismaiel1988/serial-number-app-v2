import { useLoaderData, Link } from "react-router";

export default function OrderDetailPage() {
  const { order } = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <Link to="/app/orders">← Back to orders</Link>

      <h1>Order #{order.orderNumber}</h1>

      {order.lineItems.map((item) => (
        <div key={item.id} style={{ marginTop: "16px" }}>
          <h3>{item.title}</h3>

          {item.serialNumbers.length === 0 && (
            <p>No serial numbers yet</p>
          )}

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

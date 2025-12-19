import { useLoaderData, Link } from "react-router-dom";
import OrdersTable from "../components/OrdersTable";

export default function OrdersIndexPage() {
  const { orders, error, currentPage, totalPages, totalOrders } = useLoaderData();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 24 }}>Saddle Serial Numbers</h1>
      {error && (
        <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>
      )}
      <OrdersTable orders={orders} />
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button disabled={currentPage === 1}>
          <Link to={`?page=${currentPage - 1}`}>← Previous</Link>
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button disabled={currentPage === totalPages}>
          <Link to={`?page=${currentPage + 1}`}>Next →</Link>
        </button>
      </div>
    </div>
  );
}

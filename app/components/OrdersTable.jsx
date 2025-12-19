import { Link } from "react-router-dom";

export default function OrdersTable({ orders }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={th}>Order #</th>
            <th style={th}>Customer Name</th>
            <th style={th}>Date</th>
            <th style={th}># of Saddles</th>
            <th style={th}>Status</th>
            <th style={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const saddleCount = Array.isArray(order.serialNumbers)
              ? order.serialNumbers.length
              : 0;
            const allSerialsEntered = saddleCount > 0 && order.serialNumbers.every(item => item.serialNumber && item.serialNumber.trim() !== "");
            const status = allSerialsEntered ? "complete" : "pending";
            return (
              <tr key={order.db_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={td}>
                  <Link to={`/orders/${order.db_id}`} style={{ color: '#007bff', textDecoration: 'underline' }}>{order.order_name || order.order_id}</Link>
                </td>
                <td style={td}>{order.customer_name}</td>
                <td style={td}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</td>
                <td style={td}>{saddleCount}</td>
                <td style={td}>
                  {status === "complete" ? (
                    <span style={{ ...badge, background: '#d4edda', color: '#155724' }}>🟢 Complete</span>
                  ) : (
                    <span style={{ ...badge, background: '#fff3cd', color: '#856404' }}>🟡 Pending</span>
                  )}
                </td>
                <td style={td}>
                  <Link to={`/orders/${order.db_id}`} style={{ color: '#007bff' }}>
                    {allSerialsEntered ? "View Serials" : "Add Serials"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding: '12px 8px', textAlign: 'left', fontWeight: 600 };
const td = { padding: '10px 8px', verticalAlign: 'middle' };
const badge = { display: 'inline-block', borderRadius: '12px', padding: '2px 12px', fontWeight: 600, fontSize: '0.95em' };

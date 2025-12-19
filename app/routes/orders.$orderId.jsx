import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";

export default function OrderDetailPage() {
  const { order } = useLoaderData();
  const [serials, setSerials] = useState(order.serialNumbers || []);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto-focus first empty field
    const idx = serials.findIndex(item => !item.serialNumber);
    if (idx !== -1 && inputRefs.current[idx]) {
      inputRefs.current[idx].focus();
    }
  }, [serials]);

  const handleInput = (idx, value) => {
    const updated = serials.map((item, i) =>
      i === idx ? { ...item, serialNumber: value.toUpperCase() } : item
    );
    setSerials(updated);
    setErrors({ ...errors, [idx]: undefined });
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      if (inputRefs.current[idx + 1]) {
        inputRefs.current[idx + 1].focus();
      }
    }
  };

  const validate = () => {
    const errs = {};
    serials.forEach((item, idx) => {
      if (!item.serialNumber || !item.serialNumber.trim()) {
        errs[idx] = "Serial number required";
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    // TODO: Save serials to backend
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  if (!serials.length) {
    return <div style={{ padding: 32 }}>This order contains no saddle products.</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <a href="#" onClick={() => navigate(-1)} style={{ color: '#007bff' }}>← Back to Orders</a>
      </div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Order {order.order_name || order.order_id}</h2>
      <div style={{ marginBottom: 16, color: '#555' }}>
        <span>Customer: {order.customer_name}</span> | <span>Date: {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</span>
      </div>
      {serials.map((item, idx) => (
        <div key={item.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Product image placeholder */}
            <div style={{ width: 60, height: 60, background: '#e0e0e0', borderRadius: 8 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div style={{ color: '#888', fontSize: 14 }}>Qty: {item.quantity}</div>
              <div style={{ color: '#888', fontSize: 14 }}>Saddle {idx + 1} of {serials.length}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <input
              ref={el => inputRefs.current[idx] = el}
              type="text"
              value={item.serialNumber || ""}
              placeholder="Enter serial number"
              style={{ width: 300, padding: 8, border: '1px solid #ccc', borderRadius: 4, textTransform: 'uppercase' }}
              onChange={e => handleInput(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(e, idx)}
              autoFocus={idx === 0}
            />
            {errors[idx] && <div style={{ color: 'red', fontSize: 13 }}>{errors[idx]}</div>}
            {item.updatedAt && (
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Last updated: {new Date(item.updatedAt).toLocaleString()}</div>
            )}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={handleSave} style={{ background: '#007bff', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Serial Numbers</button>
        <button onClick={() => navigate(-1)} style={{ background: '#eee', color: '#333', padding: '8px 20px', border: 'none', borderRadius: 4 }}>Cancel</button>
      </div>
      {success && <div style={{ color: 'green', marginTop: 16 }}>Serial numbers saved!</div>}
    </div>
  );
}

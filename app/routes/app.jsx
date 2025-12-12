import { Link } from "react-router";

export default function AppHome() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Saddle Serial Number App</h1>

      <p>
        Manage saddle serial numbers, warranty tracking, and order assignments.
      </p>

      <Link to="/app/orders">
        → View Orders
      </Link>
    </div>
  );
}

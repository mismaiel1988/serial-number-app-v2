import { Outlet, Link } from "react-router";

export default function AppLayout() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Saddle Serial Number App</h1>

      <p>
        Manage saddle serial numbers, warranty tracking, and order assignments.
      </p>

      {/* 👇 THIS IS THE CRITICAL LINE */}
      <Outlet />
    </div>
  );
}

import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { Outlet } from "react-router";

export default function Root() {
  return (
    <AppProvider embedded>
      <Outlet />
    </AppProvider>
  );
}

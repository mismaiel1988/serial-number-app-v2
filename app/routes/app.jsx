import { redirect } from "@react-router/node";

export const loader = async () => {
  return redirect("/app/orders");
};

export default function AppIndexRedirect() {
  return null;
}

export const loader = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app/orders",
    },
  });
};

export default function AppIndexRedirect() {
  return null;
}

import { SubscriptionsView } from "@/features/subscriptions/subscriptions-view";

// The page reads URL search params and mounts an interactive query-driven view.
// Opt out of instant-navigation validation for this blocking route segment.
export const instant = false;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const { create } = await searchParams;

  return (
    <SubscriptionsView
      key={create === "true" ? "create" : "list"}
      initialCreate={create === "true"}
    />
  );
}

import { SubscriptionsView } from "@/features/subscriptions/subscriptions-view";

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

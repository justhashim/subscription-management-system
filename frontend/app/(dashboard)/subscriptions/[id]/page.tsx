import { SubscriptionDetailView } from "@/features/subscriptions/subscription-detail-view";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SubscriptionDetailView id={id} />;
}

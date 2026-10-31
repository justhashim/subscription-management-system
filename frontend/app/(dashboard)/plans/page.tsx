import { PlansView } from "@/features/plans/plans-view";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const { productId } = await searchParams;

  return (
    <PlansView
      key={productId ?? "all"}
      initialProductId={productId}
    />
  );
}

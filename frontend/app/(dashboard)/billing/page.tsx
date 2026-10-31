import { OperationsView } from "@/features/operations/operations-view";

export const instant = false;

export default function BillingPage() {
  return <OperationsView mode="billing" />;
}

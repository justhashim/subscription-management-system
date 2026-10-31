import { OperationsView } from "@/features/operations/operations-view";

export const instant = false;

export default function PaymentsPage() {
  return <OperationsView mode="payments" />;
}

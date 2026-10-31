import DashboardView from "@/features/dashboard/dashboard-view";

// This dashboard depends on several client-side query streams and auth state.
// Allow the route to block while those streams hydrate instead of dropping the
// segment during Next.js development instant-navigation validation.
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}

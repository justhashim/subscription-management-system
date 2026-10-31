import { Suspense, type ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

function DashboardFallback() {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden w-64 border-r bg-sidebar lg:block" />
      <div className="flex-1">
        <div className="h-16 border-b" />
        <div className="mx-auto max-w-7xl space-y-4 p-6 lg:p-8">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl border bg-card"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

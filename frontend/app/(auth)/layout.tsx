import type { ReactNode } from "react";
import { CheckCircle2, Layers, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#13102b] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.35),transparent_38%),radial-gradient(circle_at_85%_75%,rgba(139,92,246,0.22),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <Layers className="size-5 text-indigo-200" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">Orbit</span>
            <span className="text-[11px] leading-4 text-white/50">
              Billing workspace
            </span>
          </span>
        </div>

        <div className="relative max-w-lg space-y-7">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-indigo-200">
            <Sparkles className="size-3" />
            Subscription operations, simplified
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
              Every customer, product, and plan in one calm workspace.
            </h1>
            <p className="max-w-md text-sm leading-6 text-white/60">
              Orbit gives your team a clear view of subscription lifecycle
              status without the spreadsheet sprawl.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: ShieldCheck,
                title: "Role-aware access",
                copy: "Admins manage the catalog and team. Members stay focused.",
              },
              {
                icon: Layers,
                title: "Catalog clarity",
                copy: "Products, plans, and subscription state in one place.",
              },
              {
                icon: CheckCircle2,
                title: "Lifecycle visibility",
                copy: "Trials, active periods, and cancellations at a glance.",
              },
              {
                icon: Sparkles,
                title: "Backend-ready",
                copy: "Typed contracts with a mock adapter for fast iteration.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm"
              >
                <item.icon className="mb-2 size-4 text-indigo-300" />
                <p className="text-xs font-medium">{item.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-white/45">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3 border-t border-white/10 pt-6">
          <div className="flex -space-x-2">
            {["AK", "JL", "SM", "PP"].map((initials) => (
              <span
                key={initials}
                className="flex size-7 items-center justify-center rounded-full border border-[#13102b] bg-indigo-400/20 text-[10px] font-medium text-indigo-100"
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="text-[11px] leading-4 text-white/45">
            Built for teams that would rather ship than reconcile spreadsheets.
          </p>
        </div>
      </section>

      <section className="flex min-h-svh items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">{children}</div>
      </section>
    </div>
  );
}

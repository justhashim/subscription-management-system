import Link from "next/link";
import { Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2.5", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
        <Orbit className="size-5" />
      </span>
      {!compact ? (
        <span className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Orbit</span>
          <span className="text-[11px] leading-4 text-muted-foreground">
            Billing workspace
          </span>
        </span>
      ) : null}
    </Link>
  );
}

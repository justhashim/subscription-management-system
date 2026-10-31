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
      <span className="flex size-9 items-center justify-center border border-sidebar-border bg-primary text-primary-foreground">
        <Orbit className="size-5" strokeWidth={1.75} />
      </span>
      {!compact ? (
        <span className="flex flex-col">
          <span className="font-mono text-sm font-bold tracking-[0.08em] uppercase">Orbit</span>
          <span className="font-mono text-[10px] leading-4 text-muted-foreground uppercase">
            Billing system
          </span>
        </span>
      ) : null}
    </Link>
  );
}

import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  ADMIN:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  MEMBER: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
  INVITED:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  SUSPENDED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  ARCHIVED:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-300",
  TRIALING: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  PAST_DUE:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  CANCELED:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  EXPIRED:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-300",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        statusStyles[status] ?? statusStyles.EXPIRED,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {titleCase(status)}
    </Badge>
  );
}

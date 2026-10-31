import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles = {
  indigo: "bg-primary text-primary-foreground",
  emerald: "bg-foreground text-background",
  amber: "bg-primary text-primary-foreground",
  sky: "bg-foreground text-background",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
}) {
  return (
    <Card className="shadow-none transition-colors hover:border-primary">
      <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            toneStyles[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

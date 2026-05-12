import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const toneClass = {
    default: "text-foreground",
    warn: "text-amber-500",
    danger: "text-red-500",
    good: "text-emerald-500",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  stale: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "needs review": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  interrupted: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  unused: "bg-muted text-muted-foreground border-border",
  missing: "bg-red-500/10 text-red-500 border-red-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  broken: "bg-red-500/10 text-red-500 border-red-500/20",
  global: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  workspace: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        styles[key] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {status}
    </span>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { workspaces as sampleWorkspaces, type Workspace } from "@/lib/mock-data";
import { workspaceCoverClasses } from "@/lib/workspace-covers";
import { ImageIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";

let ld: any = {};
let isDemoData = true;

// Build minimal Workspace rows from the aggregator's recentProjects feed.
// recentProjects.key is the slugified path; we fabricate just enough fields
// to render the card (status, freshness, $ today are not yet emitted, so
// they're shown as 0 / unknown rather than fake numbers from sample data).
function buildWorkspacesFromLive(): Workspace[] {
  const projects = (ld as any)?.recentProjects;
  if (!Array.isArray(projects)) return [];
  return projects.map(
    (p: any): Workspace => ({
      id: String(p?.key ?? ""),
      name: String(p?.displayName ?? p?.key ?? "—"),
      path: String(p?.displayName ?? p?.key ?? "—"),
      claudeMdStatus: "needs review",
      lastRun: String(p?.lastActiveAgo ?? "—"),
      activeSkills: [],
      recentFiles: [],
      recentOutputs: [],
      memoryFreshness: 0,
      usageToday: 0,
      runs7d: Number(p?.sessions ?? 0) || 0,
      description: "",
      summary: "",
      memoryFiles: [],
      sessions: [],
      warnings: [],
    }),
  );
}

// workspaces list is now computed inside WorkspacesPage()

export const Route = createFileRoute("/workspaces/")({
  head: () => ({
    meta: [
      { title: "Workspaces — Agentic OS" },
      {
        name: "description",
        content: "All Claude Code project workspaces with cover, status and live signals.",
      },
    ],
  }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  ld = useLiveData();
  isDemoData = ld?.isExample === true;
  const workspaces: Workspace[] = buildWorkspacesFromLive();
  return (
    <div className="max-w-[1400px]">
      <header className="border-b border-border pb-8 mb-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
          <span>Workspaces</span>
          {isDemoData && (
            <span
              title="Sample data shipped with this repo. Run `bun run scripts/aggregate.ts` to populate with your real ~/.claude/ activity."
              className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
              style={{
                background: "rgba(251, 191, 36, 0.14)",
                color: "#fbbf24",
                border: "1px solid rgba(251, 191, 36, 0.3)",
              }}
            >
              DEMO DATA
            </span>
          )}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          {workspaces.length}{" "}
          <span className="text-muted-foreground/60 font-normal">project folders</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Each folder has its own CLAUDE.md, memory and active skills.
        </p>
      </header>

      {workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-[13px] text-muted-foreground">
          No project workspaces detected yet. Run a Claude Code session in one of your project
          folders and re-run{" "}
          <code className="text-foreground/80">bun run scripts/aggregate.ts</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {workspaces.map((ws) => {
            const dot =
              ws.claudeMdStatus === "healthy"
                ? "bg-emerald-500"
                : ws.claudeMdStatus === "missing"
                  ? "bg-red-500"
                  : "bg-amber-500";
            return (
              <Link
                key={ws.id}
                to="/workspaces/$id"
                params={{ id: ws.id }}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors"
              >
                <div className="p-3 pb-0">
                  <div
                    className={`relative aspect-[16/9] overflow-hidden rounded-lg border border-border ring-1 ring-foreground/5 ${workspaceCoverClasses[ws.id] ?? "bg-muted/30"}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-7 w-7 text-foreground/25" strokeWidth={1.25} />
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur px-2 py-0.5 text-[10px] border border-border">
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      <span className="capitalize text-muted-foreground">{ws.claudeMdStatus}</span>
                    </div>
                    {ws.usageToday > 0 && (
                      <div className="absolute top-2 right-2 rounded-full bg-background/85 backdrop-blur px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground border border-border">
                        ${ws.usageToday.toFixed(2)} today
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-3">
                    <div className="text-base font-semibold tracking-tight text-foreground">
                      {ws.name}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground/80 truncate">
                      {ws.path}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Stat label="Runs 7d" value={ws.runs7d.toString()} />
                    <Stat
                      label="Memory"
                      value={ws.memoryFreshness > 0 ? `${ws.memoryFreshness}%` : "—"}
                      warn={ws.memoryFreshness > 0 && ws.memoryFreshness < 50}
                    />
                    <Stat label="Last" value={ws.lastRun} />
                  </div>

                  {ws.activeSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {ws.activeSkills.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] rounded-md border border-border bg-background px-1.5 py-0.5 text-muted-foreground truncate max-w-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-3">
                    <span>
                      {ws.activeSkills.length} skills · {ws.recentOutputs.length} outputs
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${warn ? "text-amber-500" : ""}`}>
        {value}
      </div>
    </div>
  );
}

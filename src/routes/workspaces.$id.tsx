import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  workspaces as sampleWorkspaces,
  runs as sampleRuns,
  outputs as sampleOutputs,
  type Workspace,
} from "@/lib/mock-data";
import { ArrowLeft, AlertTriangle, FileText, Sparkles, Activity, FileOutput } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";

function buildLiveWorkspaces(ld: any): Workspace[] {
  const projects = ld?.recentProjects;
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
      summary:
        "Per-workspace details aren't surfaced by the aggregator yet — only the high-level project signal is available.",
      memoryFiles: [],
      sessions: [],
      warnings: [],
    }),
  );
}

export const Route = createFileRoute("/workspaces/$id")({
  head: () => ({
    meta: [
      { title: "Workspace — Agentic OS" },
      { name: "description", content: "Workspace details" },
    ],
  }),
  component: WorkspaceDetail,
  notFoundComponent: () => (
    <div className="text-sm">
      Workspace not found.{" "}
      <Link to="/workspaces" className="underline">
        Back
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="text-sm text-red-500">{error.message}</div>,
});

function WorkspaceDetail() {
  const ld = useLiveData();
  const isDemoData = ld?.isExample === true;
  const allWorkspaces = buildLiveWorkspaces(ld);
  const allRuns: any[] = [];
  const allOutputs: any[] = [];
  const { id } = Route.useParams();
  const ws = allWorkspaces.find((w) => w.id === id);

  if (!ws) {
    return (
      <div className="text-sm">
        Workspace not found.{" "}
        <Link to="/workspaces" className="underline">
          Back
        </Link>
      </div>
    );
  }

  const filteredRuns = allRuns.filter((r) => r.workspace === ws.name);
  const filteredOutputs = allOutputs.filter((o) => o.workspace === ws.name);

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
        <span>Workspace</span>
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
      <Link
        to="/workspaces"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> All workspaces
      </Link>
      <PageHeader
        title={ws.name}
        description={ws.path}
        actions={<StatusPill status={ws.claudeMdStatus} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Memory freshness" value={`${ws.memoryFreshness}%`} />
        <Card label="Last run" value={ws.lastRun} />
        <Card label="Runs (7d)" value={ws.runs7d.toString()} />
        <Card label="Usage today" value={`$${ws.usageToday.toFixed(2)}`} />
      </div>

      {ws.warnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-medium mb-2">
            <AlertTriangle className="h-4 w-4" /> Open issues
          </div>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-5">
            {ws.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Memory files" icon={FileText}>
          <ul className="divide-y divide-border">
            {ws.memoryFiles.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No memory files.</li>
            ) : (
              ws.memoryFiles.map((m) => (
                <li key={m.name} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono">{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.size} · {m.updated}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Active skills" icon={Sparkles}>
          <ul className="divide-y divide-border">
            {ws.activeSkills.map((s) => (
              <li key={s} className="px-3 py-2 text-xs flex justify-between items-center">
                <span>{s}</span>
                <StatusPill status="active" />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent files changed" icon={FileText}>
          <ul className="divide-y divide-border">
            {ws.recentFiles.map((f) => (
              <li key={f.name} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-mono truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">{f.changed}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent sessions" icon={Activity}>
          <ul className="divide-y divide-border">
            {filteredRuns.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No sessions yet.</li>
            ) : (
              filteredRuns.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono">{r.id}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {r.duration} <StatusPill status={r.status} />
                  </span>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Generated outputs" icon={FileOutput}>
          <ul className="divide-y divide-border">
            {filteredOutputs.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No outputs.</li>
            ) : (
              filteredOutputs.map((o) => (
                <li key={o.name} className="px-3 py-2 text-xs">
                  <div className="font-medium truncate">{o.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {o.size} · {o.updated}
                  </div>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Summary">
          <p className="p-3 text-xs text-muted-foreground leading-relaxed">{ws.summary}</p>
        </Section>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />} {title}
      </div>
      {children}
    </div>
  );
}

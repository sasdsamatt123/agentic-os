import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Terminal,
  GitBranch,
  Globe,
  FileEdit,
  Search,
  FileText,
  FileCode,
  FileBarChart,
  FileImage,
  File,
} from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { ModelStrip, ModelLogo, MODELS, type ModelKey } from "@/components/model-logos";
import { useLiveData } from "@/lib/use-live-data";

let ld: any = {};
let isDemoData = true;

// Aggregator (scripts/aggregate.ts) emits per-session runs[] + per-file
// outputs[] in live-data.json. Each run has tools[], tokens, cost,
// duration and a first-prompt summary; each output has the file path
// it touched plus a reference back to its parent run.
let runs: any[] = [];
let outputs: any[] = [];

const MODEL_KEYS: ModelKey[] = ["claude", "openai", "gemini", "llama", "deepseek"];
function modelForRun(modelOrId: string | undefined): ModelKey {
  if (!modelOrId) return "claude";
  const s = modelOrId.toLowerCase();
  if (s.includes("claude")) return "claude";
  if (s.includes("gpt") || s.startsWith("o1") || s.startsWith("o3") || s.includes("openai"))
    return "openai";
  if (s.includes("gemini") || s.includes("google")) return "gemini";
  if (s.includes("llama")) return "llama";
  if (s.includes("deepseek")) return "deepseek";
  return "claude";
}

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Agentic OS" },
      { name: "description", content: "Claude Code sessions and the outputs they produced." },
    ],
  }),
  component: ActivityPage,
});

const toolIcons: Record<string, any> = {
  shell: Terminal,
  git: GitBranch,
  browser: Globe,
  "file edit": FileEdit,
  search: Search,
};

const typeIcons: Record<string, any> = {
  research: FileText,
  review: FileText,
  page: FileCode,
  report: FileBarChart,
  summary: FileText,
  outline: FileText,
  audit: FileBarChart,
  data: FileImage,
};

function ActivityPage() {
  ld = useLiveData();
  isDemoData = ld?.isExample === true;
  const allRuns: any[] = Array.isArray(ld?.runs) ? ld.runs : [];
  const allOutputs: any[] = Array.isArray(ld?.outputs) ? ld.outputs : [];
  const [tab, setTab] = useState<"runs" | "outputs">("runs");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  // Group runs by workspace — answers the "where is my time/money actually going?"
  // question that a flat session table can't.
  const workspaceSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        workspace: string;
        runCount: number;
        totalCost: number;
        totalMessages: number;
        totalTokens: number;
        lastStartedMs: number;
      }
    >();
    for (const r of allRuns) {
      const k = r.workspace || r.projKey || "unknown";
      let m = map.get(k);
      if (!m) {
        m = {
          workspace: k,
          runCount: 0,
          totalCost: 0,
          totalMessages: 0,
          totalTokens: 0,
          lastStartedMs: 0,
        };
        map.set(k, m);
      }
      m.runCount++;
      m.totalCost += Number(r.cost) || 0;
      m.totalMessages += Number(r.messages) || 0;
      m.totalTokens += Number(r.tokens) || 0;
      m.lastStartedMs = Math.max(m.lastStartedMs, Number(r.startedMs) || 0);
    }
    // Sort by total cost descending — operator's first question is "where
    // is my money actually going?", not "what did I touch most recently".
    // Recency is communicated via the per-tile "last activity Xd ago" line.
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [allRuns]);

  const totalCost = useMemo(
    () => workspaceSummary.reduce((s, w) => s + w.totalCost, 0),
    [workspaceSummary],
  );

  // Apply filter to module-level vars so the child views pick them up.
  runs = selectedWorkspace
    ? allRuns.filter((r: any) => (r.workspace || r.projKey) === selectedWorkspace)
    : allRuns;
  outputs = selectedWorkspace
    ? allOutputs.filter((o: any) => o.workspace === selectedWorkspace)
    : allOutputs;

  return (
    <div className="max-w-[1400px]">
      <header className="border-b border-border pb-8 mb-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
          <span>Activity</span>
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
          {selectedWorkspace && (
            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground/85">
              · filtered by{" "}
              <code className="font-mono text-foreground/85">{selectedWorkspace}</code>
              <button
                onClick={() => setSelectedWorkspace(null)}
                className="text-muted-foreground/60 hover:text-foreground"
                title="Clear filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          {runs.length} <span className="text-muted-foreground/60 font-normal">runs · </span>
          {outputs.length} <span className="text-muted-foreground/60 font-normal">outputs</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {selectedWorkspace
            ? `Sessions and outputs scoped to ${selectedWorkspace}.`
            : "Every Claude Code session and the artefact it produced."}
        </p>
      </header>

      {/* Workspace strip — horizontal scroll of all workspaces, click to filter. */}
      {workspaceSummary.length > 1 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Workspaces
            </div>
            <div className="text-[10.5px] text-muted-foreground/70 tabular-nums">
              {workspaceSummary.length} · {allRuns.length} runs · ${totalCost.toFixed(0)}
            </div>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
            <WorkspaceTile
              label="All workspaces"
              fullPath=""
              runCount={allRuns.length}
              totalCost={totalCost}
              totalMessages={workspaceSummary.reduce((s, w) => s + w.totalMessages, 0)}
              lastStartedMs={Math.max(0, ...workspaceSummary.map((w) => w.lastStartedMs))}
              selected={!selectedWorkspace}
              onClick={() => setSelectedWorkspace(null)}
              isAll
            />
            {workspaceSummary.map((w) => (
              <WorkspaceTile
                key={w.workspace}
                label={shortLabel(w.workspace)}
                fullPath={w.workspace}
                runCount={w.runCount}
                totalCost={w.totalCost}
                totalMessages={w.totalMessages}
                lastStartedMs={w.lastStartedMs}
                selected={selectedWorkspace === w.workspace}
                onClick={() =>
                  setSelectedWorkspace(
                    w.workspace === selectedWorkspace ? null : w.workspace,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {(["runs", "outputs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}{" "}
            <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
              {t === "runs" ? runs.length : outputs.length}
            </span>
          </button>
        ))}
      </div>

      {runs.length === 0 && outputs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-[13px] text-muted-foreground">
          {selectedWorkspace
            ? `No runs found for ${selectedWorkspace}.`
            : "Per-run logs aren't surfaced by the aggregator yet — runs and outputs will appear here once scripts/aggregate.ts emits per-session records."}
        </div>
      ) : tab === "runs" ? (
        <RunsView />
      ) : (
        <OutputsView />
      )}
    </div>
  );
}

function shortLabel(workspace: string): string {
  if (!workspace || workspace === "unknown") return workspace || "unknown";
  // Worktree paths — surface as "<base> · wt:<branch>"
  const wt = workspace.match(/^(.+?)\/+claude\/worktrees\/(.+)$/);
  if (wt) {
    const base = wt[1].replace(/^\/(Downloads|code|Users)\//, "").replace(/^\//, "");
    return `${base} · wt:${wt[2]}`;
  }
  // Strip common parent directories — they carry no information.
  return workspace.replace(/^\/(Downloads|code|Users)\//, "").replace(/^\//, "");
}

function humanAgoShort(ms: number): string {
  if (!ms || ms < 0) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function WorkspaceTile({
  label,
  fullPath,
  runCount,
  totalCost,
  totalMessages,
  lastStartedMs,
  selected,
  onClick,
  isAll,
}: {
  label: string;
  fullPath: string;
  runCount: number;
  totalCost: number;
  totalMessages: number;
  lastStartedMs: number;
  selected: boolean;
  onClick: () => void;
  isAll?: boolean;
}) {
  const ago = isAll
    ? ""
    : lastStartedMs
      ? `${humanAgoShort(Date.now() - lastStartedMs)} ago`
      : "—";

  return (
    <button
      onClick={onClick}
      title={fullPath || label}
      className={`shrink-0 w-[244px] snap-start rounded-lg border p-3.5 text-left transition-all ${
        selected
          ? "border-[oklch(0.74_0.085_70_/_60%)] bg-[oklch(0.74_0.085_70_/_8%)]"
          : "border-border bg-card/30 hover:border-foreground/30 hover:bg-card/60"
      }`}
      style={
        selected
          ? {
              boxShadow:
                "inset 0 1px 0 oklch(1 0 0 / 4%), 0 0 24px -8px oklch(0.74 0.085 70 / 25%)",
            }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-[12.5px] font-semibold tracking-tight truncate min-w-0">{label}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums shrink-0 font-mono">
          {runCount} {runCount === 1 ? "run" : "runs"}
        </div>
      </div>
      <div className="flex items-baseline gap-3 text-[12px] text-muted-foreground font-mono tabular-nums">
        <span className="text-foreground/85">${totalCost.toFixed(0)}</span>
        <span>{totalMessages.toLocaleString()} msg</span>
      </div>
      <div className="text-[10.5px] text-muted-foreground/70 mt-1 tabular-nums">
        {isAll ? "across all your work" : `last activity ${ago}`}
      </div>
    </button>
  );
}

function RunsView() {
  // Aggregate per-model usage from runs
  const totals = MODEL_KEYS.reduce<Record<ModelKey, { runs: number; tokens: number }>>(
    (acc, k) => ({ ...acc, [k]: { runs: 0, tokens: 0 } }),
    {} as Record<ModelKey, { runs: number; tokens: number }>,
  );
  runs.forEach((r) => {
    const k = modelForRun(r.model);
    totals[k].runs += 1;
    totals[k].tokens += r.tokens;
  });
  const totalRuns = runs.length || 1;
  const usage = MODEL_KEYS.reduce(
    (acc, k) => ({
      ...acc,
      [k]: {
        runs: totals[k].runs,
        share: Math.round((totals[k].runs / totalRuns) * 100),
        tokens: totals[k].tokens,
      },
    }),
    {} as Record<ModelKey, { runs: number; share: number; tokens: number }>,
  );

  return (
    <>
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Models
            </div>
            <div className="text-base font-semibold tracking-tight">
              Run distribution by provider
            </div>
          </div>
        </div>
        <ModelStrip usage={usage} />
      </section>

      <div className="rounded-xl border border-border bg-card overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Run</th>
              <th className="text-left font-medium px-4 py-3">Model</th>
              <th className="text-left font-medium px-4 py-3">Workspace</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Skill</th>
              <th className="text-left font-medium px-4 py-3">Started</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Duration</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Tools</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Tokens</th>
              <th className="text-right font-medium px-4 py-3">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((r) => {
              const mk = modelForRun(r.model);
              const m = MODELS[mk];
              return (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1">
                      <ModelLogo model={mk} size={12} />
                      <span className="text-[11px]">{m.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.workspace}</td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">{r.skill}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.started}</td>
                  <td className="px-4 py-3 text-xs tabular-nums hidden lg:table-cell">
                    {r.duration}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1">
                      {r.tools.map((t) => {
                        const I = toolIcons[t] ?? Terminal;
                        return (
                          <span
                            key={t}
                            title={t}
                            className="rounded border border-border bg-background p-1"
                          >
                            <I className="h-3 w-3 text-muted-foreground" />
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-right tabular-nums hidden md:table-cell">
                    {r.tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-right tabular-nums">
                    ${r.cost.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold mb-3">Timeline</h2>
      <div className="space-y-2">
        {runs.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
          >
            <div className="mt-1.5 h-2 w-2 rounded-full bg-foreground/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs">{r.id}</span>
                <StatusPill status={r.status} />
                <span className="text-xs text-muted-foreground">
                  {r.workspace} · {r.skill}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {r.started} · {r.duration}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function OutputsView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {outputs.map((o) => {
        const I = typeIcons[o.type] ?? File;
        return (
          <div
            key={o.name}
            className="rounded-lg border border-border bg-card p-4 hover:border-foreground/30"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-md border border-border bg-background p-2">
                <I className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{o.name}</div>
                <div className="text-[11px] text-muted-foreground capitalize">
                  {o.type} · {o.size}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Meta label="Workspace" value={o.workspace} />
              <Meta label="Skill" value={o.skill} />
              <Meta label="Run" value={o.run} mono />
              <Meta label="Updated" value={o.updated} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

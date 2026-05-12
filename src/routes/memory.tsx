import { createFileRoute } from "@tanstack/react-router";
import {
  memorySignals,
  memorySources,
  memoryEvents,
  memoryStats,
  workspaces,
  type MemorySource,
} from "@/lib/mock-data";
import { useLiveData } from "@/lib/use-live-data";
import { lazy, Suspense, useMemo, useState } from "react";
import { FileText, AlertTriangle, RefreshCw, X, Pencil, Cloud, Search } from "lucide-react";
import type { MemNode } from "@/components/memory-graph-3d";
import { MemoryGraphLoader } from "@/components/memory-graph-loader";
import claudeLogoPng from "@/assets/claude-logo.png";
import obsidianLogoSvg from "@/assets/logos/obsidian.svg";
import pineconeIconSvg from "@/assets/logos/pinecone-icon.svg";

const MemoryGraph3D = lazy(() => import("@/components/memory-graph-3d"));

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Agentic OS" },
      {
        name: "description",
        content: "Interactive 3D map of CLAUDE.md files, decisions, and shared memory.",
      },
    ],
  }),
  component: MemoryPage,
});

const ACCENT = "oklch(0.72 0.17 155)";

const BASE_SOURCES = ["obsidian", "claude"] as const;
const PINECONE_SOURCES = ["obsidian", "claude", "pinecone"] as const;
type SourceId = "obsidian" | "claude" | "pinecone";

function MemoryPage() {
  const [selected, setSelected] = useState<MemNode | null>(null);
  const liveData = useLiveData();
  const ld = liveData as any;
  const hasPinecone = (ld?.memory?.stats?.pineconeIndexes ?? 0) > 0 || ld?.detection?.memoryStores?.pinecone?.hasKey === true;
  const ALL_SOURCES = hasPinecone ? PINECONE_SOURCES : BASE_SOURCES;
  // Multi-select set. Empty set = nothing selected (graph empty).
  // All three present = "All" (everything visible).
  const [activeSet, setActiveSet] = useState<Set<SourceId>>(() => new Set<SourceId>(ALL_SOURCES));
  const isDemo = ld?.isExample === true;
  // Prefer the aggregator's totals; fall back to a sum of mock workspaces so
  // a cold-start clone (live-data.example.json) still renders a meaningful
  // header instead of "0 files indexed".
  const totalFiles =
    Number.isFinite(ld?.memory?.stats?.totalFiles) && ld.memory.stats.totalFiles > 0
      ? ld.memory.stats.totalFiles
      : workspaces.reduce((a, w) => a + w.memoryFiles.length, 0);
  const totalWorkspaces =
    Number.isFinite(ld?.memory?.stats?.totalWorkspaces) && ld.memory.stats.totalWorkspaces > 0
      ? ld.memory.stats.totalWorkspaces
      : workspaces.length;
  const vectorIndexCount = Number.isFinite(ld?.memory?.stats?.pineconeIndexes)
    ? ld.memory.stats.pineconeIndexes
    : memorySources.filter((s) => s.kind === "vector").length;

  const allOn = ALL_SOURCES.every((s) => activeSet.has(s));
  // Pass a single id to the graph: if all three are selected we send "all"
  // (no filter), otherwise we union the matching nodes.
  const matchesActive = (sourceTag: string | undefined, kind?: string) => {
    if (allOn) return true;
    if (activeSet.size === 0) return false;
    if (kind === "vector_store" && activeSet.has("pinecone")) return true;
    if (sourceTag === "pinecone" && activeSet.has("pinecone")) return true;
    if (sourceTag === "obsidian" && activeSet.has("obsidian")) return true;
    if (sourceTag === "claude" && activeSet.has("claude")) return true;
    return false;
  };

  const toggleSource = (id: SourceId | "all") => {
    setActiveSet((prev) => {
      if (id === "all") {
        // Clicking "All" snaps to everything on (or back to everything if it
        // was already all on — same end state, idempotent).
        return new Set(ALL_SOURCES);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The graph still wants a single string. We compose one based on the set:
  // - all 3 → "all"
  // - 1 → that id
  // - 0 or 2 → use a synthetic id and rely on the graph's union via matchesActive
  const graphFilter = (() => {
    if (allOn) return "all";
    if (activeSet.size === 1) return [...activeSet][0];
    return `multi:${[...activeSet].sort().join(",")}`;
  })();

  // Use real aggregator events when available, else fall back to the mock
  // event feed shipped with the example file.
  const sourceEvents: typeof memoryEvents =
    Array.isArray(ld?.memory?.events) && ld.memory.events.length > 0
      ? ld.memory.events
      : memoryEvents;

  const visibleEvents = useMemo(() => {
    if (allOn) return sourceEvents;
    const filtered = sourceEvents.filter((e: any) => matchesActive(e.source));
    return filtered.length ? filtered : sourceEvents;
  }, [activeSet, sourceEvents]);

  // Stale + missing — prefer aggregator output.
  const staleList: { name: string; updated: string }[] =
    Array.isArray(ld?.memory?.staleFiles) && ld.memory.staleFiles.length > 0
      ? ld.memory.staleFiles.map((f: any) => ({ name: f.name, updated: f.updated ?? "—" }))
      : memorySignals.stale;
  const missingList: string[] =
    Array.isArray(ld?.memory?.missing) && ld.memory.missing.length > 0
      ? ld.memory.missing
      : memorySignals.missing;
  // Conflicts aren't yet emitted by the aggregator — show only mock data
  // when we're running off the example file.
  const conflictsList = isDemo ? memorySignals.conflicts : [];

  // Recompute stat counts based on filter — driven by live data so toggling
  // actually changes what's shown below the graph. Aggregator stats are the
  // source of truth; mock fallbacks are only used in demo mode.
  const tiles = useMemo(() => {
    const memNodes = liveData?.memory?.nodes ?? [];
    const stats = liveData?.memory?.stats ?? {};
    const liveActive = Number.isFinite(stats?.activeLast7d)
      ? stats.activeLast7d
      : isDemo
        ? memoryStats.activeLast7d
        : 0;
    const liveActivated = Number.isFinite(stats?.activatedLast7d)
      ? stats.activatedLast7d
      : isDemo
        ? memoryStats.activatedLast7d
        : 0;
    const liveMissing = Number.isFinite(stats?.missing)
      ? stats.missing
      : isDemo
        ? memoryStats.missing
        : 0;

    if (allOn) {
      return {
        active: liveActive,
        activated: liveActivated,
        sources: 3,
        missing: liveMissing,
      };
    }

    const filtered = memNodes.filter((n: any) => matchesActive(n.source, n.kind));
    const fileCount = filtered.filter(
      (n: any) => n.kind === "file" || n.kind === "vector_store",
    ).length;
    const events = sourceEvents.filter((e: any) => matchesActive(e.source));
    const recallHits = events
      .filter((e: any) => e.type === "recall")
      .reduce((a: number, e: any) => a + (e.meta?.hits ?? 1), 0);

    const onlyPinecone = activeSet.size === 1 && activeSet.has("pinecone");
    if (onlyPinecone) {
      return {
        active: stats.pineconeIndexes ?? fileCount,
        activated: recallHits || 0,
        sources: stats.pineconeIndexes ?? 1,
        missing: 0,
      };
    }
    return {
      active: Math.max(0, fileCount),
      activated:
        recallHits || (isDemo ? Math.max(1, Math.round(memoryStats.activatedLast7d / 3)) : 0),
      sources: activeSet.size,
      missing: activeSet.has("claude") ? liveMissing : 0,
    };
  }, [activeSet, sourceEvents, isDemo]);

  return (
    <div className="max-w-[1400px]">
      <header className="flex items-end justify-between border-b border-border pb-9 mb-7">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3 inline-flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "#3ddc97",
                boxShadow: "0 0 8px rgba(61, 220, 151, 0.7)",
              }}
            />
            <span>Memory graph</span>
            {isDemo && (
              <span
                title="Sample data shipped with this repo. Run `bun run scripts/aggregate.ts` to populate with your real ~/.claude/ + Obsidian + Pinecone activity."
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
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            <span className="tabular-nums">{totalFiles}</span>{" "}
            <span className="text-muted-foreground/55 font-normal">files indexed</span>
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Drag to rotate. Hover a node to trace its links. Click to inspect. The map clusters by
            workspace, then connects shared decisions and skills across them — your AI brain made
            visible.
          </p>
        </div>
      </header>

      {/* Source filter pills */}
      <SourceFilter activeSet={activeSet} allOn={allOn} onToggle={toggleSource} />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border mb-8">
        <Tile
          label="Active"
          value={tiles.active}
          tooltip="Files you've worked on this week — your live working memory."
        />
        <Tile
          label="Activated"
          value={tiles.activated}
          tooltip="How often your memories have been pulled into a session. The most-activated memories are the ones doing real work."
        />
        <Tile
          label="Memory sources"
          value={tiles.sources}
          tooltip="Memory sources feeding this view. Toggle them above."
        />
        <Tile
          label="Missing"
          value={tiles.missing}
          tone="red"
          tooltip="Folders without an index — uncatalogued areas of your knowledge."
        />
      </div>

      <section className="rounded-xl border border-border bg-card overflow-hidden mb-10 relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Memory graph · 3D
            </div>
            <div className="text-base font-semibold tracking-tight">
              {totalWorkspaces} workspaces · {totalFiles} memory files · {vectorIndexCount} vector
              indexes
            </div>
          </div>
          <Legend />
        </div>

        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(61,220,151,0.18) 0%, rgba(0,0,0,0.95) 55%, #000 100%), #000",
            boxShadow: "inset 0 0 160px rgba(61,220,151,0.08)",
          }}
        >
          <Suspense fallback={<MemoryGraphLoader height={640} />}>
            <MemoryGraph3D onSelect={setSelected} sourceFilter={graphFilter} />
          </Suspense>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
        <Panel title="Recent activity" tone="ok" wide>
          {visibleEvents.slice(0, 8).map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </Panel>
        <Panel title="Stale" tone="warn">
          {staleList.map((m) => (
            <Row key={m.name} left={m.name} right={m.updated} tone="amber" />
          ))}
        </Panel>
        <Panel title="Missing" tone="danger">
          {missingList.map((m) => (
            <Row key={m} left={m} right="missing" tone="red" />
          ))}
          {conflictsList.map((c) => (
            <Row key={c} left={c} right="conflict" tone="red" />
          ))}
        </Panel>
      </div>

      {selected && <Inspector node={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SourceFilter({
  activeSet,
  allOn,
  onToggle,
}: {
  activeSet: Set<SourceId>;
  allOn: boolean;
  onToggle: (id: SourceId | "all") => void;
}) {
  const liveData = useLiveData();
  const pineconeCount = liveData?.memory?.stats?.pineconeIndexes ?? 0;
  type Pill = {
    id: SourceId | "all";
    label: string;
    sub?: string;
    logo?: string;
    /** Render the icon as a white silhouette via mask-image (use for monochrome SVGs) */
    mask?: boolean;
    color: string;
    tooltip: string;
  };
  const pills: Pill[] = [
    { id: "all", label: "All", color: "#9aa3b0", tooltip: "Show every memory layer" },
    {
      id: "obsidian",
      label: "Obsidian",
      logo: obsidianLogoSvg,
      color: "#7c3aed",
      tooltip: "Markdown notes from your Obsidian vault",
    },
    {
      id: "claude",
      label: "Local Claude",
      logo: claudeLogoPng,
      color: "#C19A6B",
      tooltip: "MEMORY.md, CLAUDE.md and decisions across your workspaces",
    },
    ...(liveData?.memory?.stats?.pineconeIndexes > 0 || liveData?.detection?.memoryStores?.pinecone?.hasKey
      ? [{
          id: "pinecone" as const,
          label: "Pinecone",
          sub: pineconeCount ? `${pineconeCount} indexes` : undefined,
          logo: pineconeIconSvg,
          mask: true,
          color: "#22D3EE",
          tooltip: "Vector indexes — every Pinecone collection feeds this memory source",
        }]
      : []),
  ];

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {pills.map((p) => {
        const isActive = p.id === "all" ? allOn : activeSet.has(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            title={p.tooltip}
            className={`group inline-flex items-center gap-2 rounded-full border pl-1 pr-3.5 py-1 text-xs transition-all ${
              isActive
                ? "border-foreground/40 bg-foreground/[0.08] text-foreground shadow-sm"
                : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
            style={
              isActive
                ? { boxShadow: `0 0 0 1px ${p.color}66, 0 6px 18px -10px ${p.color}` }
                : undefined
            }
          >
            <span
              className="h-6 w-6 rounded-full grid place-items-center shrink-0"
              style={{
                background: `${p.color}1f`,
                boxShadow: `inset 0 0 0 1px ${p.color}55`,
              }}
            >
              {p.id === "all" ? (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              ) : p.mask && p.logo ? (
                <span
                  aria-hidden
                  className="h-3.5 w-3.5"
                  style={{
                    background: p.color,
                    WebkitMaskImage: `url(${p.logo})`,
                    maskImage: `url(${p.logo})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
              ) : (
                <img src={p.logo} alt="" className="h-3.5 w-3.5 object-contain" loading="lazy" />
              )}
            </span>
            <span className="font-medium">{p.label}</span>
            {p.sub && (
              <span className="text-[10px] tabular-nums text-muted-foreground/80">{p.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string;
  value: number | string;
  tone?: "red";
  tooltip: string;
}) {
  const c = tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="bg-card px-5 py-4" title={tooltip}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${c}`}>{value}</div>
    </div>
  );
}

function EventRow({ event: e }: { event: (typeof memoryEvents)[number] }) {
  const Icon = e.type === "edit" ? Pencil : e.type === "vectorize" ? Cloud : Search;
  const color = e.type === "edit" ? "#3ddc97" : e.type === "vectorize" ? "#4A9EFF" : "#fbbf24";
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs hover:bg-foreground/[0.03] transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">
          {e.type}
        </span>
        <span className="font-mono text-foreground/90 truncate">
          {e.target}
          {e.destination && <span className="text-muted-foreground"> → {e.destination}</span>}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {e.time}
        {e.meta?.hits ? ` · ${e.meta.hits} hits` : ""}
      </span>
    </li>
  );
}

function Inspector({ node, onClose }: { node: MemNode; onClose: () => void }) {
  const ws = node.workspaceId ? workspaces.find((w) => w.id === node.workspaceId) : null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border border-border bg-card shadow-2xl m-0 md:m-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              {node.kind === "hub"
                ? "Shared core"
                : node.kind === "workspace"
                  ? "Workspace memory"
                  : node.kind === "vector_store"
                    ? "Pinecone index"
                    : node.kind === "file"
                      ? "Note"
                      : node.kind}
            </div>
            <div className="text-base font-semibold tracking-tight">{node.name}</div>
            {node.kind === "workspace" && ws && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {ws.memoryFiles.length} notes · last edited {node.updated ?? "—"}
              </div>
            )}
            {node.kind === "file" && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {node.size ?? "—"} · last edited {node.updated ?? "—"}
              </div>
            )}
            {node.kind === "vector_store" && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {node.vectorCount?.toLocaleString() ?? "—"} vectors ·{" "}
                {Array.isArray(node.namespaces) ? node.namespaces.length : (node.namespaces ?? "—")}{" "}
                namespaces
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {node.kind === "file" && node.preview && (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
              Preview
            </div>
            <p className="text-sm italic text-foreground/80 leading-relaxed">"{node.preview}"</p>
          </div>
        )}

        {node.kind === "vector_store" && (
          <div className="p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Index details
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Embedding</span>
                <span className="font-mono text-foreground/90">
                  Pinecone · {node.dimension ?? 1024}-dim cosine
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Namespaces</span>
                <span className="tabular-nums">{Array.isArray(node.namespaces) ? node.namespaces.length : (node.namespaces ?? "—")}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Total vectors</span>
                <span className="tabular-nums">{node.vectorCount?.toLocaleString() ?? "—"}</span>
              </li>
            </ul>
            {Array.isArray(node.namespaces) && node.namespaces.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Namespace breakdown</div>
                <ul className="space-y-1">
                  {node.namespaces.map((ns: any) => (
                    <li key={ns.name} className="flex justify-between text-xs">
                      <span className="font-mono text-foreground/90">{ns.name}</span>
                      <span className="tabular-nums text-muted-foreground">{ns.vectorCount?.toLocaleString?.()} vectors</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {ws && node.kind === "workspace" && (
          <div className="p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Notes
            </div>
            <ul className="space-y-1.5">
              {ws.memoryFiles.map((f) => (
                <li key={f.name} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-foreground/90">{f.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {f.size} · {f.updated}
                  </span>
                </li>
              ))}
            </ul>
            {node.status === "missing" && (
              <div className="pt-2 border-t border-border text-xs text-amber-500">
                Suggested: add a MEMORY.md to make this workspace discoverable.
              </div>
            )}
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              Path: <span className="font-mono text-foreground/80">{ws.path}</span>
            </div>
          </div>
        )}

        {node.kind === "hub" && (
          <div className="p-5 text-sm text-muted-foreground">
            The shared index aggregates CLAUDE.md, decisions, and session summaries across{" "}
            {workspaces.length} workspaces and{" "}
            {memorySources.filter((s) => s.kind === "vector").length} Pinecone indexes.
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> Core
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/70" /> Workspace
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#4A9EFF" }} /> Vector index
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Stale
      </span>
    </div>
  );
}

function Panel({
  title,
  children,
  tone,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
  wide?: boolean;
}) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "danger" ? FileText : RefreshCw;
  const c =
    tone === "warn"
      ? "text-amber-500"
      : tone === "danger"
        ? "text-red-500"
        : "text-muted-foreground";
  return (
    <div className={`bg-card ${wide ? "md:col-span-1" : ""}`}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Icon className={`h-4 w-4 ${c}`} />
        <div className="text-sm font-semibold tracking-tight">{title}</div>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function Row({ left, right, tone }: { left: string; right?: string; tone?: "amber" | "red" }) {
  const c =
    tone === "amber" ? "text-amber-500" : tone === "red" ? "text-red-500" : "text-muted-foreground";
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
      <span className="font-mono text-foreground/90 truncate">{left}</span>
      {right && (
        <span className={`text-[10px] uppercase tracking-wider shrink-0 ${c}`}>{right}</span>
      )}
    </li>
  );
}

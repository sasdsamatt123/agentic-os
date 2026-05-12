import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { workspaces as sampleWorkspaces, type Workspace } from "@/lib/mock-data";
import {
  Folder,
  FileText,
  GitBranch,
  Sparkles,
  Database,
  Archive,
  Lock,
  Wand2,
  ArrowRight,
} from "lucide-react";
import claudeLogo from "@/assets/claude-logo.png";
import { useLiveData } from "@/lib/use-live-data";

let ld: any = {};
let isDemoData = true;

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

let workspaces: Workspace[] = [];
let integrations: any[] = [];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Agentic OS" },
      {
        name: "description",
        content:
          "Read-only configuration for Claude Code workspace folders, skills, memory and integrations.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  ld = useLiveData();
  isDemoData = ld?.isExample === true;
  workspaces = buildWorkspacesFromLive();
  integrations = Array.isArray(ld?.integrations) ? ld.integrations : [];
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
        <span>Settings</span>
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
      <PageHeader
        title="Settings"
        description="Read-only sources. Editing happens in your shell, not here."
        actions={
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> read-only
          </span>
        }
      />

      <Link
        to="/setup"
        className="group flex items-center justify-between rounded-xl border border-border bg-card hover:border-foreground/30 transition-all p-4 mb-6 relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 0% 0%, rgba(255,138,61,0.12), transparent 60%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 grid place-items-center shrink-0">
            <img src={claudeLogo} alt="" width={32} height={32} className="drop-shadow" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Re-run setup wizard</div>
            <div className="text-xs text-muted-foreground">
              Re-detect tools, change paths, adjust Dream cadence and time value.
            </div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Group title="Workspace folders" icon={Folder}>
          {workspaces.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No workspaces detected. Re-run the aggregator.
            </div>
          ) : (
            workspaces.map((w) => <Row key={w.id} label={w.name} value={w.path} />)
          )}
        </Group>

        <Group title="Skills folders" icon={Sparkles}>
          {/* TODO: aggregator doesn't yet emit per-workspace skills folders.
              Once it does, replace this with a real list. */}
          <Row label="Global skills" value="~/.claude/skills" />
          {workspaces.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Per-workspace skills folders will appear here once the aggregator surfaces them.
            </div>
          )}
        </Group>

        <Group title="CLAUDE.md scan paths" icon={FileText}>
          {/* TODO: derive from ~/.claude-os/config.json once the wizard writes it. */}
          <Row label="Root scan" value="~/code" />
          <Row label="Depth" value="2 levels" />
          <Row label="Ignore" value="node_modules, .next, dist" />
        </Group>

        <Group title="Output folders" icon={Archive}>
          {/* TODO: derive from ~/.claude-os/config.json. */}
          <Row label="Default outputs" value="~/code/<workspace>/outputs" />
          <Row label="Shared exports" value="~/Documents/claude-exports" />
        </Group>

        <Group title="Memory folders" icon={Database}>
          <Row label="Local working memory" value="<workspace>/CLAUDE.md, decisions.md, todo.md" />
          <Row label="Wraps & summaries" value="~/code/memory-os/wraps" />
          <Row label="Archive (planned)" value="Pinecone · Obsidian" />
        </Group>

        <Group title="Git repositories" icon={GitBranch}>
          {workspaces.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">No git repos detected.</div>
          ) : (
            workspaces
              .slice(0, 6)
              .map((w) => <Row key={w.id} label={w.name} value={`${w.path}/.git`} />)
          )}
        </Group>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Integrations</div>
        <div className="divide-y divide-border">
          {integrations.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No integrations detected. Re-run the aggregator after signing in to Pinecone,
              Obsidian, or other tools.
            </div>
          ) : (
            integrations.map((it: any) => (
              <Integration
                key={it.name}
                name={it.name}
                desc={it.tagline ?? "connected"}
                status={it.connected ? "active" : "missing"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono truncate">{value}</span>
    </div>
  );
}

function Integration({ name, desc, status }: { name: string; desc: string; status: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <StatusPill status={status} />
    </div>
  );
}

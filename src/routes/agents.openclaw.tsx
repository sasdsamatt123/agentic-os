import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  GitBranch,
  Bug,
  ArrowUpRight,
  Code2,
  Boxes,
  Zap,
  ShieldCheck,
  Wrench,
  FlaskConical,
  Search,
  FileSearch,
  Hammer,
} from "lucide-react";
import confetti from "canvas-confetti";
import openclawLogo from "@/assets/openclaw.png";

export const Route = createFileRoute("/agents/openclaw")({
  head: () => ({
    meta: [
      { title: "OpenClaw — Claude Code OS" },
      { name: "description", content: "OpenClaw: your autonomous coding swarm." },
    ],
  }),
  component: OpenClawPage,
});

const TONE = "#EF4444";

const OPENCLAW_PALETTE = ["#EF4444", "#DC2626", "#F87171", "#FCA5A5"];

function fireOpenClawConfetti() {
  confetti({
    particleCount: 40,
    spread: 55,
    startVelocity: 38,
    gravity: 1.1,
    ticks: 180,
    scalar: 0.85,
    origin: { x: 0.95, y: 0.08 },
    angle: 215,
    colors: OPENCLAW_PALETTE,
    disableForReducedMotion: true,
  });
}

function OpenClawPage() {
  return (
    <div className="max-w-[1400px]">
      {/* HERO */}
      <section className="relative rounded-3xl overflow-hidden border border-border mb-8">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 80% 30%, rgba(239,68,68,0.32) 0%, transparent 55%)," +
              "radial-gradient(ellipse 50% 50% at 0% 100%, rgba(180,30,30,0.20) 0%, transparent 60%)," +
              "linear-gradient(135deg, #1a0606 0%, #0a0606 100%)",
          }}
        />
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-[0.10]"
          preserveAspectRatio="none"
          viewBox="0 0 1200 400"
        >
          <defs>
            <pattern id="ogrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#EF4444" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="1200" height="400" fill="url(#ogrid)" />
        </svg>

        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-start md:items-end gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 mb-2 inline-flex items-center gap-2">
              <span>Personal Agent</span>
              <span
                title="This page is a concept preview. Stats and modes below aren't tied to anything on disk yet."
                className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
                style={{
                  background: "rgba(167, 139, 250, 0.14)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                }}
              >
                CONCEPT PREVIEW
              </span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <img
                src={openclawLogo}
                alt="OpenClaw"
                className="h-16 md:h-20 object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.45)]"
              />
            </div>
            <p className="text-base md:text-lg text-zinc-300 max-w-2xl leading-relaxed">
              Autonomous coding swarm. Spawns parallel sub-agents to refactor, review, and ship.
              Claws into your repo — never lets go.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone={TONE}>Multi-agent</Pill>
              <Pill tone={TONE}>Sandboxed</Pill>
              <Pill tone={TONE}>PR-native</Pill>
            </div>
          </div>
          <button
            onClick={fireOpenClawConfetti}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-white md:mb-1 transition-transform active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${TONE}, #b91c1c)`,
              boxShadow: `0 10px 40px -10px ${TONE}`,
            }}
          >
            Deploy swarm
          </button>
        </div>
      </section>

      {/* STAT GRID */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatTile icon={GitBranch} label="PRs · 7d" value="28" sub="22 merged" tone={TONE} />
        <StatTile icon={Code2} label="Lines shipped" value="14.2k" sub="net +9.8k" tone={TONE} />
        <StatTile icon={Bug} label="Bugs fixed" value="46" sub="auto-triaged" tone={TONE} />
        <StatTile icon={Activity} label="Avg cycle" value="11m" sub="task → PR" tone={TONE} />
      </section>

      {/* ROLES — what to deploy OpenClaw as */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-red-300/80 mb-1">
              Swarm modes
            </div>
            <h2 className="text-sm font-semibold">Deploy OpenClaw as…</h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Each mode reshapes the swarm — different sub-agents, tools, and merge policy.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Click to deploy
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Hammer,
              name: "Refactor Swarm",
              brief: "Restructure modules, kill dead code.",
              kbd: "R",
              sample: "“Split routes/ into feature folders”",
              featured: true,
              tools: ["AST", "Codemod", "Tests"],
            },
            {
              icon: ShieldCheck,
              name: "PR Reviewer",
              brief: "Line-level review with merge verdict.",
              kbd: "V",
              sample: "“Review PR #214 for regressions”",
              featured: true,
              tools: ["Diff", "Lint", "Risk"],
            },
            {
              icon: Bug,
              name: "Bug Hunter",
              brief: "Repro, bisect, patch, prove.",
              kbd: "B",
              sample: "“Hunt the flaky upload race”",
              featured: true,
              tools: ["Repro", "Bisect", "Patch"],
            },
            {
              icon: FlaskConical,
              name: "Test Writer",
              brief: "Coverage gaps → unit + e2e suites.",
              kbd: "T",
              tools: ["Vitest", "Playwright"],
            },
            {
              icon: Search,
              name: "Repo Indexer",
              brief: "Map symbols, deps, hot files.",
              kbd: "I",
              tools: ["Graph", "Symbols"],
            },
            {
              icon: Wrench,
              name: "Migration Runner",
              brief: "Framework + dep upgrades, end-to-end.",
              kbd: "M",
              tools: ["Codemod", "CI"],
            },
          ].map((r) => (
            <button
              key={r.name}
              className={`group text-left rounded-2xl border bg-card overflow-hidden relative transition-colors ${
                r.featured
                  ? "p-5 border-red-300/25 hover:border-red-300/60"
                  : "p-4 border-border hover:border-red-300/35"
              }`}
            >
              {r.featured && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${TONE}, transparent)`,
                  }}
                />
              )}

              <div className="relative flex items-start gap-3">
                <div
                  className={`rounded-xl flex items-center justify-center shrink-0 border ${r.featured ? "h-11 w-11" : "h-9 w-9"}`}
                  style={{ background: `${TONE}14`, borderColor: `${TONE}33` }}
                >
                  <r.icon className={r.featured ? "h-5 w-5" : "h-4 w-4"} style={{ color: TONE }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-semibold leading-tight ${r.featured ? "text-[14px]" : "text-[12.5px]"}`}
                      style={r.featured ? { color: "#ffe4e4" } : undefined}
                    >
                      {r.name}
                    </div>
                    {r.featured && (
                      <span
                        className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full border"
                        style={{ borderColor: `${TONE}55`, color: TONE, background: `${TONE}10` }}
                      >
                        Pinned
                      </span>
                    )}
                  </div>
                  <div
                    className={`mt-1 text-muted-foreground leading-relaxed ${r.featured ? "text-[12px]" : "text-[11px]"}`}
                  >
                    {r.brief}
                  </div>
                </div>
                <kbd className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-black/40 text-muted-foreground">
                  ⌘{r.kbd}
                </kbd>
              </div>

              <div className="relative mt-3 flex flex-wrap gap-1.5">
                {r.tools.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full border bg-black/30"
                    style={{ borderColor: `${TONE}33`, color: TONE }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {r.featured && (
                <div
                  className="relative mt-3 pt-3 border-t border-dashed"
                  style={{ borderColor: `${TONE}28` }}
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    Sample task
                  </div>
                  <div className="text-[12px] italic" style={{ color: TONE }}>
                    <span className="text-muted-foreground mr-1">›</span>
                    {r.sample}
                  </div>
                </div>
              )}

              <div className="relative mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-muted-foreground">Deploy swarm</span>
                <ArrowUpRight className="h-3 w-3" style={{ color: TONE }} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* TWO COL */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Active swarms</h2>
            <a className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <ul className="divide-y divide-border">
            {[
              {
                t: "claude-code-os/refactor",
                d: "4 sub-agents · 6m left",
                tag: "running",
                tone: "emerald",
              },
              {
                t: "data-pipeline/eval-set",
                d: "2 sub-agents · review",
                tag: "review",
                tone: "amber",
              },
              {
                t: "memory-wrap/cron-fix",
                d: "1 sub-agent · merged",
                tag: "merged",
                tone: "violet",
              },
              {
                t: "landing-v3/perf-budget",
                d: "3 sub-agents · queued",
                tag: "queued",
                tone: "muted",
              },
            ].map((r, i) => {
              const pillCls =
                r.tone === "emerald"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : r.tone === "amber"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : r.tone === "violet"
                      ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                      : "bg-muted/40 text-muted-foreground border-border";
              return (
                <li key={i} className="py-3 flex items-center gap-3">
                  <Boxes className="h-4 w-4" style={{ color: TONE }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium font-mono truncate">{r.t}</div>
                    <div className="text-[11px] text-muted-foreground">{r.d}</div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${pillCls}`}
                  >
                    {r.tag}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Sub-agent roles</h2>
          <div className="space-y-3">
            <Capability label="Reviewer" pct={88} tone={TONE} />
            <Capability label="Refactorer" pct={74} tone={TONE} />
            <Capability label="Test-writer" pct={69} tone={TONE} />
            <Capability label="Triage" pct={92} tone={TONE} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Skills bound to OpenClaw</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            "Repo Review",
            "PR Review",
            "Diff Summariser",
            "Folder Indexer",
            "Output Organizer",
            "Cost Audit",
          ].map((s) => (
            <div
              key={s}
              className="rounded-xl border border-border bg-black/30 p-3 flex items-center gap-2"
            >
              <Zap className="h-4 w-4" style={{ color: TONE }} />
              <span className="text-sm">{s}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full border bg-black/30"
      style={{ borderColor: `${tone}55`, color: tone }}
    >
      {children}
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden"
      style={{ backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${tone}1f, transparent 60%)` }}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50"
        style={{ background: tone }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
          {label}
        </div>
        <div
          className="mt-2 text-3xl font-semibold tabular-nums"
          style={{ color: tone, textShadow: `0 0 18px ${tone}33` }}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function Capability({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tone}, ${tone}88)` }}
        />
      </div>
    </div>
  );
}

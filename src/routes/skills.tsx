import { createFileRoute } from "@tanstack/react-router";
import { skills as sampleSkills, skillCategories } from "@/lib/mock-data";
import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Search,
  Code2,
  Eye,
  Brain,
  Video,
  Palette,
  Cog,
  BarChart3,
  Clock,
  DollarSign,
  RotateCcw,
} from "lucide-react";
import skillsHero from "@/assets/skills/skills-hero.png";
import { useTimeSaved, runsIn, formatHours, type Period } from "@/lib/time-saved";
import { useLiveData } from "@/lib/use-live-data";

let ld: any = {};
let isDemoData = true;

// Build skill rows from liveData.skills.active. The aggregator emits each
// `/<command>` it parsed out of the user's Claude history, with use-counts
// and last-used timestamps. We map those into the same shape the existing
// skill cards expect.
type SkillRow = (typeof sampleSkills)[number];

function inferCategory(name: string): (typeof skillCategories)[number] {
  const n = name.toLowerCase();
  if (n.includes("research") || n.includes("recall") || n.includes("brief")) return "Research";
  if (n.includes("review") || n.includes("audit")) return "Review";
  if (n.includes("memory") || n.includes("wrap") || n.includes("recall")) return "Memory";
  if (n.includes("video") || n.includes("script") || n.includes("intro") || n.includes("title"))
    return "Video";
  if (n.includes("page") || n.includes("design")) return "Design";
  if (n.includes("organize") || n.includes("indexer") || n.includes("automation"))
    return "Automation";
  if (n.includes("report") || n.includes("cost") || n.includes("snapshot")) return "Reporting";
  return "Coding";
}

function buildSkillsFromLive(): SkillRow[] {
  const live = ld?.skills?.active;
  if (!Array.isArray(live)) return [];
  return live.map((s: any): SkillRow => {
    const uses7d = Number(s?.uses7d) || 0;
    const total = Number(s?.totalUses) || 0;
    const uses = uses7d > 0 ? uses7d : total;
    const status: SkillRow["status"] =
      Number(s?.uses7d) > 0 ? "active" : uses > 0 ? "stale" : "unused";
    return {
      name: String(s?.name ?? "/skill"),
      category: inferCategory(String(s?.name ?? "")),
      scope: "global",
      workspace: null,
      lastUsed: String(s?.lastUsed ?? "—"),
      status,
      inputs: [],
      outputs: [],
      uses,
      // Score is heuristic until the aggregator emits one — bias by recency.
      score: status === "active" ? 80 : status === "stale" ? 55 : 30,
    };
  });
}

// skills list is now computed inside SkillsPage()
let skills: SkillRow[] = [];
let hasAnySkills = false;

// Re-implement totals() locally so it sums over `skills` (which is now the
// live list when not in demo mode) instead of the static sampleSkills import.
function liveTotals(minutesFor: (name: string) => number, rate: number, period: Period) {
  let mins = 0;
  for (const s of skills) {
    mins += minutesFor(s.name) * runsIn(s.uses, period);
  }
  return { minutes: mins, dollars: (mins / 60) * rate };
}

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skills — Agentic OS" },
      {
        name: "description",
        content: "Visual map of every Claude Code skill, grouped by category and ranked by usage.",
      },
    ],
  }),
  component: SkillsPage,
});

const ACCENT = "oklch(0.72 0.17 155)";

const categoryIcons: Record<string, any> = {
  Research: Search,
  Coding: Code2,
  Review: Eye,
  Memory: Brain,
  Video: Video,
  Design: Palette,
  Automation: Cog,
  Reporting: BarChart3,
};

function SkillsPage() {
  ld = useLiveData();
  isDemoData = ld?.isExample === true;
  skills = buildSkillsFromLive();
  hasAnySkills = skills.length > 0;
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? skills : skills.filter((s) => s.category === filter);
  const totalUses = skills.reduce((a, s) => a + s.uses, 0);

  const [period, setPeriod] = useState<Period>("week");
  const { minutesFor, setMinutesFor, rate, setRate, resetAll } = useTimeSaved();
  const t = liveTotals(minutesFor, rate, period);

  const byCategory = useMemo(
    () =>
      skillCategories.map((c) => ({
        name: c,
        uses: skills.filter((s) => s.category === c).reduce((a, s) => a + s.uses, 0),
        count: skills.filter((s) => s.category === c).length,
      })),
    [],
  );

  const topSavers = useMemo(() => {
    return skills
      .map((s) => {
        const mins = minutesFor(s.name) * runsIn(s.uses, period);
        return { name: s.name, category: s.category, mins, dollars: (mins / 60) * rate };
      })
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 6);
  }, [minutesFor, rate, period]);

  return (
    <div className="max-w-[1400px]">
      {/* Hero */}
      <section className="relative rounded-xl overflow-hidden border border-border mb-10 aspect-[16/9] max-h-[420px] bg-card">
        <img
          src={skillsHero}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background from-0% via-background/30 via-30% to-transparent to-55%" />
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-10 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-4xl font-semibold tracking-tight max-w-2xl flex items-baseline gap-x-3 flex-wrap">
                <span className="inline-flex items-baseline gap-x-2.5">
                  <span className="relative inline-flex h-2 w-2 self-center translate-y-[-2px]">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  </span>
                  <span>{skills.length}</span>
                </span>
                <span className="text-foreground/75 font-normal">capabilities</span>
              </h1>
              <p className="text-sm text-foreground/75 mt-2 max-w-xl">
                Map of your Claude Code skills, grouped by category and ranked by use.
              </p>
            </div>
            <div className="shrink-0 inline-flex items-center gap-2.5 rounded-full border border-foreground/20 bg-background/40 backdrop-blur-sm px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] [text-shadow:none]">
              <span className="text-foreground/85">Skills</span>
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
              <span aria-hidden className="h-px w-4 bg-foreground/30" />
              <span className="tabular-nums text-foreground/70">
                {totalUses.toLocaleString()} invocations
              </span>
            </div>
          </div>
        </div>
      </section>

      {!hasAnySkills && (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-[13px] text-muted-foreground mb-10">
          No skills detected yet. Run any{" "}
          <code className="text-foreground/80">/&lt;command&gt;</code> in Claude Code (e.g.{" "}
          <code className="text-foreground/80">/recall</code>,{" "}
          <code className="text-foreground/80">/wrap-up</code>) and re-run{" "}
          <code className="text-foreground/80">bun run scripts/aggregate.ts</code> to start
          tracking.
        </div>
      )}

      {hasAnySkills && (
        <>
          {/* Time saved hero */}
          <section className="relative rounded-xl overflow-hidden border border-border bg-card p-6 md:p-8 mb-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30"
              style={{ background: ACCENT }}
            />
            <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  <Clock className="h-3.5 w-3.5" /> Time saved
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div className="text-5xl font-semibold tabular-nums tracking-tight">
                    {formatHours(t.minutes)}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>
                    ${Math.round(t.dollars).toLocaleString()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 max-w-md">
                  Estimated human hours that Claude removed this {period} — converted at your hourly
                  rate.
                </p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-3">
                <div className="inline-flex rounded-full border border-border bg-background p-0.5">
                  {(["day", "week", "month"] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
                        period === p
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-background pl-3 pr-1 py-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="number"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-16 bg-transparent text-sm font-semibold tabular-nums outline-none"
                    aria-label="Hourly rate"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground pr-2">
                    / hour
                  </span>
                  <button
                    onClick={resetAll}
                    title="Reset all overrides"
                    className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Top savers */}
            <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {topSavers.map((s) => {
                const max = topSavers[0]?.mins || 1;
                return (
                  <div
                    key={s.name}
                    className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium truncate">{s.name}</span>
                      <span
                        className="text-[11px] tabular-nums font-semibold"
                        style={{ color: ACCENT }}
                      >
                        {formatHours(s.mins)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.mins / max) * 100}%`,
                          background: ACCENT,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      ${Math.round(s.dollars).toLocaleString()} · {s.category}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Usage by category */}
          <section className="rounded-xl border border-border bg-card p-6 mb-10">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                  Usage by category
                </div>
                <div className="text-base font-semibold tracking-tight">Where the work happens</div>
              </div>
            </div>
            <div className="h-44 -mx-2">
              <ResponsiveContainer>
                <BarChart data={byCategory} margin={{ left: 0, top: 5, right: 8, bottom: 24 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="uses" fill={ACCENT} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Filter */}
          <div className="flex flex-wrap gap-1.5 mb-6 text-xs">
            <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            {skillCategories.map((c) => (
              <FilterChip key={c} label={c} active={filter === c} onClick={() => setFilter(c)} />
            ))}
          </div>

          {/* Grouped skill cards */}
          <div className="space-y-10">
            {skillCategories.map((cat) => {
              const items = filtered.filter((s) => s.category === cat);
              if (items.length === 0) return null;
              const Icon = categoryIcons[cat];
              const maxUses = Math.max(...items.map((s) => s.uses));

              return (
                <section key={cat}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <h2 className="text-sm font-semibold tracking-tight">{cat}</h2>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {items.length} skills · {items.reduce((a, s) => a + s.uses, 0)} uses
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((s) => {
                      const intensity = s.uses / maxUses;
                      const tier = levelFor(s.score);
                      const dot =
                        s.status === "active"
                          ? "bg-emerald-500"
                          : s.status === "stale"
                            ? "bg-amber-500"
                            : s.status === "broken"
                              ? "bg-red-500"
                              : "bg-muted-foreground/40";
                      return (
                        <div
                          key={s.name}
                          className="group relative rounded-xl border border-border/70 bg-card p-4 hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] transition-all overflow-hidden"
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-3xl opacity-25 group-hover:opacity-50 transition-opacity"
                            style={{ background: tier.color }}
                          />

                          <div className="relative flex items-start gap-3 mb-3">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 text-xl shrink-0"
                              style={{ background: `${tier.color}1f` }}
                              title={`${tier.label} · score ${s.score}`}
                            >
                              {tier.emoji}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">
                                  {s.status} · {s.scope}
                                </span>
                                <span
                                  className="ml-auto text-[9px] uppercase tracking-wider rounded-full px-1.5 py-0.5"
                                  style={{ background: `${tier.color}26`, color: tier.color }}
                                >
                                  {tier.label}
                                </span>
                              </div>
                              <div className="text-sm font-semibold tracking-tight leading-tight">
                                {s.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Last used {s.lastUsed}
                              </div>
                            </div>
                          </div>

                          <div className="relative grid grid-cols-3 gap-2 mb-3 text-[11px]">
                            <Stat label="Uses" value={s.uses.toString()} />
                            <Stat label="Score" value={s.score.toString()} />
                            <Stat label="Load" value={`${Math.round(intensity * 100)}%`} />
                          </div>

                          <div className="relative rounded-md border border-border bg-background px-2.5 py-2 mb-3 flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Saves
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={minutesFor(s.name)}
                              onChange={(e) => setMinutesFor(s.name, Number(e.target.value))}
                              className="w-12 bg-transparent text-xs font-semibold tabular-nums outline-none text-right"
                              aria-label={`${s.name} minutes saved per run`}
                            />
                            <span className="text-[10px] text-muted-foreground">min/run</span>
                            <span
                              className="ml-auto text-[11px] tabular-nums font-semibold"
                              style={{ color: tier.color }}
                            >
                              {formatHours(minutesFor(s.name) * runsIn(s.uses, period))}
                              <span className="text-muted-foreground font-normal"> / {period}</span>
                            </span>
                          </div>

                          <div className="relative flex items-center gap-1 flex-wrap">
                            {s.inputs.map((i) => (
                              <span
                                key={i}
                                className="text-[9px] rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-muted-foreground"
                              >
                                in:{i}
                              </span>
                            ))}
                            {s.outputs.map((o) => (
                              <span
                                key={o}
                                className="text-[9px] rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-muted-foreground"
                              >
                                out:{o}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// Map a numeric score to an emoji-tagged level
function levelFor(score: number): { emoji: string; label: string; color: string } {
  if (score >= 90) return { emoji: "👑", label: "Legendary", color: "oklch(0.78 0.16 75)" };
  if (score >= 80) return { emoji: "🚀", label: "Expert", color: "oklch(0.72 0.17 155)" };
  if (score >= 70) return { emoji: "🔥", label: "Skilled", color: "oklch(0.7 0.18 30)" };
  if (score >= 60) return { emoji: "✨", label: "Solid", color: "oklch(0.7 0.15 250)" };
  if (score >= 40) return { emoji: "🌱", label: "Learning", color: "oklch(0.65 0.12 200)" };
  return { emoji: "💤", label: "Dormant", color: "oklch(0.6 0.02 260)" };
}

import { createFileRoute } from "@tanstack/react-router";
import {
  Zap,
  Activity,
  MessageSquare,
  Server,
  Shield,
  Cpu,
  ArrowUpRight,
  Megaphone,
  Radio,
  FlaskConical,
  Lightbulb,
  PenLine,
  LineChart,
} from "lucide-react";
import confetti from "canvas-confetti";
import hermesLogo from "@/assets/hermes-agent.png";

export const Route = createFileRoute("/agents/hermes")({
  head: () => ({
    meta: [
      { title: "Hermes Agent — Agentic OS" },
      {
        name: "description",
        content: "Hermes: your local, uncensored research and reasoning agent.",
      },
    ],
  }),
  component: HermesPage,
});

const TONE = "#FFD21E";

const HERMES_PALETTE = ["#FFD21E", "#FFB300", "#FFE066", "#fff8d6"];

function fireHermesConfetti() {
  confetti({
    particleCount: 40,
    spread: 55,
    startVelocity: 38,
    gravity: 1.1,
    ticks: 180,
    scalar: 0.85,
    origin: { x: 0.95, y: 0.08 },
    angle: 215,
    colors: HERMES_PALETTE,
    disableForReducedMotion: true,
  });
}

function HermesPage() {
  return (
    <div className="max-w-[1400px]">
      {/* HERO */}
      <section className="relative rounded-3xl overflow-hidden border border-border mb-8">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 20% 30%, rgba(255,210,30,0.32) 0%, transparent 55%)," +
              "radial-gradient(ellipse 50% 50% at 100% 100%, rgba(255,140,0,0.18) 0%, transparent 60%)," +
              "linear-gradient(135deg, #1a1404 0%, #0b0a05 100%)",
          }}
        />
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-[0.10]"
          preserveAspectRatio="none"
          viewBox="0 0 1200 400"
        >
          <defs>
            <pattern id="hgrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#FFD21E" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="1200" height="400" fill="url(#hgrid)" />
        </svg>

        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-start md:items-end gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.28em] text-amber-400 mb-2 inline-flex items-center gap-2">
              <span>Personal Agent</span>
              <span
                title="This page is a concept preview. Stats and roles below aren't tied to anything on disk yet."
                className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
                style={{
                  background: "rgba(74, 158, 255, 0.14)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(74, 158, 255, 0.3)",
                }}
              >
                CONCEPT PREVIEW
              </span>
            </div>
            <img
              src={hermesLogo}
              alt="Hermes Agent"
              className="h-16 md:h-20 object-contain mb-4 drop-shadow-[0_0_30px_rgba(255,210,30,0.4)]"
            />
            <p className="text-base md:text-lg text-zinc-300 max-w-2xl leading-relaxed">
              Local, uncensored Llama-tuned reasoning model. Your private second brain — no rate
              limits, no telemetry, no guardrails on research.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone={TONE}>Local · Ollama</Pill>
              <Pill tone={TONE}>70B params</Pill>
              <Pill tone={TONE}>Offline-capable</Pill>
            </div>
          </div>
          <button
            onClick={fireHermesConfetti}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-black md:mb-1 transition-transform active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${TONE}, #ffb700)`,
              boxShadow: `0 10px 40px -10px ${TONE}`,
            }}
          >
            Summon Hermes
          </button>
        </div>
      </section>

      {/* STAT GRID */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatTile icon={Activity} label="Sessions · 7d" value="42" sub="+18% vs prev" tone={TONE} />
        <StatTile icon={Cpu} label="Tokens · 7d" value="3.4M" sub="all local" tone={TONE} />
        <StatTile icon={Server} label="Avg latency" value="820ms" sub="local GPU" tone={TONE} />
        <StatTile icon={Shield} label="External calls" value="0" sub="fully private" tone={TONE} />
      </section>

      {/* ROLES — what to summon Hermes for */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80 mb-1">
              Roles
            </div>
            <h2 className="text-sm font-semibold">Summon Hermes as…</h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Each role rebriefs Hermes with its own system prompt, tools, and house style.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Click to brief
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Megaphone,
              name: "Marketing Strategist",
              brief: "Positioning, hooks, audience cuts.",
              kbd: "M",
              sample: "“3 hooks for the launch teardown”",
              featured: true,
              tools: ["Hooks", "Personas", "Channels"],
            },
            {
              icon: Radio,
              name: "Comms Lead",
              brief: "PR drafts, tone, crisis loops.",
              kbd: "C",
              sample: "“Draft response to the @verge thread”",
              featured: true,
              tools: ["Statements", "FAQ", "Tone"],
            },
            {
              icon: FlaskConical,
              name: "Research Analyst",
              brief: "Deep-dive teardown reports.",
              kbd: "R",
              sample: "“Map the prompt-injection landscape”",
              featured: true,
              tools: ["Sources", "Compare", "Cite"],
            },
            {
              icon: Lightbulb,
              name: "Creative Brainstormer",
              brief: "Concepts, formats, wild bets.",
              kbd: "B",
              tools: ["Concepts", "Formats"],
            },
            {
              icon: PenLine,
              name: "Ghostwriter",
              brief: "Long-form drafts in your voice.",
              kbd: "G",
              tools: ["Voice", "Outline"],
            },
            {
              icon: LineChart,
              name: "Growth Operator",
              brief: "Funnels, experiments, tracking.",
              kbd: "O",
              tools: ["Funnel", "A/B", "Metrics"],
            },
          ].map((r) => (
            <button
              key={r.name}
              className={`group text-left rounded-2xl border bg-card overflow-hidden relative transition-colors ${
                r.featured
                  ? "p-5 border-amber-300/25 hover:border-amber-300/60"
                  : "p-4 border-border hover:border-amber-300/35"
              }`}
            >
              {/* featured: thin top rim accent */}
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
                      style={r.featured ? { color: "#fff8d6" } : undefined}
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
                    Sample brief
                  </div>
                  <div className="text-[12px] italic" style={{ color: TONE }}>
                    <span className="text-muted-foreground mr-1">›</span>
                    {r.sample}
                  </div>
                </div>
              )}

              <div className="relative mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-muted-foreground">Brief Hermes</span>
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
            <h2 className="text-sm font-semibold">Recent investigations</h2>
            <a className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <ul className="divide-y divide-border">
            {[
              { t: "Market sizing summary", d: "32m · 18 sources", tag: "research" },
              { t: "Quarterly review synthesis", d: "1h 4m · 41 sources", tag: "synthesis" },
              { t: "Cash-flow stress test", d: "22m · 7 sources", tag: "modelling" },
              { t: "Customer interview rewrite", d: "48m · 12 sources", tag: "drafting" },
            ].map((r, i) => (
              <li key={i} className="py-3 flex items-center gap-3">
                <MessageSquare className="h-4 w-4" style={{ color: TONE }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.t}</div>
                  <div className="text-[11px] text-muted-foreground">{r.d}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-300/90">
                  {r.tag}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Capabilities</h2>
          <div className="space-y-3">
            <Capability label="Long-context synthesis" pct={92} tone={TONE} />
            <Capability label="Structured reasoning" pct={86} tone={TONE} />
            <Capability label="Code generation" pct={71} tone={TONE} />
            <Capability label="Vision (multimodal)" pct={48} tone={TONE} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Skills bound to Hermes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            "Deep Research",
            "Document Q&A",
            "Inbox Triage",
            "Weekly Brief",
            "Meeting Notes",
            "Spec Drafting",
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

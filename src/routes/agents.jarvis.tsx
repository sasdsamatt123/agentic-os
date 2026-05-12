import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Mic,
  Map as MapIcon,
  Network,
  Workflow,
  FileText,
  Briefcase,
  ArrowUpRight,
  Building2,
  Phone,
  Globe,
  Mail,
  Wallet,
  TrendingUp,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import jarvisLogo from "@/assets/jarvis.svg?url";
import { useLiveData } from "@/lib/use-live-data";

const AGENCYOS_PORT = 3091;
const AGENCYOS_URL = `http://localhost:${AGENCYOS_PORT}`;
const AGENCYOS_OPEN_URL = `${AGENCYOS_URL}/#map`;

export const Route = createFileRoute("/agents/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Agentic OS" },
      {
        name: "description",
        content:
          "Live AgencyOS state — pipeline, clients, daily briefing — surfaced by the JARVIS voice agent.",
      },
    ],
  }),
  component: JarvisPage,
});

type LiveStatus = "checking" | "online" | "offline";

function JarvisPage() {
  const ld = useLiveData() as any;
  const ao = ld?.agencyos as any;

  const [status, setStatus] = useState<LiveStatus>("checking");
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    fetch(AGENCYOS_URL, { mode: "no-cors", signal: ctrl.signal })
      .then(() => !cancelled && setStatus("online"))
      .catch(() => !cancelled && setStatus("offline"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  const state = ao?.state?.state ?? ao?.state ?? null;
  const pipeline = ao?.pipeline ?? null;
  const briefing = ao?.briefing ?? null;
  const stats = ao?.statistics ?? null;
  const clients = (ao?.clients ?? []) as any[];
  const retainerTotal = ao?.monthlyRetainerTotal ?? 0;
  const activeClientCount = ao?.activeClientCount ?? clients.length;

  const goalMrr = state?.revenueGoal?.targetMrr ?? 0;
  const currency = state?.revenueGoal?.currency ?? "TRY";
  const mrrPct = goalMrr > 0 ? Math.min(100, Math.round((retainerTotal / goalMrr) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1200px] py-8 md:py-10 space-y-8">
      {/* Hero */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className="h-14 w-14 rounded-xl shrink-0 grid place-items-center overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.20 0.005 285) 0%, oklch(0.14 0.006 285) 100%)",
              border: "1px solid oklch(0.65 0.18 250 / 30%)",
              boxShadow: "inset 0 1px 0 oklch(1 0 0 / 5%)",
            }}
          >
            <img src={jarvisLogo} alt="JARVIS" className="h-9 w-9" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
              Agent · AgencyOS bridge
            </div>
            <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight leading-[1.05]">
              JARVIS
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground max-w-[640px] leading-relaxed">
              Gemini Live voice + tool agent for your AgencyOS stack. The data below is read from
              the AgencyOS MCP every aggregator pass — the panel works even when the local dev
              server is off.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={status} />
          {ao?.fetchedAt && (
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              data: {new Date(ao.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Connection-failed empty state */}
      {!ao?.available && (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-[13px] text-muted-foreground">
          <strong className="text-foreground/80">AgencyOS MCP not connected.</strong>{" "}
          {ao?.error ? <code className="text-foreground/70">{ao.error}</code> : "—"}. Add an
          agencyos entry to <code className="text-foreground/70">~/.claude/mcp.json</code> and
          re-run <code className="text-foreground/70">bun run aggregate</code>.
        </div>
      )}

      {/* Agency state */}
      {state && (
        <section className="rounded-xl border border-border p-5 space-y-4 lift-on-hover">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
                Agency
              </div>
              <div className="text-xl font-semibold tracking-tight text-foreground">
                {state.agencyName ?? "—"}
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-1">
                operator {state.ownerName ?? "—"} · {state.city ?? "—"}
                {state.country ? `, ${state.country}` : ""} ·{" "}
                <span className="text-foreground/85">{state.primaryNiche ?? "—"}</span>
              </div>
              {state.agencyDescription && (
                <div className="text-[12px] text-muted-foreground/85 mt-1.5 italic">
                  {state.agencyDescription}
                </div>
              )}
            </div>
            {goalMrr > 0 && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
                  MRR target
                </div>
                <div className="font-mono text-[20px] font-semibold tabular-nums text-foreground tracking-tight">
                  {formatMoney(retainerTotal, currency)}{" "}
                  <span className="text-muted-foreground/60 text-[14px] font-normal">
                    / {formatMoney(goalMrr, currency)}
                  </span>
                </div>
                <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                  {mrrPct}% of target
                </div>
              </div>
            )}
          </div>
          {goalMrr > 0 && (
            <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${mrrPct}%`,
                  background: "linear-gradient(90deg, oklch(0.74 0.085 70), oklch(0.78 0.10 70))",
                  boxShadow: "0 0 8px oklch(0.74 0.085 70 / 35%)",
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* Pipeline */}
      {pipeline && (
        <section className="rounded-xl border border-border p-5 lift-on-hover">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
                Pipeline
              </div>
              <div className="text-base font-semibold tracking-tight">
                {(pipeline.total ?? 0).toLocaleString()} leads ·{" "}
                <span className="text-muted-foreground">
                  {formatMoney(briefing?.pipelineValue ?? 0, currency)} value
                </span>
              </div>
            </div>
          </div>
          <PipelineStrip byStage={pipeline.byStage ?? {}} total={pipeline.total ?? 0} />
          {pipeline.contactCoverage && (
            <div className="flex items-center gap-5 mt-4 text-[11px] text-muted-foreground/85 flex-wrap">
              <CoverageStat icon={Phone} label="phone" present={pipeline.contactCoverage.withPhone} missing={pipeline.contactCoverage.withoutPhone} />
              <CoverageStat icon={Globe} label="website" present={pipeline.contactCoverage.withWebsite} missing={pipeline.contactCoverage.withoutWebsite} />
              <CoverageStat icon={Mail} label="email" present={pipeline.contactCoverage.withEmail} missing={pipeline.contactCoverage.withoutEmail} />
            </div>
          )}
        </section>
      )}

      {/* Today's briefing + statistics */}
      {(briefing || stats) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {briefing && (
            <section className="rounded-xl border border-border p-5 lift-on-hover">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-3">
                Today's briefing · <span className="tabular-nums">{briefing.date}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <BriefingTile icon={Sparkles} label="new today" value={briefing.counts?.newLeads ?? 0} accent="amber" />
                <BriefingTile icon={ClipboardList} label="crm total" value={briefing.counts?.crmLeads ?? 0} />
                <BriefingTile icon={Wallet} label={`revenue (${currency})`} value={formatMoney(briefing.monthlyRevenue ?? 0, currency, true)} />
                <BriefingTile icon={TrendingUp} label="pipeline value" value={formatMoney(briefing.pipelineValue ?? 0, currency, true)} accent="amber" />
              </div>
              {(briefing.followUps?.length ?? 0) > 0 && (
                <div className="mt-3 text-[11px] text-muted-foreground/85">
                  {briefing.followUps.length} follow-up{briefing.followUps.length === 1 ? "" : "s"} due
                </div>
              )}
            </section>
          )}
          {stats && (
            <section className="rounded-xl border border-border p-5 lift-on-hover">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-3">
                Map intelligence · {(stats.total ?? 0).toLocaleString()} businesses
              </div>
              <div className="space-y-2.5">
                {Object.entries(stats.byCity ?? {})
                  .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
                  .slice(0, 5)
                  .map(([city, n]) => {
                    const pct = stats.total ? Math.round((Number(n) / stats.total) * 100) : 0;
                    return (
                      <CityBar key={city} label={String(city)} value={Number(n)} pct={pct} />
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Active clients */}
      {clients.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
                Active clients
              </div>
              <div className="text-base font-semibold tracking-tight">
                {activeClientCount} client{activeClientCount === 1 ? "" : "s"} ·{" "}
                <span className="text-muted-foreground font-normal">
                  {formatMoney(retainerTotal, currency)} retainer / mo
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.slice(0, 6).map((c) => (
              <ClientTile key={c.projectId} client={c} currency={currency} />
            ))}
          </div>
        </section>
      )}

      {/* Launch + capabilities */}
      <section>
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <button
            onClick={() => window.open(AGENCYOS_OPEN_URL, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              background: "oklch(0.65 0.18 250)",
              color: "oklch(0.11 0.005 285)",
              boxShadow: "0 6px 16px -6px oklch(0.65 0.18 250 / 45%)",
            }}
          >
            Open JARVIS in AgencyOS
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <a
            href={AGENCYOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border border-border hover:border-foreground/30 hover:bg-accent/30 transition-colors"
          >
            AgencyOS home
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-3">
          Capabilities · 96 tools
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Capability icon={MapIcon} title="Lead scraping" body="Google Maps via Apify → auto-import to CRM. Filter by city, niche, density." />
          <Capability icon={Briefcase} title="Sales pipeline" body="Move leads through stages, mark won/lost, schedule follow-ups, log activities." />
          <Capability icon={Workflow} title="Project workspaces" body="Create clients, attach services, run recurring tasks, capture deliverables." />
          <Capability icon={Network} title="Automations" body="Email sequences, lead enrollment, pause / resume, conditional branching." />
          <Capability icon={FileText} title="Operations briefings" body="Daily summary: payments due, support tickets, follow-ups, new pipeline activity." />
          <Capability icon={Mic} title="Voice + text" body="Gemini Live: bidirectional audio, optional webcam input. Or just chat." />
        </div>
      </section>
    </div>
  );
}

/* ── components ────────────────────────────────────────────── */

function StatusPill({ status }: { status: LiveStatus }) {
  const cfg = {
    checking: { label: "Checking…", dot: "oklch(0.65 0.005 90)", ring: "oklch(1 0 0 / 10%)" },
    online: {
      label: `Dev server live · :${AGENCYOS_PORT}`,
      dot: "oklch(0.70 0.16 150)",
      ring: "oklch(0.70 0.16 150 / 35%)",
    },
    offline: {
      label: "Dev server offline",
      dot: "oklch(0.62 0.20 25)",
      ring: "oklch(0.62 0.20 25 / 35%)",
    },
  }[status];
  return (
    <div
      className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
      style={{ background: "oklch(0.18 0.005 285)", border: `1px solid ${cfg.ring}` }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }}
      />
      <span className="text-foreground/90">{cfg.label}</span>
    </div>
  );
}

const STAGE_ORDER = ["New", "Contacted", "Replied", "Booked", "Proposal", "Won", "Lost"] as const;
const STAGE_COLORS: Record<string, string> = {
  New: "oklch(0.65 0.005 90 / 70%)",
  Contacted: "oklch(0.65 0.18 250)",
  Replied: "oklch(0.70 0.12 150)",
  Booked: "oklch(0.74 0.085 70)",
  Proposal: "oklch(0.78 0.10 70)",
  Won: "oklch(0.70 0.16 150)",
  Lost: "oklch(0.62 0.20 25)",
};

function PipelineStrip({
  byStage,
  total,
}: {
  byStage: Record<string, number>;
  total: number;
}) {
  const visible = STAGE_ORDER.filter((s) => (byStage[s] ?? 0) > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/30">
        {visible.map((s) => {
          const n = byStage[s] ?? 0;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div
              key={s}
              style={{
                width: `${pct}%`,
                background: STAGE_COLORS[s],
              }}
              title={`${s}: ${n.toLocaleString()}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAGE_ORDER.map((s) => {
          const n = byStage[s] ?? 0;
          const active = n > 0;
          return (
            <div
              key={s}
              className={`rounded-md px-2.5 py-2 border ${active ? "border-border bg-card/40" : "border-border/40 opacity-50"}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/85 mb-0.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STAGE_COLORS[s] }}
                />
                {s}
              </div>
              <div className="font-mono text-[15px] tabular-nums font-semibold text-foreground">
                {n.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageStat({
  icon: Icon,
  label,
  present,
  missing,
}: {
  icon: any;
  label: string;
  present: number;
  missing: number;
}) {
  const total = present + missing;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-foreground/60" />
      <span className="tabular-nums font-mono text-foreground/90">{present.toLocaleString()}</span>
      <span className="text-muted-foreground/60">{label}</span>
      <span className="text-muted-foreground/50 tabular-nums">({pct}%)</span>
    </div>
  );
}

function BriefingTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent?: "amber";
}) {
  const isStr = typeof value === "string";
  return (
    <div className="rounded-lg border border-border/70 bg-card/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className="font-mono text-[19px] tabular-nums font-semibold tracking-tight"
        style={accent === "amber" ? { color: "oklch(0.78 0.10 70)" } : undefined}
      >
        {isStr ? value : Number(value).toLocaleString()}
      </div>
    </div>
  );
}

function CityBar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11.5px] mb-1">
        <span className="text-foreground/90 truncate">{label}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {value.toLocaleString()}{" "}
          <span className="text-muted-foreground/50">({pct}%)</span>
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, oklch(0.74 0.085 70 / 80%), oklch(0.65 0.18 250 / 70%))",
          }}
        />
      </div>
    </div>
  );
}

function ClientTile({ client, currency }: { client: any; currency: string }) {
  const created = client.createdAt ? new Date(client.createdAt) : null;
  const ageDays = created ? Math.round((Date.now() - created.getTime()) / 86_400_000) : null;
  const isActive = client.lifecycleStatus === "active";
  const isDemo = client.projectId?.startsWith("proj-demo-") || /demo/i.test(client.name ?? "");
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 lift-on-hover">
      <div className="flex items-start gap-2.5 mb-3">
        <div
          className="h-9 w-9 rounded-md grid place-items-center shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.20 0.005 285) 0%, oklch(0.14 0.006 285) 100%)",
            border: "1px solid oklch(0.74 0.085 70 / 25%)",
          }}
        >
          <Building2 className="h-4 w-4" style={{ color: "oklch(0.74 0.085 70)" }} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2">
            {client.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] uppercase tracking-wider">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                background: isActive ? "oklch(0.70 0.16 150 / 14%)" : "oklch(1 0 0 / 6%)",
                color: isActive ? "oklch(0.78 0.16 150)" : "oklch(0.65 0.005 90)",
                border: `1px solid ${isActive ? "oklch(0.70 0.16 150 / 30%)" : "oklch(1 0 0 / 10%)"}`,
              }}
            >
              {client.lifecycleStatus ?? "—"}
            </span>
            {isDemo && (
              <span className="text-muted-foreground/60">demo</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">retainer</div>
          <div className="font-mono text-[16px] font-semibold tabular-nums tracking-tight text-foreground">
            {formatMoney(client.retainerAmount ?? 0, currency)}
            <span className="text-muted-foreground/55 text-[11px] font-normal"> /mo</span>
          </div>
        </div>
        {ageDays !== null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">since</div>
            <div className="text-[12px] tabular-nums text-foreground/80">{ageDays}d</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Capability({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/30 p-4 lift-on-hover">
      <Icon className="h-4 w-4 text-foreground/75 mb-2.5" />
      <div className="text-[13px] font-semibold text-foreground mb-1">{title}</div>
      <div className="text-[12px] text-muted-foreground leading-snug">{body}</div>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────── */

function formatMoney(amount: number, currency: string, abbreviate = false): string {
  const sym = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  if (abbreviate && amount >= 1_000_000) {
    return `${sym}${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abbreviate && amount >= 10_000) {
    return `${sym}${Math.round(amount / 1000)}K`;
  }
  return `${sym}${amount.toLocaleString()}`;
}

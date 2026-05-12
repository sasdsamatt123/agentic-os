import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Mic, Map as MapIcon, Network, Workflow, FileText, Briefcase, ArrowUpRight } from "lucide-react";
import jarvisLogo from "@/assets/jarvis.svg?url";

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
          "Launcher for JARVIS, the voice + tool agent that lives inside AgencyOS. 96 MCP tools across lead scraping, CRM, projects, and automations.",
      },
    ],
  }),
  component: JarvisPage,
});

type Status = "checking" | "online" | "offline";

function JarvisPage() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);

    // CORS-safe liveness check — opaque response counts as "reachable".
    fetch(AGENCYOS_URL, { mode: "no-cors", signal: ctrl.signal })
      .then(() => {
        if (!cancelled) setStatus("online");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] py-8 md:py-10">
      {/* Hero */}
      <div className="flex items-start justify-between gap-6 mb-10">
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
              Agent · external
            </div>
            <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight leading-[1.05]">
              JARVIS
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground max-w-[640px] leading-relaxed">
              Gemini Live voice + tool agent. Lives inside the AgencyOS app at{" "}
              <code className="font-mono text-foreground/90">localhost:{AGENCYOS_PORT}</code>.
              Speak or type — it scrapes leads, runs your CRM pipeline, opens projects, drives
              automations, and answers the daily briefing.
            </p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Primary action */}
      <div className="mb-10 flex items-center gap-3 flex-wrap">
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
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border border-border bg-card hover:border-foreground/30 hover:bg-accent/30 transition-colors"
        >
          AgencyOS home
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Capabilities grid */}
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-3">
          Capabilities · 96 tools
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Capability
            icon={MapIcon}
            title="Lead scraping"
            body="Google Maps via Apify → auto-import to CRM. Filter by city, niche, density."
          />
          <Capability
            icon={Briefcase}
            title="Sales pipeline"
            body="Move leads through stages, mark won/lost, schedule follow-ups, log activities."
          />
          <Capability
            icon={Workflow}
            title="Project workspaces"
            body="Create clients, attach services, run recurring tasks, capture deliverables."
          />
          <Capability
            icon={Network}
            title="Automations"
            body="Email sequences, lead enrollment, pause / resume, conditional branching."
          />
          <Capability
            icon={FileText}
            title="Operations briefings"
            body="Daily summary: payments due, support tickets, follow-ups, new pipeline activity."
          />
          <Capability
            icon={Mic}
            title="Voice + text"
            body="Gemini Live: bidirectional audio, optional webcam input. Or just chat."
          />
        </div>
      </div>

      {/* How it bridges */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="text-[13px] font-medium text-foreground mb-2">
          How it bridges with Agentic OS
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
          JARVIS is a full app — not a component imported here. This page is the launcher and a
          living status indicator. When AgencyOS dev server is running on{" "}
          <code className="font-mono text-foreground/85">localhost:{AGENCYOS_PORT}</code>, the
          pill above turns green and the button opens it in a new tab.
        </p>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Both apps see the same disk — your skills, sessions, and memory live in{" "}
          <code className="font-mono text-foreground/85">~/.claude/</code>, your AgencyOS data
          lives in Supabase + the local AgencyOS app. The aggregator in Agentic OS also reads
          your AgencyOS MCP server from{" "}
          <code className="font-mono text-foreground/85">~/.claude.json</code> and renders it in
          the Integrations panel on the home dashboard.
        </p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const cfg = {
    checking: {
      label: "Checking…",
      dot: "oklch(0.65 0.005 90)",
      bg: "oklch(0.18 0.005 285)",
      ring: "oklch(1 0 0 / 10%)",
    },
    online: {
      label: `Detected · localhost:${AGENCYOS_PORT}`,
      dot: "oklch(0.70 0.16 150)",
      bg: "oklch(0.18 0.005 285)",
      ring: "oklch(0.70 0.16 150 / 35%)",
    },
    offline: {
      label: "AgencyOS offline",
      dot: "oklch(0.62 0.20 25)",
      bg: "oklch(0.18 0.005 285)",
      ring: "oklch(0.62 0.20 25 / 35%)",
    },
  }[status];

  return (
    <div
      className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
      style={{ background: cfg.bg, border: `1px solid ${cfg.ring}` }}
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

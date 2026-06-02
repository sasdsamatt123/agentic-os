import { createFileRoute, Link } from "@tanstack/react-router";
import { SetupModal } from "./setup";
import { workspaces, usageDaily as fallbackUsageDaily } from "@/lib/mock-data";
import { useLiveData } from "@/lib/use-live-data";
import dreamCosmos from "@/assets/dream-cosmos.jpg";
import dreamMemoryPink from "@/assets/dream/memory-pink.png";
import dreamCostOrange from "@/assets/dream/cost-orange.png";
import dreamSkillsBlue from "@/assets/dream/skills-blue.png";
import dreamWorkflowYellow from "@/assets/dream/workflow-yellow.png";
import logoApify from "@/assets/logos/apify.png";
import logoCanva from "@/assets/logos/canva.png";
import logoFirecrawl from "@/assets/logos/firecrawl.png";
import logoGamma from "@/assets/logos/gamma.png";
import logoOpenai from "@/assets/logos/openai.png";
import logoOpenrouter from "@/assets/logos/openrouter.svg";
import logoOpenclaw from "@/assets/logos/openclaw.svg";
import logoPinecone from "@/assets/logos/pinecone.png";
import logoNotebooklm from "@/assets/logos/notebooklm.png";
import logoSupabase from "@/assets/logos/supabase.png";
import logoZapier from "@/assets/logos/zapier.png";
import logoNotion from "@/assets/logos/notion.png";
import logoTelegram from "@/assets/logos/telegram.png";
import logoYoutube from "@/assets/logos/youtube.svg";
import logoGmail from "@/assets/logos/gmail.svg";
import logoGoogleCalendar from "@/assets/logos/googlecalendar.svg";
import logoGoogleDrive from "@/assets/logos/googledrive.svg";
import logoGoogleGemini from "@/assets/logos/googlegemini.svg";

const LOCAL_LOGO_MAP: Record<string, string> = {
  apify: logoApify,
  canva: logoCanva,
  firecrawl: logoFirecrawl,
  gamma: logoGamma,
  openai: logoOpenai,
  openrouter: logoOpenrouter,
  openclaw: logoOpenclaw,
  pinecone: logoPinecone,
  notebooklm: logoNotebooklm,
  googlenotebooklm: logoNotebooklm,
  supabase: logoSupabase,
  zapier: logoZapier,
  notion: logoNotion,
  telegram: logoTelegram,
  youtube: logoYoutube,
  gmail: logoGmail,
  googlecalendar: logoGoogleCalendar,
  googledrive: logoGoogleDrive,
  googlegemini: logoGoogleGemini,
};
import {
  ArrowUpRight,
  Brain,
  Sparkles,
  Activity as ActivityIcon,
  DollarSign,
  Wand2,
  Zap,
  CheckCircle2,
  XCircle,
  Plug,
  Database,
  Calendar,
  Mail,
  FileText,
  Youtube,
  Workflow,
  Bot,
  Image as ImageIco,
  Send,
  Search,
  Layers,
  Clock,
  AlertTriangle,
  Lightbulb,
  Pencil,
  TrendingUp,
  Megaphone,
  ScrollText,
  HandCoins,
  PlayCircle,
  Network,
  MessageSquare,
  MousePointerClick,
  Loader2,
  X,
  Terminal as TerminalIcon,
} from "lucide-react";
import * as React from "react";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useTimeSaved, totals, formatHours, type Period } from "@/lib/time-saved";
import { UsagePanel } from "@/components/usage-panel";
import { HermesMissionControl } from "@/components/hermes-mission-control";
import { EditablePrice } from "@/components/editable-price";
import { usePriceOverrides } from "@/hooks/use-price-overrides";

const MemoryGraph3D = lazy(() => import("@/components/memory-graph-3d"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — Agentic OS" },
      {
        name: "description",
        content:
          "Operator home: skills ROI, memory graph, integrations, automations and the daily Dream review.",
      },
    ],
  }),
  component: Home,
});

const ACCENT = "oklch(0.72 0.17 155)";

// ---------- Live-data derivations ----------
// liveData is whatever scripts/aggregate.ts most recently emitted.
// On a fresh clone we ship src/data/live-data.example.json (isExample=true)
// so the dashboard boots with sensible numbers before the user runs the
// aggregator. Real numbers replace these once `bun run aggregate` runs.

// Moved to component scope — see DashboardPage below
let ld: any = {};
let isDemoData = true;
let hasRealActivity = false;
// "Cold real" = aggregator ran but found no activity (fresh user, FDA denied,
// or Claude Code never used). Different from demo state.
let isColdReal = false;

// ---------- Operator Score ----------
// One number summarising overall AI-OS health. Components: memory freshness,
// subscription ROI, recent activity. Bounded 0–100. We derive on the client
// so the formula is auditable and easy to iterate on.
function computeOperatorScore(): {
  score: number;
  components: { label: string; value: number; max: number }[];
} {
  const stale = Number(ld?.memory?.stats?.stale ?? 0);
  const totalMem = Number(ld?.memory?.stats?.totalFiles ?? 0);
  const staleRatio = totalMem > 0 ? stale / totalMem : 0;
  const memHealth = 25 * (1 - Math.min(1, staleRatio * 3));

  const value7d = Number(ld?.summary?.valueExtracted7d ?? 0);
  const claudePrice = Number(ld?.subscriptions?.claude?.monthlyPrice ?? 200);
  const chatPrice = Number(ld?.subscriptions?.chatgpt?.monthlyPrice ?? 20);
  const subsTotal = Math.max(1, claudePrice + chatPrice + 20);
  const monthlyValue = value7d * (30 / 7);
  const roi = monthlyValue / subsTotal;
  const roiPts = 35 * Math.min(1, roi / 10);

  const recent = Number(ld?.summary?.messagesLast7d ?? 0);
  const activity = 30 * Math.min(1, recent / 1500);

  const baseline = 10; // baseline reward for having the OS installed at all
  const score = Math.round(Math.max(0, Math.min(100, memHealth + roiPts + activity + baseline)));

  return {
    score,
    components: [
      { label: "Memory health", value: Math.round(memHealth), max: 25 },
      { label: "Sub ROI", value: Math.round(roiPts), max: 35 },
      { label: "Activity", value: Math.round(activity), max: 30 },
      { label: "Baseline", value: baseline, max: 10 },
    ],
  };
}
const operatorScore = computeOperatorScore();

// 7-day cost + sessions for sparkline + spend math.
const usageDaily: { day: string; cost: number; runs: number }[] =
  Array.isArray(ld?.daily) && ld.daily.length > 0
    ? ld.daily.map((d: any) => ({
        day: new Date(d.day).toLocaleDateString(undefined, { weekday: "short" }),
        cost: Number(d.cost) || 0,
        runs: Math.max(1, Math.round((Number(d.messages) || 0) / 6)),
      }))
    : fallbackUsageDaily;

// ---------- Demo data unique to this page ----------

type SkillStatus = "active" | "dormant" | "dead";
interface DemoSkill {
  name: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  uses: number; // this period
  minsPerRun: number; // estimate
  status: SkillStatus;
  lastUsed: string;
  estimateSource: "you" | "ai" | "manual";
}

// Sample shipped with the repo. Used only when the dashboard is in demo
// mode (live-data.example.json copied to live-data.json on a fresh clone).
// Real deployments replace this with skills derived from liveData.skills.active.


// Map a live `/<command>` to a reasonable icon. Falls back to Sparkles.
function iconForSkill(
  name: string,
): ComponentType<{ className?: string; style?: React.CSSProperties }> {
  const n = name.toLowerCase();
  if (n.includes("title")) return Pencil;
  if (n.includes("research") || n.includes("recall")) return Search;
  if (n.includes("wrap") || n.includes("session") || n.includes("handoff")) return Network;
  if (n.includes("intro") || n.includes("script")) return ScrollText;
  if (n.includes("comment")) return MessageSquare;
  if (n.includes("video") || n.includes("play")) return PlayCircle;
  if (n.includes("invoice") || n.includes("money") || n.includes("bill")) return HandCoins;
  if (n.includes("ad") || n.includes("sponsor") || n.includes("market")) return Megaphone;
  if (n.includes("trend") || n.includes("signal") || n.includes("report")) return TrendingUp;
  if (n.includes("hook") || n.includes("scroll")) return MousePointerClick;
  return Sparkles;
}

// Derive home-page skill cards from liveData.skills.active. Each entry's
// "uses" reflects the trailing 7d, so periodFactor (day/week/month) maps
// cleanly onto it. minsPerRun is a heuristic until the user calibrates per
// skill on the Skills page.
function deriveSkillsFromLive(): DemoSkill[] {
  const live = ld?.skills?.active;
  if (!Array.isArray(live) || live.length === 0) return [];
  const now = Date.now();
  return live.map((s: any): DemoSkill => {
    const uses = Number(s?.uses7d) || 0;
    const lastUsedMs = Number(s?.lastUsedMs) || 0;
    const ageDays = lastUsedMs ? (now - lastUsedMs) / (1000 * 60 * 60 * 24) : 999;
    const status: SkillStatus = uses > 0 ? "active" : ageDays > 30 ? "dead" : "dormant";
    return {
      name: String(s?.name || "/skill"),
      icon: iconForSkill(String(s?.name || "")),
      uses,
      // Default to 0 — shows $0 saved until user sets their own estimate
      minsPerRun: 0,
      status,
      lastUsed: String(s?.lastUsed || "—"),
      estimateSource: "manual",
    };
  });
}

let liveDerivedSkills = deriveSkillsFromLive();
// Pick which list to render in the "Your skills" section.
// - DEMO: use the rich shipped sample so a fresh clone looks alive.
// - REAL: use whatever the aggregator found. Empty real → empty state.
let demoSkills: DemoSkill[] = liveDerivedSkills;

// Rising 14-day activity trend.
// When liveData.daily has entries (after running `bun run aggregate`), the
// most recent 7 days come from real data; older days are backfilled with a
// synthetic but believable trend so the chart isn't half-empty on day one.
function computeDailyActivity(): { date: string; label: string; sessions: number; minutes: number }[] {
  const realByDay = new Map<string, { messages: number }>();
  if (Array.isArray(ld?.daily)) {
    for (const d of ld.daily) {
      if (d?.day) realByDay.set(String(d.day), { messages: Number(d.messages) || 0 });
    }
  }
  const out: { date: string; label: string; sessions: number; minutes: number }[] = [];
  const today = new Date();
  const noise = [0, -1, 1, 2, -1, 0, 1, -2, 2, 1, -1, 1, 0, 0];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const real = realByDay.get(iso);
    let sessions: number;
    if (real) {
      // ~6 messages per session is the rough average across Claude Code logs.
      sessions = Math.max(2, Math.round(real.messages / 6));
    } else {
      const base = 5 + Math.round(((13 - i) / 13) * 14);
      sessions = Math.max(2, base + (noise[(13 - i) % noise.length] ?? 0));
    }
    out.push({
      date: iso,
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Yesterday"
            : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      sessions,
      minutes: sessions * (32 + ((sessions * 7) % 18)),
    });
  }
  return out.reverse();
}
let dailyActivity = computeDailyActivity();

// Skill recommendations — research-backed, evidence-driven.
interface SkillRecommendation {
  name: string;
  command: string;
  evidenceCount: number;
  basis: string;
  predictedSavings: { hoursPerMonth: number; dollarsPerMonth: number };
  confidence: number;
  inspiredBy: string[];
}



let liveRecommended = ld?.skills?.recommended;
let skillRecommendations: SkillRecommendation[] = Array.isArray(liveRecommended)
    ? liveRecommended
    : [];

// Integrations come from liveData (the aggregator filters to signals it can
// actually verify — keychain creds, env vars, OAuth files). The UI hides
// the section when the list is empty. Each entry must already be `connected`
// because the aggregator only emits real signals — no dead/false tiles.
type IntegrationTileData = {
  name: string;
  slug: string;
  connected: boolean;
  color: string;
  tagline?: string;
};
let liveIntegrations = ld?.integrations;
let integrations: IntegrationTileData[] = Array.isArray(liveIntegrations) ? liveIntegrations : [];

type KnowledgeStoreTileData = {
  kind?: string;
  slug: string;
  title: string;
  detail: string;
  brand?: string;
  color?: string;
  name?: string;
};
let liveKnowledgeStores = ld?.knowledgeStores;
let knowledgeStores: KnowledgeStoreTileData[] = Array.isArray(liveKnowledgeStores)
  ? liveKnowledgeStores.map((k: any) => ({
      ...k,
      name: k.name ?? (k.kind === "pinecone" ? "Pinecone" : (k.kind ?? "Vector store")),
      brand: k.brand ?? "FFFFFF",
      color: k.color ?? "1F1F1F",
    }))
  : [];

type AutomationRow = {
  name: string;
  cadence: string;
  lastRun: string;
  nextRun: string;
  status: "success" | "failed" | "pending" | string;
  source?: "cowork" | "codex" | "claude" | "claude-os";
  meta?: string;
};
let liveAutomations = ld?.automations;
let automations: AutomationRow[] = Array.isArray(liveAutomations) ? liveAutomations : [];

type DreamTone = "pink" | "orange" | "blue" | "yellow";

interface DreamSuggestion {
  id?: string;
  cat: "MEMORY" | "COST" | "SKILLS" | "WORKFLOW";
  tone: DreamTone;
  headline: string;
  prescription: string;
  evidence: string[];
  command?: string;
  dollarImpact: number;
  timeImpactMins: number;
}

// Real prescriptions from ~/.claude-os/dreams/dream-{date}.json (inlined by
// the aggregator). Empty array = "all caught up" empty state.
let livePrescriptions = ld?.dream?.prescriptions;
let dreamSuggestions: DreamSuggestion[] =
  Array.isArray(livePrescriptions) && livePrescriptions.length > 0
    ? livePrescriptions
    : [];
let dreamGeneratedAt: string | null = ld?.dream?.generatedAt ?? null;
let dreamDate: string | null = ld?.dream?.date ?? null;

// ---------- Page ----------

export function Home({ forceSetupModal = false }: { forceSetupModal?: boolean } = {}) {
  // Hydrate the module-level `ld` from the runtime hook so all helper
  // functions that read `ld` pick up the latest data from disk.
  ld = useLiveData();
  isDemoData = ld?.isExample === true;
  hasRealActivity = !isDemoData && Number(ld?.summary?.totalAssistantMessages ?? 0) > 0;
  isColdReal = !isDemoData && !hasRealActivity;

  // Re-derive module-level data captures from the freshly hydrated `ld`.
  // Without this, the `let`-bound module globals hold the value computed at
  // module-init when `ld = {}`, and the dashboard renders empty rails for
  // automations / integrations / knowledge stores / skill recs / dream.
  liveRecommended = ld?.skills?.recommended;
  skillRecommendations = Array.isArray(liveRecommended) ? liveRecommended : [];
  liveIntegrations = ld?.integrations;
  integrations = Array.isArray(liveIntegrations) ? liveIntegrations : [];
  liveKnowledgeStores = ld?.knowledgeStores;
  knowledgeStores = Array.isArray(liveKnowledgeStores)
    ? liveKnowledgeStores.map((k: any) => ({
        ...k,
        name: k.name ?? (k.kind === "pinecone" ? "Pinecone" : (k.kind ?? "Vector store")),
        brand: k.brand ?? "FFFFFF",
        color: k.color ?? "1F1F1F",
      }))
    : [];
  liveAutomations = ld?.automations;
  automations = Array.isArray(liveAutomations) ? liveAutomations : [];
  liveDerivedSkills = deriveSkillsFromLive();
  demoSkills = liveDerivedSkills;
  dailyActivity = computeDailyActivity();
  livePrescriptions = ld?.dream?.prescriptions;
  dreamSuggestions =
    Array.isArray(livePrescriptions) && livePrescriptions.length > 0 ? livePrescriptions : [];
  dreamGeneratedAt = ld?.dream?.generatedAt ?? null;
  dreamDate = ld?.dream?.date ?? null;
  // Modal-based setup gating: instead of navigating away to /setup, the
  // dashboard always renders and we layer the SetupModal over it when the
  // user has no config yet (or when /setup forced the modal open via prop).
  //
  // Why no `useLayoutEffect` redirect: every navigate races with localStorage
  // and the sidecar config probe. Eliminating the navigate eliminates the
  // entire class of "loop bugs" — the dashboard is one continuous render and
  // the modal is a state toggle.
  //
  // Initial modal state is computed synchronously from localStorage so we
  // don't flash the dashboard before the modal mounts on first paint.
  const [showSetupModal, setShowSetupModal] = React.useState<boolean>(() => {
    if (forceSetupModal) return true;
    if (typeof window === "undefined") return false;
    try {
      return !window.localStorage.getItem("claude-os-config");
    } catch {
      return false;
    }
  });

  // Just-installed override: when the terminal `bun run setup` finishes it
  // drops ~/.claude-os/show-wizard. The vite middleware reads that file
  // exactly once at /__just-installed and self-deletes. If we see it, we
  // force-open the wizard even when claude-os-config exists in localStorage
  // — this handles the "reinstalled on a laptop that already had Agentic OS"
  // case where the browser's cached config would otherwise skip the wizard.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/__just-installed");
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (j?.justInstalled) setShowSetupModal(true);
      } catch {
        /* dev server not exposing the endpoint — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (forceSetupModal) {
      setShowSetupModal(true);
      return;
    }
    let cancelled = false;

    const checkConfigured = async () => {
      if (typeof window === "undefined") return;

      // Pure-localStorage check. Sidecar is gone; the wizard's "Save"
      // button is the only path that writes claude-os-config, and it
      // runs synchronously before unmounting the modal — so by the time
      // the dashboard re-checks, the value is already there.
      let configured = false;
      try {
        configured = !!window.localStorage.getItem("claude-os-config");
      } catch (err) {
        console.warn("[home] localStorage config check failed:", err);
      }

      if (cancelled) return;

      // Sidecar may have hydrated localStorage with a config we didn't know
      // about — close the modal in that case. Conversely, never open the
      // modal here as a side-effect of the probe; the synchronous initializer
      // already opened it if localStorage was empty on first paint.
      if (configured) {
        setShowSetupModal(false);
        try {
          if (window.localStorage.getItem("claude-os-just-installed")) {
            window.localStorage.removeItem("claude-os-just-installed");
            import("canvas-confetti").then(({ default: confetti }) => {
              const colors = ["#D4B17E", "#C19A6B", "#9A7A4A", "#4A9EFF", "#3ddc97", "#60a5fa"];
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
              setTimeout(
                () =>
                  confetti({
                    particleCount: 80,
                    angle: 60,
                    spread: 70,
                    origin: { x: 0, y: 0.7 },
                    colors,
                  }),
                200,
              );
              setTimeout(
                () =>
                  confetti({
                    particleCount: 80,
                    angle: 120,
                    spread: 70,
                    origin: { x: 1, y: 0.7 },
                    colors,
                  }),
                350,
              );
            });
          }
        } catch (err) {
          console.warn("[home] just-installed marker check failed:", err);
        }
      }
    };

    void checkConfigured();
    return () => {
      cancelled = true;
    };
  }, [forceSetupModal]);

  const handleSetupClose = React.useCallback(() => {
    setShowSetupModal(false);
    // Fire celebration confetti when the modal closes after a successful
    // activate. The wizard sets "claude-os-just-installed" before calling
    // onClose, so reading + clearing it here is the natural gate.
    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem("claude-os-just-installed")
      ) {
        window.localStorage.removeItem("claude-os-just-installed");
        import("canvas-confetti").then(({ default: confetti }) => {
          const colors = ["#D4B17E", "#C19A6B", "#9A7A4A", "#4A9EFF", "#3ddc97", "#60a5fa"];
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
          setTimeout(
            () =>
              confetti({
                particleCount: 80,
                angle: 60,
                spread: 70,
                origin: { x: 0, y: 0.7 },
                colors,
              }),
            200,
          );
          setTimeout(
            () =>
              confetti({
                particleCount: 80,
                angle: 120,
                spread: 70,
                origin: { x: 1, y: 0.7 },
                colors,
              }),
            350,
          );
        });
      }
    } catch (err) {
      console.warn("[home] confetti on close failed:", err);
    }
  }, []);
  const [period, setPeriod] = useState<Period>("week");
  const [skillsExpanded, setSkillsExpanded] = useState<boolean>(false);
  const [dismissedDreams, setDismissedDreams] = useState<Set<number>>(new Set());
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedKpi, setExpandedKpi] = useState<"spend" | "skills" | null>(null);
  const [dreamIdx, setDreamIdx] = useState(0);
  const [spendView, setSpendView] = useState<"subscription" | "tokens">("subscription");
  const { rate, minutesFor, setMinutesFor, setRate } = useTimeSaved();

  // Skill totals from demo skills (per-period scaling: assumes "uses" is week)
  const periodFactor = period === "day" ? 1 / 7 : period === "week" ? 1 : 30 / 7;
  const skillStats = demoSkills.map((s) => {
    const uses = s.uses * periodFactor;
    const mins = uses * s.minsPerRun;
    return { ...s, periodUses: uses, mins, dollars: (mins / 60) * rate };
  });
  const saved = skillStats.reduce(
    (a, s) => ({ minutes: a.minutes + s.mins, dollars: a.dollars + s.dollars }),
    { minutes: 0, dollars: 0 },
  );

  // Rolling 28-day skills saved (independent of the per-card period)
  const saved28 = demoSkills.reduce(
    (a, s) => {
      const uses = s.uses * 4; // weekly → 28d
      const mins = uses * s.minsPerRun;
      return { minutes: a.minutes + mins, dollars: a.dollars + (mins / 60) * rate };
    },
    { minutes: 0, dollars: 0 },
  );

  // AI Spend with its own filter (drives top KPI + per-model strip)
  const [spendPeriod, setSpendPeriod] = useState<Period>("month");
  const weekSpend = usageDaily.reduce((a, d) => a + d.cost, 0);

  // Token equivalent — only shown inside the expanded detail view
  const tokenEquivalent =
    spendPeriod === "day"
      ? (usageDaily[usageDaily.length - 1]?.cost ?? 0)
      : spendPeriod === "week"
        ? weekSpend
        : weekSpend * (28 / 7);
  const spendSub =
    spendPeriod === "day" ? "today" : spendPeriod === "week" ? "last 7 days" : "last 28 days";
  const spendFactor = spendPeriod === "day" ? 1 / 7 : spendPeriod === "week" ? 1 : 4;

  // Token estimate (kept for detail expansion only)
  const tokensIn = ((tokenEquivalent * 0.7) / 3) * 1_000_000;
  const tokensOut = ((tokenEquivalent * 0.3) / 15) * 1_000_000;
  const fmtTok = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1000).toFixed(0)}K`;

  // Actual flat subscription spend — what the user actually pays per month
  const ldSubs = ld?.subscriptions ?? {};
  const subClaude = Number(ldSubs?.claude?.monthlyPrice ?? 0);
  const subChatGPT = Number(ldSubs?.chatgpt?.monthlyPrice ?? 0);
  const subCodex = Number(ldSubs?.codex?.monthlyPrice ?? 0);
  const subOpenRouter = 0; // pay-as-you-go, not flat
  const flatMonthlySpend = subClaude + subChatGPT + subCodex + subOpenRouter;
  // Scale to selected period
  const spendValue =
    spendPeriod === "day"
      ? flatMonthlySpend / 30
      : spendPeriod === "week"
        ? (flatMonthlySpend / 30) * 7
        : flatMonthlySpend;

  // Per-model spend — derived from liveData.modelSplit (computed by the
  // aggregator from real cost shares per model). Falls back to a sensible
  // single-Opus split when liveData is missing the field so the UI doesn't
  // crash, but the strip is hidden entirely if the list is empty.
  const liveModelSplit = ld?.modelSplit;
  const modelSplit: {
    name: string;
    slug: string;
    color: string;
    share: number;
    tagline: string;
  }[] = Array.isArray(liveModelSplit) && liveModelSplit.length > 0 ? liveModelSplit : [];

  // Skills saved scaled to the selected period
  const savedPeriod = {
    minutes: saved28.minutes * (spendFactor / 4),
    dollars: saved28.dollars * (spendFactor / 4),
  };
  const configuredCount = demoSkills.filter((s) => minutesFor(s.name) > 0).length;
  const skillsConfigured = configuredCount > 0;
  const dreamCount = dreamSuggestions.length;

  return (
    <>
      {showSetupModal && <SetupModal onClose={handleSetupClose} />}
      <div className="max-w-[1400px]">
        {/* ============= TOP — KPI STRIP ============= */}
        <header className="mb-8">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
                <EyebrowAvatar />
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
                {isColdReal && (
                  <span
                    title="The aggregator ran but found no Claude activity. Either run a Claude Code session and re-run `bun run scripts/aggregate.ts`, or check Full Disk Access for your terminal in System Settings."
                    className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
                    style={{
                      background: "rgba(239, 68, 68, 0.14)",
                      color: "#f87171",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    NEEDS A SESSION
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <GreetingHeadline />
                <OperatorScorePill
                  score={operatorScore.score}
                  components={operatorScore.components}
                />
              </div>
              <NowWorkingOn />
            </div>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-card/60 backdrop-blur shadow-sm">
              {(["day", "week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSpendPeriod(p)}
                  className={`px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] font-medium rounded-md transition-all ${
                    spendPeriod === p
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {p === "day" ? "Today" : p === "week" ? "7 days" : "28 days"}
                </button>
              ))}
            </div>
          </div>

          {/* Three premium KPI panels — all driven by the period toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. AI Spend — flat subscription cost */}
            <KpiPanel
              eyebrow="AI spend"
              icon={Zap}
              value={`$${Math.round(spendValue).toLocaleString()}`}
              sub={`${spendSub} · click for breakdown`}
              tone="orange"
              accent="#C19A6B"
              active={expandedKpi === "spend"}
              onClick={() => setExpandedKpi(expandedKpi === "spend" ? null : "spend")}
              glyph={
                <svg viewBox="0 0 200 90" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="kg1f" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#D4B17E" stopOpacity="0.55" />
                      <stop offset="55%" stopColor="#C19A6B" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#9A7A4A" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="kg1l" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#D4B17E" stopOpacity="0.85" />
                      <stop offset="55%" stopColor="#C19A6B" stopOpacity="1" />
                      <stop offset="100%" stopColor="#9A7A4A" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const max = Math.max(...usageDaily.map((x) => x.cost), 1);
                    const pts = usageDaily.map((d, i) => {
                      const x = (i / (usageDaily.length - 1)) * 200;
                      const y = 86 - (d.cost / max) * 72;
                      return [x, y] as [number, number];
                    });
                    const path = pts.reduce((acc, [x, y], i) => {
                      if (i === 0) return `M${x},${y}`;
                      const [px, py] = pts[i - 1];
                      const cx = (px + x) / 2;
                      return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
                    }, "");
                    return (
                      <>
                        <path d={`${path} L200,90 L0,90 Z`} fill="url(#kg1f)" />
                        <path d={path} stroke="url(#kg1l)" strokeWidth="2" fill="none" strokeLinecap="round" />
                      </>
                    );
                  })()}
                </svg>
              }
            />
            {/* 2. Skills saved (middle) — $0 until configured */}
            <KpiPanel
              eyebrow="Skills saved"
              icon={DollarSign}
              value={skillsConfigured ? `$${Math.round(savedPeriod.dollars).toLocaleString()}` : "$0"}
              sub={skillsConfigured
                ? `${formatHours(savedPeriod.minutes)} saved · ${configuredCount} skills configured`
                : `${demoSkills.length} skills detected · click to configure`}
              tone="emerald"
              accent="#3ddc97"
              active={expandedKpi === "skills"}
              onClick={() => setExpandedKpi(expandedKpi === "skills" ? null : "skills")}
              glyph={
                <svg viewBox="0 0 200 90" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="kg3f" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.55" />
                      <stop offset="55%" stopColor="#3ddc97" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#3ddc97" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="kg3l" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#aaffd9" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const n = Math.max(usageDaily.length, 7);
                    const pts: [number, number][] = [];
                    let acc = 0;
                    for (let i = 0; i < n; i++) {
                      acc += 0.5 + 0.45 * Math.sin(i * 1.3) + (i / n) * 0.6;
                      pts.push([(i / (n - 1)) * 200, acc]);
                    }
                    const max = pts[pts.length - 1][1];
                    const norm = pts.map(([x, v]) => [x, 84 - (v / max) * 74] as [number, number]);
                    const path = norm.reduce((a, [x, y], i) => {
                      if (i === 0) return `M${x},${y}`;
                      const [px, py] = norm[i - 1];
                      const cx2 = (px + x) / 2;
                      return `${a} C${cx2},${py} ${cx2},${y} ${x},${y}`;
                    }, "");
                    return (
                      <>
                        <path d={`${path} L200,90 L0,90 Z`} fill="url(#kg3f)" />
                        <path d={path} stroke="url(#kg3l)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      </>
                    );
                  })()}
                </svg>
              }
            />
            {/* 3. Sessions — real activity count */}
            <KpiPanel
              eyebrow="Activity"
              icon={TrendingUp}
              value={`${Number(ld?.summary?.totalAssistantMessages ?? 0).toLocaleString()}`}
              sub={`${Number(ld?.summary?.messagesLast7d ?? 0).toLocaleString()} turns last 7d · ${Number(ld?.summary?.projectsTracked ?? 0)} projects`}
              tone="violet"
              accent="#4A9EFF"
              glyph={
                <svg viewBox="0 0 200 90" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="kg2f" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4A9EFF" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#4A9EFF" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="kg2l" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#ddd6fe" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const dailyMsgs = usageDaily.map((d) => (d as any).messages ?? d.runs ?? d.cost);
                    const max = Math.max(...dailyMsgs, 1);
                    const pts = dailyMsgs.map((v, i) => {
                      const x = (i / (dailyMsgs.length - 1)) * 200;
                      const y = 86 - (v / max) * 72;
                      return [x, y] as [number, number];
                    });
                    const path = pts.reduce((a, [x, y], i) => {
                      if (i === 0) return `M${x},${y}`;
                      const [px, py] = pts[i - 1];
                      const cx2 = (px + x) / 2;
                      return `${a} C${cx2},${py} ${cx2},${y} ${x},${y}`;
                    }, "");
                    return (
                      <>
                        <path d={`${path} L200,90 L0,90 Z`} fill="url(#kg2f)" />
                        <path d={path} stroke="url(#kg2l)" strokeWidth="2" fill="none" strokeLinecap="round" />
                      </>
                    );
                  })()}
                </svg>
              }
            />
          </div>


          {/* KPI expansion: AI Spend → subscriptions + savings */}
          {expandedKpi === "spend" && (
            <SpendExpansion
              onClose={() => setExpandedKpi(null)}
              spendValue={spendValue}
              tokenEquivalent={tokenEquivalent}
              spendSub={spendSub}
            />
          )}
          {/* KPI expansion: Skills Saved → hourly rate + per-skill table */}
          {expandedKpi === "skills" && (
            <SkillsSavedExpansion
              onClose={() => setExpandedKpi(null)}
              rate={rate}
              setRate={setRate}
              skills={demoSkills}
              minutesFor={minutesFor}
              setMinutesFor={setMinutesFor}
              period={period}
            />
          )}
          {/* Per-model spend strip — Subscription / Tokens tabs */}
          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="inline-flex rounded-lg border border-border/70 bg-black/20 p-0.5">
                <button
                  onClick={() => setSpendView("subscription")}
                  className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider transition-colors ${
                    spendView === "subscription"
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  Subscriptions
                </button>
                <button
                  onClick={() => setSpendView("tokens")}
                  className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider transition-colors ${
                    spendView === "tokens"
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  Tokens · API-equivalent
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {spendView === "subscription" ? (
                  <>flat monthly spend</>
                ) : (
                  <>
                    ${tokenEquivalent.toFixed(2)} equivalent · {spendSub}
                  </>
                )}
              </div>
            </div>

            {spendView === "subscription" && <SubscriptionStrip apiEquivalent={tokenEquivalent} />}

            {spendView === "tokens" && modelSplit.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
                No per-model usage detected yet. Run a Claude Code session and re-run{" "}
                <code className="text-foreground/80">bun run scripts/aggregate.ts</code> to populate
                this strip.
              </div>
            )}

            {spendView === "tokens" && modelSplit.length > 0 && (
              <>
                <div className="text-[11px] text-muted-foreground mb-3 flex items-start gap-1.5">
                  <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
                  <span>
                    You're on subscription, so these aren't billed amounts — it's what the metered
                    API would charge for the same tokens. The number proves your subscription is
                    paying off.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {modelSplit.map((m) => {
                    const dollars = tokenEquivalent * m.share;
                    const isOpen = expandedModel === m.name;
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => setExpandedModel(isOpen ? null : m.name)}
                        className={`group relative rounded-xl border bg-black/30 p-3 overflow-hidden transition-all hover:-translate-y-0.5 text-left ${
                          isOpen
                            ? "border-foreground/50 ring-1 ring-foreground/20"
                            : "border-border/70 hover:border-foreground/30"
                        }`}
                        style={{
                          backgroundImage: `radial-gradient(120% 80% at 0% 0%, #${m.color}22, transparent 60%)`,
                        }}
                      >
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"
                          style={{ background: `#${m.color}` }}
                        />
                        <div className="relative flex items-center gap-2.5 mb-2">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                            style={{
                              background: `#${m.color}1f`,
                              boxShadow: `inset 0 0 0 1px #${m.color}55`,
                            }}
                          >
                            <img
                              src={`https://cdn.simpleicons.org/${m.slug}/FFFFFF`}
                              alt={m.name}
                              className="relative h-5 w-5 object-contain"
                              loading="lazy"
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.style.display = "none";
                                const fb = el.nextElementSibling as HTMLElement | null;
                                if (fb) fb.style.opacity = "1";
                              }}
                            />
                            <span
                              aria-hidden
                              style={{ color: `#${m.color}`, opacity: 0 }}
                              className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold transition-opacity"
                            >
                              {m.name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold leading-tight truncate">
                              {m.name}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                              {m.tagline}
                            </div>
                          </div>
                          <ArrowUpRight
                            className={`h-3 w-3 text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                          />
                        </div>
                        <div className="relative flex items-baseline justify-between">
                          <span className="text-base font-semibold tabular-nums">
                            ${dollars.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {Math.round(m.share * 100)}%
                          </span>
                        </div>
                        <div className="relative mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${m.share * 100}%`,
                              background: `linear-gradient(90deg, #${m.color}, #${m.color}88)`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Tokenomics expander */}
            {spendView === "tokens" &&
              expandedModel &&
              (() => {
                const m = modelSplit.find((x) => x.name === expandedModel)!;
                const dollars = spendValue * m.share;
                const inRate =
                  m.tagline === "Anthropic" && m.name.includes("Opus")
                    ? 15
                    : m.tagline === "Anthropic"
                      ? 3
                      : m.tagline === "OpenAI"
                        ? 2.5
                        : m.tagline === "Google"
                          ? 1.25
                          : 0.27;
                const outRate =
                  m.tagline === "Anthropic" && m.name.includes("Opus")
                    ? 75
                    : m.tagline === "Anthropic"
                      ? 15
                      : m.tagline === "OpenAI"
                        ? 10
                        : m.tagline === "Google"
                          ? 5
                          : 1.1;
                const inputTokens = ((dollars * 0.65) / inRate) * 1_000_000;
                const outputTokens = ((dollars * 0.35) / outRate) * 1_000_000;
                const calls = Math.round(20 + m.share * 800);
                const avgIn = Math.round(inputTokens / Math.max(calls, 1));
                const avgOut = Math.round(outputTokens / Math.max(calls, 1));
                const avgCost = dollars / Math.max(calls, 1);
                const cacheHitPct = Math.round(15 + m.share * 60);
                const fmt = (n: number) =>
                  n >= 1_000_000
                    ? `${(n / 1_000_000).toFixed(2)}M`
                    : n >= 1_000
                      ? `${(n / 1_000).toFixed(1)}K`
                      : Math.round(n).toString();
                return (
                  <div
                    className="mt-3 rounded-xl border border-border bg-black/40 backdrop-blur p-5 animate-fade-in"
                    style={{
                      backgroundImage: `radial-gradient(120% 80% at 100% 0%, #${m.color}1f, transparent 60%)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-md flex items-center justify-center"
                          style={{
                            background: `#${m.color}26`,
                            boxShadow: `inset 0 0 0 1px #${m.color}55`,
                          }}
                        >
                          <img
                            src={`https://cdn.simpleicons.org/${m.slug}/FFFFFF`}
                            alt=""
                            className="h-4 w-4"
                          />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold leading-tight">
                            {m.name} · tokenomics
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {spendSub} · ${dollars.toFixed(2)} of ${spendValue.toFixed(2)} total
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedModel(null)}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        close
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5 items-center">
                      {/* Pie chart of share across all models — hover swaps the highlighted model */}
                      <SpendPie
                        models={modelSplit}
                        highlight={m.name}
                        total={spendValue}
                        onHover={(name) => name && setExpandedModel(name)}
                      />

                      <div className="space-y-4">
                        {/* Headline stats — bigger, clearer */}
                        <div className="grid grid-cols-3 gap-3">
                          <BigStat
                            label="Calls"
                            value={calls.toLocaleString()}
                            accent={`#${m.color}`}
                            icon={ActivityIcon}
                          />
                          <BigStat
                            label="Avg cost / call"
                            value={`$${avgCost.toFixed(3)}`}
                            accent={`#${m.color}`}
                            icon={DollarSign}
                          />
                          <BigStat
                            label="Cache hit"
                            value={`${cacheHitPct}%`}
                            accent={`#${m.color}`}
                            icon={Zap}
                          />
                        </div>

                        {/* Input vs output bar */}
                        <div>
                          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                            <span>Token flow</span>
                            <span className="tabular-nums normal-case tracking-normal">
                              <span className="text-foreground/80">{fmt(inputTokens)} in</span>
                              <span className="mx-1.5">·</span>
                              <span className="text-foreground/80">{fmt(outputTokens)} out</span>
                            </span>
                          </div>
                          <div className="relative h-2.5 rounded-full bg-muted/30 overflow-hidden flex">
                            <div
                              className="h-full transition-all duration-700 relative"
                              style={{
                                width: `${(inputTokens / (inputTokens + outputTokens)) * 100}%`,
                                background: `linear-gradient(90deg, #${m.color}ff 0%, #${m.color}cc 60%, #${m.color}88 100%)`,
                                boxShadow: `0 0 16px #${m.color}aa, inset 0 0 8px rgba(255,255,255,0.18)`,
                              }}
                            />
                            <div
                              className="h-full transition-all duration-700"
                              style={{
                                width: `${(outputTokens / (inputTokens + outputTokens)) * 100}%`,
                                background: `linear-gradient(90deg, #${m.color}66 0%, #${m.color}33 60%, #${m.color}11 100%)`,
                              }}
                            />
                            <div
                              aria-hidden
                              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 token-flow-shimmer"
                              style={{
                                background:
                                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                            <span>avg {avgIn.toLocaleString()} tok / call</span>
                            <span>avg {avgOut.toLocaleString()} tok / call</span>
                          </div>
                        </div>

                        {/* Rates row */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Input rate</span>
                            <span className="font-mono tabular-nums">${inRate}/M tok</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Output rate</span>
                            <span className="font-mono tabular-nums">${outRate}/M tok</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        </header>

        {/* ============= LIVE USAGE — subscriptions, windows, credit ============= */}
        <UsagePanel />

        {/* ============= HERO — DREAM REVIEW ============= */}
        <section className="relative mb-12">
          <div className="relative rounded-2xl border border-violet-500/25 overflow-hidden">
            {/* Stargazing background */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 80% 60% at 50% 110%, rgba(139,92,246,0.45) 0%, transparent 60%)," +
                    "radial-gradient(ellipse 60% 50% at 15% -10%, rgba(56,189,248,0.25) 0%, transparent 55%)," +
                    "radial-gradient(ellipse 50% 40% at 90% 10%, rgba(236,72,153,0.22) 0%, transparent 55%)," +
                    "linear-gradient(180deg, #050416 0%, #0a0820 50%, #110a2e 100%)",
                }}
              />
              {/* Twinkling starfield */}
              <div className="dream-stars" />
              {/* Soft glowing nebula orbs */}
              <div
                className="absolute -top-24 -left-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
                style={{
                  background: "radial-gradient(circle, rgba(167,139,250,0.6), transparent 70%)",
                }}
              />
              <div
                className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full opacity-50 blur-3xl"
                style={{
                  background: "radial-gradient(circle, rgba(236,72,153,0.5), transparent 70%)",
                }}
              />
              {/* Subtle grid for depth */}
              <svg
                className="absolute inset-0 w-full h-full opacity-[0.08] mix-blend-screen"
                preserveAspectRatio="none"
                viewBox="0 0 1200 460"
              >
                <defs>
                  <pattern id="dreamGridHero" width="44" height="44" patternUnits="userSpaceOnUse">
                    <path d="M44 0H0V44" fill="none" stroke="#c4b5fd" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="1200" height="460" fill="url(#dreamGridHero)" />
              </svg>
            </div>

            <div className="relative p-7 md:p-10">
              <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-violet-200/70 mb-2">
                    Dream Review
                  </div>
                  <div className="text-2xl md:text-3xl font-semibold tracking-tight text-violet-50">
                    {dreamCount - dismissedDreams.size} improvement
                    {dreamCount - dismissedDreams.size === 1 ? "" : "s"} found overnight
                  </div>
                  <div className="text-[12px] text-violet-200/60 mt-1.5">
                    {dreamGeneratedAt
                      ? `Pattern analysis across 7 days · generated ${new Date(dreamGeneratedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                      : dreamCount === 0
                        ? 'Dream runs automatically on your configured cron schedule. Run claude -p "/dream" to trigger it now.'
                        : "Pattern analysis across 7 days"}
                  </div>
                </div>
                {dismissedDreams.size > 0 && (
                  <button
                    onClick={() => setDismissedDreams(new Set())}
                    className="text-[11px] uppercase tracking-[0.2em] px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-300/30 text-violet-100 hover:bg-violet-500/30 transition-colors backdrop-blur"
                  >
                    Restore dismissed
                  </button>
                )}
              </div>

              {(() => {
                const visible = dreamSuggestions
                  .map((d, i) => ({ ...d, originalIndex: i }))
                  .filter((d) => !dismissedDreams.has(d.originalIndex));
                if (visible.length === 0) {
                  // Two distinct empty states:
                  //   - dreamSuggestions.length === 0 → no dream JSON exists yet
                  //   - dreamSuggestions has entries but all dismissed → caught up
                  const noDreamYet = dreamSuggestions.length === 0;
                  return (
                    <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-8 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-3" />
                      <div className="text-sm text-emerald-100">
                        {noDreamYet
                          ? "Dream review runs on your configured cron schedule. It will appear here after its first run — or run claude -p \"/dream\" to trigger now."
                          : "All caught up. Nothing else for tonight."}
                      </div>
                    </div>
                  );
                }
                const safeIdx = dreamIdx % visible.length;
                const cur = visible[safeIdx];
                return (
                  <DreamCarousel
                    cur={cur}
                    total={visible.length}
                    index={safeIdx}
                    prev={() => setDreamIdx((i) => (i - 1 + visible.length) % visible.length)}
                    next={() => setDreamIdx((i) => (i + 1) % visible.length)}
                    onDismiss={() => {
                      setDismissedDreams((prev) => {
                        const next = new Set(prev);
                        next.add(cur.originalIndex);
                        return next;
                      });
                      setDreamIdx(0);
                    }}
                  />
                );
              })()}
            </div>
            <DreamWinsStrip resolved={(ld?.dream as any)?.resolved ?? []} />
          </div>
        </section>

        {/* ============= MISSION CONTROL — long-term goal planning ============= */}
        <HermesMissionControl />

        {/* ============= SECTION 1 — SKILLS ============= */}
        <section className="mb-14">
          <SectionHead
            eyebrow="Skills"
            title="Your skills"
            right={
              <Link
                to="/skills"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                All skills <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          {(() => {
            if (skillStats.length === 0) {
              return (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
                  No skills detected yet. Run any{" "}
                  <code className="text-foreground/80">/&lt;command&gt;</code> in Claude Code (e.g.{" "}
                  <code className="text-foreground/80">/recall</code>,{" "}
                  <code className="text-foreground/80">/wrap-up</code>) and re-run{" "}
                  <code className="text-foreground/80">bun run scripts/aggregate.ts</code> to start
                  tracking.
                </div>
              );
            }
            const sorted = [...skillStats].sort((a, b) => b.dollars - a.dollars);
            const visible = skillsExpanded ? sorted : sorted.slice(0, 4);
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {visible.map((s) => (
                    <SkillCard key={s.name} s={s} period={period} />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3" />
                    Time-per-run is AI-estimated. Click any card to edit on the Skills tab.
                  </div>
                  {sorted.length > 4 && (
                    <button
                      onClick={() => setSkillsExpanded((v) => !v)}
                      className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 hover:bg-accent/40 transition-colors"
                    >
                      {skillsExpanded ? "Show top 4" : `Show all ${sorted.length}`}
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </section>

        {/* ============= SECTION 2 — MEMORY ============= */}
        <section className="mb-14">
          <SectionHead
            eyebrow="Memory"
            title="Your memory"
            right={
              <Link
                to="/memory"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Open map <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div
              className="relative w-full"
              style={{
                height: 460,
                background:
                  "radial-gradient(ellipse 90% 65% at 50% 55%, rgba(61,220,151,0.18) 0%, rgba(0,0,0,0.92) 65%, #000 100%), #000",
              }}
            >
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none mix-blend-screen"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 40% at 25% 70%, rgba(96,165,250,0.14) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 80% 25%, rgba(244,114,182,0.10) 0%, transparent 55%)",
                }}
              />
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
                    Loading memory graph…
                  </div>
                }
              >
                <MemoryGraph3D onSelect={() => {}} embedded />
              </Suspense>

              {/* LEFT overlay — legend */}
              <div className="absolute top-4 left-4 z-10 w-52 rounded-xl border border-border/60 bg-black/70 backdrop-blur p-3 text-[11px] space-y-1.5 pointer-events-none">
                <div className="text-muted-foreground uppercase tracking-wider text-[9px] mb-1.5">
                  Node legend
                </div>
                <LegendDot color="#3ddc97" label="Memory core" />
                <LegendDot color="#e6ebf2" label="Workspaces" />
                <LegendDot color="#4A9EFF" label="Decisions" />
                <LegendDot color="#60a5fa" label="Sessions" />
                <LegendDot color="#f472b6" label="Skills" />
                <LegendDot color="#f5b14c" label="Stale" />
                <LegendDot color="#ef5a5a" label="Missing" />
              </div>

              {/* RIGHT overlay — recent signals from the aggregator's memory.events feed */}
              <MemorySignalsOverlay />
            </div>
            <MemoryStatsFooter />
          </div>
        </section>

        {/* ============= SECTION 3 — INTEGRATIONS ============= */}
        {integrations.length > 0 && (
          <section className="mb-14">
            <SectionHead eyebrow="Integrations" title="What's plugged into your stack" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {integrations.map((it) => (
                <IntegrationTile key={it.name} {...it} />
              ))}
            </div>
          </section>
        )}

        {/* ============= SECTION 4 — VECTOR INDEXES ============= */}
        {knowledgeStores.length > 0 && (
          <section className="mb-14">
            <SectionHead eyebrow="Memory sources" title="Connected vector indexes" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {knowledgeStores.map((k) => (
                <div
                  key={k.title}
                  className="group rounded-xl border border-border bg-card p-4 flex items-start gap-3 hover:border-foreground/30 transition-colors overflow-hidden relative"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
                    style={{ background: `#${k.brand}` }}
                  />
                  <div
                    className="relative h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `#${k.brand}1a`,
                      boxShadow: `inset 0 0 0 1px #${k.brand}40`,
                    }}
                  >
                    <img
                      src={`https://cdn.simpleicons.org/${k.slug}/FFFFFF`}
                      alt={k.name ?? k.title}
                      className="h-5 w-5 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="min-w-0 relative">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {k.name ?? k.title}
                    </div>
                    <div className="text-sm font-semibold truncate">{k.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{k.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============= SECTION 5 — AUTOMATIONS ============= */}
        <section className="mb-14">
          <SectionHead eyebrow="Automations" title="Scheduled tasks" />
          {automations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
              No automations detected — set up scheduled tasks in Cowork, automations in
              Codex, or add tasks to <code className="text-foreground/80">~/.claude/tasks/</code>.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {automations.map((a) => (
                <div
                  key={a.name}
                  className="grid grid-cols-12 items-center px-4 py-3 gap-3 text-xs"
                >
                  <div className="col-span-12 md:col-span-4 flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    {a.source && (
                      <span
                        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                          a.source === "cowork"
                            ? "bg-orange-500/15 text-orange-400"
                            : a.source === "codex"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : a.source === "claude-os"
                                ? "bg-violet-500/15 text-violet-400"
                                : "bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        {a.source === "claude-os" ? "OS" : a.source}
                      </span>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-3 text-muted-foreground">{a.cadence}</div>
                  <div className="col-span-6 md:col-span-2 text-muted-foreground">
                    last: {a.lastRun}
                  </div>
                  <div className="col-span-6 md:col-span-2 text-muted-foreground">
                    next: {a.nextRun}
                  </div>
                  <div className="col-span-6 md:col-span-1 flex md:justify-end">
                    {a.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> ok
                      </span>
                    ) : a.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                        <XCircle className="h-3 w-3" /> failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]">
                        <Clock className="h-3 w-3" /> {a.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ============= SECTION 7 — DAILY ACTIVITY (rising trend) ============= */}
        <section className="mb-10">
          <SectionHead
            eyebrow="Activity"
            title="Sessions per day"
            right={
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Last 14 days · trending up
              </span>
            }
          />
          <DailyActivityRows />
        </section>

        {/* ============= SECTION 8 — SKILL RECOMMENDER ============= */}
        {skillRecommendations.length > 0 && (
          <section className="mb-12">
            <SectionHead
              eyebrow="Recommender"
              title="Skills your sessions are asking for"
              right={
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Based on {skillRecommendations.reduce((a, s) => a + s.evidenceCount, 0)} signals ·
                  refreshed this morning
                </span>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {skillRecommendations.map((s) => (
                <SkillRecommenderCard key={s.name} rec={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ---------- Pieces ----------

function KpiPanel({
  eyebrow,
  icon: Icon,
  value,
  sub,
  tone,
  accent,
  glyph,
  onClick,
  active,
}: {
  eyebrow: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: string;
  sub: string;
  tone: "emerald" | "amber" | "violet" | "orange";
  accent: string;
  glyph?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneText =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "orange"
          ? "text-orange-300"
          : "text-violet-200";
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative rounded-2xl border bg-card overflow-hidden p-5 min-w-0 transition-all text-left w-full ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      } ${active ? "border-foreground/50 ring-1 ring-foreground/20" : "border-border hover:border-foreground/30"}`}
      style={{
        backgroundImage: `radial-gradient(120% 100% at 0% 0%, ${accent}1f, transparent 60%)`,
        boxShadow: active
          ? `0 16px 48px -16px ${accent}66, inset 0 1px 0 rgba(255, 255, 255, 0.04)`
          : "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity"
        style={{ background: accent }}
      />
      {glyph && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 opacity-80"
        >
          {glyph}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            {eyebrow}
          </div>
          {onClick && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground transition-colors">
              {active ? "close" : "details"}
            </span>
          )}
        </div>
        <div
          className={`mt-3 text-4xl md:text-5xl font-semibold tabular-nums tracking-tight leading-[1.05] ${toneText}`}
          style={{ textShadow: `0 0 40px ${accent}55` }}
        >
          {value}
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{sub}</div>
      </div>
    </Tag>
  );
}

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5 inline-flex items-center gap-2">
          <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground/60" />
          {eyebrow}
        </div>
        <h2 className="text-lg md:text-xl font-semibold tracking-tight leading-tight">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function SkillCard({
  s,
  period,
}: {
  s: DemoSkill & { periodUses: number; mins: number; dollars: number };
  period: Period;
}) {
  const Icon = s.icon;
  const dot =
    s.status === "active"
      ? "bg-emerald-500"
      : s.status === "dormant"
        ? "bg-amber-500"
        : "bg-zinc-600";
  const periodWord = period === "day" ? "today" : period === "week" ? "this week" : "this month";
  // Pseudo-random hue per skill name (stable, image-like cover)
  let h = 0;
  for (let i = 0; i < s.name.length; i++) h = (h * 31 + s.name.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 60) % 360;
  return (
    <Link
      to="/skills"
      className="group rounded-xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors flex flex-col"
    >
      {/* Image-like header */}
      <div
        className="relative h-20 overflow-hidden"
        style={{
          background:
            `radial-gradient(circle at 20% 20%, hsla(${hue1}, 80%, 60%, 0.55), transparent 55%),` +
            `radial-gradient(circle at 80% 80%, hsla(${hue2}, 80%, 55%, 0.55), transparent 55%),` +
            `linear-gradient(135deg, hsl(${hue1}, 50%, 14%), hsl(${hue2}, 50%, 10%))`,
        }}
      >
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-30"
          preserveAspectRatio="none"
          viewBox="0 0 100 40"
        >
          <pattern id={`sk-${hue1}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M6 0H0V6" stroke="white" strokeWidth="0.2" fill="none" />
          </pattern>
          <rect width="100" height="40" fill={`url(#sk-${hue1})`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-11 w-11 rounded-xl bg-black/30 backdrop-blur border border-white/15 flex items-center justify-center"
            style={{ boxShadow: `0 6px 24px hsla(${hue1}, 80%, 50%, 0.35)` }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${dot}`} title={s.status} />
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{s.name}</div>
          <div className="text-[10px] text-muted-foreground">last used {s.lastUsed}</div>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>
            ${Math.round(s.dollars).toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">saved {periodWord}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-[11px]">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Used</div>
            <div className="font-semibold tabular-nums">
              {Math.round(s.periodUses)}× {periodWord}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
              ~per run{" "}
              {s.estimateSource === "ai" ? (
                <Sparkles className="h-2.5 w-2.5" />
              ) : (
                <Pencil className="h-2.5 w-2.5" />
              )}
            </div>
            <div className="font-semibold tabular-nums">{s.minsPerRun} min</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function IntegrationTile({
  name,
  slug,
  connected,
  color,
  tagline,
}: {
  name: string;
  slug: string;
  connected: boolean;
  color: string;
  tagline?: string;
}) {
  const local = LOCAL_LOGO_MAP[slug];
  const logo = local ?? `https://cdn.simpleicons.org/${slug}/${color}`;
  const isLocal = !!local;
  const initial = name.charAt(0);
  return (
    <div
      className={`group relative rounded-xl border bg-card p-3 flex items-center gap-3 transition-all overflow-hidden ${
        connected
          ? "border-border hover:border-foreground/30 hover:-translate-y-0.5"
          : "border-border/60 opacity-60"
      }`}
    >
      {/* Subtle brand-color halo on hover so each tile has its own personality */}
      {connected && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ background: `#${color}` }}
        />
      )}
      <div
        className="relative h-10 w-10 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-border/60 overflow-hidden"
        style={{ boxShadow: connected ? `inset 0 0 0 1px #${color}22` : undefined }}
      >
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums"
          style={{ color: `#${color}` }}
        >
          {initial}
        </span>
        <img
          src={logo}
          alt={name}
          className="relative h-5 w-5 object-contain"
          loading="lazy"
          style={isLocal ? { color: `#${color}`, filter: "none" } : undefined}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1 truncate">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? "bg-emerald-500" : "bg-zinc-600"}`}
            style={connected ? { boxShadow: "0 0 6px rgba(16, 185, 129, 0.7)" } : undefined}
          />
          <span className="truncate">{tagline ?? (connected ? "connected" : "not connected")}</span>
        </div>
      </div>
    </div>
  );
}

function DreamItem({
  cat,
  text,
  tone,
  index,
  dismissed,
  onDismiss,
}: {
  cat: string;
  text: string;
  tone: DreamTone;
  index: number;
  dismissed: boolean;
  onDismiss: () => void;
}) {
  const [bursting, setBursting] = useState(false);
  const [hidden, setHidden] = useState(false);
  React.useEffect(() => {
    if (dismissed) {
      setBursting(true);
      const t = setTimeout(() => setHidden(true), 700);
      return () => clearTimeout(t);
    }
  }, [dismissed]);

  if (hidden) return null;

  const palette = DREAM_PALETTES[tone];

  const catIcon =
    cat === "MEMORY"
      ? Brain
      : cat === "COST"
        ? DollarSign
        : cat === "SKILLS"
          ? Sparkles
          : cat === "WORKFLOW"
            ? Workflow
            : Lightbulb;
  const CatIcon = catIcon;

  return (
    <div
      className={`group relative rounded-2xl border ${palette.ring} bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5 overflow-hidden transition-all duration-500 ${
        bursting ? "opacity-0 scale-95" : "opacity-100 scale-100 hover:-translate-y-0.5"
      }`}
      style={{
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.03), 0 8px 28px -12px ${palette.glow}`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50"
        style={{ background: palette.glow }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: palette.glow.replace("0.35", "0.18"),
            boxShadow: `inset 0 0 0 1px ${palette.glow.replace("0.35", "0.45")}`,
          }}
        >
          <CatIcon className="h-4 w-4" style={{ color: palette.icon }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[9px] tracking-[0.2em] px-1.5 py-0.5 rounded border ${palette.chip}`}
            >
              {cat}
            </span>
            {tone === "pink" && <AlertTriangle className="h-3 w-3 text-pink-300" />}
          </div>
          <p className="text-[13px] leading-relaxed text-violet-50/95">{text}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Mark as done"
          className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-violet-100/70 hover:bg-emerald-500/20 hover:border-emerald-300/50 hover:text-emerald-200 transition-all shrink-0 flex items-center justify-center"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {bursting && <Confetti seed={index} />}
    </div>
  );
}

function Confetti({ seed }: { seed: number }) {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const rand = (n: number) =>
          (((Math.sin(seed * 9.7 + i * 12.3 + n) * 43758.5453) % 1) + 1) % 1;
        const angle = rand(1) * Math.PI * 2;
        const dist = 60 + rand(2) * 90;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 20,
          r: rand(3) * 360,
          c: ["#4A9EFF", "#f472b6", "#3ddc97", "#fde68a", "#bae6fd", "#ddd6fe"][
            Math.floor(rand(4) * 6)
          ],
          d: 4 + rand(5) * 6,
        };
      }),
    [seed],
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute block confetti-piece"
          style={{
            background: p.c,
            width: `${p.d}px`,
            height: `${p.d * 0.4}px`,
            // @ts-expect-error custom props
            "--tx": `${p.x}px`,
            "--ty": `${p.y}px`,
            "--rot": `${p.r}deg`,
          }}
        />
      ))}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}

// Recent wins — prescriptions that Dream auto-resolved (or that the operator
// accepted) since the previous run. Positive feedback loop: instead of the
// dashboard only ever surfacing problems, it also says "this one fixed itself
// — here's the evidence."
function DreamWinsStrip({ resolved }: { resolved: any[] }) {
  if (!Array.isArray(resolved) || resolved.length === 0) return null;
  const titleize = (id: string) =>
    String(id || "")
      .replace(/^([a-z]+)-/, "$1 · ")
      .replace(/-/g, " ");
  return (
    <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-500/[0.04] p-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/80 inline-flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3" />
          Recent wins
        </div>
        <div className="text-[10.5px] text-emerald-200/55 tabular-nums">
          {resolved.length} resolved since last week
        </div>
      </div>
      <ul className="space-y-2">
        {resolved.slice(0, 4).map((w: any) => (
          <li
            key={w.id}
            className="flex items-start gap-3 text-[12px] text-emerald-50/90"
          >
            <span
              aria-hidden
              className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
              style={{
                background: "oklch(0.70 0.16 150)",
                boxShadow: "0 0 6px oklch(0.70 0.16 150 / 60%)",
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-snug text-emerald-50/95 mb-0.5">
                {titleize(w.id)}
              </div>
              {w.resolvedReason && (
                <div className="text-[11px] text-emerald-200/65 leading-snug">
                  {w.resolvedReason}
                </div>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-200/45 tabular-nums shrink-0">
              {w.status === "accepted" ? "accepted" : "auto"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ n, label, tone }: { n: string; label: string; tone?: "amber" | "red" }) {
  const c =
    tone === "red" ? "text-red-400" : tone === "amber" ? "text-amber-400" : "text-foreground";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-semibold tabular-nums tracking-tight ${c}`}>{n}</span>
      <span className="text-muted-foreground/80">{label}</span>
    </span>
  );
}

// Pulled from liveData.memory.events (real activity from the aggregator).
// Renders nothing if the aggregator hasn't surfaced any events.
function MemorySignalsOverlay() {
  const events: any[] = ld?.memory?.events ?? [];
  if (!Array.isArray(events) || events.length === 0) return null;
  const dotForType = (t: string): string => {
    if (t === "edit") return "#3ddc97";
    if (t === "vectorize") return "#4A9EFF";
    if (t === "recall") return "#fbbf24";
    return "#60a5fa";
  };
  return (
    <div className="absolute top-4 right-4 z-10 w-60 rounded-xl border border-border/60 bg-black/70 backdrop-blur p-3 text-[11px] space-y-2 pointer-events-none">
      <div className="text-muted-foreground uppercase tracking-wider text-[9px]">
        Latest signals
      </div>
      {events.slice(0, 4).map((e, i) => {
        const dot = dotForType(String(e?.type || ""));
        const title = String(e?.target ?? "—");
        const subtitle = `${String(e?.time ?? "—")}${
          e?.meta?.hits ? ` · ${e.meta.hits} hits` : e?.destination ? ` → ${e.destination}` : ""
        }`;
        return (
          <div key={String(e?.id ?? i)} className="flex items-start gap-2">
            <span
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
            />
            <div className="min-w-0">
              <div className="text-foreground/90 truncate">{title}</div>
              <div className="text-muted-foreground text-[10px]">{subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Footer stats bar under the home memory graph. Every number comes from
// liveData.memory.stats — the same totals the Memory page header uses.
// We hide tiles that have no data instead of falling back to invented numbers.
function MemoryStatsFooter() {
  const stats: any = ld?.memory?.stats ?? {};
  const totalFiles = Number.isFinite(stats?.totalFiles) ? Number(stats.totalFiles) : null;
  const totalWorkspaces = Number.isFinite(stats?.totalWorkspaces)
    ? Number(stats.totalWorkspaces)
    : null;
  const stale = Number.isFinite(stats?.stale) ? Number(stats.stale) : null;
  const missing = Number.isFinite(stats?.missing) ? Number(stats.missing) : null;
  const types =
    stats?.typeBreakdown && typeof stats.typeBreakdown === "object"
      ? Object.values(stats.typeBreakdown).filter((v: any) => Number(v) > 0).length
      : null;

  const cells = [
    totalFiles !== null ? <Stat key="files" n={String(totalFiles)} label="memories" /> : null,
    types !== null && types > 0 ? <Stat key="types" n={String(types)} label="types" /> : null,
    totalWorkspaces !== null ? (
      <Stat key="ws" n={String(totalWorkspaces)} label="projects" />
    ) : null,
    stale !== null && stale > 0 ? (
      <Stat key="stale" n={String(stale)} label="stale" tone="amber" />
    ) : null,
    missing !== null && missing > 0 ? (
      <Stat
        key="missing"
        n={String(missing)}
        label={missing === 1 ? "missing" : "missing"}
        tone="red"
      />
    ) : null,
  ].filter(Boolean);

  if (cells.length === 0) {
    return (
      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        No memory parsed yet — run{" "}
        <code className="text-foreground/80">bun run scripts/aggregate.ts</code> to populate.
      </div>
    );
  }

  return (
    <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
      {cells}
    </div>
  );
}

function Tokenomic({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={`text-[13px] font-semibold tabular-nums mt-0.5 ${muted ? "text-foreground/70" : ""}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- Spend / Skills KPI expansions ----------

// Subscriptions list shown inside the Spend → Subscriptions tab. Built from
// liveData.subscriptions only (the aggregator detects each one). No
// invented tiles — the user only sees what's actually on their machine.
type SubscriptionRow = {
  name: string;
  slug: string;
  color: string;
  plan: string;
  usage: string;
  tip: string;
};
function buildSubscriptionRows(): SubscriptionRow[] {
  const ldSubs = ld?.subscriptions ?? {};
  const rows: SubscriptionRow[] = [];
  const c = ldSubs?.claude;
  const claudeDetected =
    !!c && (Number(c?.credCount ?? 0) > 0 || c?.authMode === "oauth" || c?.plan);
  if (claudeDetected) {
    const monthly = Number.isFinite(c?.monthlyPrice) ? c.monthlyPrice : null;
    rows.push({
      name: c?.plan ?? "Claude",
      slug: "anthropic",
      color: "FF8A4C",
      plan: monthly !== null ? `$${monthly} / month` : "Subscription",
      usage:
        Array.isArray(c?.evidence) && c.evidence.length > 0
          ? c.evidence.slice(0, 2).join(" · ")
          : c?.authMode === "oauth"
            ? "OAuth credentials present"
            : "Detected",
      tip: "Plan + tip detail will appear here once the aggregator surfaces per-window metrics.",
    });
  }
  const g = ldSubs?.chatgpt;
  if (g && (g.hasOauth || g.present)) {
    const monthly = Number.isFinite(g?.monthlyPrice) ? g.monthlyPrice : null;
    rows.push({
      name: g?.plan ?? "ChatGPT",
      slug: "openai",
      color: "10D49C",
      plan: monthly !== null ? `$${monthly} / month` : "Subscription",
      usage: "ChatGPT subscription",
      tip: "Click the price on the hero card to edit your monthly cost.",
    });
  }
  // Codex (separate billing from ChatGPT)
  const cx = ldSubs?.codex;
  if (cx?.present) {
    const monthly = Number.isFinite(cx?.monthlyPrice) && cx.monthlyPrice > 0 ? cx.monthlyPrice : null;
    rows.push({
      name: cx?.plan ?? "Codex",
      slug: "openai",
      color: "74AA9C",
      plan: monthly !== null ? `$${monthly} / month` : "Set price →",
      usage: "OpenAI CLI agent (separate billing)",
      tip: "Codex has its own rate limits separate from ChatGPT.",
    });
  }
  const or = ldSubs?.openrouter;
  if (or?.label) {
    const remaining = Number.isFinite(or?.limit_remaining) ? or.limit_remaining : null;
    rows.push({
      name: "OpenRouter",
      slug: "openrouter",
      color: "EAB308",
      plan: "Pay-as-you-go",
      usage: remaining !== null ? `$${remaining.toFixed(2)} credit left` : "API key in env",
      tip: "Best for DeepSeek and fallback routing.",
    });
  }
  return rows;
}

// Savings tips that the home dashboard ships. Each is generic guidance rather
// than evidence-derived analysis — the real per-skill recommendations come
// from the Dream review (rendered separately below). We keep them generic so
// they're true for any operator regardless of model split.
const savingsTips = [
  {
    icon: Sparkles,
    title: "Route simple file reads to Haiku",
    saving: "≈ $80 / mo typical",
    detail:
      "When most of your Opus calls are sub-4k tokens, swapping the read-heavy skills to Haiku adds up fast.",
  },
  {
    icon: Zap,
    title: "Enable prompt caching for repeated context",
    saving: "≈ $40 / mo typical",
    detail:
      "Skills that send the same system prompt every run cache cleanly — input tokens drop ~40%.",
  },
  {
    icon: TrendingUp,
    title: "Bundle repetitive workflows into a single skill",
    saving: "Hours / week",
    detail:
      "Reduces context overhead by reusing one session. The Dream review surfaces the specific candidates from your usage.",
  },
];

function SpendExpansion({
  onClose,
  spendValue,
  tokenEquivalent,
  spendSub,
}: {
  onClose: () => void;
  spendValue: number;
  tokenEquivalent: number;
  spendSub: string;
}) {
  const [tab, setTab] = useState<"subs" | "variable" | "save">("subs");
  const subscriptions = React.useMemo(() => buildSubscriptionRows(), []);

  const subsFixed = subscriptions
    .filter((s) => /\$\d+\s*\/\s*month/i.test(s.plan))
    .reduce((sum, s) => sum + (parseInt(s.plan.replace(/[^\d]/g, ""), 10) || 0), 0);
  const variableTotal = Math.max(0, spendValue - subsFixed);
  const totalSavings = savingsTips
    .map((t) => parseInt(t.saving.replace(/[^\d]/g, ""), 10) || 0)
    .reduce((a, b) => a + b, 0);

  const tabs = [
    { id: "subs", label: "Subscriptions", count: subscriptions.length, accent: "#fbbf24" },
    { id: "variable", label: "Variable", count: 1, accent: "#4A9EFF" },
    { id: "save", label: "Ways to save", count: savingsTips.length, accent: "#3ddc97" },
  ] as const;

  return (
    <div
      className="mt-4 rounded-2xl border border-amber-400/30 overflow-hidden animate-fade-in"
      style={{
        background: "radial-gradient(140% 100% at 0% 0%, #2a1a05 0%, #120a02 50%, #0a0500 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.04), 0 16px 48px -16px rgba(251,191,36,0.35)",
      }}
    >
      {/* Header — totals at a glance */}
      <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-300" />
          <div className="text-[12px] font-semibold tracking-tight">AI spend</div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {spendSub}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <MiniTotal label="Subscriptions" value={`$${subsFixed.toLocaleString()}`} accent="#fbbf24" />
          <span className="text-white/15">·</span>
          <MiniTotal label="API-equivalent" value={`$${Math.round(tokenEquivalent).toLocaleString()}`} accent="#4A9EFF" />
          <span className="text-white/15">·</span>
          <MiniTotal label="You pay" value={`$${Math.round(spendValue).toLocaleString()}`} accent="#fff" />
          <button
            onClick={onClose}
            className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4 flex items-center gap-2 flex-wrap">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-[0.18em] transition-colors"
              style={{
                borderColor: active ? `${t.accent}66` : "rgba(255,255,255,0.08)",
                background: active ? `${t.accent}1a` : "transparent",
                color: active ? t.accent : "rgba(255,255,255,0.55)",
              }}
            >
              {t.label}
              <span className="text-[10px] tabular-nums opacity-70">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-5 min-h-[230px]">
        {tab === "subs" && subscriptions.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[12px] text-muted-foreground">
            No AI subscriptions detected on this machine yet. The aggregator looks for Claude OAuth,
            Codex OAuth, and OpenRouter — re-run{" "}
            <code className="text-foreground/80">bun run scripts/aggregate.ts</code> after signing
            in.
          </div>
        )}
        {tab === "subs" && subscriptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {subscriptions.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-3 hover:border-white/15 transition-colors"
              >
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: `#${s.color}1f`,
                    boxShadow: `inset 0 0 0 1px #${s.color}55`,
                  }}
                >
                  <img
                    src={`https://cdn.simpleicons.org/${s.slug}/FFFFFF`}
                    alt=""
                    className="h-4 w-4"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-semibold truncate">{s.name}</div>
                    <span className="text-[11px] font-mono tabular-nums text-amber-200/90 shrink-0">
                      {s.plan}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                    {s.usage}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "variable" && (
          <div className="rounded-xl border border-white/5 bg-black/30 p-5">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-violet-200/70">
                OpenRouter · pay-as-you-go
              </div>
              <div className="text-2xl font-semibold tabular-nums" style={{ color: "#4A9EFF" }}>
                ${variableTotal.toFixed(2)}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mb-4">
              Metered API calls outside of any subscription. Best for fallback routing and DeepSeek.
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (variableTotal / Math.max(spendValue, 1)) * 100)}%`,
                  background: "linear-gradient(90deg, #4A9EFF, #c4b5fd)",
                }}
              />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground tabular-nums">
              {Math.round((variableTotal / Math.max(spendValue, 1)) * 100)}% of total spend
            </div>
          </div>
        )}

        {tab === "save" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80 inline-flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Highest-impact moves
              </div>
              <div className="text-[11px] text-muted-foreground">
                Potential{" "}
                <span className="text-emerald-300 font-mono tabular-nums">
                  ≈ ${totalSavings}/mo
                </span>
              </div>
            </div>
            {savingsTips.map((t, i) => {
              const I = t.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3 hover:border-emerald-300/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-300/30 flex items-center justify-center shrink-0">
                      <I className="h-3.5 w-3.5 text-emerald-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold">{t.title}</div>
                        <span className="text-[11px] font-mono text-emerald-300 tabular-nums shrink-0">
                          {t.saving}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-1">{t.detail}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTotal({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-[14px] font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function SkillsSavedExpansion({
  onClose,
  rate,
  setRate,
  skills,
  minutesFor,
  setMinutesFor,
  period,
}: {
  onClose: () => void;
  rate: number;
  setRate: (n: number) => void;
  skills: DemoSkill[];
  minutesFor: (name: string) => number;
  setMinutesFor: (name: string, value: number) => void;
  period: Period;
}) {
  const factor = period === "day" ? 1 / 7 : period === "week" ? 1 : 30 / 7;
  const sorted = [...skills].sort((a, b) => b.uses * b.minsPerRun - a.uses * a.minsPerRun);
  const configuredCount = skills.filter((s) => minutesFor(s.name) > 0).length;
  const [showAskAi, setShowAskAi] = useState(false);
  // Per-row unit toggles: "min" or "hr"
  const [units, setUnits] = useState<Record<string, "min" | "hr">>({});
  const getUnit = (name: string) => units[name] ?? "min";

  const askAiCommand = `claude "Look at my skills in ~/.claude/ and estimate how many minutes each one saves per run compared to doing it manually. Output JSON like {\\"skillName\\": minutes}. Be conservative — only count time the skill genuinely saves."`;

  return (
    <div
      className="mt-4 rounded-2xl border border-emerald-400/30 bg-card overflow-hidden animate-fade-in"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 0% 0%, rgba(61,220,151,0.10), transparent 60%)",
      }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-300" />
          <div className="text-[12px] font-semibold">Skills saved · tune your estimates</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAskAi((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-violet-400/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/60 transition-colors"
          >
            <TerminalIcon className="h-3 w-3" /> Ask AI
          </button>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            close
          </button>
        </div>
      </div>

      {/* Ask AI command panel */}
      {showAskAi && (
        <div className="px-5 py-4 border-b border-border/60 bg-violet-500/[0.04]">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0 mt-0.5">
              <TerminalIcon className="h-3.5 w-3.5 text-violet-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold mb-1">Let Claude estimate your time savings</div>
              <div className="text-[10px] text-muted-foreground mb-3">
                Paste this command in your terminal. Claude will scan your skills and estimate how many minutes each one saves per run. Then enter the numbers below.
              </div>
              <div className="relative group">
                <pre className="bg-black/40 border border-border/60 rounded-lg p-3 text-[10.5px] text-emerald-200/90 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {askAiCommand}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(askAiCommand);
                  }}
                  className="absolute top-2 right-2 text-[9px] uppercase tracking-wider px-2 py-1 rounded border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:border-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hourly rate */}
      <div className="px-5 py-4 border-b border-border/60 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] font-semibold mb-0.5">Your hourly rate</div>
          <div className="text-[10px] text-muted-foreground">
            What an hour of your time is worth. Used to convert minutes saved into dollars across
            every skill.
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="text-[11px] text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
            className="w-20 bg-transparent outline-none text-[14px] font-semibold tabular-nums"
          />
          <span className="text-[10px] text-muted-foreground">/ hour</span>
        </div>
      </div>

      {/* Empty state when no skills are configured */}
      {configuredCount === 0 && skills.length > 0 && (
        <div className="px-5 py-6 border-b border-border/60">
          <div className="rounded-xl border border-dashed border-emerald-400/20 bg-emerald-500/[0.03] p-5 text-center">
            <div className="text-[28px] mb-2">🎯</div>
            <div className="text-[13px] font-semibold mb-1">No time estimates configured yet</div>
            <div className="text-[11px] text-muted-foreground max-w-sm mx-auto mb-3">
              Set how many minutes each skill saves per run to start tracking your ROI.
              Use the <strong className="text-violet-300">Ask AI</strong> button above to get estimates automatically, or enter them manually below.
            </div>
            <div className="text-[10px] text-muted-foreground">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} detected · all showing $0 until configured
            </div>
          </div>
        </div>
      )}

      {/* Skills table */}
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur">
            <tr>
              <th className="text-left font-medium px-4 py-2">Skill</th>
              <th className="text-right font-medium px-4 py-2">Uses</th>
              <th className="text-left font-medium px-4 py-2">Time saved per run</th>
              <th className="text-right font-medium px-4 py-2">$ saved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.map((s) => {
              const min = minutesFor(s.name) || s.minsPerRun;
              const uses = s.uses * factor;
              const dollars = ((min * uses) / 60) * rate;
              const unit = getUnit(s.name);
              const displayValue = unit === "hr" ? +(min / 60).toFixed(2) : min;
              return (
                <tr key={s.name} className="hover:bg-accent/20">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium truncate">{s.name}</span>
                      {s.estimateSource === "ai" && (
                        <span
                          title="AI-estimated"
                          className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-violet-300/70"
                        >
                          <Sparkles className="h-2.5 w-2.5" /> ai
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {Math.round(uses)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={unit === "hr" ? 0.25 : 1}
                        value={displayValue}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setMinutesFor(s.name, unit === "hr" ? Math.round(v * 60) : v);
                        }}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-right text-[11px] tabular-nums outline-none focus:border-foreground/40"
                      />
                      <button
                        onClick={() => setUnits((u) => ({ ...u, [s.name]: unit === "min" ? "hr" : "min" }))}
                        className="text-[9px] uppercase tracking-wider px-1.5 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 w-8 text-center"
                        title="Toggle between minutes and hours"
                      >
                        {unit}
                      </button>
                    </div>
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums font-semibold"
                    style={{ color: "#3ddc97" }}
                  >
                    ${Math.round(dollars).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Tokenomics helpers ----------

function BigStat({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-black/30 p-3 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl opacity-30"
        style={{ background: accent }}
      />
      <div className="relative flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color: accent }} />
        {label}
      </div>
      <div
        className="relative text-[18px] font-semibold tabular-nums mt-1"
        style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}
      >
        {value}
      </div>
    </div>
  );
}

function SpendPie({
  models,
  highlight,
  total,
  onHover,
}: {
  models: { name: string; color: string; share: number }[];
  highlight: string;
  total: number;
  onHover?: (name: string | null) => void;
}) {
  const cx = 100,
    cy = 100,
    r = 82,
    ir = 52;
  let cumulative = 0;
  const slices = models.map((m) => {
    const start = cumulative;
    cumulative += m.share;
    const end = cumulative;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const large = end - start > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0),
      y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1),
      y1 = cy + r * Math.sin(a1);
    const xi0 = cx + ir * Math.cos(a0),
      yi0 = cy + ir * Math.sin(a0);
    const xi1 = cx + ir * Math.cos(a1),
      yi1 = cy + ir * Math.sin(a1);
    const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${ir},${ir} 0 ${large} 0 ${xi0},${yi0} Z`;
    // small outward translation for highlighted slice
    const mid = (a0 + a1) / 2;
    const dx = Math.cos(mid) * 4;
    const dy = Math.sin(mid) * 4;
    return { ...m, d, dx, dy, isHi: m.name === highlight };
  });
  const hi = slices.find((s) => s.isHi);
  return (
    <div className="relative w-[210px] h-[210px] mx-auto" onMouseLeave={() => onHover?.(null)}>
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        <defs>
          <filter id="pieGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {slices.map((s) => (
          <path
            key={s.name}
            d={s.d}
            fill={`#${s.color}`}
            opacity={s.isHi ? 1 : 0.32}
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="0.6"
            filter={s.isHi ? "url(#pieGlow)" : undefined}
            transform={s.isHi ? `translate(${s.dx} ${s.dy})` : undefined}
            onMouseEnter={() => onHover?.(s.name)}
            style={{
              transition: "opacity 0.25s, transform 0.25s",
              cursor: onHover ? "pointer" : "default",
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</div>
        <div className="text-base font-semibold tabular-nums">${total.toFixed(2)}</div>
        <div className="text-[10px] text-muted-foreground mt-1 text-center max-w-[120px] truncate">
          {highlight}
        </div>
        <div
          className="text-[10px] tabular-nums"
          style={{
            color: hi ? `#${hi.color}` : "#fff",
            textShadow: hi ? `0 0 10px #${hi.color}aa` : undefined,
          }}
        >
          {Math.round((hi?.share ?? 0) * 100)}%
        </div>
      </div>
    </div>
  );
}

const DREAM_PALETTES: Record<
  DreamTone,
  {
    ring: string;
    glow: string;
    chip: string;
    icon: string;
    image: string;
  }
> = {
  pink: {
    ring: "border-pink-400/40",
    glow: "rgba(236,72,153,0.45)",
    chip: "bg-pink-500/20 text-pink-100 border-pink-400/40",
    icon: "#fbcfe8",
    image: dreamMemoryPink,
  },
  orange: {
    ring: "border-orange-400/40",
    glow: "rgba(249,115,22,0.45)",
    chip: "bg-orange-500/20 text-orange-100 border-orange-400/40",
    icon: "#fed7aa",
    image: dreamCostOrange,
  },
  blue: {
    ring: "border-sky-400/40",
    glow: "rgba(56,189,248,0.45)",
    chip: "bg-sky-500/20 text-sky-100 border-sky-400/40",
    icon: "#bae6fd",
    image: dreamSkillsBlue,
  },
  yellow: {
    ring: "border-yellow-400/40",
    glow: "rgba(234,179,8,0.45)",
    chip: "bg-yellow-500/20 text-yellow-100 border-yellow-400/40",
    icon: "#fef08a",
    image: dreamWorkflowYellow,
  },
};

// (sidecar removed — wizard + dashboard are pure browser; aggregator runs in terminal)

type StreamState =
  | { kind: "idle" }
  | { kind: "streaming"; output: string }
  | { kind: "done"; output: string; exitCode: number | null }
  | { kind: "error"; output: string; message: string };

function DreamCarousel({
  cur,
  total,
  index,
  prev,
  next,
  onDismiss,
}: {
  cur: DreamSuggestion & { originalIndex: number };
  total: number;
  index: number;
  prev: () => void;
  next: () => void;
  onDismiss: () => void;
}) {
  const palette = DREAM_PALETTES[cur.tone];
  const [copiedFix, setCopiedFix] = useState(false);
  const [stream, setStream] = useState<StreamState>({ kind: "idle" });
  const [copyToast, setCopyToast] = useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Reset streaming UI when the user navigates to a different prescription.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStream({ kind: "idle" });
  }, [cur.originalIndex]);

  const CatIcon =
    cur.cat === "MEMORY"
      ? Brain
      : cur.cat === "COST"
        ? DollarSign
        : cur.cat === "SKILLS"
          ? Sparkles
          : Workflow;
  const headlineByCat: Record<string, string> = {
    MEMORY: "Sharpen your memory",
    COST: "Spend smarter",
    SKILLS: "Compound your skills",
    WORKFLOW: "Tighten the loop",
  };

  const fallbackCopy = () => {
    if (!cur.command) return;
    navigator.clipboard?.writeText(cur.command).then(() => {
      setCopiedFix(true);
      setCopyToast(true);
      setTimeout(() => setCopiedFix(false), 1800);
      setTimeout(() => setCopyToast(false), 4000);
    });
  };

  // Sidecar removed — clicking [Run this fix →] now copies the underlying
  // `claude -p "<prescription>"` command to the clipboard so the user can
  // paste it into Claude Code (or any AI agent) themselves. No backend
  // streaming, no race conditions.
  const runFix = () => {
    fallbackCopy();
  };

  const closeStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStream({ kind: "idle" });
  };

  const updatedLabel = dreamGeneratedAt
    ? new Date(dreamGeneratedAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "3:12 AM";

  return (
    <div
      className={`relative rounded-2xl border ${palette.ring} overflow-hidden md:min-h-[440px] md:flex`}
      style={{
        background: "radial-gradient(140% 100% at 0% 50%, #1a0b3a 0%, #0a0418 45%, #050210 100%)",
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 16px 48px -16px ${palette.glow}`,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] md:flex-1 md:min-h-0 w-full">
        {/* Hero photo — feathered into the panel, true colors */}
        <div className="relative overflow-hidden hidden md:block">
          <img
            src={palette.image}
            alt={`Dream · ${cur.cat.toLowerCase()}`}
            loading="lazy"
            width={1280}
            height={720}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              WebkitMaskImage:
                "radial-gradient(120% 100% at 30% 50%, #000 45%, rgba(0,0,0,0.55) 72%, transparent 100%)",
              maskImage:
                "radial-gradient(120% 100% at 30% 50%, #000 45%, rgba(0,0,0,0.55) 72%, transparent 100%)",
            }}
          />
          {/* soft bottom darken for caption legibility */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, transparent 55%, rgba(5,2,16,0.7) 100%)",
            }}
          />
          <div className="relative h-full flex items-end p-5">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-xl bg-black/55 backdrop-blur border border-white/15 flex items-center justify-center"
                style={{ boxShadow: `0 8px 24px ${palette.glow}` }}
              >
                <CatIcon className="h-5 w-5" style={{ color: palette.icon }} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                  Overnight insight
                </div>
                <div className="text-sm font-semibold text-white">
                  {headlineByCat[cur.cat] ?? "Suggestion"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative p-5 md:p-7 flex flex-col md:min-h-0 md:overflow-hidden">
          {/* Top-right meta cluster — vertical: time saved + dollar impact + last refreshed */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-[10px] tabular-nums text-emerald-100"
              style={{ boxShadow: "0 4px 16px -8px rgba(16,185,129,0.45)" }}
              title="Estimated impact if you act on this"
            >
              <span className="font-semibold tracking-tight">${cur.dollarImpact}/mo</span>
              <span className="opacity-60">·</span>
              <span className="opacity-90">{cur.timeImpactMins} min saved</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider text-violet-200/60">
              <Clock className="h-2.5 w-2.5" />
              Refreshed {updatedLabel}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 mt-1 flex-wrap">
            <span
              className={`text-[9px] tracking-[0.2em] px-1.5 py-0.5 rounded border ${palette.chip}`}
            >
              {cur.cat}
            </span>
            {/* State badge — surfaced from state.json by the aggregator. */}
            {cur.status === "recurring" && (
              <span
                className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border"
                style={{
                  background: "oklch(0.74 0.085 70 / 14%)",
                  color: "oklch(0.85 0.10 70)",
                  borderColor: "oklch(0.74 0.085 70 / 35%)",
                }}
                title="Dream surfaced this on a previous run and it's still unresolved"
              >
                Recurring · {Number(cur.ageDays ?? 0)}d
              </span>
            )}
            {cur.status === "partial" && (
              <span
                className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border"
                style={{
                  background: "oklch(0.65 0.18 250 / 12%)",
                  color: "oklch(0.80 0.15 250)",
                  borderColor: "oklch(0.65 0.18 250 / 35%)",
                }}
                title="You've made progress on this — Dream is watching to see if it sticks"
              >
                Partial
              </span>
            )}
            {cur.status === "accepted" && (
              <span
                className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border"
                style={{
                  background: "oklch(0.70 0.16 150 / 14%)",
                  color: "oklch(0.85 0.16 150)",
                  borderColor: "oklch(0.70 0.16 150 / 35%)",
                }}
              >
                Accepted
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-violet-200/60 tabular-nums">
              {index + 1} / {total}
            </span>
          </div>

          {/* Everything content-wise lives inside one scroll container so
              long Dream notes + multi-line prescriptions never get clipped
              at the bottom of the 440px card. Meta cluster stays absolutely
              positioned in the top-right corner above this. */}
          <div className="flex-1 md:overflow-y-auto pr-1 space-y-4">
            {cur.note && (
              <div className="text-[11px] italic text-violet-200/70 max-w-[58ch]">
                Dream note: {cur.note}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-violet-200/60 mb-2">
                {headlineByCat[cur.cat]}
              </div>
              <div className="text-[15px] md:text-[17px] font-semibold leading-snug text-violet-50 mb-3 max-w-[42ch]">
                {cur.headline}
              </div>
              <p className="text-[12px] md:text-[13px] leading-relaxed text-violet-100/80 max-w-[58ch]">
                {cur.prescription}
              </p>
            </div>
            <div className="pl-3 border-l border-white/10">
              <div className="text-[9px] uppercase tracking-[0.2em] text-violet-200/60 mb-1.5">
                Why we're suggesting this
              </div>
              <ul className="space-y-1.5">
                {cur.evidence.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12px] text-violet-100/85 leading-snug"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                      style={{ background: palette.icon, boxShadow: `0 0 6px ${palette.icon}` }}
                    />
                    <span className="break-words">{e}</span>
                  </li>
                ))}
              </ul>
            </div>
            {cur.command && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-violet-200/60 mb-1.5 flex items-center justify-between gap-2">
                  <span>Try it now — copy this and paste into Claude Code</span>
                  <button
                    onClick={runFix}
                    disabled={stream.kind === "streaming"}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-[10px] uppercase tracking-wider text-violet-100 disabled:opacity-60"
                    title={
                      stream.kind === "streaming"
                        ? "Running…"
                        : copiedFix
                          ? "Copied — paste into Claude Code"
                          : "Copy this command to your clipboard"
                    }
                  >
                    {stream.kind === "streaming" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : copiedFix ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" />
                    )}
                    {stream.kind === "streaming"
                      ? "Running…"
                      : copiedFix
                        ? "Copied"
                        : "Run this fix"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={runFix}
                  disabled={stream.kind === "streaming"}
                  className="block w-full text-left text-[11px] md:text-[12px] font-mono px-3 py-2 rounded-md bg-black/40 border border-white/10 text-violet-50 break-all hover:border-white/25 transition-colors cursor-copy disabled:cursor-progress"
                  title="Click to copy the command"
                >
                  {cur.command}
                </button>

                {copyToast && stream.kind === "idle" && (
                  <div className="mt-2 text-[10px] text-amber-200/85 bg-amber-500/10 border border-amber-400/30 rounded-md px-2.5 py-1.5">
                    Copied to clipboard. Tip:
                    <span className="font-mono"> bun run server </span>
                    runs this for you with one click.
                  </div>
                )}

                {stream.kind !== "idle" && (
                  <div className="mt-3 rounded-md border border-white/10 bg-black/60 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 text-[10px] uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1.5 text-violet-200/80">
                        <TerminalIcon className="h-3 w-3" />
                        {stream.kind === "streaming" && "Streaming…"}
                        {stream.kind === "done" && (
                          <span
                            className={
                              stream.exitCode === 0 || stream.exitCode === null
                                ? "text-emerald-300"
                                : "text-red-300"
                            }
                          >
                            {stream.exitCode === 0 || stream.exitCode === null
                              ? `Done · exit ${stream.exitCode ?? 0}`
                              : `Failed · exit ${stream.exitCode}`}
                          </span>
                        )}
                        {stream.kind === "error" && (
                          <span className="text-red-300">Failed · {stream.message}</span>
                        )}
                      </span>
                      <button
                        onClick={closeStream}
                        className="inline-flex items-center gap-1 text-[10px] text-violet-200/70 hover:text-violet-50 px-1.5 py-0.5 rounded hover:bg-white/5"
                      >
                        <X className="h-2.5 w-2.5" /> Close
                      </button>
                    </div>
                    <pre className="px-3 py-2 text-[11px] font-mono text-violet-50/90 max-h-48 overflow-auto whitespace-pre-wrap">
                      {stream.output ||
                        (stream.kind === "streaming" ? "" : "")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-white/8 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={prev}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-violet-100 hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="Previous"
              >
                <span aria-hidden>‹</span>
              </button>
              <button
                onClick={next}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-violet-100 hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="Next"
              >
                <span aria-hidden>›</span>
              </button>
              <div className="flex items-center gap-1.5 px-2">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === index ? 16 : 5,
                      background: i === index ? palette.icon : "rgba(255,255,255,0.22)",
                      boxShadow: i === index ? `0 0 8px ${palette.icon}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-violet-100/80 text-[11px] uppercase tracking-wider hover:bg-white/10 transition-colors"
                title="Skip this suggestion"
              >
                <XCircle className="h-3.5 w-3.5" /> Skip
              </button>
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 text-[11px] uppercase tracking-wider hover:bg-emerald-500/25 transition-colors"
                style={{ boxShadow: "0 6px 20px -8px rgba(16,185,129,0.55)" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Apply &amp; mark done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyActivityRows() {
  const max = Math.max(...dailyActivity.map((d) => d.sessions));
  const totalSessions = dailyActivity.reduce((a, d) => a + d.sessions, 0);
  const totalMinutes = dailyActivity.reduce((a, d) => a + d.minutes, 0);
  const last7Avg = Math.round(dailyActivity.slice(-7).reduce((a, d) => a + d.sessions, 0) / 7);
  const prev7Avg = Math.round(dailyActivity.slice(0, 7).reduce((a, d) => a + d.sessions, 0) / 7);
  const trendPct = prev7Avg > 0 ? Math.round(((last7Avg - prev7Avg) / prev7Avg) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-border text-[11px] tabular-nums">
        <span className="text-muted-foreground">14d total</span>
        <span className="font-semibold text-foreground">{totalSessions} sessions</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {Math.round(totalMinutes / 60)} hours of focused work
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />+{trendPct}% week-over-week
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {dailyActivity
          .slice()
          .reverse()
          .map((d) => {
            const pct = d.sessions / max;
            const isToday = d.label === "Today";
            return (
              <div key={d.date} className="grid grid-cols-12 items-center px-5 py-2.5 gap-3">
                <div
                  className={`col-span-3 md:col-span-2 text-xs ${isToday ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {d.label}
                </div>
                <div className="col-span-6 md:col-span-7 relative h-5 rounded-full bg-foreground/[0.04] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${pct * 100}%`,
                      background: isToday
                        ? "linear-gradient(90deg, #3ddc97, #7be0c8)"
                        : "linear-gradient(90deg, rgba(61,220,151,0.55), rgba(123,224,200,0.4))",
                      boxShadow: isToday ? "0 0 18px rgba(61,220,151,0.6)" : undefined,
                    }}
                  />
                </div>
                <div className="col-span-2 text-right text-[11px] tabular-nums">
                  <span
                    className={isToday ? "text-foreground font-semibold" : "text-muted-foreground"}
                  >
                    {d.sessions}
                  </span>
                  <span className="text-muted-foreground/50"> sess.</span>
                </div>
                <div className="col-span-1 text-right text-[10px] tabular-nums text-muted-foreground/70 hidden md:inline">
                  {Math.round(d.minutes / 60)}h
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function SkillRecommenderCard({ rec }: { rec: SkillRecommendation }) {
  const conf = Math.round(rec.confidence * 100);
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    try {
      navigator.clipboard?.writeText(rec.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 overflow-hidden hover:border-foreground/30 transition-colors">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
        style={{ background: "#4A9EFF" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-violet-300">
            <Lightbulb className="h-3 w-3" />
            Recommended skill
          </div>
          <div className="text-[10px] tabular-nums text-muted-foreground">{conf}% confidence</div>
        </div>
        <div className="font-mono text-base font-semibold mb-1.5 text-foreground">{rec.name}</div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">{rec.basis}</p>

        <div className="flex items-center gap-3 mb-3 text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <TrendingUp className="h-3 w-3" />${rec.predictedSavings.dollarsPerMonth}/mo
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{rec.predictedSavings.hoursPerMonth}h saved</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{rec.evidenceCount} signals</span>
        </div>

        <div className="rounded-md bg-black/40 border border-white/10 px-2.5 py-2 mb-3 flex items-center gap-2">
          <code className="font-mono text-[11px] text-violet-100 truncate flex-1">
            {rec.command}
          </code>
          <button
            onClick={onCopy}
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            title="Copy"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {rec.inspiredBy.map((s, i) => (
            <span
              key={i}
              className="text-[9px] font-mono text-muted-foreground/70 px-1.5 py-0.5 rounded bg-foreground/[0.04]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscriptionStrip({ apiEquivalent }: { apiEquivalent: number }) {
  // Derived from liveData.subscriptions (the aggregator detects which
  // services have credentials on disk). Each tile is only rendered when
  // we have actual evidence the subscription exists — no invented Gemini
  // or hardcoded plans for users who don't have them.
  const ldSubs = ld?.subscriptions ?? {};

  const claudeSub = ldSubs?.claude;
  const claudeDetected =
    !!claudeSub &&
    (Number(claudeSub?.credCount ?? 0) > 0 || claudeSub?.authMode === "oauth" || claudeSub?.plan);
  const chatgptPresent = ldSubs?.chatgpt?.hasOauth || ldSubs?.chatgpt?.present;
  const orLabel = ldSubs?.openrouter?.label;
  const orRemaining = Number.isFinite(ldSubs?.openrouter?.limit_remaining)
    ? ldSubs.openrouter.limit_remaining
    : null;

  const { setPrice, getPrice } = usePriceOverrides();

  const subs: {
    name: string;
    slug: string;
    color: string;
    detectedMonthly: number | null;
    tagline: string;
    status: "active" | "fallback";
  }[] = [];

  if (claudeDetected) {
    subs.push({
      name: claudeSub?.plan ?? "Claude",
      slug: "anthropic",
      color: "FF7A3D",
      detectedMonthly: Number.isFinite(claudeSub?.monthlyPrice) ? claudeSub.monthlyPrice : null,
      tagline:
        claudeSub?.authMode === "oauth"
          ? "Anthropic · OAuth"
          : Array.isArray(claudeSub?.evidence) && claudeSub.evidence.length > 0
            ? `Anthropic · ${claudeSub.evidence[0]}`
            : "Anthropic",
      status: "active",
    });
  }
  if (chatgptPresent) {
    subs.push({
      name: ldSubs?.chatgpt?.plan ?? "ChatGPT",
      slug: "openai",
      color: "10D49C",
      detectedMonthly: Number.isFinite(ldSubs?.chatgpt?.monthlyPrice) ? ldSubs.chatgpt.monthlyPrice : null,
      tagline: "OpenAI · ChatGPT subscription",
      status: "active",
    });
  }
  // Codex (OpenAI CLI) has separate billing from ChatGPT
  const codexSub = ldSubs?.codex;
  if (codexSub?.present) {
    subs.push({
      name: codexSub?.plan ?? "Codex",
      slug: "openai",
      color: "74AA9C",
      detectedMonthly: Number.isFinite(codexSub?.monthlyPrice) && codexSub.monthlyPrice > 0
        ? codexSub.monthlyPrice
        : null,
      tagline: "OpenAI · CLI agent",
      status: "active",
    });
  }
  if (orLabel) {
    subs.push({
      name: "OpenRouter",
      slug: "openrouter",
      color: "7C8CFF",
      detectedMonthly: null,
      tagline:
        orRemaining !== null
          ? `Pay-as-you-go · $${orRemaining.toFixed(2)} left`
          : `Pay-as-you-go · ${orLabel}`,
      status: "fallback",
    });
  }

  if (subs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
        No AI subscriptions detected yet. Run{" "}
        <code className="text-foreground/80">bun run scripts/aggregate.ts</code> after signing into
        Claude / ChatGPT / OpenRouter.
      </div>
    );
  }

  const flatTotal = subs.reduce((a, s) => a + (getPrice(s.slug, s.detectedMonthly) ?? 0), 0);
  const roi = flatTotal > 0 ? apiEquivalent / flatTotal : 0;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 text-[12px]">
        <span className="text-muted-foreground">Flat monthly spend</span>
        <span className="text-foreground font-semibold tabular-nums text-base">${flatTotal.toLocaleString()}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">Tokens used</span>
        <span className="text-foreground font-semibold tabular-nums text-base">
          ${Math.round(apiEquivalent).toLocaleString()}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-emerald-400 font-semibold tabular-nums">{roi.toFixed(1)}× ROI</span>
      </div>
      <div
        className={`grid gap-2.5 ${subs.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : subs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {subs.map((s) => {
          const local = LOCAL_LOGO_MAP[s.slug];
          const logoSrc = local ?? `https://cdn.simpleicons.org/${s.slug}/FFFFFF`;
          return (
            <div
              key={s.name}
              className="group relative rounded-xl border border-border/70 bg-black/30 p-3 overflow-hidden hover:border-foreground/30 transition-colors"
              style={{
                backgroundImage: `radial-gradient(120% 80% at 0% 0%, #${s.color}1f, transparent 60%)`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"
                style={{ background: `#${s.color}` }}
              />
              <div className="relative flex items-center gap-2.5 mb-2">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: `#${s.color}1f`,
                    boxShadow: `inset 0 0 0 1px #${s.color}55`,
                  }}
                >
                  <img
                    src={logoSrc}
                    alt={s.name}
                    className="h-5 w-5 object-contain"
                    loading="lazy"
                    style={s.slug === "openai" ? { filter: "brightness(0) invert(1)" } : undefined}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold leading-tight truncate">{s.name}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                    {s.tagline}
                  </div>
                </div>
              </div>
              <div className="relative flex items-baseline justify-between">
                <EditablePrice
                  value={getPrice(s.slug, s.detectedMonthly)}
                  onChange={(p) => setPrice(s.slug, p)}
                  accent={`#${s.color}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function OperatorScorePill({
  score,
  components,
}: {
  score: number;
  components: { label: string; value: number; max: number }[];
}) {
  const [open, setOpen] = useState(false);
  const tone = score >= 75 ? "#3ddc97" : score >= 50 ? "#fbbf24" : "#f87171";
  const label =
    score >= 80 ? "Excellent" : score >= 60 ? "Healthy" : score >= 40 ? "OK" : "Needs work";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] tabular-nums"
        style={{
          borderColor: `${tone}55`,
          background: `${tone}14`,
          color: tone,
        }}
        title="Operator Score · click to see how it's calculated"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: tone, boxShadow: `0 0 6px ${tone}` }}
        />
        <span className="text-[10px] uppercase tracking-[0.18em] opacity-80">Score</span>
        <span className="font-semibold">{score}</span>
        <span className="opacity-70 text-[10px]">/ 100 · {label}</span>
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-2 w-72 rounded-xl border border-border bg-card shadow-2xl p-3 animate-fade-in">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            How this score is calculated
          </div>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground/85">{c.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.value} / {c.max}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-foreground/[0.06] overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(c.value / c.max) * 100}%`, background: tone }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
            Score is derived from the latest aggregator output — memory freshness, ROI vs. monthly
            subs, and recent message volume. Re-run{" "}
            <code className="text-foreground/80">bun run scripts/aggregate.ts</code> to refresh.
          </div>
        </div>
      )}
    </div>
  );
}

const EYEBROW_AVATAR_KEY = "claude-os.avatar.v1";
const OPERATOR_NAME_KEY = "claude-os.operator-name.v1";

function EyebrowAvatar() {
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(EYEBROW_AVATAR_KEY);
      } catch {
        return null;
      }
    };
    setAvatar(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === EYEBROW_AVATAR_KEY || e.key === null) setAvatar(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!avatar) return null;
  return (
    <img src={avatar} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-border" />
  );
}

// Time-of-day greeting using the operator's name. Defaults to "Operator".
// Reads ~/.claude-os name from localStorage and re-renders on storage events
// so name changes from the wizard hit immediately.
function GreetingHeadline() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(OPERATOR_NAME_KEY);
      } catch {
        return null;
      }
    };
    setName(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === OPERATOR_NAME_KEY || e.key === null) setName(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const trimmed = (name ?? "").trim();
  const firstName = trimmed ? trimmed.split(/\s+/)[0] : null;
  const hour = new Date().getHours();
  const slot =
    hour < 5
      ? "Up late"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  return (
    <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight leading-[1.1]">
      {slot}
      {firstName ? (
        <>
          , <span className="text-foreground/85">{firstName}</span>.
        </>
      ) : (
        "."
      )}
      <span className="text-muted-foreground/55"> Today at a glance.</span>
    </h1>
  );
}

function NowWorkingOn() {
  const projects = ld?.recentProjects;
  const top = Array.isArray(projects) && projects.length > 0 ? projects[0] : null;
  if (!top) return null;
  // If the last activity was over an hour ago, the emerald pulse misleads —
  // show a static amber dot instead. "Currently in" still refers to the
  // most-recent project, but the dot stops claiming live presence.
  const lastMs = Number(top.lastActiveMs);
  const isLive = Number.isFinite(lastMs) && lastMs > 0 && Date.now() - lastMs < 60 * 60 * 1000;
  const dotColor = isLive ? "#3ddc97" : "#fbbf24";
  return (
    <div className="text-[11px] text-muted-foreground mt-2 inline-flex items-center gap-2 tabular-nums">
      <span
        className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse" : ""}`}
        style={{
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}99`,
        }}
      />
      <span className="text-muted-foreground/70">Currently in</span>
      <span
        className="font-mono text-foreground/90 truncate max-w-[24ch]"
        title={top.displayName ?? top.key}
      >
        {top.displayName ?? top.key}
      </span>
      <span className="text-muted-foreground/40">·</span>
      <span>{top.lastActiveAgo ?? "—"}</span>
      {Number.isFinite(top.sessions) && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>
            {top.sessions} session{top.sessions === 1 ? "" : "s"}
          </span>
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, Wallet, Clock, Gauge, RefreshCw } from "lucide-react";
import { useLiveData, useRefreshLiveData } from "@/lib/use-live-data";
import claudeLogoPng from "@/assets/claude-logo.png";
import openaiLogoPng from "@/assets/logos/openai.png";
import openrouterLogoPng from "@/assets/logos/openrouter.png";

const ANTHROPIC_ORANGE = "#FF8A4C";
const OPENAI_GREEN = "#10D49C";
const OPENROUTER_BLUE = "#7C8CFF";

type Service = "Claude" | "ChatGPT" | "OpenRouter";

interface UsageWindow {
  label: string; // "5h" | "Weekly" | "Monthly"
  used: number;
  cap: number;
  unit: "msgs" | "$";
  pct: number;
  resetIn: string;
}

interface ServiceUsage {
  service: Service;
  brand: string;
  slug: string;
  plan: string;
  authBadge: string;
  authIcon: typeof KeyRound;
  windows: UsageWindow[];
}

// Real reset windows aren't yet emitted by the aggregator (they'd require
// reading Anthropic/OpenAI's per-account quota state). We label these as
// "—" so we don't fake exact countdowns. When the aggregator starts
// surfacing real reset times we wire them in here.
function fiveHourReset(): string {
  return "—";
}
function weeklyReset(): string {
  return "—";
}
function monthlyReset(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86400000));
  return `${days}d`;
}

function buildServices(liveData: any): ServiceUsage[] {
  const out: ServiceUsage[] = [];

  const cw = liveData?.usage?.claudeWindow as any;
  if (cw) {
    // Use multi-window data if available from the aggregator
    const multiWindows: UsageWindow[] = cw.windows
      ? cw.windows.map((w: any) => ({
          label: w.label,
          used: w.used,
          cap: w.cap,
          unit: "msgs" as const,
          pct: w.pct,
          resetIn: w.label.startsWith("5") ? fiveHourReset() : weeklyReset(),
        }))
      : [
          {
            label: "5h",
            used: cw.messagesUsed,
            cap: cw.messageCap,
            unit: "msgs" as const,
            pct: cw.pctUsed,
            resetIn: fiveHourReset(),
          },
        ];

    out.push({
      service: "Claude",
      brand: ANTHROPIC_ORANGE,
      slug: "anthropic",
      plan: cw.plan,
      authBadge: cw.authMode === "oauth" ? "OAuth" : "API key",
      authIcon: cw.authMode === "oauth" ? ShieldCheck : KeyRound,
      windows: multiWindows,
    });
  }

  const gw = liveData?.usage?.chatgptWindow as any;
  if (gw) {
    // Always show ChatGPT when detected — even if message counts are 0.
    // The aggregator can't parse Codex archives yet but the row confirms
    // the subscription is connected.
    out.push({
      service: "ChatGPT",
      brand: OPENAI_GREEN,
      slug: "openai",
      plan: gw.plan,
      authBadge: gw.hasOauth ? "OAuth" : gw.hasApiKey ? "API key" : "—",
      authIcon: gw.hasOauth ? ShieldCheck : KeyRound,
      windows: [
        {
          label: "3h",
          used: gw.messagesUsed,
          cap: gw.messageCap,
          unit: "msgs",
          pct: gw.pctUsed,
          resetIn: fiveHourReset(),
        },
      ],
    });
  }

  const or = liveData?.usage?.openrouter as any;
  if (or) {
    const used = or.usage ?? 0;
    const limit = or.limit ?? 0;
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const remaining = Math.max(0, limit - used);
    out.push({
      service: "OpenRouter",
      brand: OPENROUTER_BLUE,
      slug: "openrouter",
      plan: "Pay-as-you-go",
      authBadge: "API key",
      authIcon: KeyRound,
      windows: [
        {
          label: `Credit · $${remaining.toFixed(2)} left of $${limit}`,
          used,
          cap: limit,
          unit: "$",
          pct,
          resetIn: "no reset",
        },
      ],
    });
  }

  return out;
}

function fmt(value: number, unit: "msgs" | "$") {
  if (unit === "$") return `$${value.toFixed(value < 10 ? 2 : 0)}`;
  return value.toLocaleString();
}

export function UsagePanel() {
  const liveData = useLiveData();
  const refreshLiveData = useRefreshLiveData();
  const services = useMemo(() => buildServices(liveData), [liveData]);
  const [syncTime, setSyncTime] = useState<string>("");

  useEffect(() => {
    setSyncTime(
      new Date(liveData?.generatedAt || Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [liveData]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // In dev mode, call the aggregator via a fetch to the dev server's
      // custom endpoint. If that fails, just reload the page.
      // Fetch the per-run token from the loopback-only /__token endpoint,
      // then send it as X-Claude-OS-Token. The dev server rejects any
      // /__refresh_data POST without it, so a malicious browser tab or
      // extension can't trigger the aggregator (which scans ~/.claude/,
      // decodes JWTs, and runs `security dump-keychain`).
      let token: string | null = null;
      try {
        const t = await fetch("/__token");
        if (t.ok) token = (await t.json()).token ?? null;
      } catch {
        /* ignore — server may not expose it in prod builds */
      }
      const res = await fetch("/__refresh_data", {
        method: "POST",
        headers: token ? { "X-Claude-OS-Token": token } : {},
      }).catch(() => null);
      if (!res || !res.ok) {
        // Fallback: just reload the page (which will re-run seed:data)
        window.location.reload();
        return;
      }
      // Reload the data via React Query instead of reloading the page
      refreshLiveData();
    } catch {
      refreshLiveData();
    }
  };

  return (
    <section className="relative mb-12">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            Live usage
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Plan limits & windows</h2>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70"
            suppressHydrationWarning
          >
            {syncTime ? `Sync · ${syncTime}` : "Sync"}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-medium border border-border/60 bg-foreground/[0.03] hover:bg-foreground/[0.07] text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        {services.map((s) => (
          <ServiceRow key={s.service} service={s} />
        ))}
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground/60 flex items-center gap-3">
        <Wallet className="h-3 w-3" />
        Caps & balances pulled from local logs and the OpenRouter key endpoint. No new credentials
        required.
      </div>
    </section>
  );
}

function ServiceRow({ service }: { service: ServiceUsage }) {
  const Icon = service.authIcon;
  // Use the most-pressing window for the dial.
  const primary = [...service.windows].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div
      className="relative grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 p-5 md:p-6 transition-colors hover:bg-foreground/[0.015]"
      style={{
        backgroundImage: `radial-gradient(120% 60% at 0% 50%, ${service.brand}10, transparent 55%)`,
      }}
    >
      {/* LEFT — identity + dial */}
      <div className="flex items-center gap-4">
        <Dial pct={primary.pct} brand={service.brand} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-md grid place-items-center shrink-0"
              style={{
                background: `${service.brand}1a`,
                boxShadow: `inset 0 0 0 1px ${service.brand}55`,
              }}
            >
              {(() => {
                const localLogos: Record<string, string> = {
                  anthropic: claudeLogoPng,
                  openai: openaiLogoPng,
                  openrouter: openrouterLogoPng,
                };
                const src = localLogos[service.slug] ?? `https://cdn.simpleicons.org/${service.slug}/FFFFFF`;
                return (
                  <img
                    src={src}
                    alt={service.service}
                    className="h-3.5 w-3.5 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                );
              })()}
            </div>
            <div className="text-sm font-semibold tracking-tight truncate">{service.service}</div>
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{service.plan}</div>
          <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.14em] border border-border/70 text-muted-foreground/80">
            <Icon className="h-2.5 w-2.5" />
            {service.authBadge}
          </div>
        </div>
      </div>

      {/* RIGHT — bars per window */}
      <div className="flex flex-col gap-3 justify-center">
        {service.windows.map((w) => (
          <WindowBar key={w.label} window={w} brand={service.brand} />
        ))}
      </div>
    </div>
  );
}

function WindowBar({ window: w, brand }: { window: UsageWindow; brand: string }) {
  const widthPct = Math.max(0.5, Math.min(100, w.pct));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {w.label}
          </span>
          <span className="text-[12px] font-semibold tabular-nums tracking-tight">
            {fmt(w.used, w.unit)}
            <span className="text-muted-foreground/70 font-normal">
              {" / "}
              {fmt(w.cap, w.unit)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
            <Clock className="h-2.5 w-2.5" style={{ color: brand }} />
            {w.resetIn}
          </span>
          <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: brand }}>
            {w.pct}%
          </span>
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-border/30 overflow-hidden">
        {/* tick marks at 25/50/75 */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-foreground/[0.04]" />
          <div className="flex-1 border-r border-foreground/[0.04]" />
          <div className="flex-1 border-r border-foreground/[0.04]" />
          <div className="flex-1" />
        </div>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${widthPct}%`,
            background: `linear-gradient(90deg, ${brand}aa, ${brand})`,
            boxShadow: `0 0 14px ${brand}66`,
          }}
        />
      </div>
    </div>
  );
}

function Dial({ pct, brand }: { pct: number; brand: string }) {
  const size = 76;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="rgba(255,255,255,0.06)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={brand}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${brand}88)`,
            transition: "stroke-dashoffset 600ms ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Gauge className="h-3 w-3 mb-0.5" style={{ color: brand }} />
        <div
          className="text-[14px] font-semibold tabular-nums leading-none"
          style={{ color: brand }}
        >
          {clamped}%
        </div>
      </div>
    </div>
  );
}

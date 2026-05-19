/*
 * HermesStatusPill — a small "● Hermes" indicator that lives in the top
 * bar on every route. Two roles:
 *   1. Signal that Hermes is alive in the system (so users know their
 *      operator dashboard and Hermes are actually wired together).
 *   2. Persistent quick-link to /agents/hermes from anywhere.
 *
 * Polls the live `/__hermes_status` endpoint (not live-data.json) so the
 * state is fresh within a few seconds — important because Hermes can
 * come online / go offline out-of-band (gateway restart, install, etc).
 *
 * Renders nothing when Hermes isn't installed. The bar stays clean for
 * users who haven't set it up.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import hermesLogo from "@/assets/hermes-agent.png";

interface HermesStatus {
  installed: boolean;
  version: string | null;
  configured: boolean;
  defaultModel: string | null;
  provider: string | null;
  needsSetup: boolean;
}

export function HermesStatusPill() {
  const { data: status } = useQuery<HermesStatus>({
    queryKey: ["hermes-status"],
    queryFn: async () => {
      const res = await fetch("/__hermes_status");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    // 4s polling — same cadence as the chat page. Keeps the pill fresh
    // without thrashing the filesystem.
    refetchInterval: 4000,
    staleTime: 0,
    // Failure is fine: we treat anything that throws as "not installed".
    retry: false,
  });

  if (!status?.installed) return null;

  // Three states:
  //   - needs setup        → amber dot ("setup")
  //   - configured + ready → emerald dot ("online")
  //   - installed but no config → amber dot ("setup")
  const ready = status.configured && !status.needsSetup;
  const dotColor = ready ? "#86efac" : "#fbbf24";
  const dotGlow = ready
    ? "0 0 6px rgba(134, 239, 172, 0.7)"
    : "0 0 6px rgba(251, 191, 36, 0.6)";
  const stateLabel = ready ? "online" : "setup";

  return (
    <Link
      to="/agents/hermes"
      className="group inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs font-medium tracking-tight transition-colors hover:border-foreground/30 hover:bg-accent"
      title={
        ready
          ? `Hermes online · ${status.defaultModel ?? "no model"} via ${status.provider ?? "—"}`
          : "Hermes installed — needs setup"
      }
    >
      <img
        src={hermesLogo}
        alt=""
        className="h-3.5 w-auto object-contain"
        style={{ filter: "drop-shadow(0 0 4px rgba(255, 210, 30, 0.5))" }}
      />
      <span
        aria-hidden
        className="inline-block rounded-full shrink-0"
        style={{
          width: 6,
          height: 6,
          background: dotColor,
          boxShadow: dotGlow,
        }}
      />
      <span className="text-foreground/85">Hermes</span>
      <span className="text-muted-foreground/70 text-[10.5px] uppercase tracking-[0.18em] hidden sm:inline">
        {stateLabel}
      </span>
    </Link>
  );
}

export default HermesStatusPill;

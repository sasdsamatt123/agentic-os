import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, Camera } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Share — Agentic OS" },
      { name: "description", content: "A 1200×630 share card with your AI subscription ROI." },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const ld = useLiveData();
  const isDemo = ld?.isExample === true;

  // Sum only subscriptions we actually detected on disk. Don't pad the
  // total with assumed services the user might not have — the share card
  // is a public statement, it has to be defensible.
  const claudeSub = ld?.subscriptions?.claude;
  const claudeDetected =
    !!claudeSub &&
    (Number(claudeSub?.credCount ?? 0) > 0 || claudeSub?.authMode === "oauth" || claudeSub?.plan);
  const claudePrice: number = claudeDetected
    ? Number.isFinite(claudeSub?.monthlyPrice)
      ? claudeSub.monthlyPrice
      : 0
    : 0;
  const chatgptPresent =
    ld?.subscriptions?.chatgpt?.hasOauth || ld?.subscriptions?.chatgpt?.present;
  const chatgptPrice: number = chatgptPresent
    ? Number.isFinite(ld?.subscriptions?.chatgpt?.monthlyPrice)
      ? ld.subscriptions.chatgpt.monthlyPrice
      : 0
    : 0;
  const subsTotal = claudePrice + chatgptPrice;
  const value7d: number = Number.isFinite(ld?.summary?.valueExtracted7d)
    ? ld.summary.valueExtracted7d
    : 0;
  const valueMonthly = value7d * (30 / 7);
  const roi = subsTotal > 0 ? valueMonthly / subsTotal : 0;
  const roiClean = roi >= 10 ? Math.round(roi) : Number(roi.toFixed(1));

  const messages: number = Number.isFinite(ld?.summary?.messagesLast7d)
    ? ld.summary.messagesLast7d
    : 0;
  const projects: number = Number.isFinite(ld?.summary?.projectsTracked)
    ? ld.summary.projectsTracked
    : 0;

  const shareText = `I extracted ~$${Math.round(valueMonthly).toLocaleString()} of work from $${subsTotal}/mo of AI subscriptions this month. ${roiClean}× ROI.\n\nMy AI usage panel: ${messages.toLocaleString()} messages across ${projects} projects.\n\nAgentic OS — local read-only operator console.`;
  const [copied, setCopied] = useState(false);
  const [tipShown, setTipShown] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 inline-flex items-center gap-2">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: "oklch(0.74 0.085 70)",
            boxShadow: "0 0 8px oklch(0.74 0.085 70 / 70%)",
          }}
        />
        Share card
      </div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.05] mb-3 text-center">
        Show your AI ROI.
      </h1>
      <div className="mb-7 flex items-center gap-3 text-[12px] text-muted-foreground text-center max-w-xl leading-relaxed">
        <Camera className="h-4 w-4 shrink-0" />
        <span>
          Take a screenshot of the card below — sized 1200 × 630 for OG, Twitter, and LinkedIn
          previews.
        </span>
        {isDemo && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold shrink-0"
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

      {/* The actual share card — 1200×630 at 1× zoom */}
      <div
        id="share-card"
        className="relative shrink-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        style={{
          width: 1200,
          height: 630,
          maxWidth: "100%",
          background:
            "radial-gradient(120% 90% at 0% 0%, oklch(0.16 0.008 285) 0%, oklch(0.11 0.005 285) 45%, oklch(0.07 0.003 285) 100%), oklch(0.07 0.003 285)",
          fontFamily:
            'Geist, ui-sans-serif, system-ui, -apple-system, "SF Pro Display", sans-serif',
        }}
      >
        {/* glowing accents — amber primary, blue counterweight */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full blur-[90px] opacity-40"
          style={{
            background:
              "radial-gradient(circle, oklch(0.74 0.085 70 / 65%) 0%, oklch(0.65 0.18 250 / 30%) 55%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-40 h-[440px] w-[440px] rounded-full blur-[90px] opacity-25"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.18 250 / 70%) 0%, transparent 70%)",
          }}
        />

        <div className="relative h-full flex flex-col justify-between p-14 text-white">
          {/* Header — branding */}
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center font-mono font-semibold text-[20px] leading-none"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.20 0.005 285) 0%, oklch(0.14 0.006 285) 100%)",
                border: "1px solid oklch(0.74 0.085 70 / 35%)",
                color: "oklch(0.74 0.085 70)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 6%)",
              }}
            >
              A.
            </div>
            <div className="flex flex-col leading-tight">
              <div className="text-[14px] font-semibold tracking-tight text-white">Agentic OS</div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/55">
                operator console
              </div>
            </div>
          </div>

          {/* Hero numbers */}
          <div>
            <div className="text-[18px] uppercase tracking-[0.28em] text-white/55 mb-3">
              Subscription ROI
            </div>
            <div className="flex items-baseline gap-5 flex-wrap">
              <div
                className="text-[120px] leading-[0.92] font-semibold tabular-nums"
                style={{
                  color: "oklch(0.78 0.10 70)",
                  textShadow: "0 8px 28px oklch(0.74 0.085 70 / 30%)",
                  fontFamily:
                    '"Geist Mono Variable", ui-monospace, "SF Mono", monospace',
                }}
              >
                {roiClean}×
              </div>
              <div className="text-[28px] leading-tight font-medium text-white/90 max-w-[640px]">
                <span className="tabular-nums">${Math.round(valueMonthly).toLocaleString()}</span>
                <span className="text-white/55"> of work extracted from </span>
                <span className="tabular-nums">${subsTotal}/mo</span>
                <span className="text-white/55"> of AI subscriptions</span>
              </div>
            </div>
          </div>

          {/* Footer — supporting numbers */}
          <div className="flex items-end justify-between gap-6">
            <div className="flex gap-12">
              <Stat label="Messages · 7d" value={messages.toLocaleString()} />
              <Stat label="Projects" value={projects.toString()} />
              <Stat label="Plan" value={claudeSub?.plan ?? (claudeDetected ? "Claude" : "—")} />
            </div>
            <div className="text-[14px] text-white/55 max-w-[320px] text-right leading-snug">
              Personal AI operator console — local, read-only, dark.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:border-foreground/30 hover:bg-accent text-sm font-medium transition-colors"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : "Copy share text"}
        </button>
        <button
          onClick={() => setTipShown((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:border-foreground/30 hover:bg-accent text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          How to save as PNG
        </button>
      </div>

      {tipShown && (
        <div className="mt-4 max-w-xl text-center text-[13px] text-muted-foreground leading-relaxed rounded-xl border border-border bg-card/40 p-4">
          <strong className="text-foreground">macOS:</strong> <kbd>⌘⇧4</kbd>, then <kbd>Space</kbd>,
          then click the card. The screenshot lands on your Desktop at exactly 1200×630.
          <div className="mt-2">
            <strong className="text-foreground">Web devtools:</strong> Right-click the card →
            Inspect → in DevTools, right-click the <code>#share-card</code> node → Capture node
            screenshot.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-1">{label}</div>
      <div className="text-[26px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

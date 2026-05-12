import welcomeHero from "@/assets/setup-welcome-hero.jpg";
import dreamCosmos from "@/assets/dream-cosmos.jpg";

import claudeLogo from "@/assets/claude-logo.png";
import codexLogo from "@/assets/logos/codex.png";
import openaiLogo from "@/assets/logos/openai-gpt5.png";
import vscodeLogo from "@/assets/logos/vscode.svg";
import openrouterLogo from "@/assets/logos/openrouter.png";
import openclawLogo from "@/assets/logos/openclaw.svg";
import geminiLogo from "@/assets/logos/googlegemini.svg";
import pineconeLogo from "@/assets/logos/pinecone.png";
import obsidianLogo from "@/assets/logos/obsidian.png";
import notionLogo from "@/assets/logos/notion.png";
import antigravityLogo from "@/assets/logos/antigravity.png";
import cursorLogo from "@/assets/logos/cursor.svg";
import zedLogo from "@/assets/logos/zed.svg";
import windsurfLogo from "@/assets/logos/windsurf.svg";
import jetbrainsLogo from "@/assets/logos/jetbrains.svg";
import aiderLogo from "@/assets/logos/aider.svg";
import codyLogo from "@/assets/logos/cody.svg";
import copilotLogo from "@/assets/logos/copilot.svg";
import gooseLogo from "@/assets/logos/goose.svg";
import continueLogo from "@/assets/logos/continue.svg";
import cadenceMorning from "@/assets/dream/cadence-morning.png";
import cadenceEvening from "@/assets/dream/cadence-evening.png";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Home } from "./index";
import confetti from "canvas-confetti";
import { useLiveData } from "@/lib/use-live-data";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cog,
  Compass,
  Eye,
  EyeOff,
  Moon,
  Plus,
  Search,
  Sparkles,
  HardDrive,
  X,
  ExternalLink,
  KeyRound,
  MessagesSquare,
  Brain,
  Coins,
  Zap,
  Activity,
  Workflow,
  Telescope,
  TrendingUp,
  Upload,
  User,
  Loader2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

// `/setup` is no longer a separate full-screen wizard route. Instead, it
// renders the dashboard with the setup modal forced open — same UX as `/`
// when the user has no config yet, but the URL stays as /setup so direct
// links and Vite's --open=/setup flag still work.
function SetupRoute() {
  return <Home forceSetupModal />;
}

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Set up Agentic OS" },
      {
        name: "description",
        content: "Detect your tools, point at your data, and install Agentic OS in 90 seconds.",
      },
    ],
  }),
  component: SetupRoute,
});

// ---------- Color tokens ----------
const ORANGE = "#C19A6B";
const ORANGE_SOFT = "#D4B17E";
const ORANGE_GRADIENT = "linear-gradient(135deg, #D4B17E 0%, #C19A6B 55%, #9A7A4A 100%)";
const VIOLET = "#4A9EFF";
const EMERALD = "#3ddc97";
const AMBER = "#fbbf24";
const SKY = "#60a5fa";

// Sidecar base URL — defined early in the module so it's available to all
// functions including code-split route components.
// (sidecar removed — wizard is pure UI; aggregator runs in terminal via `bun run setup`)

// ---------- Types & defaults ----------

type ToolKey =
  | "claude_code"
  | "claude_desktop"
  | "claude_vscode"
  | "antigravity"
  | "codex"
  | "gemini"
  | "anthropic_api"
  | "openai_api"
  | "openrouter"
  | "openclaw";

type ToolStatus = "detected" | "missing" | "manual";

interface ToolDef {
  key: ToolKey;
  name: string;
  iconUrl?: string;
  iconText?: string;
  iconColor?: string;
  defaultPath?: string;
  envVar?: string;
  defaultStatus: ToolStatus;
  defaultOnIfDetected: boolean;
  lastActivity?: string;
}

// Demo-data sentinel — set by aggregate.ts in live-data.example.json.
// When true, Step 3 (Detect tools) suppresses fake "detected" pills so a fresh
// clone doesn't see false positives for tools the user doesn't have.
let IS_DEMO_DATA = true;

// Real signals for Anthropic + OpenRouter, derived from live-data.json so we
// stop pretending "detected" regardless of reality.
let ANTHROPIC_DETECTED = false;
let OPENROUTER_DETECTED = false;
let DETECTION: DetectionShape | null = null;

// Hydrated from useLiveData() inside SetupModal
function hydrateLiveSignals(liveData: any) {
  IS_DEMO_DATA = liveData?.isExample === true;
  const sub = liveData?.subscriptions?.claude;
  ANTHROPIC_DETECTED = !!sub && (sub.credCount ?? 0) > 0;
  const present: string[] = liveData?.detection?.envKeysPresent ?? [];
  const orSub = liveData?.subscriptions?.openrouter;
  OPENROUTER_DETECTED = present.includes("OPENROUTER_API_KEY") || !!orSub?.label;
  DETECTION = liveData?.detection ?? null;
}

// `defaultStatus` and `lastActivity` are only fallbacks for tool keys that
// don't have a real detection contract entry yet. The real signal comes
// from `detectionForTool()` (which reads liveData.detection.apps) — that's
// what the badge text and the sub-text actually use at render time. We
// start every "default to detected" tool as missing so a brand-new clone
// with no aggregator run cannot show fake "active 2h ago" text.
const TOOLS: ToolDef[] = [
  {
    key: "claude_code",
    name: "Claude Code",
    iconUrl: claudeLogo,
    defaultPath: "~/.claude",
    defaultStatus: "missing",
    defaultOnIfDetected: true,
    lastActivity: undefined,
  },
  {
    key: "claude_desktop",
    name: "Claude Desktop",
    iconUrl: claudeLogo,
    defaultPath: "~/.claude",
    defaultStatus: "missing",
    defaultOnIfDetected: true,
    lastActivity: undefined,
  },
  {
    key: "claude_vscode",
    name: "Claude in VS Code",
    iconUrl: vscodeLogo,
    defaultPath: "~/.claude",
    defaultStatus: "missing",
    defaultOnIfDetected: false,
    lastActivity: undefined,
  },
  {
    key: "antigravity",
    name: "AntiGravity",
    iconUrl: antigravityLogo,
    defaultPath: "~/.antigravity",
    defaultStatus: "missing",
    defaultOnIfDetected: true,
  },
  {
    key: "codex",
    name: "OpenAI Codex",
    iconUrl: codexLogo,
    defaultPath: "~/.codex",
    defaultStatus: "missing",
    defaultOnIfDetected: true,
    lastActivity: undefined,
  },
  {
    key: "gemini",
    name: "Gemini CLI",
    iconUrl: geminiLogo,
    defaultPath: "~/.config/gemini-cli",
    defaultStatus: "missing",
    defaultOnIfDetected: false,
  },
  {
    key: "anthropic_api",
    name: "Anthropic API",
    iconUrl: claudeLogo,
    envVar: "ANTHROPIC_API_KEY",
    defaultStatus: ANTHROPIC_DETECTED ? "detected" : "missing",
    defaultOnIfDetected: false,
    lastActivity: ANTHROPIC_DETECTED ? "Keychain credentials present" : undefined,
  },
  {
    key: "openai_api",
    name: "OpenAI API",
    iconUrl: openaiLogo,
    envVar: "OPENAI_API_KEY",
    defaultStatus: "missing",
    defaultOnIfDetected: false,
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    iconUrl: openrouterLogo,
    envVar: "OPENROUTER_API_KEY",
    defaultStatus: OPENROUTER_DETECTED ? "detected" : "missing",
    defaultOnIfDetected: OPENROUTER_DETECTED,
    lastActivity: OPENROUTER_DETECTED ? "key in env" : undefined,
  },
  {
    key: "openclaw",
    name: "OpenClaw",
    iconUrl: openclawLogo,
    defaultPath: "~/.openclaw",
    defaultStatus: "missing",
    defaultOnIfDetected: true,
    lastActivity: undefined,
  },
];

// (VALIDATION_BY_TOOL removed alongside the old "Locate data" step.)

// Map our internal ToolKey to the detection contract from aggregate.ts.
// `null` means the detection layer doesn't know about that tool yet — we fall
// back to the hardcoded TOOLS defaults. We exclude `terminals` because that
// entry is a nested aggregate (current + installed list), not a single
// AppDetectionEntry.
type DetectionAppKey = Exclude<keyof DetectionShape["apps"], "terminals">;
const TOOL_DETECTION_KEY: Partial<Record<ToolKey, DetectionAppKey>> = {
  claude_code: "claudeCode",
  claude_desktop: "claudeApp",
  // claude_vscode  → no detection contract, keep default
  antigravity: "antigravity",
  codex: "codex",
  // gemini, anthropic_api, openai_api, openrouter, openclaw → fall back
};

function detectionForTool(
  tool: ToolDef,
): { detected: boolean; label: string; meta?: string } | null {
  if (!DETECTION?.apps) return null;
  const k = TOOL_DETECTION_KEY[tool.key];
  if (!k) return null;
  const entry = DETECTION.apps[k] as AppDetectionEntry | undefined;
  if (!entry) return null;
  if (!entry.detected) {
    return { detected: false, label: "Not found" };
  }
  const ver = entry.version ? `v${entry.version}` : null;
  return {
    detected: true,
    label: ver ? `Detected · ${ver}` : "Detected",
    meta: entry.path,
  };
}

interface EnvKeyNeeded {
  name: string;
  reason: string;
  url?: string;
  optional: boolean;
}

interface AppDetectionEntry {
  detected: boolean;
  version?: string;
  path?: string;
  name?: string;
  configPath?: string;
  variants?: string[];
}

interface TerminalDetections {
  current: { detected: boolean; name?: string };
  installed: {
    warp: AppDetectionEntry;
    ghostty: AppDetectionEntry;
    iterm: AppDetectionEntry;
    hyper: AppDetectionEntry;
    alacritty: AppDetectionEntry;
    wezterm: AppDetectionEntry;
    tabby: AppDetectionEntry;
    appleTerminal: AppDetectionEntry;
  };
}

interface DetectionShape {
  apps: {
    // Existing
    antigravity: AppDetectionEntry;
    claudeApp: AppDetectionEntry;
    claudeCode: AppDetectionEntry;
    cursor: AppDetectionEntry;
    codex: AppDetectionEntry;
    // IDEs / editors
    vscode: AppDetectionEntry;
    vscodeInsiders: AppDetectionEntry;
    zed: AppDetectionEntry;
    windsurf: AppDetectionEntry;
    jetbrains: AppDetectionEntry;
    // AI CLIs
    aider: AppDetectionEntry;
    continueCli: AppDetectionEntry;
    copilotCli: AppDetectionEntry;
    cody: AppDetectionEntry;
    goose: AppDetectionEntry;
    // Terminals (current + installed list)
    terminals: TerminalDetections;
  };
  memoryStores: {
    pinecone: { detected: boolean; hasKey: boolean; indexes?: number; totalVectors?: number };
    obsidian: {
      detected: boolean;
      vaultPath?: string;
      files?: number;
      vaults?: { path: string; files: number }[];
    };
    notion: { detected: boolean; appPath?: string; hasToken: boolean };
    logseq: { detected: boolean; appPath?: string; configPath?: string };
  };
  envKeysNeeded: EnvKeyNeeded[];
  envKeysPresent: string[];
}

// DETECTION is now hydrated by hydrateLiveSignals() inside SetupModal

export interface ConfigShape {
  version: string;
  createdAt?: string;
  tools: Partial<Record<ToolKey, { enabled: boolean; path?: string; envVar?: string }>>;
  memory?: { sources: string[]; primaryPath?: string };
  valuation?: { hourlyRateUsd: number };
  envKeys?: Record<string, string>;
  dream?: {
    enabled: boolean;
    schedule: { frequency: "daily" | "weekly"; time: string; tz: string };
    webSearch: boolean;
    heroImage: boolean;
    imageApiKey?: string;
  };
  privacy?: { acknowledgedAt: string; outboundCalls: string[] };
}

function normalizeJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function") {
    throw new TypeError("Config contains a function, which cannot be persisted as JSON.");
  }
  if (value === undefined || value === null || typeof value !== "object") return value;
  if (seen.has(value)) {
    throw new TypeError("Config contains a circular reference, which cannot be persisted as JSON.");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const arr = value.map((item) => normalizeJsonValue(item, seen));
    seen.delete(value);
    return arr;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeJsonValue(entry, seen);
    if (normalized !== undefined) out[key] = normalized;
  }
  seen.delete(value);
  return out;
}

function serializeConfig(final: ConfigShape): { config: ConfigShape; json: string } {
  const config = normalizeJsonValue(final) as ConfigShape;
  const json = JSON.stringify(config);
  if (!json) throw new TypeError("Config could not be serialized.");
  return { config, json };
}

// Reconcile a tool's `enabled` default against ALL detection signals we have.
// This is the single source of truth used by both the displayed status badge
// and the toggle's initial state. Critical fix for the prior OpenRouter bug
// where the badge said "Not found" but the toggle silently stayed enabled
// because defaultOnIfDetected was hard-coded to true at module init.
function isToolReallyDetected(tool: ToolDef): boolean {
  // Prefer real detection-contract entries when available.
  const real = detectionForTool(tool);
  if (real) return real.detected;
  // Tool keys without a detection contract: rely on the per-tool detection
  // flags computed above.
  if (tool.key === "anthropic_api") return ANTHROPIC_DETECTED;
  if (tool.key === "openrouter") return OPENROUTER_DETECTED;
  // Demo data lies — assume nothing is detected so we don't auto-toggle
  // tools the brand-new user doesn't actually have.
  if (IS_DEMO_DATA) return false;
  return tool.defaultStatus === "detected";
}

function buildInitialConfig(): ConfigShape {
  const tools: ConfigShape["tools"] = {};
  for (const t of TOOLS) {
    // The toggle starts on ONLY when we genuinely detected the tool AND its
    // default policy says we should pre-enable on detection. Anything else
    // (missing, demo-data fakery, ambiguous signal) starts off.
    const detected = isToolReallyDetected(t);
    const enabled = detected && t.defaultOnIfDetected;
    tools[t.key] = t.envVar ? { enabled, envVar: t.envVar } : { enabled, path: t.defaultPath };
  }
  // Seed envKeys with empty strings for any keys the detection layer flagged
  // as needed — keeps the config JSON shape consistent. Tolerate missing /
  // non-array envKeysNeeded so we don't crash when the wizard renders before
  // live-data hydrates (the React Query fallback ships an empty detection).
  const envKeys: Record<string, string> = {};
  const needed = Array.isArray(DETECTION?.envKeysNeeded) ? DETECTION!.envKeysNeeded : [];
  for (const k of needed) envKeys[k.name] = "";
  return {
    version: "1.0.0",
    tools,
    // Auto-tick memory sources we detected
    memory: { sources: ["claude_memory", "chatgpt_memory"] },
    envKeys,
  };
}

function persistInstalledConfig(final: ConfigShape, markJustInstalled = false) {
  if (typeof window === "undefined") return final;
  try {
    const { config, json } = serializeConfig(final);
    window.localStorage.setItem("claude-os-config", json);
    window.localStorage.removeItem("claude-os-config-draft");
    if (markJustInstalled) {
      window.localStorage.setItem("claude-os-just-installed", "1");
    }
    return config;
  } catch (err) {
    console.error("[setup] failed to persist installed config:", err);
    return final;
  }
}

// User-visible numbered steps. Welcome is a pre-roll (step index 0) and is
// intentionally not in this list — the Stepper hides during Welcome and shows
// 1..7 once the wizard begins. "You're set" is the final visible step and the
// finish step.
const STEP_TITLES = [
  "Make it yours",
  "Detect tools",
  "Memory",
  "API keys",
  "Time value",
  "Dream cadence",
  "You're set",
];

// Internal step indices: 0 = Welcome (pre-roll), 1..7 = visible steps in order.
const TOTAL_STEPS = STEP_TITLES.length + 1; // 8 (Welcome + 7 numbered)
const LAST_STEP_INDEX = TOTAL_STEPS - 1; // 7 (You're set, also the finish step)
const FINISH_STEP_INDEX = LAST_STEP_INDEX; // You're set is the final/finish

const AVATAR_STORAGE_KEY = "claude-os.avatar.v1";
const OPERATOR_NAME_KEY = "claude-os.operator-name.v1";

// ---------- Component ----------

// SetupModal — the wizard rendered as a centered modal layered over the
// dashboard. The dashboard always renders underneath; this component only
// owns the wizard's internal state (step, config, navigation). When the
// user finishes (or cancels), `onClose` fires and the parent unmounts us.
//
// No `useNavigate` here — the entire point of the modal architecture is
// that we never navigate. State changes only.
export function SetupModal({ onClose }: { onClose: () => void }) {
  // Hydrate module-level detection signals from runtime data
  const liveData = useLiveData();
  hydrateLiveSignals(liveData);
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ConfigShape>(() => buildInitialConfig());

  const updateConfig = useCallback(
    (patch: (prev: ConfigShape) => { next: ConfigShape; flashed: string[] }) => {
      setConfig((prev) => {
        const { next } = patch(prev);
        // flashed is intentionally unused — the right-side drawer was removed,
        // so there's nothing to flash. We keep the patch contract so step
        // components can stay generic.
        return next;
      });
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, LAST_STEP_INDEX)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const requestClose = useCallback(() => {
    if (confirm("Cancel setup? Your progress will be saved as a draft.")) {
      try {
        localStorage.setItem("claude-os-config-draft", JSON.stringify(config));
      } catch {}
      onClose();
    }
  }, [config, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && step < FINISH_STEP_INDEX) {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        next();
      }
      if (e.key === "Escape") {
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, next, requestClose]);

  // Persist draft on every change
  useEffect(() => {
    try {
      localStorage.setItem("claude-os-config-draft", JSON.stringify(config));
    } catch {}
  }, [config]);

  // Skippable: personalize (1), memory (3), api keys (4), dream cadence (6).
  // In demo mode, Detect tools (2) is also skippable since the empty-state
  // explicitly tells the user to come back after running the aggregator.
  const skippableSteps = new Set<number>([1, 3, 4, 6]);
  if (IS_DEMO_DATA) skippableSteps.add(2);

  return (
    <div
      // Modal layer: full-viewport fixed overlay above the dashboard. The
      // dashboard renders underneath; this layer dims + blurs it without
      // replacing it. z-50 keeps us above the sticky header (z-30) and the
      // sidebar's mobile backdrop.
      className="fixed inset-0 z-50 overflow-y-auto text-foreground"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,138,61,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(167,139,250,0.08) 0%, transparent 55%), rgba(8, 8, 12, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Set up Agentic OS"
    >
      {/* Tiny corner anchor — brand mark + close button — sits subtly outside
          the centered card so the eye lands on the card itself. The brand
          mark gets a soft orange halo so it reads as a piece of identity
          and not just a logo. */}
      <div className="fixed top-5 left-6 z-[60] inline-flex items-center gap-2.5">
        <div
          className="relative flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden shrink-0"
          style={{
            background: "linear-gradient(135deg, #D4B17E 0%, #C19A6B 60%, #9A7A4A 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 6px 18px -6px rgba(193, 154, 107, 0.7)",
          }}
        >
          <img src={claudeLogo} alt="Claude" className="h-5 w-5 object-contain drop-shadow-sm" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 hidden sm:inline">
          Agentic OS · Setup
        </span>
      </div>
      <button
        onClick={requestClose}
        className="fixed top-5 right-6 z-[60] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
        aria-label="Close setup"
      >
        <X className="h-3.5 w-3.5" /> Close
      </button>

      {/* Centered viewport: stepper + card + nav stack vertically and sit in
          the middle of the page. */}
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-14 md:py-20">
        {/* Stepper — centered, just above the card */}
        <div className="mb-6">
          <Stepper current={step} />
        </div>

        {/* The window. Card sits in the middle of the page with breathing
            room above + below. The .modal-glass utility adds the inset
            top-edge highlight so the card reads as a piece of glass. */}
        <div
          className="modal-glass w-full max-w-3xl rounded-2xl border border-border/60 overflow-hidden backdrop-blur-sm"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.012) 40%, rgba(0,0,0,0.22) 100%), oklch(0.185 0.012 265)",
          }}
        >
          <div className="px-7 md:px-12 py-11 md:py-14">
            <StepContent
              step={step}
              config={config}
              updateConfig={updateConfig}
              onAdvance={next}
              onFinish={(finalFromActivate?: ConfigShape) => {
                const final = finalFromActivate ?? {
                  ...config,
                  createdAt: new Date().toISOString(),
                };
                // Persist and mark just-installed; the parent's onClose
                // handler reads + clears that marker to fire confetti.
                persistInstalledConfig(final, true);
                onClose();
              }}
            />
          </div>
        </div>

        {/* Bottom nav — centered under the card. Back is on the left of the
            same row; Skip/Next are on the right. They share the card's width
            so the eye reads the whole stack as one unit. */}
        <div className="w-full max-w-3xl mt-6 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="group text-sm text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-foreground/5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
          </button>

          <div className="flex items-center gap-2">
            {skippableSteps.has(step) && (
              <button
                onClick={next}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-md hover:bg-foreground/5 transition-colors"
              >
                Skip
              </button>
            )}
            {step < FINISH_STEP_INDEX && (
              <button
                onClick={next}
                className="group relative text-sm font-semibold inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white transition-all hover:scale-[1.02] active:scale-[0.99] overflow-hidden"
                style={{
                  background: ORANGE_GRADIENT,
                  boxShadow: `0 10px 30px -8px ${ORANGE}, inset 0 1px 0 rgba(255, 255, 255, 0.32)`,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-30"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 100%)",
                  }}
                />
                <span className="relative inline-flex items-center gap-2">
                  {step === 0 ? "Start setup" : "Next"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fireConfetti() {
  try {
    const colors = ["#D4B17E", "#C19A6B", "#9A7A4A", "#4A9EFF", "#3ddc97", "#60a5fa"];
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
    setTimeout(
      () =>
        confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors }),
      200,
    );
    setTimeout(
      () =>
        confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors }),
      350,
    );
  } catch {}
}

// ---------- Stepper ----------

const EMERALD_GRADIENT = "linear-gradient(135deg, #A7F3D0 0%, #34D399 55%, #059669 100%)";

function Stepper({ current }: { current: number }) {
  // `current` is the wizard's internal step index where 0 = Welcome (pre-roll)
  // and 1..8 = the numbered steps. We hide the stepper during the pre-roll and
  // map the internal index onto STEP_TITLES (length 8) for the visible row.
  if (current === 0) {
    return <div className="hidden md:block" aria-hidden />;
  }
  const visibleCurrent = current - 1; // 0..7 over STEP_TITLES
  const visibleTitle = STEP_TITLES[visibleCurrent] ?? "";
  return (
    <div className="hidden md:flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        {STEP_TITLES.map((t, i) => {
          const done = i < visibleCurrent;
          const active = i === visibleCurrent;
          // Done = filled, monochrome with a check mark feel.
          // Active = filled with the orange brand gradient + soft pulse.
          // Future = empty pill.
          let bg = "rgba(255, 255, 255, 0.05)";
          let color: string = "rgba(255, 255, 255, 0.45)";
          let shadow = "inset 0 0 0 1px rgba(255, 255, 255, 0.06)";
          if (done) {
            bg = "rgba(255, 255, 255, 0.16)";
            color = "rgba(255, 255, 255, 0.75)";
            shadow = "inset 0 0 0 1px rgba(255, 255, 255, 0.18)";
          }
          if (active) {
            bg = ORANGE_GRADIENT;
            color = "rgba(255, 255, 255, 0.98)";
            shadow =
              "0 0 22px -2px rgba(193, 154, 107, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.32)";
          }
          return (
            <div key={t} className="flex items-center gap-1.5">
              <div
                className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold tabular-nums transition-all ${
                  active ? "scale-110 stepper-active" : ""
                }`}
                style={{
                  background: bg,
                  color,
                  boxShadow: shadow,
                  textShadow: active ? "0 1px 1px rgba(0, 0, 0, 0.3)" : "none",
                }}
                title={t}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </div>
              {i < STEP_TITLES.length - 1 && (
                <div
                  className="h-px w-5 transition-colors"
                  style={{
                    background: done ? "rgba(255, 255, 255, 0.32)" : "rgba(255, 255, 255, 0.08)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Step label below the dots — quiet, just enough orientation */}
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 tabular-nums">
        Step {visibleCurrent + 1} of {STEP_TITLES.length}
        <span className="text-muted-foreground/40 mx-1.5">·</span>
        <span className="text-foreground/75">{visibleTitle}</span>
      </div>
    </div>
  );
}

// ---------- Step content router ----------

function StepContent({
  step,
  config,
  updateConfig,
  onAdvance,
  onFinish,
}: {
  step: number;
  config: ConfigShape;
  updateConfig: (patch: (prev: ConfigShape) => { next: ConfigShape; flashed: string[] }) => void;
  onAdvance: () => void;
  onFinish: (finalConfig?: ConfigShape) => void;
}) {
  return (
    <div key={step} className="animate-in fade-in slide-in-from-right-4 duration-300">
      {step === 0 && <StepWelcome />}
      {step === 1 && <StepPersonalize />}
      {step === 2 && (
        <StepDetect config={config} updateConfig={updateConfig} onAdvance={onAdvance} />
      )}
      {step === 3 && <StepMemoryConnect config={config} updateConfig={updateConfig} />}
      {step === 4 && <StepApiKeys config={config} updateConfig={updateConfig} />}
      {step === 5 && <StepValue config={config} updateConfig={updateConfig} />}
      {step === 6 && <StepDream config={config} updateConfig={updateConfig} />}
      {step === 7 && <StepYoureSet config={config} onFinish={onFinish} />}
    </div>
  );
}

// ---------- Step 1: Welcome ----------

function StepWelcome() {
  // Clear stale draft and scan state on mount so a re-run of the wizard
  // starts fresh. We do NOT clear "claude-os-config" here — that's the
  // installed config that the dashboard depends on. It gets overwritten
  // by Activate, not deleted by merely visiting /setup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("claude-os-config-draft");
      window.localStorage.removeItem("claude-os-just-installed");
      // Clear the scan-completed guard so Step 2 runs a fresh scan
      window.sessionStorage.removeItem("claude-os.scan-completed");
      window.sessionStorage.removeItem("claude-os.scan-reloaded");
    } catch {}
  }, []);

  return (
    <div className="max-w-2xl">
      <div
        className="aspect-[16/8] rounded-2xl border border-border/60 mb-9 relative overflow-hidden"
        style={{
          boxShadow:
            "0 24px 64px -20px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Slow ambient drift on the hero so it doesn't feel static. The
            scale > 1 keeps the image from showing edges as it shifts. */}
        <img
          src={welcomeHero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover ambient-drift"
          width={1536}
          height={832}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        {/* Soft orange wash from the bottom-left so the hero feels rooted in
            the brand color rather than purely cinematic. */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-screen opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 15% 100%, rgba(193, 154, 107, 0.45) 0%, transparent 60%)",
          }}
        />
      </div>
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-4 inline-flex items-center gap-2"
        style={{ color: "color-mix(in oklab, var(--foreground) 60%, transparent)" }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }}
        />
        Welcome
      </div>
      <h1
        className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-[1.05]"
        style={{ color: "var(--foreground)" }}
      >
        Set up your
        <br />
        Agentic OS.
      </h1>
      <p
        className="text-base md:text-[17px] mb-9 max-w-xl leading-relaxed"
        style={{ color: "color-mix(in oklab, var(--foreground) 78%, transparent)" }}
      >
        We'll detect your tools, point at your data, and install your daily Dream review. About 90
        seconds — no commitments.
      </p>
      <div className="flex flex-wrap gap-2.5 text-sm">
        <BadgeRow icon={<Cog className="h-4 w-4" />} label="Detect" color={ORANGE} />
        <BadgeRow icon={<Compass className="h-4 w-4" />} label="Configure" color={VIOLET} />
        <BadgeRow icon={<Moon className="h-4 w-4" />} label="Activate" color={EMERALD} />
      </div>
    </div>
  );
}

function BadgeRow({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card/40"
      style={{ borderColor: `${color}55`, boxShadow: `inset 0 0 0 1px ${color}10` }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-foreground/90">{label}</span>
    </div>
  );
}

// ---------- Step 2: Personal photo ----------

const ANTHROPIC_ORANGE = "#C19A6B";

async function fileToCompressedDataUrl(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not decode image"));
    i.src = dataUrl;
  });

  // If already small and under ~512KB, keep as-is
  if (img.width <= maxSize && img.height <= maxSize && dataUrl.length < 512 * 1024) {
    return dataUrl;
  }

  // Square crop to centre, then downscale to maxSize
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = maxSize;
  canvas.height = maxSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
  return canvas.toDataURL("image/jpeg", quality);
}

function StepPersonalize() {
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate name + avatar from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existingName = window.localStorage.getItem(OPERATOR_NAME_KEY);
      if (existingName) setName(existingName);
      const existing = window.localStorage.getItem(AVATAR_STORAGE_KEY);
      if (existing) setPreview(existing);
    } catch {}
  }, []);

  // Persist name as the user types (debounced via every-keystroke; tiny payload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const trimmed = name.trim();
      if (trimmed) {
        window.localStorage.setItem(OPERATOR_NAME_KEY, trimmed);
      } else {
        window.localStorage.removeItem(OPERATOR_NAME_KEY);
      }
      window.dispatchEvent(
        new StorageEvent("storage", { key: OPERATOR_NAME_KEY, newValue: trimmed || null }),
      );
    } catch {}
  }, [name]);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      window.localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
      try {
        window.dispatchEvent(
          new StorageEvent("storage", { key: AVATAR_STORAGE_KEY, newValue: dataUrl }),
        );
      } catch {}
      setPreview(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    void handleFile(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    void handleFile(f);
  };

  const onClear = () => {
    try {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: AVATAR_STORAGE_KEY, newValue: null }),
      );
    } catch {}
    setPreview(null);
  };

  return (
    <div>
      <Eyebrow>Make it yours</Eyebrow>
      <H1>Howdy.</H1>
      <Sub>
        Tell us your name and drop in a photo. Both stay in your browser — nothing leaves this
        device. Skip either if you'd rather keep the defaults.
      </Sub>

      {/* Name field */}
      <label className="block mb-7">
        <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Your name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Operator"
          autoComplete="given-name"
          spellCheck={false}
          className="focus-orange w-full px-4 py-3.5 rounded-xl bg-card/40 border border-border text-base placeholder:text-muted-foreground/55 transition-colors"
          style={{ caretColor: ANTHROPIC_ORANGE }}
        />
        <span className="block text-[11px] text-muted-foreground mt-2">
          We'll greet you by this name on the dashboard. Default is "Operator".
        </span>
      </label>

      {/* Photo dropzone */}
      <div className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Your photo
      </div>

      {preview ? (
        <div
          className="rounded-2xl border bg-card/50 p-6 mb-4"
          style={{
            borderColor: `${ANTHROPIC_ORANGE}40`,
            boxShadow: `inset 0 0 0 1px ${ANTHROPIC_ORANGE}10`,
          }}
        >
          <div className="flex items-center gap-5">
            <div
              className="relative h-24 w-24 rounded-full overflow-hidden shrink-0"
              style={{
                boxShadow: `0 0 0 2px ${ANTHROPIC_ORANGE}cc, 0 0 0 6px ${ANTHROPIC_ORANGE}22, 0 12px 32px -8px ${ANTHROPIC_ORANGE}55`,
              }}
            >
              <img src={preview} alt="Your avatar" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold mb-1 tracking-tight">Looks good.</div>
              <div className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
                Stored locally — only this browser ever sees it.
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border hover:border-foreground/30 hover:bg-foreground/5 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" /> Replace
                </button>
                <button
                  onClick={onClear}
                  className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border hover:border-foreground/30 hover:bg-foreground/5 text-muted-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="rounded-2xl border-2 border-dashed p-10 mb-4 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? ANTHROPIC_ORANGE : "var(--border)",
            // Soft gradient when empty so the dropzone reads as a piece of
            // the wizard, not a flat box. Lifts to a brighter orange wash
            // while dragging so the affordance is unmistakable.
            background: dragOver
              ? `radial-gradient(ellipse 60% 80% at 50% 30%, ${ANTHROPIC_ORANGE}1f 0%, transparent 70%), ${ANTHROPIC_ORANGE}0a`
              : `radial-gradient(ellipse 80% 80% at 50% 0%, ${ANTHROPIC_ORANGE}0d 0%, transparent 65%), rgba(255, 255, 255, 0.012)`,
            boxShadow: dragOver
              ? `0 0 0 4px ${ANTHROPIC_ORANGE}1a, inset 0 0 0 1px ${ANTHROPIC_ORANGE}30`
              : "inset 0 0 0 1px rgba(255, 255, 255, 0.02)",
          }}
        >
          <div
            className="mx-auto h-16 w-16 rounded-full grid place-items-center mb-4"
            style={{
              background: `linear-gradient(135deg, ${ANTHROPIC_ORANGE}26, ${ANTHROPIC_ORANGE}10)`,
              color: ANTHROPIC_ORANGE,
              boxShadow: `inset 0 0 0 1px ${ANTHROPIC_ORANGE}40, 0 8px 24px -8px ${ANTHROPIC_ORANGE}66`,
            }}
          >
            {busy ? <Sparkles className="h-7 w-7 animate-pulse" /> : <User className="h-7 w-7" />}
          </div>
          <div className="text-sm font-semibold mb-1.5 tracking-tight">
            {busy ? "Processing…" : "Drop a photo here, or click to browse"}
          </div>
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            JPG, PNG, or WEBP. We downscale to 256×256 before saving — your file never leaves the
            browser.
          </div>
          {error && (
            <div className="mt-3 text-[12px]" style={{ color: "#ef4444" }}>
              {error}
            </div>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}

// ---------- Step 3: Detect ----------

function ToolIcon({ tool, size = 34 }: { tool: ToolDef; size?: number }) {
  if (tool.iconUrl) {
    return (
      <img
        src={tool.iconUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-lg object-contain"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          padding: 5,
          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
        }}
      />
    );
  }
  return (
    <div
      className="rounded-lg grid place-items-center font-bold"
      style={{
        width: size,
        height: size,
        background: `${tool.iconColor}22`,
        color: tool.iconColor,
        fontSize: size * 0.42,
        boxShadow: `inset 0 0 0 1px ${tool.iconColor}33`,
      }}
    >
      {tool.iconText}
    </div>
  );
}

// Visual scan steps — purely decorative; the real work happens via the SSE
// aggregator. We rotate through these so the user has something to read while
// the actual scan runs in the background.
const SCAN_STAGES: { label: string; icon: typeof Search }[] = [
  { label: "Looking for AI editors…", icon: Search },
  { label: "Probing terminals…", icon: HardDrive },
  { label: "Reading Claude sessions…", icon: MessagesSquare },
  { label: "Scanning memory stores…", icon: Brain },
  { label: "Checking subscriptions…", icon: Sparkles },
  { label: "Tallying API keys…", icon: KeyRound },
];

function StepDetect({
  config,
  updateConfig,
  onAdvance,
}: {
  config: ConfigShape;
  updateConfig: (patch: (prev: ConfigShape) => { next: ConfigShape; flashed: string[] }) => void;
  onAdvance: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const stepLd = useLiveData();
  const enabledCount = Object.values(config.tools).filter((t) => t?.enabled).length;

  const [scanState, setScanState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "done"; freshDetection?: DetectionShape | null }
    | { kind: "offline" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const startedRef = useRef(false);
  const advancedRef = useRef(false);
  const [stageIdx, setStageIdx] = useState(0);
  // Live-updating "found X" feed parsed from the aggregator's stdout.
  // Each entry surfaces as a green checkmark line in the loader so the
  // user sees discoveries land in real time instead of staring at a spinner.
  const [finds, setFinds] = useState<string[]>([]);
  const addFind = useCallback((label: string) => {
    setFinds((prev) => (prev.includes(label) ? prev : [...prev, label]));
  }, []);

  const advanceOnce = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onAdvance();
  }, [onAdvance]);

  // No more "scanning" — the scan happened in the terminal. Step 2 lands
  // directly on the detection results (or an empty-state pointing at
  // `bun run setup` for cold-start clones).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setScanState({ kind: "done" });

    const ld = stepLd;
    const hasReal = ld?.isExample !== true;

    // Pre-populate the finds list immediately so the results card renders
    // populated rather than empty. No animation, no queue tick.
    const queue: string[] = [];
    if (hasReal) {
      const projects = Number(ld?.summary?.projectsTracked ?? 0);
      const messages = Number(ld?.summary?.totalAssistantMessages ?? 0);
      if (projects > 0) {
        queue.push(`${projects} Claude projects · ${messages.toLocaleString()} messages`);
      }
      const memFiles = Number(ld?.memory?.stats?.totalFiles ?? 0);
      const memWs = Number(ld?.memory?.stats?.totalWorkspaces ?? 0);
      const pcIdx = Number(ld?.memory?.stats?.pineconeIndexes ?? 0);
      const pcVec = Number(ld?.memory?.stats?.totalVectors ?? 0);
      if (memFiles > 0) queue.push(`${memFiles} memory files`);
      if (memWs > 0) queue.push(`${memWs} workspaces`);
      if (pcIdx > 0) queue.push(`${pcIdx} Pinecone indexes (${pcVec.toLocaleString()} vectors)`);
      const dreamCount = Array.isArray(ld?.dream?.prescriptions)
        ? ld.dream.prescriptions.length
        : 0;
      if (dreamCount > 0) queue.push(`Latest Dream: ${dreamCount} prescriptions`);
      const subs: string[] = [];
      if (ld?.subscriptions?.claude?.authMode) subs.push("Claude");
      if (ld?.subscriptions?.chatgpt?.present) subs.push("ChatGPT");
      if (ld?.subscriptions?.openrouter?.label) subs.push("OpenRouter");
      if (ld?.subscriptions?.openclaw?.lastTouchedAt) subs.push("OpenClaw");
      if (subs.length > 0) queue.push(`Subscriptions: ${subs.join(" · ")}`);
      const value7d = Number(ld?.summary?.valueExtracted7d ?? 0);
      if (value7d > 0) {
        queue.push(`API-equivalent token spend: $${Math.round(value7d).toLocaleString()} (last 7d)`);
      }
    } else {
      // No real scan yet — show a friendly hint without faking discoveries.
      queue.push("No real scan yet — run `bun run setup` in your terminal");
    }

    // Push every find synchronously — no animation. The user lands on a
    // populated results card immediately.
    for (const f of queue) addFind(f);
  }, [addFind]);

  if (scanState.kind === "offline" || scanState.kind === "error") {
    return (
      <div>
        <Eyebrow>Detect tools</Eyebrow>
        <H1>Run the scan first.</H1>
        <Sub>
          Open a terminal and run <span className="font-mono">bun run setup</span> in this repo.
          That walks your machine, populates the dashboard, and you come back here.
        </Sub>
        {scanState.kind === "error" && (
          <p className="text-[11px] text-muted-foreground/70 mt-3">{scanState.message}</p>
        )}
      </div>
    );
  }
  // Detection data is always sourced from the imported liveData module —
  // no sidecar fetch, no fresh-data state. The aggregator wrote
  // src/data/live-data.json when the user ran `bun run setup` in their
  // terminal, and Vite picked it up when it served this page.
  const activeDetection: DetectionShape | null = DETECTION;

  // Resolve each tool's effective status using live detection data.
  const resolveStatus = (tool: ToolDef): ToolStatus => {
    // Check fresh detection data first
    if (activeDetection) {
      const k = TOOL_DETECTION_KEY[tool.key];
      if (k) {
        const entry = activeDetection.apps[k] as AppDetectionEntry | undefined;
        if (entry) return entry.detected ? "detected" : "missing";
      }
    }
    return isToolReallyDetected(tool) ? "detected" : "missing";
  };

  const detectedCount = TOOLS.filter((t) => resolveStatus(t) === "detected").length;

  const toggle = (tool: ToolDef) => {
    updateConfig((prev: ConfigShape) => {
      const cur = prev.tools[tool.key];
      const nextTools = {
        ...prev.tools,
        [tool.key]: { ...cur, enabled: !cur?.enabled },
      };
      return { next: { ...prev, tools: nextTools }, flashed: [`tools.${tool.key}.enabled`] };
    });
  };

  if (detectedCount === 0) {
    return (
      <div>
        <Eyebrow>Detect tools</Eyebrow>
        <H1>Nothing detected yet.</H1>
        <Sub>
          We couldn't find Claude Code, Codex, or any other tools we know about. Install one and
          come back — the wizard will pick them up automatically.
        </Sub>
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <a href="https://claude.ai/code" className="text-sm" style={{ color: ORANGE }}>
            Install Claude Code first?
          </a>
        </div>
      </div>
    );
  }

  const detected = TOOLS.filter((t) => resolveStatus(t) !== "missing");
  const missing = TOOLS.filter((t) => resolveStatus(t) === "missing");

  const renderCard = (tool: ToolDef) => {
    const enabled = !!config.tools[tool.key]?.enabled;
    const status = resolveStatus(tool);
    const real = detectionForTool(tool);
    const statusStyle =
      status === "detected"
        ? { color: EMERALD, bg: `${EMERALD}1a`, label: real?.label ?? "Detected" }
        : status === "manual"
          ? { color: AMBER, bg: `${AMBER}1a`, label: "Manual" }
          : { color: "#9aa3b0", bg: "rgba(255,255,255,0.05)", label: "Not found" };
    const sub = real?.meta ?? tool.lastActivity;

    // Detected + enabled = confident green-edged tile. Detected + off = quiet
    // border. Not found = dimmed. The shadow + border combine to make
    // "enabled" feel like a deliberate state.
    const isDetected = status === "detected";
    const cardStyle: React.CSSProperties = enabled
      ? {
          borderColor: isDetected ? `${EMERALD}55` : "rgba(255, 255, 255, 0.18)",
          background: isDetected
            ? `radial-gradient(120% 100% at 0% 0%, ${EMERALD}10, transparent 60%), rgba(255, 255, 255, 0.025)`
            : "rgba(255, 255, 255, 0.04)",
          boxShadow: isDetected
            ? `inset 0 0 0 1px ${EMERALD}22, 0 6px 18px -12px ${EMERALD}90`
            : "inset 0 0 0 1px rgba(255, 255, 255, 0.03)",
        }
      : {
          borderColor: "var(--border)",
          background: "rgba(255, 255, 255, 0.012)",
        };
    return (
      <div
        key={tool.key}
        role="button"
        tabIndex={0}
        onClick={() => toggle(tool)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(tool);
          }
        }}
        aria-pressed={enabled}
        className="relative text-left rounded-xl border p-4 transition-all cursor-pointer select-none hover:border-foreground/25"
        style={cardStyle}
      >
        <div className="flex items-start justify-between mb-3">
          <ToolIcon tool={tool} />
          <Toggle checked={enabled} onChange={() => toggle(tool)} stop />
        </div>
        <div className="text-sm font-semibold tracking-tight">{tool.name}</div>
        <div
          className="inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {statusStyle.label}
        </div>
        {sub && (
          <div className="text-[11px] text-muted-foreground mt-2 truncate font-mono">{sub}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Eyebrow>Detect tools</Eyebrow>
      <H1>Found these on your machine.</H1>
      <Sub>
        We'll watch the ones you check. {enabledCount} of {TOOLS.length} enabled.
      </Sub>

      {/* Detection results strip — confirmation that the scan actually saw your
          editors, CLIs, and terminals. Sits quietly above the toggle grid so
          the headline of this step is still about the scan result, not the
          inventory. */}
      <DetectionResults />

      <SectionLabel>
        On your machine <span className="text-muted-foreground/60">· {detected.length}</span>
      </SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {detected.map(renderCard)}
      </div>

      {missing.length > 0 && (
        <>
          <SectionLabel muted>
            Not detected <span className="text-muted-foreground/60">· {missing.length}</span>
          </SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 opacity-75">
            {missing.map(renderCard)}
          </div>
        </>
      )}

      <button
        onClick={() => setShowAddModal(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2"
      >
        <Plus className="h-4 w-4" /> Add another tool manually
      </button>

      {showAddModal && <AddToolModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// Pretty animated loader for Step 2. Pulse ring + cycling stage labels so the
// user has something to read while the aggregator is grinding in the background.
// `finds` is the list of "we found X" lines parsed from the aggregator's stdout
// in real time — they animate in as discoveries land.
function DetectScanLoader({ stageIdx, finds }: { stageIdx: number; finds: string[] }) {
  const stage = SCAN_STAGES[stageIdx];
  const StageIcon = stage.icon;
  return (
    <div
      className="rounded-2xl border p-10 mb-6 flex flex-col items-center text-center relative overflow-hidden"
      style={{
        borderColor: "rgba(193, 154, 107, 0.18)",
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(193, 154, 107, 0.06) 0%, transparent 60%), rgba(255, 255, 255, 0.012)",
        boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.02)",
      }}
    >
      {/* Soft ambient orange glow behind the pulse — gives the loader weight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{ background: ORANGE }}
      />
      {/* Pulse ring with rotating icon */}
      <div className="relative h-24 w-24 mb-7">
        {/* outer pulse */}
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: `${ORANGE}33` }}
        />
        {/* mid pulse, slower */}
        <span
          className="absolute inset-2 rounded-full"
          style={{
            background: `${ORANGE}22`,
            animation: "ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
        {/* inner solid */}
        <div
          className="absolute inset-4 rounded-full grid place-items-center"
          style={{
            background: ORANGE_GRADIENT,
            boxShadow: `0 12px 36px -8px ${ORANGE}, inset 0 1px 0 rgba(255, 255, 255, 0.35)`,
          }}
        >
          <Loader2 className="h-7 w-7 text-white animate-spin" />
        </div>
      </div>

      {/* Cycling label */}
      <div
        key={stageIdx /* re-mount for crossfade on each tick */}
        className="inline-flex items-center gap-2 text-[14px] text-foreground/90 animate-in fade-in slide-in-from-bottom-1 duration-300 mb-5 min-h-[1.5rem]"
      >
        <StageIcon className="h-3.5 w-3.5" style={{ color: ORANGE }} />
        <span className="tracking-tight">{stage.label}</span>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1.5 mb-7">
        {SCAN_STAGES.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === stageIdx ? 22 : 6,
              background: i === stageIdx ? ORANGE : "rgba(255, 255, 255, 0.18)",
              boxShadow: i === stageIdx ? `0 0 8px ${ORANGE}88` : undefined,
            }}
          />
        ))}
      </div>

      {/* Live "found X" feed — each entry animates in as the aggregator
          surfaces it. Caps at 6 visible to keep the panel breathable. */}
      {finds.length > 0 && (
        <div className="w-full max-w-md text-left border-t border-border/40 pt-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-3 inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse"
              style={{ boxShadow: "0 0 6px rgba(61, 220, 151, 0.8)" }}
            />
            Discoveries
          </div>
          <div className="space-y-1">
            {finds.slice(-6).map((line, i) => (
              <div
                key={`${line}-${i}`}
                className="find-line flex items-center gap-2 py-1 text-[12.5px] animate-in fade-in slide-in-from-left-1 duration-300"
                style={{ color: "color-mix(in oklab, var(--foreground) 92%, transparent)" }}
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                <span className="truncate">{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Detection results strip (Step 2) ----------
//
// Renders the actual scan results so the user sees what was found, not just
// the loader. Groups into AI Editors / AI CLIs / Terminals. Shows detected
// cards expanded; collapses "not detected" entries behind a "+ N not detected"
// chip so the section stays visually quiet.

interface DetectionRowSpec {
  key: string;
  name: string;
  iconUrl: string;
}

const EDITOR_SPECS: DetectionRowSpec[] = [
  { key: "claudeApp", name: "Claude.app", iconUrl: claudeLogo },
  { key: "cursor", name: "Cursor", iconUrl: cursorLogo },
  { key: "vscode", name: "VS Code", iconUrl: vscodeLogo },
  { key: "vscodeInsiders", name: "VS Code Insiders", iconUrl: vscodeLogo },
  { key: "zed", name: "Zed", iconUrl: zedLogo },
  { key: "windsurf", name: "Windsurf", iconUrl: windsurfLogo },
  { key: "jetbrains", name: "JetBrains", iconUrl: jetbrainsLogo },
  { key: "antigravity", name: "AntiGravity", iconUrl: antigravityLogo },
];

const CLI_SPECS: DetectionRowSpec[] = [
  { key: "claudeCode", name: "Claude Code", iconUrl: claudeLogo },
  { key: "codex", name: "OpenAI Codex", iconUrl: codexLogo },
  { key: "aider", name: "Aider", iconUrl: aiderLogo },
  { key: "cody", name: "Cody", iconUrl: codyLogo },
  { key: "copilotCli", name: "Copilot CLI", iconUrl: copilotLogo },
  { key: "goose", name: "Goose", iconUrl: gooseLogo },
  { key: "continueCli", name: "Continue.dev", iconUrl: continueLogo },
];

const TERMINAL_SPECS: { key: string; name: string }[] = [
  { key: "warp", name: "Warp" },
  { key: "ghostty", name: "Ghostty" },
  { key: "iterm", name: "iTerm2" },
  { key: "hyper", name: "Hyper" },
  { key: "alacritty", name: "Alacritty" },
  { key: "wezterm", name: "WezTerm" },
  { key: "tabby", name: "Tabby" },
  { key: "appleTerminal", name: "Apple Terminal" },
];

function DetectionResults() {
  const [showHiddenEditors, setShowHiddenEditors] = useState(false);
  const [showHiddenCLIs, setShowHiddenCLIs] = useState(false);
  const [showHiddenTerminals, setShowHiddenTerminals] = useState(false);

  if (!DETECTION) return null;

  // Pull each spec's detection entry. Demo-data lies about everything being
  // detected, so in demo mode we render the section but keep all cards in the
  // muted "not detected" state.
  const editorEntries = EDITOR_SPECS.map((s) => ({
    spec: s,
    entry: (DETECTION?.apps as any)?.[s.key] as AppDetectionEntry | undefined,
  }));
  const cliEntries = CLI_SPECS.map((s) => ({
    spec: s,
    entry: (DETECTION?.apps as any)?.[s.key] as AppDetectionEntry | undefined,
  }));
  const terminalEntries = TERMINAL_SPECS.map((s) => ({
    spec: s,
    entry: DETECTION?.apps?.terminals?.installed?.[s.key as keyof TerminalDetections["installed"]] as
      | AppDetectionEntry
      | undefined,
  }));

  const currentTerminal = DETECTION?.apps?.terminals?.current;

  const isDetected = (e: AppDetectionEntry | undefined) => !IS_DEMO_DATA && !!e?.detected;

  const detectedEditors = editorEntries.filter(({ entry }) => isDetected(entry));
  const missingEditors = editorEntries.filter(({ entry }) => !isDetected(entry));
  const detectedCLIs = cliEntries.filter(({ entry }) => isDetected(entry));
  const missingCLIs = cliEntries.filter(({ entry }) => !isDetected(entry));
  const detectedTerms = terminalEntries.filter(({ entry }) => isDetected(entry));
  const missingTerms = terminalEntries.filter(({ entry }) => !isDetected(entry));

  return (
    <div className="mb-7 rounded-2xl border border-border/50 bg-card/20 p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-4">
        Scan results
      </div>

      <DetectionGroup
        title="AI Editors"
        detected={detectedEditors.map(({ spec, entry }) => (
          <DetectionCard
            key={spec.key}
            iconUrl={spec.iconUrl}
            name={spec.name}
            detected
            version={entry?.version}
            path={entry?.path}
          />
        ))}
        missing={missingEditors.map(({ spec, entry }) => (
          <DetectionCard
            key={spec.key}
            iconUrl={spec.iconUrl}
            name={spec.name}
            detected={false}
            version={entry?.version}
            path={entry?.path}
          />
        ))}
        showHidden={showHiddenEditors}
        setShowHidden={setShowHiddenEditors}
      />

      <DetectionGroup
        title="AI CLIs"
        detected={detectedCLIs.map(({ spec, entry }) => (
          <DetectionCard
            key={spec.key}
            iconUrl={spec.iconUrl}
            name={spec.name}
            detected
            version={entry?.version}
            path={entry?.path}
          />
        ))}
        missing={missingCLIs.map(({ spec, entry }) => (
          <DetectionCard
            key={spec.key}
            iconUrl={spec.iconUrl}
            name={spec.name}
            detected={false}
            version={entry?.version}
            path={entry?.path}
          />
        ))}
        showHidden={showHiddenCLIs}
        setShowHidden={setShowHiddenCLIs}
      />

      {/* Terminals: prepend the "current shell" if known. */}
      <DetectionGroup
        title="Terminals"
        detected={[
          ...(currentTerminal?.detected && currentTerminal?.name && !IS_DEMO_DATA
            ? [
                <DetectionCard
                  key="__current__"
                  iconText="●"
                  iconColor={EMERALD}
                  name={`${currentTerminal.name} (current)`}
                  detected
                />,
              ]
            : []),
          ...detectedTerms.map(({ spec, entry }) => (
            <DetectionCard
              key={spec.key}
              iconText="▱"
              iconColor={SKY}
              name={spec.name}
              detected
              path={entry?.path}
              version={entry?.version}
            />
          )),
        ]}
        missing={missingTerms.map(({ spec, entry }) => (
          <DetectionCard
            key={spec.key}
            iconText="▱"
            iconColor="#9aa3b0"
            name={spec.name}
            detected={false}
            path={entry?.path}
            version={entry?.version}
          />
        ))}
        showHidden={showHiddenTerminals}
        setShowHidden={setShowHiddenTerminals}
      />
    </div>
  );
}

function DetectionGroup({
  title,
  detected,
  missing,
  showHidden,
  setShowHidden,
}: {
  title: string;
  detected: React.ReactNode[];
  missing: React.ReactNode[];
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;
}) {
  if (detected.length === 0 && missing.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-medium tracking-wide text-foreground/85">{title}</div>
        <div className="text-[10px] tabular-nums text-muted-foreground/70">
          {detected.length} detected
        </div>
      </div>

      {detected.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{detected}</div>
      ) : (
        <div className="text-[11px] text-muted-foreground/70 italic">None detected.</div>
      )}

      {missing.length > 0 && (
        <>
          {!showHidden ? (
            <button
              onClick={() => setShowHidden(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground/80 px-2 py-1 rounded-full border border-border/50 hover:border-foreground/20 transition-colors"
            >
              <Plus className="h-3 w-3" /> {missing.length} not detected
            </button>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 opacity-60">{missing}</div>
              <button
                onClick={() => setShowHidden(false)}
                className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground/80"
              >
                Hide
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DetectionCard({
  iconUrl,
  iconText,
  iconColor,
  name,
  detected,
  version,
  path,
}: {
  iconUrl?: string;
  iconText?: string;
  iconColor?: string;
  name: string;
  detected: boolean;
  version?: string;
  path?: string;
}) {
  const meta = path ?? (detected ? "—" : undefined);
  const versionLabel = version ? (version.startsWith("v") ? version : `v${version}`) : null;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2"
      style={{
        borderColor: detected ? `${EMERALD}33` : "rgba(255,255,255,0.06)",
        background: detected ? `${EMERALD}08` : "rgba(255,255,255,0.02)",
      }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          width={22}
          height={22}
          className="rounded-md object-contain shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", padding: 2 }}
        />
      ) : (
        <div
          className="h-[22px] w-[22px] rounded-md grid place-items-center font-bold shrink-0"
          style={{
            background: `${iconColor ?? "#9aa3b0"}22`,
            color: iconColor ?? "#9aa3b0",
            fontSize: 11,
          }}
        >
          {iconText ?? "·"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-medium tracking-tight truncate">{name}</div>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider shrink-0"
            style={{
              background: detected ? `${EMERALD}1a` : "rgba(255,255,255,0.05)",
              color: detected ? EMERALD : "#9aa3b0",
            }}
          >
            {detected ? (versionLabel ? `Detected · ${versionLabel}` : "Detected") : "Not found"}
          </span>
        </div>
        {detected && meta && (
          <div className="text-[10px] text-muted-foreground/70 truncate font-mono">{meta}</div>
        )}
      </div>
    </div>
  );
}

function AddToolModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-semibold">Add tool manually</div>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-sm"
              placeholder="My custom tool"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Path
            </label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-sm font-mono"
              placeholder="~/.mytool"
            />
          </div>
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-2 rounded-md text-white text-sm"
            style={{ background: ORANGE_GRADIENT }}
          >
            Add tool
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 4: Connect your stack ----------

// (buildDetectionCards / DetectionCardView removed — the old "Connect stack"
// step was replaced by Step 3 "Memory" and Step 4 "API keys", which use
// dedicated MemoryStoreCard + ApiKeyRow components below.)

// Inline API-key field used by Step 4. Logo on the left, label + one-line
// "what this unlocks" explainer above the input. No skip checkboxes — leave
// the field blank to skip.
function ApiKeyRow({
  name,
  iconUrl,
  iconText,
  iconColor,
  unlocks,
  url,
  value,
  alreadyInEnv,
  onChange,
}: {
  name: string;
  iconUrl?: string;
  iconText?: string;
  iconColor?: string;
  unlocks: string;
  url?: string;
  value: string;
  alreadyInEnv: boolean;
  onChange: (v: string) => void;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="shrink-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-lg object-contain"
              style={{ background: "rgba(255,255,255,0.05)", padding: 6 }}
            />
          ) : (
            <div
              className="rounded-lg grid place-items-center font-bold w-10 h-10"
              style={{
                background: `${iconColor ?? "#9aa3b0"}22`,
                color: iconColor ?? "#9aa3b0",
                fontSize: 16,
              }}
            >
              {iconText}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[12.5px] text-foreground/90">{name}</span>
              {alreadyInEnv && (
                <span
                  className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `${EMERALD}1f`, color: EMERALD }}
                >
                  Already set
                </span>
              )}
            </div>
            {url && !alreadyInEnv && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Get key <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="text-[12px] text-muted-foreground mb-3 leading-relaxed">{unlocks}</div>

          {alreadyInEnv ? (
            <div
              className="font-mono text-[11px] text-muted-foreground bg-background/40 px-3 py-2 rounded border flex items-center gap-2"
              style={{ borderColor: `${EMERALD}30` }}
            >
              <Check className="h-3 w-3 shrink-0" style={{ color: EMERALD }} />
              <span>detected in your shell — leave blank</span>
            </div>
          ) : (
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="paste your key (or leave blank to skip)"
                className="focus-orange w-full font-mono text-xs px-3 py-2 pr-9 rounded-md bg-background border border-border transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? "Hide key" : "Show key"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3: Memory (Pinecone / Obsidian / Notion / Logseq) ----------

// What each memory store unlocks for the user — shown when nothing is detected
// to explain *why* they'd connect this thing in the first place.
const MEMORY_BLURB: Record<"pinecone" | "obsidian" | "notion" | "logseq", string> = {
  pinecone: "Vector database for embeddings. Lets the dashboard read across long-term memory.",
  obsidian: "Local markdown notes app. We index your vault into the memory graph.",
  notion: "If you keep specs and decisions in Notion, we'll pull them into the graph.",
  logseq: "Networked outliner. Same idea as Obsidian — local-first markdown blocks.",
};

function StepMemoryConnect({
  config,
  updateConfig,
}: {
  config: ConfigShape;
  updateConfig: (patch: (prev: ConfigShape) => { next: ConfigShape; flashed: string[] }) => void;
}) {
  const stores = DETECTION?.memoryStores;
  const envKeys = config.envKeys ?? {};
  const envPresent = DETECTION?.envKeysPresent ?? [];
  const pineconeAlreadyInEnv = envPresent.includes("PINECONE_API_KEY");
  const notionAlreadyInEnv =
    envPresent.includes("NOTION_TOKEN") || envPresent.includes("NOTION_API_KEY");
  const [connectedKeys, setConnectedKeys] = useState<Record<string, boolean>>({});

  const setEnvKey = (name: string, value: string) => {
    updateConfig((prev) => {
      const cur = prev.envKeys ?? {};
      return {
        next: { ...prev, envKeys: { ...cur, [name]: value } },
        flashed: [`envKeys.${name}`],
      };
    });
  };

  const connectEnvKey = (name: string) => {
    const value = (envKeys[name] ?? "").trim();
    if (!value) return;
    setEnvKey(name, value);
    setConnectedKeys((prev) => ({ ...prev, [name]: true }));
  };

  const setObsidianPath = (path: string) => {
    updateConfig((prev) => ({
      next: {
        ...prev,
        memory: { ...(prev.memory ?? { sources: [] }), primaryPath: path },
      },
      flashed: ["memory.primaryPath"],
    }));
  };

  const obsidianPath = config.memory?.primaryPath ?? "";
  const pineconeKeySaved = Boolean(
    stores && (stores.pinecone.hasKey || pineconeAlreadyInEnv || connectedKeys.PINECONE_API_KEY),
  );
  const pineconeNeedsKey = !pineconeKeySaved;
  const notionTokenSaved = Boolean(
    stores && (stores.notion.hasToken || notionAlreadyInEnv || connectedKeys.NOTION_TOKEN),
  );
  const notionNeedsToken = !notionTokenSaved;

  return (
    <div>
      <Eyebrow>Memory</Eyebrow>
      <H1>Connect your memory.</H1>
      <Sub>
        These are the stores Agentic OS reads into the memory constellation. Anything we couldn't
        auto-detect, you can point us at by hand.
      </Sub>

      {!stores ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-sm text-muted-foreground leading-relaxed">
          We haven't scanned your machine yet. Go back to the previous step and let it finish — once
          detection runs we'll show your real memory stores here.
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Pinecone — detection card + inline API key */}
          <MemoryStoreCard
            name="Pinecone"
            iconUrl={pineconeLogo}
            blurb={MEMORY_BLURB.pinecone}
            detected={stores.pinecone.detected || pineconeKeySaved}
            badgeLabel={
              stores.pinecone.detected && pineconeKeySaved
                ? "Connected"
                : pineconeKeySaved
                  ? "Key saved"
                  : "Connect"
            }
            badgeTone={
              stores.pinecone.detected && pineconeNeedsKey
                ? "attention"
                : pineconeKeySaved
                  ? "success"
                  : "action"
            }
            statusLine={
              stores.pinecone.detected && pineconeKeySaved
                ? `${stores.pinecone.indexes ?? 0} indexes · ${(stores.pinecone.totalVectors ?? 0).toLocaleString()} vectors`
                : pineconeKeySaved
                  ? "API key saved. Agentic OS will connect during activation."
                  : "Paste your API key to connect Pinecone."
            }
          >
            {/* Inline API key — required for Pinecone to actually be readable */}
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> Pinecone API key
                {pineconeAlreadyInEnv && (
                  <span
                    className="ml-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${EMERALD}1f`, color: EMERALD }}
                  >
                    Already set
                  </span>
                )}
              </div>
              {pineconeKeySaved ? (
                <div className="font-mono text-[11px] text-muted-foreground bg-background/30 px-3 py-2 rounded border border-border">
                  {stores.pinecone.detected
                    ? "Key is ready. No need to paste it again."
                    : "Key saved. We'll verify indexes when the local scan runs again."}
                </div>
              ) : (
                <CredentialConnectInput
                  value={envKeys.PINECONE_API_KEY ?? ""}
                  onChange={(v) => setEnvKey("PINECONE_API_KEY", v)}
                  placeholder="paste your Pinecone API key"
                  onConnect={() => connectEnvKey("PINECONE_API_KEY")}
                />
              )}
              <a
                href="https://app.pinecone.io/organizations/-/projects/-/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5"
              >
                Get key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </MemoryStoreCard>

          {/* Obsidian — detection + manual path input */}
          <MemoryStoreCard
            name="Obsidian"
            iconUrl={obsidianLogo}
            blurb={MEMORY_BLURB.obsidian}
            detected={stores.obsidian.detected}
            badgeLabel={stores.obsidian.detected ? "Detected" : "Add path"}
            badgeTone={stores.obsidian.detected ? "success" : "action"}
            statusLine={
              stores.obsidian.detected
                ? `${stores.obsidian.files ?? 0} files · ${stores.obsidian.vaultPath ?? "~/Documents/Obsidian Vault"}`
                : undefined
            }
          >
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                {stores.obsidian.detected ? "Vault path (override)" : "Where is your vault?"}
              </div>
              <input
                value={obsidianPath}
                onChange={(e) => setObsidianPath(e.target.value)}
                placeholder={stores.obsidian.vaultPath ?? "~/Documents/Obsidian Vault"}
                className="w-full font-mono text-xs px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                {stores.obsidian.detected
                  ? "We auto-detected the path above. Override only if your vault lives somewhere else."
                  : "Paste the folder that contains your .obsidian directory. Leave blank if you don't use Obsidian."}
              </p>
              {(stores.obsidian.vaults?.length ?? 0) > 1 && (
                <div className="mt-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    Detected vaults
                  </div>
                  {stores.obsidian.vaults!.map((vault) => (
                    <button
                      key={vault.path}
                      type="button"
                      onClick={() => setObsidianPath(vault.path)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/30 px-3 py-1.5 text-left hover:border-foreground/30"
                    >
                      <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
                        {vault.path}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {vault.files} files
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </MemoryStoreCard>

          {/* Notion — connection card */}
          <MemoryStoreCard
            name="Notion"
            iconUrl={notionLogo}
            blurb={MEMORY_BLURB.notion}
            detected={stores.notion.detected || notionTokenSaved}
            badgeLabel={
              stores.notion.detected && notionTokenSaved
                ? "Connected"
                : notionTokenSaved
                  ? "Token saved"
                  : "Connect"
            }
            badgeTone={
              stores.notion.detected && notionNeedsToken
                ? "attention"
                : notionTokenSaved
                  ? "success"
                  : "action"
            }
            statusLine={
              stores.notion.detected && notionTokenSaved
                ? "Integration token ready"
                : notionTokenSaved
                  ? "Token saved. Agentic OS will connect during activation."
                  : "Paste your integration token to connect Notion."
            }
          >
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> Notion integration token
                {notionAlreadyInEnv && (
                  <span
                    className="ml-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${EMERALD}1f`, color: EMERALD }}
                  >
                    Already set
                  </span>
                )}
              </div>
              {notionTokenSaved ? (
                <div className="font-mono text-[11px] text-muted-foreground bg-background/30 px-3 py-2 rounded border border-border">
                  {stores.notion.detected
                    ? "Token is ready. No need to paste it again."
                    : "Token saved. We'll verify the workspace when the local scan runs again."}
                </div>
              ) : (
                <CredentialConnectInput
                  value={envKeys.NOTION_TOKEN ?? ""}
                  onChange={(v) => setEnvKey("NOTION_TOKEN", v)}
                  placeholder="paste your Notion integration token"
                  onConnect={() => connectEnvKey("NOTION_TOKEN")}
                />
              )}
              <a
                href="https://www.notion.so/profile/integrations"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5"
              >
                Create an integration <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </MemoryStoreCard>

          {/* Logseq is local-only. If the scan did not find an app/config path, hide it. */}
          {stores.logseq.detected && (
            <MemoryStoreCard
              name="Logseq"
              iconText="L"
              iconColor="#85c1e9"
              blurb={MEMORY_BLURB.logseq}
              detected
              badgeLabel="Detected"
              badgeTone="success"
              statusLine={stores.logseq.appPath ?? stores.logseq.configPath ?? "Detected"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <input
        type={reveal ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full font-mono text-xs px-3 py-2 pr-9 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40"
      />
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        aria-label={reveal ? "Hide" : "Show"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function CredentialConnectInput({
  value,
  onChange,
  onConnect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onConnect: () => void;
  placeholder: string;
}) {
  const [reveal, setReveal] = useState(false);
  const hasValue = value.trim().length > 0;
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="focus-orange w-full font-mono text-xs px-3 py-2 pr-9 rounded-md bg-background border border-border transition-colors"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Hide" : "Show"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={!hasValue}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.99]"
        style={{
          background: ORANGE_GRADIENT,
          boxShadow: hasValue
            ? `0 8px 22px -8px ${ORANGE}, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
            : undefined,
        }}
      >
        Connect <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MemoryStoreCard({
  name,
  iconUrl,
  iconText,
  iconColor,
  blurb,
  detected,
  badgeLabel,
  badgeTone,
  statusLine,
  children,
}: {
  name: string;
  iconUrl?: string;
  iconText?: string;
  iconColor?: string;
  blurb: string;
  detected: boolean;
  badgeLabel?: string;
  badgeTone?: "success" | "attention" | "action";
  statusLine?: string;
  children?: React.ReactNode;
}) {
  const tone = badgeTone ?? (detected ? "success" : "action");
  const badgeStyles =
    tone === "success"
      ? { background: `${EMERALD}1f`, color: EMERALD }
      : tone === "attention"
        ? { background: `${AMBER}1f`, color: AMBER }
        : { background: `${ORANGE}1f`, color: ORANGE };
  const borderColor =
    tone === "success" ? `${EMERALD}55` : tone === "attention" ? `${AMBER}55` : "var(--border)";
  const bg =
    tone === "success"
      ? `${EMERALD}08`
      : tone === "attention"
        ? `${AMBER}08`
        : "var(--card-bg, rgba(0,0,0,0))";
  // Subtle outer glow when detected so the card reads as a state, not just
  // a coloured outline. Quiet by default — strong enough that "Connected"
  // feels like a confirmation.
  const shadow =
    tone === "success"
      ? `inset 0 0 0 1px ${EMERALD}22, 0 8px 24px -16px ${EMERALD}90`
      : tone === "attention"
        ? `inset 0 0 0 1px ${AMBER}22, 0 8px 24px -16px ${AMBER}90`
        : "inset 0 0 0 1px rgba(255, 255, 255, 0.02)";
  return (
    <div
      className="rounded-2xl border p-5 transition-all"
      style={{ borderColor, background: bg, boxShadow: shadow }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-lg object-contain"
              style={{ background: "rgba(255,255,255,0.05)", padding: 6 }}
            />
          ) : (
            <div
              className="rounded-lg grid place-items-center font-bold w-10 h-10"
              style={{
                background: `${iconColor ?? "#9aa3b0"}22`,
                color: iconColor ?? "#9aa3b0",
                fontSize: 16,
              }}
            >
              {iconText}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold tracking-tight">{name}</span>
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={badgeStyles}
            >
              {badgeLabel ?? (detected ? "Connected" : "Connect")}
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">{blurb}</p>
          {statusLine && (
            <p className="text-[11px] text-muted-foreground/80 mt-1 truncate" title={statusLine}>
              {statusLine}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Step 4: API keys ----------

interface ApiKeySpec {
  name: string;
  iconUrl?: string;
  iconText?: string;
  iconColor?: string;
  unlocks: string;
  url?: string;
}

const API_KEY_SPECS: ApiKeySpec[] = [
  {
    name: "OPENROUTER_API_KEY",
    iconUrl: openrouterLogo,
    unlocks: "Live PAYG balance + per-call burn rate.",
    url: "https://openrouter.ai/keys",
  },
  {
    name: "ANTHROPIC_API_KEY",
    iconUrl: claudeLogo,
    unlocks: "Plan tier detection beyond the OAuth signal.",
    url: "https://console.anthropic.com/settings/keys",
  },
  {
    name: "OPENAI_API_KEY",
    iconUrl: openaiLogo,
    unlocks: "GPT-5 / Codex usage when you're not on Plus.",
    url: "https://platform.openai.com/api-keys",
  },
  {
    name: "KIE_API_KEY",
    iconText: "K",
    iconColor: "#4A9EFF",
    unlocks: "Image generation for the Dream cards. Optional.",
    url: "https://kie.ai/api-keys",
  },
];

function StepApiKeys({
  config,
  updateConfig,
}: {
  config: ConfigShape;
  updateConfig: (patch: (prev: ConfigShape) => { next: ConfigShape; flashed: string[] }) => void;
}) {
  const envKeys = config.envKeys ?? {};
  const envPresent = DETECTION?.envKeysPresent ?? [];

  const setEnvKey = (name: string, value: string) => {
    updateConfig((prev) => {
      const cur = prev.envKeys ?? {};
      return {
        next: { ...prev, envKeys: { ...cur, [name]: value } },
        flashed: [`envKeys.${name}`],
      };
    });
  };

  return (
    <div>
      <Eyebrow>API keys</Eyebrow>
      <H1>Track your usage live.</H1>
      <Sub>
        These keys let Agentic OS pull live balance, vector counts, and per-call spend straight from
        your accounts. Leave any field blank to skip.
      </Sub>

      <div className="space-y-3">
        {API_KEY_SPECS.map((spec) => (
          <ApiKeyRow
            key={spec.name}
            name={spec.name}
            iconUrl={spec.iconUrl}
            iconText={spec.iconText}
            iconColor={spec.iconColor}
            unlocks={spec.unlocks}
            url={spec.url}
            value={envKeys[spec.name] ?? ""}
            alreadyInEnv={envPresent.includes(spec.name)}
            onChange={(v) => setEnvKey(spec.name, v)}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground mt-7 leading-relaxed flex items-start gap-2">
        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
        <span>
          We never validate keys here. On the final step we write any keys you pasted to{" "}
          <span className="font-mono text-foreground/75">claude-os/.env.local</span> via the local
          sidecar — they never leave this machine.
        </span>
      </p>
    </div>
  );
}

// ---------- Step 5: Time value ----------

const RATE_PRESETS = [
  { rate: 20, label: "Student" },
  { rate: 60, label: "Freelancer" },
  { rate: 150, label: "Senior IC" },
  { rate: 250, label: "Founder" },
  { rate: 1500, label: "Executive" },
];

function StepValue({ config, updateConfig }: { config: ConfigShape; updateConfig: any }) {
  const rate = config.valuation?.hourlyRateUsd ?? 150;
  const setRate = (n: number) => {
    updateConfig((prev: ConfigShape) => ({
      next: { ...prev, valuation: { hourlyRateUsd: n } },
      flashed: ["valuation.hourlyRateUsd"],
    }));
  };

  // Live calc — assume the average operator saves 10 hours/month with the
  // dashboard. Multiplied by the user's hourly rate to make the number
  // concrete. The 47-hour figure on the original was a 30-day demo number;
  // we replace it with the cleaner 10/month framing the brief asked for.
  const hoursSavedMonthly = 10;
  const monthlyDollars = Math.round(rate * hoursSavedMonthly);
  // 30-day skills usage estimate — the legacy preview line.
  const hoursSaved30d = 47;
  const dollars30d = Math.round(rate * hoursSaved30d);

  return (
    <div className="max-w-2xl">
      <Eyebrow>Time value</Eyebrow>
      <H1>What's your time worth?</H1>
      <Sub>
        Pick what an hour of your time is worth. We multiply this by time saved per skill use to
        keep the dashboard's ROI numbers honest.
      </Sub>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-6">
        {RATE_PRESETS.map((p) => {
          const active = rate === p.rate;
          return (
            <button
              key={p.rate}
              onClick={() => setRate(p.rate)}
              className={`rounded-xl border p-4 text-left transition-all ${
                active ? "bg-card/80" : "border-border bg-card/30 hover:border-foreground/25"
              }`}
              style={
                active
                  ? {
                      borderColor: `${ORANGE}66`,
                      boxShadow: `0 0 0 1px ${ORANGE}44, 0 8px 24px -10px ${ORANGE}88`,
                    }
                  : undefined
              }
            >
              <div className="text-2xl font-semibold tabular-nums tracking-tight">
                <span style={active ? { color: ORANGE } : undefined}>${p.rate}</span>
                <span className="text-sm text-muted-foreground">/hr</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{p.label}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/30 p-5 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="range"
            min={20}
            max={1500}
            step={5}
            value={rate}
            onChange={(e) => setRate(parseInt(e.target.value))}
            className="flex-1 accent-orange-500"
            style={{ accentColor: ORANGE }}
          />
          <div
            className="flex items-center gap-1 rounded-lg border bg-background/60 px-2.5 py-1.5"
            style={{ borderColor: `${ORANGE}44` }}
          >
            <span className="text-muted-foreground text-sm">$</span>
            <input
              type="number"
              min={20}
              max={1500}
              step={5}
              value={rate}
              onChange={(e) =>
                setRate(Math.max(20, Math.min(1500, parseInt(e.target.value) || 20)))
              }
              className="focus-orange w-20 px-1.5 py-0.5 rounded bg-transparent border-0 text-base tabular-nums text-right font-semibold"
              style={{ color: ORANGE }}
            />
            <span className="text-muted-foreground text-sm">/hr</span>
          </div>
        </div>
      </div>

      {/* Live preview — both the brief's "save 10 hours/month" framing and
          the longer-horizon "last 30 days of skills use" figure for context. */}
      <div
        className="rounded-xl border p-5 mb-3"
        style={{
          borderColor: `${ORANGE}40`,
          background: `radial-gradient(ellipse 80% 80% at 0% 0%, ${ORANGE}14 0%, transparent 60%), ${ORANGE}06`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-2">
          If you save 10 hours a month
        </div>
        <div className="text-base md:text-lg leading-relaxed text-foreground/90">
          At <span className="font-semibold tabular-nums">${rate}/hr</span>, that's worth{" "}
          <span
            className="font-semibold text-2xl md:text-3xl tabular-nums tracking-tight"
            style={{ color: ORANGE, textShadow: `0 0 24px ${ORANGE}55` }}
          >
            ${monthlyDollars.toLocaleString()}
          </span>{" "}
          <span className="text-muted-foreground">a month.</span>
        </div>
      </div>

      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        On a 30-day skills cadence, that scales to{" "}
        <span className="font-semibold tabular-nums" style={{ color: ORANGE }}>
          ${dollars30d.toLocaleString()}
        </span>{" "}
        of work avoided. You can re-tune this anytime from the Skills panel.
      </p>
    </div>
  );
}

// ---------- Step 6: Dream cadence ----------

type CadenceTime = "morning" | "evening";

const CADENCE_OPTIONS: {
  id: CadenceTime;
  label: string;
  caption: string;
  time: string;
  image: string;
}[] = [
  { id: "morning", label: "Morning", caption: "7:00 am", time: "07:00", image: cadenceMorning },
  { id: "evening", label: "Evening", caption: "8:00 pm", time: "20:00", image: cadenceEvening },
];

function StepDream({ config, updateConfig }: { config: ConfigShape; updateConfig: any }) {
  const dream = config.dream ?? {
    enabled: true,
    schedule: { frequency: "daily" as const, time: "07:00", tz: "auto" },
    webSearch: false,
    heroImage: false,
    imageApiKey: "",
  };

  const set = (patch: Partial<NonNullable<ConfigShape["dream"]>>, flashed: string[]) => {
    updateConfig((prev: ConfigShape) => {
      const nextDream = { ...dream, ...patch } as NonNullable<ConfigShape["dream"]>;
      return { next: { ...prev, dream: nextDream }, flashed };
    });
  };

  const setFrequency = (f: "daily" | "weekly") =>
    set({ schedule: { ...dream.schedule, frequency: f, tz: "auto" } }, ["dream.schedule"]);

  const setCadence = (c: CadenceTime) => {
    const opt = CADENCE_OPTIONS.find((o) => o.id === c)!;
    set({ schedule: { ...dream.schedule, time: opt.time, tz: "auto" } }, ["dream.schedule"]);
  };

  const activeCadence: CadenceTime =
    CADENCE_OPTIONS.find((o) => o.time === dream.schedule.time)?.id ?? "morning";

  return (
    <div className="max-w-3xl">
      <Eyebrow>Dream cadence</Eyebrow>
      <H1>When should we dream?</H1>
      <Sub>
        Each night while you sleep, Dream reads your last 24 hours of activity across Claude, Codex,
        Pinecone, and Obsidian — finds patterns, surfaces drift, and writes 4 prescriptions you can
        run as one-liners in the morning. Pick when it runs.
      </Sub>

      <DreamBuckets />

      {/* Frequency segmented toggle */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Frequency
        </span>
        <div className="inline-flex rounded-lg border border-border/70 bg-card/30 p-0.5">
          {(["daily", "weekly"] as const).map((f) => {
            const active = dream.schedule.frequency === f;
            return (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`px-4 py-1.5 rounded-md text-[12px] capitalize transition-all ${
                  active ? "text-white shadow-md" : "text-muted-foreground hover:text-foreground/80"
                }`}
                style={active ? { background: ORANGE_GRADIENT } : undefined}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time of day cards — 2 only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {CADENCE_OPTIONS.map((p) => {
          const active = activeCadence === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setCadence(p.id)}
              className={`group relative rounded-2xl border overflow-hidden text-left transition-all ${
                active ? "border-foreground/60" : "border-border hover:border-foreground/30"
              }`}
              style={active ? { boxShadow: `0 12px 36px -10px ${ORANGE}88` } : undefined}
            >
              <div className="aspect-[16/9] relative overflow-hidden">
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  style={{ transform: "scale(1.06)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {active && (
                  <div
                    className="absolute top-3 right-3 h-7 w-7 rounded-full grid place-items-center"
                    style={{ background: ORANGE_GRADIENT, boxShadow: `0 4px 14px -4px ${ORANGE}` }}
                  >
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  </div>
                )}
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-base font-semibold text-white drop-shadow-md">{p.label}</div>
                  <div className="text-[12px] text-white/80">{p.caption}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <ToggleRow
          checked={dream.webSearch}
          onChange={(v) => set({ webSearch: v }, ["dream.webSearch"])}
          label="Allow web search during Dream"
          hint="Pulls in fresh context on topics you've been working on."
        />
        <ToggleRow
          checked={dream.heroImage}
          onChange={(v) => set({ heroImage: v }, ["dream.heroImage"])}
          label="Generate a fresh cosmos hero image each Dream"
          hint={
            dream.heroImage
              ? "~$0.04 per run · requires OpenAI API key"
              : "Off — we'll use the built-in default images."
          }
        />

        {dream.heroImage && (
          <div
            className="rounded-xl border bg-card/30 p-4 space-y-2 animate-in fade-in slide-in-from-top-1"
            style={{ borderColor: `${ORANGE}40` }}
          >
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> OpenAI API key
            </label>
            <input
              type="password"
              value={dream.imageApiKey ?? ""}
              onChange={(e) => set({ imageApiKey: e.target.value }, ["dream.imageApiKey"])}
              placeholder="sk-..."
              className="w-full font-mono text-xs px-3 py-2 rounded bg-background border border-border focus:outline-none focus:border-foreground/40"
            />
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Get a key from platform.openai.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Dream Buckets ----------

const DREAM_BUCKETS: {
  title: string;
  blurb: string;
  example: string;
  detail: string;
  Icon: typeof Sparkles;
  color: string;
}[] = [
  {
    title: "Conversation analysis",
    blurb: "Recurring topics & tasks that haven't become skills yet.",
    detail:
      "Reads your last 7 days of user messages, embeds them, clusters by intent. Flags any task you've done manually three or more times so we can suggest turning it into a skill.",
    example: "You've debugged Vite SSR 6× this week — make a skill?",
    Icon: MessagesSquare,
    color: ORANGE,
  },
  {
    title: "Cost intelligence",
    blurb: "Model misuse, low cache hit rates, token waste.",
    detail:
      "Inspects every model call, looks for high-Opus usage on simple work, low cache hit rates, and oversized contexts. Recommends the cheaper model swap when output quality won't suffer.",
    example: "Sonnet running prompts Haiku could handle — save ~$38/mo.",
    Icon: Coins,
    color: AMBER,
  },
  {
    title: "Skill performance",
    blurb: "Dead, dormant, or upgrade-worthy skills in your stack.",
    detail:
      "Tracks each skill's last-used date, invocation count, average tokens, and error rate. Surfaces dead skills to archive, dormant ones to revive, and frequent chains worth composing.",
    example: "'pdf-extract' unused 41 days — archive or sharpen?",
    Icon: Zap,
    color: VIOLET,
  },
  {
    title: "Memory health",
    blurb: "Stale notes, conflicts, missing facts, and drift over time.",
    detail:
      "Walks every memory file, checks freshness against current sessions, looks for cross-file contradictions, and flags topics you discuss often but never recorded.",
    example: "Two memories disagree about your deploy target.",
    Icon: Brain,
    color: SKY,
  },
  {
    title: "Session hygiene",
    blurb: "Context rot, edit-without-read patterns, runaway length.",
    detail:
      "Watches session length, message density, and tool-call ordering. Catches the patterns that erode quality — long sessions past 120K tokens, edits before reads, and missed compactions.",
    example: "3 sessions edited files before reading them.",
    Icon: Activity,
    color: EMERALD,
  },
  {
    title: "Workflow patterns",
    blurb: "Manual sequences you repeat — ripe for automation.",
    detail:
      "Detects always-paired commands, repeated tool sequences, and morning routines. Suggests when two skills should chain into one or a workflow deserves its own keystroke.",
    example: "Lint → test → commit done by hand 11× this week.",
    Icon: Workflow,
    color: ORANGE_SOFT,
  },
  {
    title: "External opportunity",
    blurb: "New tools, skills, or models worth adopting right now.",
    detail:
      "Optional: scans community skills, new model releases, and MCP servers relevant to your topic areas. Off by default — turn it on for proactive recommendations from outside your stack.",
    example: "GPT-5.1-mini just dropped — 3× cheaper for your routing.",
    Icon: Telescope,
    color: "#f472b6",
  },
  {
    title: "Business outcomes",
    blurb: "Real ROI per skill and false-positive savings.",
    detail:
      "Compares time-saved estimates to whether the skill output was actually used downstream. Catches skills that claim ROI but produce work you ignore — a quiet drain.",
    example: "'invoice-parser' saved 6.2 hrs · ~$930 this week.",
    Icon: TrendingUp,
    color: "#34d399",
  },
];

function DreamBuckets() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const open = openIdx !== null ? DREAM_BUCKETS[openIdx] : null;

  return (
    <div className="mb-8 rounded-2xl border border-border overflow-hidden bg-card/30">
      <div className="grid grid-cols-1 md:grid-cols-[42%_1fr]">
        {/* Visual */}
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[360px] overflow-hidden">
          <img src={dreamCosmos} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/80 hidden md:block" />
          <div
            className="absolute inset-0 mix-blend-screen opacity-60 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 70%, rgba(167,139,250,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(255,138,61,0.25) 0%, transparent 55%)",
            }}
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-full grid place-items-center backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.08)",
                boxShadow: `0 0 24px -4px ${ORANGE_SOFT}, inset 0 0 0 1px rgba(255,255,255,0.18)`,
              }}
            >
              <Moon className="h-4 w-4" style={{ color: ORANGE_SOFT }} />
            </div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/75">The Dream</span>
          </div>
        </div>

        {/* Text + lens chips */}
        <div className="p-6 md:p-7 flex flex-col justify-center">
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight mb-2">
            8 dimensions of Dream intelligence.
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-md">
            While you sleep, Dream reads your stack and surfaces what's worth your attention. Tap
            any dimension to see how it works.
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            {DREAM_BUCKETS.map(({ title, Icon, color }, idx) => {
              const active = openIdx === idx;
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => setOpenIdx(active ? null : idx)}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 border transition-all text-left ${
                    active
                      ? "border-foreground/40 bg-background/80"
                      : "border-border/60 bg-background/40 hover:bg-background/80 hover:border-foreground/20"
                  }`}
                  style={
                    active
                      ? { boxShadow: `0 0 0 1px ${color}55, 0 8px 24px -10px ${color}` }
                      : undefined
                  }
                >
                  <div
                    className="h-6 w-6 shrink-0 rounded-md grid place-items-center relative"
                    style={{ background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}33` }}
                  >
                    <Icon className="h-3 w-3" style={{ color }} />
                  </div>
                  <span className="text-[12px] font-medium text-foreground/90 truncate flex-1">
                    {title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {open && (
        <div
          className="border-t border-border bg-background/40 px-6 md:px-7 py-5 animate-in fade-in slide-in-from-top-1"
          style={{ boxShadow: `inset 0 1px 0 ${open.color}33` }}
        >
          <div className="flex items-start gap-4 max-w-3xl">
            <div
              className="h-10 w-10 shrink-0 rounded-lg grid place-items-center"
              style={{
                background: `${open.color}1f`,
                boxShadow: `inset 0 0 0 1px ${open.color}55`,
              }}
            >
              <open.Icon className="h-5 w-5" style={{ color: open.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <h4 className="text-sm font-semibold tracking-tight">{open.title}</h4>
                <button
                  onClick={() => setOpenIdx(null)}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  close
                </button>
              </div>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-3">
                {open.detail}
              </p>
              <div
                className="rounded-md border px-3 py-2 text-[12px] italic"
                style={{
                  background: `${open.color}10`,
                  borderColor: `${open.color}40`,
                  color: `${open.color}cc`,
                }}
              >
                <span className="text-[9px] not-italic uppercase tracking-wider opacity-70 mr-2">
                  Example output
                </span>
                {open.example}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Step 7: You're set ----------


function buildEnvLocalContent(config: ConfigShape): string {
  const lines: string[] = [];
  const env = config.envKeys ?? {};
  for (const [k, v] of Object.entries(env)) {
    const trimmed = (v ?? "").trim();
    if (trimmed) lines.push(`${k}=${trimmed}`);
  }
  const obsidianPath = config.memory?.primaryPath?.trim();
  if (obsidianPath) lines.push(`CLAUDE_OS_OBSIDIAN_PATH=${obsidianPath}`);
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

function StepYoureSet({
  config,
  onFinish,
}: {
  config: ConfigShape;
  onFinish: (finalConfig?: ConfigShape) => void;
}) {
  type Phase = "idle" | "installing" | "aggregating" | "success" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activating = phase === "installing" || phase === "aggregating";

  // Pure-browser activate. The aggregator already ran in the user's
  // terminal as part of `bun run setup` (which also copied the /dream
  // skill + installed the launchd cron). All this button does is
  // commit the wizard's collected preferences to localStorage and
  // dismiss the modal. No fetch, no race, no loop.
  const activate = useCallback(() => {
    if (activating) return;
    let finalConfig: ConfigShape;
    try {
      finalConfig = serializeConfig({
        ...config,
        createdAt: new Date().toISOString(),
      }).config;
    } catch (err) {
      console.error("[setup] config is not serializable:", err);
      setErrorMessage(err instanceof Error ? err.message : "Config is not serializable.");
      setPhase("error");
      return;
    }
    setErrorMessage(null);
    setPhase("installing");
    const written = persistInstalledConfig(finalConfig, true);
    if (!written) {
      setErrorMessage("localStorage write failed — try a different browser or disable private mode.");
      setPhase("error");
      return;
    }
    setPhase("success");
    // Tiny celebration window before the modal unmounts.
    setTimeout(() => {
      onFinish(finalConfig);
    }, 600);
  }, [activating, config, onFinish]);

  const sidecarOffline = phase === "error";

  return (
    <div className="max-w-xl">
      <Eyebrow>You're set</Eyebrow>
      <H1>You're set.</H1>
      <Sub>
        One click and we'll write your config and populate the dashboard with your real data.
        Reverse anytime with{" "}
        <span className="font-mono text-foreground/80">claude-os uninstall</span>.
      </Sub>

      <button
        onClick={activate}
        disabled={activating || phase === "success"}
        className="group w-full inline-flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl text-white font-semibold text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-85 disabled:cursor-not-allowed disabled:hover:scale-100 mb-4 relative overflow-hidden"
        style={{
          background: ORANGE_GRADIENT,
          boxShadow: `0 12px 36px -10px ${ORANGE}, inset 0 1px 0 rgba(255, 255, 255, 0.32)`,
        }}
      >
        {/* Subtle glossy highlight on top edge */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-30"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, transparent 100%)",
          }}
        />
        <span className="relative inline-flex items-center justify-center gap-2.5">
          {phase === "success" ? (
            <>
              <Check className="h-5 w-5" strokeWidth={3} /> Done — opening dashboard…
            </>
          ) : phase === "aggregating" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Aggregating your data…
            </>
          ) : phase === "installing" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Activating…
            </>
          ) : (
            <>
              Activate now{" "}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </span>
      </button>

      {sidecarOffline && (
        <div
          className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3 mb-4 text-[12.5px] leading-relaxed"
          style={{ color: "color-mix(in oklab, var(--foreground) 90%, transparent)" }}
        >
          <div
            className="font-semibold mb-1 flex items-center gap-1.5"
            style={{ color: "var(--foreground)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Couldn't reach the local server
          </div>
          <p>
            Restart <span className="font-mono">bun run dev</span> — that starts the dashboard and
            the local server together. Then click Activate again.
          </p>
          {errorMessage && <p className="mt-2 opacity-60 text-[11px]">Detail: {errorMessage}</p>}
        </div>
      )}

      <button
        onClick={() => onFinish()}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] hover:bg-foreground/5 transition-colors"
        style={{ color: "color-mix(in oklab, var(--foreground) 55%, transparent)" }}
      >
        Skip and open dashboard
      </button>
    </div>
  );
}

// (StepDone, ConfigDrawer, renderJsonWithHighlights, formatPrimitive removed —
// the right-side JSON drawer is gone now that the activate button on the final
// step writes the config directly via the sidecar.)

// ---------- Small primitives ----------

function H1({ children }: { children: React.ReactNode }) {
  // Explicit color so the heading is never inherited as dim text against the
  // dark background. Render at near-white in dark mode regardless of parent.
  // Size bump (text-4xl → text-5xl on md) so the H1 dominates the Sub instead
  // of fighting it for visual weight.
  return (
    <h1
      className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-[1.05] text-foreground"
      style={{ color: "var(--foreground)" }}
    >
      {children}
    </h1>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[15px] md:text-base mb-9 max-w-[58ch] leading-relaxed"
      style={{ color: "color-mix(in oklab, var(--foreground) 76%, transparent)" }}
    >
      {children}
    </p>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] uppercase tracking-[0.22em] mb-3.5 inline-flex items-center gap-2"
      style={{ color: "color-mix(in oklab, var(--foreground) 60%, transparent)" }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          background: "#C19A6B",
          boxShadow: "0 0 8px rgba(193, 154, 107, 0.7)",
        }}
      />
      {children}
    </div>
  );
}
function SectionLabel({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 mb-3 mt-1 text-[10px] uppercase tracking-[0.2em] ${muted ? "text-muted-foreground/60" : "text-muted-foreground"}`}
    >
      <span>{children}</span>
      <span className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  stop = false,
}: {
  checked: boolean;
  onChange: () => void;
  stop?: boolean;
}) {
  // Geometry: pill 28px × 52px, knob 22px. Knob sits flush at 3px from start
  // when off (3 + 22 = 25, plenty of clearance), 27px when on (27 + 22 = 49,
  // 3px from right edge). Glow stays close so the knob never appears outside.
  return (
    <button
      type="button"
      onClick={(e) => {
        if (stop) e.stopPropagation();
        onChange();
      }}
      role="switch"
      aria-checked={checked}
      className="relative inline-block rounded-full transition-colors shrink-0 cursor-pointer"
      style={{
        height: 28,
        width: 52,
        background: checked ? EMERALD_GRADIENT : "rgba(255,255,255,0.10)",
        boxShadow: checked
          ? "0 0 0 1px rgba(255,255,255,0.18) inset, 0 4px 14px -6px rgba(52,211,153,0.6)"
          : "0 0 0 1px rgba(255,255,255,0.08) inset",
      }}
    >
      <span
        aria-hidden
        className="absolute rounded-full bg-white transition-all"
        style={{
          height: 22,
          width: 22,
          top: 3,
          left: checked ? 27 : 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.05)",
        }}
      />
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className="flex items-center justify-between rounded-xl border border-border bg-card/30 px-4 py-3 cursor-pointer hover:border-foreground/20 transition-colors"
    >
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={() => onChange(!checked)} stop />
    </div>
  );
}

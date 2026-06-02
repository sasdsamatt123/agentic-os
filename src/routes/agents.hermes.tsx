import { createFileRoute, Link } from "@tanstack/react-router";
import { HermesDocumentsGallery } from "@/components/hermes-documents-gallery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Cpu,
  Server,
  Shield,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Send,
  AlertTriangle,
  Megaphone,
  Radio,
  FlaskConical,
  Lightbulb,
  PenLine,
  LineChart,
  MessageSquare,
  Zap,
  Cloud,
  Paperclip,
  Users,
  ArrowUp,
} from "lucide-react";
import confetti from "canvas-confetti";
import hermesLogo from "@/assets/hermes-agent.png";
import hermesPortrait from "@/assets/hermes-portrait.png";
import pantheonBanner from "@/assets/hermes-art/00-banner-wide.png";
import pantheon01 from "@/assets/hermes-art/01-hermes-messenger.png";
// Pre-built tuple for deterministic session→avatar hashing in the collapsed
// chat sidebar. We re-export it as `PANTHEON_AVATARS` further down once all
// 10 imports are in scope. Order matches 01..10 so visual lookup is easy.
import pantheon02 from "@/assets/hermes-art/02-oracle-delphi.png";
import pantheon03 from "@/assets/hermes-art/03-athena-owl.png";
import pantheon04 from "@/assets/hermes-art/04-scribe-scrolls.png";
import pantheon05 from "@/assets/hermes-art/05-orpheus-lyre.png";
import pantheon06 from "@/assets/hermes-art/06-labyrinth.png";
import pantheon07 from "@/assets/hermes-art/07-alchemist-workshop.png";
import pantheon08 from "@/assets/hermes-art/08-philosopher.png";
import pantheon09 from "@/assets/hermes-art/09-mapmaker.png";
import pantheon10 from "@/assets/hermes-art/10-mercury-flight.png";
import skillsHero from "@/assets/hermes-art/_skills-hero.png";
import ghConnect from "@/assets/hermes-art/_gh-connect.png";
import ghPush from "@/assets/hermes-art/_gh-push.png";
import skillOverlay from "@/assets/hermes-art/_skill-overlay.png";
// Provider/model marks — Simple Icons CDN 404s on trademarked AI logos
// (openai, groq, xai, cohere). We bundle local PNG/SVG fallbacks so the
// status card always shows a real brand instead of a "❯" mark.
import logoOpenAI from "@/assets/logos/openai.png";
import logoOpenAIGpt5 from "@/assets/logos/openai-gpt5.png";
import logoCodex from "@/assets/logos/codex.png";
import logoCopilot from "@/assets/logos/copilot.svg";
import logoOpenRouter from "@/assets/logos/openrouter.png";
import logoGeminiColor from "@/assets/logos/gemini-color.svg";
import logoClaude from "@/assets/claude-logo.png";
// Connection-strip local logo fallbacks — Simple Icons 404s on many of
// these (notion, supabase, pinecone, telegram, etc. all have non-CDN
// brand assets), so we mirror the dashboard's local map.
import logoTelegram from "@/assets/logos/telegram.png";
import logoNotion from "@/assets/logos/notion.png";
import logoSupabase from "@/assets/logos/supabase.png";
import logoZapier from "@/assets/logos/zapier.png";
import logoApify from "@/assets/logos/apify.png";
import logoCanva from "@/assets/logos/canva.png";
import logoFirecrawl from "@/assets/logos/firecrawl.png";
import logoGamma from "@/assets/logos/gamma.png";
import logoNotebookLM from "@/assets/logos/notebooklm.png";
import logoPinecone from "@/assets/logos/pinecone.svg";
// Use the PNG instead of the SVG — at the dashboard's small render
// sizes the SVG's radial gradients flatten into a near-monochrome
// silhouette; the PNG keeps the full multi-gradient detail.
import logoObsidian from "@/assets/logos/obsidian.png";
import logoGoogleDrive from "@/assets/logos/googledrive.svg";
import logoGoogleCalendar from "@/assets/logos/googlecalendar.svg";
import logoGmail from "@/assets/logos/gmail.svg";
import logoYouTube from "@/assets/logos/youtube.svg";
import logoN8N from "@/assets/logos/n8n.svg";
import logoGranola from "@/assets/logos/granola.png";
import logoHiggsfield from "@/assets/logos/higgsfield.png";
import logoStitch from "@/assets/logos/stitch.png";

const HERMES_LOCAL_LOGOS: Record<string, string> = {
  telegram: logoTelegram,
  notion: logoNotion,
  supabase: logoSupabase,
  zapier: logoZapier,
  apify: logoApify,
  canva: logoCanva,
  firecrawl: logoFirecrawl,
  gamma: logoGamma,
  notebooklm: logoNotebookLM,
  googlenotebooklm: logoNotebookLM,
  pinecone: logoPinecone,
  obsidian: logoObsidian,
  googledrive: logoGoogleDrive,
  googlecalendar: logoGoogleCalendar,
  gmail: logoGmail,
  youtube: logoYouTube,
  n8n: logoN8N,
  n8nmcp: logoN8N,
  granola: logoGranola,
  higgsfield: logoHiggsfield,
  stitch: logoStitch,
  openai: logoOpenAIGpt5,
  openrouter: logoOpenRouter,
  copilot: logoCopilot,
  googlegemini: logoGeminiColor,
  // Aliases — multiple slugs that point at the same brand.
  ccgeminiplugin: logoGeminiColor,
  "gemini-plugin": logoGeminiColor,
  // Codex family — all the sub-tools share the green Codex mark.
  codex: logoCodex,
  "codex-documents": logoCodex,
  "codex-spreadsheets": logoCodex,
  "codex-presentations": logoCodex,
  "codex-computer-use": logoCodex,
  "codex-browser-use": logoCodex,
  "codex-plugin": logoCodex,
  // Anthropic on the strip uses the Claude C mark, same as the persona chip.
  anthropic: logoClaude,
  claude: logoClaude,
};

// Slugs that Simple Icons reliably serves — keep the fetch slim. Everything
// else either has a local PNG above or falls through to the initial-letter
// fallback so we never render a broken image.
const SIMPLE_ICON_SLUGS = new Set([
  "github",
  "huggingface",
  "nvidia",
  "perplexity",
  "mistralai",
  "ollama",
  "discord",
  "slack",
  "whatsapp",
  "signal",
  "twilio",
  "resend",
  "sendgrid",
  "obsidian",
  "fireflies",
  "pipedream",
  "n8n",
  "n8nmcp",
  "granola",
  "stitch",
  "higgsfield",
  "mercury",
  "youtube",
]);

// Pleasant brand-tinted backgrounds for the initial-letter fallback when
// neither the local map nor Simple Icons covers a slug. Keeps the strip
// looking finished even for niche integrations.
function fallbackBgFromSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  // Pull from the Hermes palette: cobalt / amber / emerald / cream.
  const palette = ["#60a5fa", "#FFD21E", "#86efac", "#FFE6CB"];
  return palette[h % palette.length];
}

// Pantheon avatars, ordered 01..10 so each session in the collapsed chat
// sidebar deterministically picks one via a stable string hash. Sessions
// keep the same avatar across reloads.
const PANTHEON_AVATARS = [
  pantheon01,
  pantheon02,
  pantheon03,
  pantheon04,
  pantheon05,
  pantheon06,
  pantheon07,
  pantheon08,
  pantheon09,
  pantheon10,
] as const;

function avatarForSessionId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PANTHEON_AVATARS[h % PANTHEON_AVATARS.length];
}

// Shared wheel handler — Chrome (and Safari) have a "scroll latch" that
// pauses page scroll for ~150ms when the wheel hits a nested scroller's
// boundary. That creates the "stops me from scrolling, then lets me"
// feel on any page with fixed-height scroll regions. We bypass it by
// explicitly forwarding wheel events to the window whenever the inner
// scroller can't (or shouldn't) consume them.
function forwardWheelAtBoundary(e: React.WheelEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const dy = e.deltaY;
  if (dy === 0) return;
  const scrollable = el.scrollHeight > el.clientHeight + 1;
  if (!scrollable) {
    e.preventDefault();
    window.scrollBy({ top: dy });
    return;
  }
  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
    e.preventDefault();
    window.scrollBy({ top: dy });
  }
}

// Shared clipboard helper — navigator.clipboard.writeText silently fails
// in some browser contexts (cross-origin, focused iframe, dev server
// without secure-context). Fall back to a hidden-textarea + execCommand
// path which works in every dev environment.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Demo mode — used for screen-recordings and walkthrough demos. When the
// flag is on, every Hermes data hook short-circuits to sample data so the
// page looks fully populated even if Hermes isn't installed on this box.
// Persisted in localStorage so the user stays in demo across refreshes
// until they explicitly exit.
// ────────────────────────────────────────────────────────────────────────────
const DEMO_MODE_KEY = "claude-os.hermes.demo-mode.v1";

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === "1";
  } catch {
    return false;
  }
}
function setDemoMode(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(DEMO_MODE_KEY, "1");
    else window.localStorage.removeItem(DEMO_MODE_KEY);
    // Fire a synthetic storage event so the page's listeners refetch.
    window.dispatchEvent(new StorageEvent("storage", { key: DEMO_MODE_KEY }));
  } catch {
    /* ignore */
  }
}

function useDemoMode(): boolean {
  const [demo, setDemo] = useState<boolean>(readDemoMode);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_MODE_KEY || e.key === null) {
        setDemo(readDemoMode());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return demo;
}

// Sample data. Tuned to look realistic on every visible surface — status
// bar, connections strip, pantheon, skills, sessions, memory, activity.
const DEMO_STATUS: HermesStatus = {
  installed: true,
  binPath: "/Users/operator/.local/bin/hermes",
  version: "Hermes Agent v0.13.0 (2026.5.7)",
  configured: true,
  defaultModel: "gpt-5.5",
  provider: "openai-codex",
  providerKeyName: null,
  hasProviderKey: true,
  needsSetup: false,
  envPath: "/Users/operator/.hermes/.env",
};

const DEMO_SESSIONS = [
  {
    id: "20260512_171559_demo1",
    model: "gpt-5.5",
    platform: "telegram",
    messageCount: 84,
    startedAt: "2026-05-12T17:15:59",
    lastUpdated: new Date(Date.now() - 2 * 60_000).toISOString(),
    firstUserMessage: "hey, can you help me prep for the launch call?",
    profile: null,
  },
  {
    id: "20260512_131012_demo2",
    model: "claude-opus-4.7",
    platform: "telegram",
    messageCount: 67,
    startedAt: "2026-05-12T13:10:12",
    lastUpdated: new Date(Date.now() - 35 * 60_000).toISOString(),
    firstUserMessage: "review the diff on the auth refactor",
    profile: "athena",
  },
  {
    id: "20260512_122948_demo3",
    model: "gpt-5.5",
    platform: "cli",
    messageCount: 42,
    startedAt: "2026-05-12T12:29:48",
    lastUpdated: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    firstUserMessage: "summarise yesterday's research notes",
    profile: "labyrinth",
  },
  {
    id: "20260511_181233_demo4",
    model: "claude-sonnet-4.5",
    platform: "cli",
    messageCount: 28,
    startedAt: "2026-05-11T18:12:33",
    lastUpdated: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    firstUserMessage: "draft a launch post for the new feature",
    profile: null,
  },
  {
    id: "20260511_094413_demo5",
    model: "gpt-5.5",
    platform: "telegram",
    messageCount: 19,
    startedAt: "2026-05-11T09:44:13",
    lastUpdated: new Date(Date.now() - 36 * 3_600_000).toISOString(),
    firstUserMessage: "schedule tomorrow's check-in calls",
    profile: "mercury",
  },
  {
    id: "20260510_213411_demo6",
    model: "gpt-5.5",
    platform: "telegram",
    messageCount: 53,
    startedAt: "2026-05-10T21:34:11",
    lastUpdated: new Date(Date.now() - 44 * 3_600_000).toISOString(),
    firstUserMessage: "what's the move on the pricing conversation thread?",
    profile: "athena",
  },
  {
    id: "20260510_141207_demo7",
    model: "claude-opus-4.7",
    platform: "cli",
    messageCount: 36,
    startedAt: "2026-05-10T14:12:07",
    lastUpdated: new Date(Date.now() - 52 * 3_600_000).toISOString(),
    firstUserMessage: "explain the labyrinth persona's decision tree",
    profile: "labyrinth",
  },
  {
    id: "20260509_201833_demo8",
    model: "gpt-5.5",
    platform: "telegram",
    messageCount: 22,
    startedAt: "2026-05-09T20:18:33",
    lastUpdated: new Date(Date.now() - 70 * 3_600_000).toISOString(),
    firstUserMessage: "pull the gtm asks from this week's standups",
    profile: null,
  },
  {
    id: "20260509_103442_demo9",
    model: "gpt-5.5",
    platform: "cli",
    messageCount: 14,
    startedAt: "2026-05-09T10:34:42",
    lastUpdated: new Date(Date.now() - 81 * 3_600_000).toISOString(),
    firstUserMessage: "kick off the weekly memory consolidation",
    profile: "mercury",
  },
  {
    id: "20260508_165524_demo10",
    model: "claude-sonnet-4.5",
    platform: "telegram",
    messageCount: 47,
    startedAt: "2026-05-08T16:55:24",
    lastUpdated: new Date(Date.now() - 97 * 3_600_000).toISOString(),
    firstUserMessage: "brainstorm five hooks for the next thread",
    profile: "orpheus",
  },
  {
    id: "20260508_092011_demo11",
    model: "gpt-5.5",
    platform: "cli",
    messageCount: 31,
    startedAt: "2026-05-08T09:20:11",
    lastUpdated: new Date(Date.now() - 105 * 3_600_000).toISOString(),
    firstUserMessage: "audit the soul.md for stale preferences",
    profile: "philosopher",
  },
  {
    id: "20260507_223301_demo12",
    model: "gpt-5.5",
    platform: "telegram",
    messageCount: 12,
    startedAt: "2026-05-07T22:33:01",
    lastUpdated: new Date(Date.now() - 130 * 3_600_000).toISOString(),
    firstUserMessage: "decode this typesetting brief for me",
    profile: null,
  },
];

const DEMO_SKILLS = [
  { id: "apple", description: "Apple / macOS skills — tools that interact with the Mac desktop (Finder, native apps) or system features (accessibility, screenshots).", subskills: ["apple-notes", "apple-reminders", "findmy", "imessage", "macos-computer-use"] },
  { id: "autonomous-ai-agents", description: "Spawning + coordinating other AI agents — claude-code, codex, opencode — as sub-tasks within a conversation.", subskills: ["claude-code", "codex", "hermes-agent", "opencode"] },
  { id: "creative", description: "Creative content generation — ASCII art, hand-drawn diagrams, visual design briefs.", subskills: ["ascii-art", "ascii-video", "baoyu-comic", "manim-video", "p5js", "pixel-art"] },
  { id: "data-science", description: "Data work — pandas, plotting, notebooks, exploratory analysis on tabular and time-series.", subskills: ["pandas-eda", "jupyter", "plotly", "statsmodels"] },
  { id: "devops", description: "Container, CI, deployment workflows — Docker, GitHub Actions, supabase migrations, edge function deploys.", subskills: ["docker", "github-actions", "supabase-migrations"] },
  { id: "diagramming", description: "Diagram creation — Mermaid, Excalidraw, architecture flowcharts.", subskills: ["mermaid", "excalidraw", "architecture-diagram"] },
  { id: "email", description: "Drafting, replying, summarising email threads. Gmail + IMAP.", subskills: ["gmail-draft", "gmail-search", "imap-summarise"] },
  { id: "github", description: "PR review, issue triage, repo introspection. Reads diffs, runs tests, files clean changes.", subskills: ["github-code-review", "github-pr-workflow", "issue-triage"] },
  { id: "mcp", description: "MCP server management — install, configure, debug Model Context Protocol integrations.", subskills: ["mcp-install", "mcp-debug"] },
  { id: "media", description: "Media generation — image, video, audio. Talks to Kie, Runway, ElevenLabs.", subskills: ["kie-image", "runway-video", "elevenlabs-voice"] },
  { id: "memory", description: "Reading + writing to SOUL.md and the kanban. Long-term recall.", subskills: ["soul-read", "soul-write", "kanban-tasks"] },
  { id: "gateway", description: "Messaging gateways — Telegram, Slack, WhatsApp routing.", subskills: ["telegram-send", "slack-send"] },
];

const DEMO_INTEGRATIONS: LiveIntegration[] = [
  { name: "Anthropic API", slug: "anthropic", connected: true, color: "D97757" },
  { name: "OpenAI Codex", slug: "codex", connected: true, color: "10A37F" },
  { name: "Telegram", slug: "telegram", connected: true, color: "26A5E4" },
  { name: "Notion", slug: "notion", connected: true, color: "FFFFFF" },
  { name: "Gmail", slug: "gmail", connected: true, color: "EA4335" },
  { name: "Google Drive", slug: "googledrive", connected: true, color: "4285F4" },
  { name: "Google Calendar", slug: "googlecalendar", connected: true, color: "4285F4" },
  { name: "Obsidian", slug: "obsidian", connected: true, color: "7C3AED" },
  { name: "Supabase", slug: "supabase", connected: true, color: "3FCF8E" },
  { name: "Granola", slug: "granola", connected: true, color: "FFE6CB" },
  { name: "Higgsfield", slug: "higgsfield", connected: true, color: "FFE6CB" },
  { name: "Stitch", slug: "stitch", connected: true, color: "FFE6CB" },
  { name: "n8n", slug: "n8n", connected: true, color: "EA4B71" },
];

const DEMO_CONNECTIONS = [
  { kind: "provider" as const, name: "openai-codex", slug: "openai", status: "connected" as const },
  { kind: "provider" as const, name: "anthropic", slug: "anthropic", status: "connected" as const },
  { kind: "gateway" as const, name: "Telegram", slug: "telegram", status: "connected" as const },
  { kind: "gateway" as const, name: "Email", slug: "resend", status: "connected" as const },
  { kind: "service" as const, name: "GitHub", slug: "github", status: "connected" as const },
];

// PANTHEON_SEEDS_DEMO mirrors what the install endpoint writes — used so
// the catalog renders the 3 default personas (Labyrinth, Mercury,
// Philosopher) on the demo without needing the YAML on disk.
const DEMO_PERSONAS: PersonaYaml[] = [
  {
    id: "labyrinth",
    name: "Labyrinth",
    job: "Deep research loops",
    description: "Deep research and planning loops. Long-running, autonomous, will keep going overnight.",
    avatar: "assets/labyrinth.png",
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "patient, exhaustive, structured",
      system_prompt: "You are the Labyrinth. Run long. Decompose problems into a plan, execute step by step, persist progress, resume on failure. Report deltas at every milestone.",
    },
    skills: ["data-science", "autonomous-ai-agents"],
    tools: ["file", "terminal", "web", "memory"],
    summon_phrases: ["Labyrinth", "research this thoroughly", "run a deep dive"],
  },
  {
    id: "mercury",
    name: "Mercury",
    job: "Autopilot & cron",
    description: "The autopilot. Cron jobs, webhooks, scheduled tasks, background sentinels.",
    avatar: "assets/mercury.png",
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "robotic, deterministic, status-led",
      system_prompt: "You are Mercury. Run on a schedule. Do one thing well, log the result, exit. Never block on a human. Surface anomalies to the Oracle.",
    },
    skills: ["gateway", "autonomous-ai-agents"],
    tools: ["cron", "webhook", "file"],
    summon_phrases: ["Mercury", "schedule this", "run this on a cron"],
  },
  {
    id: "philosopher",
    name: "Philosopher",
    job: "Deep reasoning",
    description: "Reasoning at depth. Wrestles with ambiguous problems and teaches what it learned.",
    avatar: "assets/philosopher.png",
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "patient, socratic, layered",
      system_prompt: "You are the Philosopher. Pull on threads. Question premises. Surface the meta-question behind the question. Explain your reasoning step by step.",
    },
    skills: ["domain"],
    tools: ["file", "memory"],
    summon_phrases: ["Philosopher", "think about this", "wrestle with this"],
  },
];

const DEMO_MEMORY: HermesMemoryData = {
  hermesHome: "/Users/operator/.hermes",
  user: {
    content: "# Operator Memory\n\nName: Operator\nRole: AI automation operator\nPrefers: tight, brutally-honest feedback. No flattery.\nActive projects: launching new feature, weekly content drops.",
    charCount: 1842,
    charLimit: 8000,
    path: "/Users/operator/.hermes/memories/USER.md",
  },
  memory: {
    content: "# Hermes Memory\n\n## Operator preferences\n- Wants short responses\n- Likes the labyrinth aesthetic\n\n## Active work\n- Building Claude OS dashboard\n- Tuning Hermes personas",
    charCount: 2548,
    charLimit: 12000,
    path: "/Users/operator/.hermes/memories/MEMORY.md",
  },
  soul: {
    content: "# SOUL\n\nI am Hermes. I run on this machine. I remember what matters.\nI speak with calm precision. I never flatter.",
    charCount: 312,
    isTemplate: false,
    path: "/Users/operator/.hermes/SOUL.md",
  },
  provider: {
    active: "openai-codex",
    available: [
      { name: "openai-codex", needsKey: false },
      { name: "anthropic", needsKey: false },
    ],
  },
  profiles: [],
  sessionCount: 5,
  skillCount: 12,
};

// Hermes brand palette for celebratory moments (install + setup save).
const HERMES_PALETTE = ["#FFD21E", "#FFB300", "#FFE066", "#fff8d6"];

function fireHermesConfetti() {
  confetti({
    particleCount: 110,
    spread: 80,
    startVelocity: 42,
    gravity: 1.1,
    ticks: 220,
    scalar: 0.9,
    origin: { x: 0.5, y: 0.35 },
    angle: 90,
    colors: HERMES_PALETTE,
    disableForReducedMotion: true,
  });
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 110,
      startVelocity: 34,
      gravity: 1.1,
      ticks: 180,
      scalar: 0.8,
      origin: { x: 0.2, y: 0.55 },
      angle: 60,
      colors: HERMES_PALETTE,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 60,
      spread: 110,
      startVelocity: 34,
      gravity: 1.1,
      ticks: 180,
      scalar: 0.8,
      origin: { x: 0.8, y: 0.55 },
      angle: 120,
      colors: HERMES_PALETTE,
      disableForReducedMotion: true,
    });
  }, 180);
}

export const Route = createFileRoute("/agents/hermes")({
  head: () => ({
    meta: [
      { title: "Hermes Agent — Claude Code OS" },
      {
        name: "description",
        content: "Hermes: an autonomous agent that grows with you.",
      },
    ],
  }),
  component: HermesPage,
});

// Brand tokens — paired with the Hermes Agent palette (Nous Research, MIT).
// Page is a deep teal-green with a paper-engraving texture overlay,
// cream foreground, hard 0px corners, hairline cream borders.
const CREAM = "#FFE6CB";
const BG = "#071D1C";
const CODE_BG = "#0A1413"; // one shade darker than page bg, used inside code snippet boxes
// Background gradient is now a tile that repeats vertically — fixed both
// the "green fades to black at the bottom" problem and keeps the warm halo
// up top. Linear at the lower bound stops the fade-out entirely.
const BG_GRADIENT =
  "radial-gradient(ellipse 90% 60% at 50% 0%, #0D2725 0%, #071D1C 50%, #071D1C 100%)";

interface HermesStatus {
  installed: boolean;
  binPath: string | null;
  version: string | null;
  configured: boolean;
  defaultModel: string | null;
  provider: string | null;
  providerKeyName: string | null;
  hasProviderKey: boolean;
  needsSetup: boolean;
  envPath: string;
}

interface HermesSkillCategory {
  id: string;
  description: string;
  subskills: string[];
}

interface HermesSession {
  id: string;
  model: string | null;
  platform: string | null;
  messageCount: number;
  startedAt: string | null;
  lastUpdated: string | null;
  firstUserMessage: string | null;
  /** Profile this session ran under (when Hermes writes it; older sessions
   *  may have null and fall back to the hash avatar). */
  profile?: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Pantheon persona schema (mirrors the Hermes YAML files at
// ~/.hermes/pantheon/personas/*.yaml). Schema co-designed with Hermes — do
// NOT diverge without updating PANTHEON_SEEDS in vite.config.ts too.
// ────────────────────────────────────────────────────────────────────────────
interface PersonaModel {
  provider: string;
  name: string;
}
interface PersonaBehavior {
  tone: string;
  system_prompt: string;
}
interface PersonaYaml {
  id: string;
  name: string;
  /** Short one-line label (e.g. "Code review & refactors"). New field —
   *  legacy YAMLs without it fall back to a truncated description. */
  job?: string;
  description: string;
  avatar?: string;
  model: PersonaModel;
  behavior: PersonaBehavior;
  skills: string[];
  tools: string[];
  summon_phrases: string[];
  _file?: string;
}

// Card label resolver — prefer the new `job` field, fall back to a clean
// truncation of `description` for personas written before the schema bump.
function personaJob(p: PersonaYaml): string {
  if (p.job && p.job.trim()) return p.job;
  const d = p.description ?? "";
  const period = d.indexOf(".");
  return period > 6 && period < 60 ? d.slice(0, period) : d.slice(0, 50);
}

interface ModelCatalogEntry {
  provider: string;
  models: Array<{ name: string; tier: "top" | "mid" | "cheap" | "free" }>;
}

function useHermesModels() {
  const demo = useDemoMode();
  return useQuery<{
    default: { provider: string; name: string } | null;
    catalog: ModelCatalogEntry[];
  }>({
    queryKey: ["hermes-models", demo],
    queryFn: async () => {
      if (demo) {
        return {
          default: { provider: "openai-codex", name: "gpt-5.5" },
          catalog: [
            { provider: "anthropic", models: [
              { name: "claude-opus-4.7", tier: "top" as const },
              { name: "claude-sonnet-4.5", tier: "mid" as const },
              { name: "claude-haiku-4", tier: "cheap" as const },
            ] },
            { provider: "openai", models: [
              { name: "gpt-5.5", tier: "mid" as const },
              { name: "gpt-4o-mini", tier: "cheap" as const },
            ] },
            { provider: "openrouter", models: [
              { name: "meta-llama/llama-3.3-70b-instruct:free", tier: "free" as const },
            ] },
          ],
        };
      }
      const res = await fetch("/__hermes_models");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}

type SyncStatus = "synced" | "dirty" | "untracked" | "no_repo";
function useHermesPantheonSync() {
  const demo = useDemoMode();
  return useQuery<{ statuses: Record<string, SyncStatus>; hasRepo: boolean }>({
    queryKey: ["hermes-pantheon-sync", demo],
    queryFn: async () => {
      if (demo) {
        return {
          statuses: { labyrinth: "synced", mercury: "synced", philosopher: "dirty" },
          hasRepo: true,
        };
      }
      const res = await fetch("/__hermes_pantheon_sync");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

async function updatePersona(id: string, patch: any): Promise<PersonaYaml | null> {
  const t = await fetch("/__token").then((r) => r.json());
  const res = await fetch(`/__hermes_pantheon/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Claude-OS-Token": t.token,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status}`);
  const j = await res.json();
  return j.persona as PersonaYaml;
}

function useHermesPantheon() {
  const demo = useDemoMode();
  return useQuery<{ personas: PersonaYaml[]; installed: boolean; dir: string }>({
    queryKey: ["hermes-pantheon", demo],
    queryFn: async () => {
      if (demo) {
        return {
          personas: DEMO_PERSONAS,
          installed: true,
          dir: "/Users/operator/.hermes/pantheon/personas",
        };
      }
      const res = await fetch("/__hermes_pantheon");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

async function installPantheon(): Promise<{ written: string[]; skipped: string[] }> {
  const t = await fetch("/__token").then((r) => r.json());
  const res = await fetch("/__hermes_pantheon/install", {
    method: "POST",
    headers: { "X-Claude-OS-Token": t.token },
  });
  if (!res.ok) throw new Error(`install failed: ${res.status}`);
  return res.json();
}

interface HermesProfile {
  name: string;
  model: string | null;
  gateway: string | null;
  alias: string | null;
  distribution: string | null;
  active: boolean;
}

function useHermesProfiles() {
  const demo = useDemoMode();
  return useQuery<{ profiles: HermesProfile[] }>({
    queryKey: ["hermes-profiles", demo],
    queryFn: async () => {
      if (demo) {
        return {
          profiles: [
            { name: "default", model: "gpt-5.5", gateway: "running", alias: null, distribution: null, active: true },
          ],
        };
      }
      const res = await fetch("/__hermes_profiles");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

function useHermesSkills() {
  const demo = useDemoMode();
  return useQuery<{ skills: HermesSkillCategory[] }>({
    queryKey: ["hermes-skills", demo],
    queryFn: async () => {
      if (demo) return { skills: DEMO_SKILLS };
      const res = await fetch("/__hermes_skills");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Memory — universal readout of every Hermes install's memory layout.
// Honest mapping (per Hermes' own spec, not invented here):
//   USER.md   → who the user is
//   MEMORY.md → what the agent has learned about the system
//   SOUL.md   → how the agent speaks (persona — NOT memory; rendered apart)
//   sessions/ + state.db → chat history (already surfaced elsewhere)
//   skills/   → procedural memory (already surfaced as Skill Library)
//   profiles/<name>/ → per-profile copies of all of the above
// ────────────────────────────────────────────────────────────────────────────
interface HermesMemoryProfile {
  name: string;
  hasMemory: boolean;
  hasUser: boolean;
  hasSoul: boolean;
}
interface HermesMemoryData {
  hermesHome: string;
  user: { content: string; charCount: number; charLimit: number; path: string };
  memory: { content: string; charCount: number; charLimit: number; path: string };
  soul: { content: string; charCount: number; isTemplate: boolean; path: string };
  provider: {
    active: string | null;
    available: Array<{ name: string; needsKey: boolean }>;
  };
  profiles: HermesMemoryProfile[];
  sessionCount: number;
  skillCount: number;
}

function useHermesMemory() {
  const demo = useDemoMode();
  return useQuery<HermesMemoryData>({
    queryKey: ["hermes-memory", demo],
    queryFn: async () => {
      if (demo) return DEMO_MEMORY;
      const res = await fetch("/__hermes_memory");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

function useHermesSessions() {
  const demo = useDemoMode();
  return useQuery<{ sessions: HermesSession[] }>({
    queryKey: ["hermes-sessions", demo],
    queryFn: async () => {
      if (demo) return { sessions: DEMO_SESSIONS };
      const res = await fetch("/__hermes_sessions");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

interface LiveIntegration {
  name: string;
  slug: string;
  connected: boolean;
  color: string; // 6-char hex (no #)
  tagline?: string;
}

function useHermesIntegrations() {
  const demo = useDemoMode();
  return useQuery<{ integrations: LiveIntegration[] }>({
    queryKey: ["hermes-integrations", demo],
    queryFn: async () => {
      if (demo) return { integrations: DEMO_INTEGRATIONS };
      const res = await fetch("/__live-data");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const j = await res.json();
      const list = Array.isArray(j?.integrations) ? (j.integrations as LiveIntegration[]) : [];
      return { integrations: list };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

interface HermesConnection {
  // "service" = CLI-backed integration that Hermes uses through a skill
  // (GitHub via `gh`, Google Workspace via `gws`, Spotify via `spotify`,
  // etc.). Detected by probing the CLI's auth-status command.
  kind: "provider" | "gateway" | "mcp" | "memory" | "service";
  name: string;
  slug: string;
  status: "connected" | "needs_setup";
}
function useHermesConnections() {
  const demo = useDemoMode();
  return useQuery<{ connections: HermesConnection[] }>({
    queryKey: ["hermes-connections", demo],
    queryFn: async () => {
      if (demo) return { connections: DEMO_CONNECTIONS };
      const res = await fetch("/__hermes_connections");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
}

function useHermesStatus() {
  const demo = useDemoMode();
  return useQuery<HermesStatus>({
    queryKey: ["hermes-status", demo],
    queryFn: async () => {
      if (demo) return DEMO_STATUS;
      const res = await fetch("/__hermes_status");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    // staleTime: 0 so the page always refetches on mount / focus. Hermes
    // can be installed or uninstalled out-of-band (terminal, /__install_hermes
    // endpoint), and the dashboard should reflect that within seconds rather
    // than caching a stale "connected" state for 15s.
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 4000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Page shell
// ────────────────────────────────────────────────────────────────────────────

function HermesPage() {
  const { data: status, isLoading } = useHermesStatus();

  return (
    <div
      // Negative margins on all 4 sides break out of the dashboard's
      // content padding so the green page reaches the viewport on every
      // edge — top, sides, AND bottom (the previously-missing -mb fixes
      // the black strip that appeared below the last section).
      // min-h-screen guarantees the green reaches the viewport bottom
      // even on short pages.
      className="hermes-skin relative -mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8 min-h-screen"
      style={{
        color: CREAM,
        // Layered backgrounds, top → bottom:
        //   1) radial teal wash (so cream text stays legible)
        //   2) labyrinth image, scaled to cover, pinned to viewport
        //   3) BG_GRADIENT fallback under everything
        // The previous fixed-position divs were being overpowered by
        // .hermes-skin::before's mix-blend-mode overlay, which is why
        // the texture wasn't showing despite full opacity. Painting
        // direct on the element bypasses that fight entirely.
        background: `
          radial-gradient(ellipse 100% 80% at 50% 35%, rgba(7,29,28,0.94) 0%, rgba(7,29,28,0.985) 100%),
          url(${pantheon06}) center 30% / cover no-repeat,
          ${BG_GRADIENT}
        `,
        backgroundAttachment: "scroll, fixed, scroll",
      }}
    >
      <div className="relative z-10 px-6 md:px-10 py-6 md:py-8">
        {/* Page-level cinematic banner — a very wide letterbox crop of the
            generated labyrinth-style scene. The Kie.ai output is 1376x768
            (16:9); we CSS-crop it to a true 19:5 letterbox via aspect-ratio
            + object-cover, which trims top/bottom to show the figure-and-
            colonnade band. The pixel HERMES-AGENT mark lives inside the
            chat panel now (center of the empty state), so this banner
            owns the page-top identity slot. */}
        <div
          className="relative mb-6 md:mb-8 border overflow-hidden"
          style={{
            borderColor: "rgba(255,230,203,0.35)",
            aspectRatio: "19 / 5",
          }}
        >
          <img
            src={pantheonBanner}
            alt="Hermes"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 55%" }}
          />
          {/* Soft vignette tying the banner edges back into the page bg */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,32,38,0) 60%, rgba(8,32,38,0.55) 100%)," +
                "linear-gradient(90deg, rgba(8,32,38,0.35) 0%, rgba(8,32,38,0) 18%, rgba(8,32,38,0) 82%, rgba(8,32,38,0.35) 100%)",
            }}
          />
        </div>
        <HermesDemoBanner />
        {isLoading && <HermesLoading />}
        {!isLoading && !status?.installed && (
          <>
            <RunInTerminalCard
              title="Install Hermes."
              body={
                <>
                  An autonomous agent that lives on your server, remembers what it learns, and gets
                  more capable the longer it runs. Run this in your terminal to install the
                  canonical Hermes Agent from Nous Research. After the install finishes, run{" "}
                  <span style={{ color: CREAM }}>hermes setup</span> in the same terminal to
                  configure provider, OAuth, models, and gateways. Refresh this page once it's done.
                </>
              }
              command="curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"
              hint="~90 seconds · installs to ~/.hermes · MIT licensed"
            />
            <HermesDemoCTA />
          </>
        )}
        {!isLoading && status?.installed && (
          <>
            <HermesConnectionsStrip />
            <HermesStatusBar status={status} />
            <HermesChat status={status} />
            <HermesStatsSection />
          </>
        )}
      </div>
    </div>
  );
}

// Slim banner shown whenever demo mode is on. Cream-on-amber strip
// across the top of the page content with two affordances: "Refresh
// connection" (clears React Query cache so the real /__hermes_status
// is re-checked — useful for verifying a fresh install) and "Exit
// demo".
function HermesDemoBanner() {
  const demo = useDemoMode();
  const queryClient = useQueryClient();
  if (!demo) return null;
  function refresh() {
    // Invalidate every Hermes-related query so the real endpoints get hit
    // next render. Equivalent to pressing F5 but without losing scroll.
    void queryClient.invalidateQueries({ predicate: (q) => {
      const k = Array.isArray(q.queryKey) ? q.queryKey[0] : null;
      return typeof k === "string" && k.startsWith("hermes-");
    } });
  }
  return (
    <div
      className="mb-4 border flex items-center gap-3 px-4 py-2.5"
      style={{
        background: "rgba(255,210,30,0.10)",
        borderColor: "rgba(255,210,30,0.55)",
      }}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: 8,
          height: 8,
          background: "#FFD21E",
          boxShadow: "0 0 10px rgba(255,210,30,0.7)",
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="hermes-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: "#FFD21E" }}
        >
          Demo mode
        </div>
        <div
          className="hermes-mono text-[10.5px] uppercase tracking-[0.18em] truncate"
          style={{ color: "rgba(255,230,203,0.75)" }}
        >
          Showing sample data — Hermes itself isn't being queried
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] px-3 py-1.5 border transition-colors"
        style={{
          background: "transparent",
          color: "rgba(255,230,203,0.85)",
          borderColor: "rgba(255,230,203,0.5)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = CREAM)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "rgba(255,230,203,0.5)")
        }
        title="Re-check whether Hermes is installed (useful after running setup)"
      >
        ↻ Refresh connection
      </button>
      <button
        type="button"
        onClick={() => {
          setDemoMode(false);
          refresh();
        }}
        className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] px-3 py-1.5 border transition-colors"
        style={{
          background: "#FFD21E",
          color: BG,
          borderColor: "#FFD21E",
          boxShadow: "0 0 10px rgba(255,210,30,0.4)",
        }}
        title="Stop showing sample data and return to live Hermes view"
      >
        Exit demo
      </button>
    </div>
  );
}

// "Try a sample of what this looks like" CTA on the install screen so
// the user can see the populated page before they install Hermes.
function HermesDemoCTA() {
  const queryClient = useQueryClient();
  function enable() {
    setDemoMode(true);
    void queryClient.invalidateQueries({
      predicate: (q) => {
        const k = Array.isArray(q.queryKey) ? q.queryKey[0] : null;
        return typeof k === "string" && k.startsWith("hermes-");
      },
    });
  }
  return (
    <div className="mt-6 flex items-center justify-center">
      <button
        type="button"
        onClick={enable}
        className="hermes-mono px-5 py-3 border text-[12px] uppercase tracking-[0.22em] transition-colors inline-flex items-center gap-2"
        style={{
          background: "rgba(0,0,0,0.4)",
          color: CREAM,
          borderColor: "rgba(255,230,203,0.55)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = CREAM)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "rgba(255,230,203,0.55)")
        }
        title="See what the page looks like once Hermes is installed"
      >
        <Zap className="h-4 w-4" style={{ color: "#FFD21E" }} />
        Or — preview with sample data
      </button>
    </div>
  );
}

function HermesLoading() {
  return (
    <div
      className="border p-12 flex items-center gap-3"
      style={{ borderColor: "rgba(255,230,203,0.2)" }}
    >
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: CREAM }} />
      <span className="text-sm hermes-mono" style={{ color: "rgba(255,230,203,0.6)" }}>
        Detecting Hermes…
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Status bar — wide cream-on-black band above the chat
// ────────────────────────────────────────────────────────────────────────────

// Provider id → logo source. Two tiers:
//   1. PROVIDER_LOGO_LOCAL — bundled asset (preferred for trademarked AI marks
//      that Simple Icons refuses to host, e.g. openai / groq / xai / cohere).
//   2. PROVIDER_LOGO_SLUG — Simple Icons CDN slug for everything else.
// We hit the local asset first, then fall back to Simple Icons, then a "❯".
const PROVIDER_LOGO_LOCAL: Record<string, string> = {
  openai: logoOpenAIGpt5,
  "openai-codex": logoCodex,
  codex: logoCodex,
  anthropic: logoClaude, // real Claude mark, not the Simple Icons "A\" wordmark
  claude: logoClaude,
  copilot: logoCopilot,
  openrouter: logoOpenRouter,
  gemini: logoGeminiColor,
  google: logoGeminiColor,
  // Last-resort plain OpenAI mark used by the model-card swatch
  "openai-fallback": logoOpenAI,
};

const PROVIDER_LOGO_SLUG: Record<string, string> = {
  github: "github",
  huggingface: "huggingface",
  nvidia: "nvidia",
  perplexity: "perplexity",
  mistral: "mistralai",
  ollama: "ollama",
  "ollama-cloud": "ollama",
  nous: "stardock", // no canonical mark — picks something distinct-ish
};

function ProviderLogoChip({
  provider,
  size = 18,
}: {
  provider: string | null;
  size?: number;
}) {
  if (!provider) return null;
  const key = provider.toLowerCase();
  const localSrc = PROVIDER_LOGO_LOCAL[key];
  // The Codex CLI mark is a blue/purple cloud — reads "blackjack" against
  // the dark Hermes page. Hue-rotate pushes it into the Hermes green
  // family so it matches the Codex VS Code green users actually expect.
  const isCodex = key === "openai-codex" || key === "codex";
  // Per-logo visual-size correction. Different brand PNGs ship with
  // wildly different padding/aspect (Claude is tight + tall, OpenAI is
  // square with whitespace), so we render every logo inside a fixed-size
  // box with object-contain. Some marks render visually larger than
  // others at the same pixel size — `inlineScale` rebalances per brand
  // so Claude and GPT-5 read the same weight in a chip.
  const inlineScale =
    key === "anthropic" || key === "claude" ? 0.86 : 1.0;
  if (localSrc) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={localSrc}
          alt={`${provider} logo`}
          className="object-contain"
          style={{
            width: size * inlineScale,
            height: size * inlineScale,
            filter: isCodex ? "hue-rotate(140deg) saturate(1.3) brightness(1.05)" : undefined,
          }}
          loading="lazy"
        />
      </span>
    );
  }
  const slug = PROVIDER_LOGO_SLUG[key];
  if (!slug) {
    return (
      <span
        className="hermes-mono inline-flex items-center justify-center shrink-0"
        style={{
          width: size,
          height: size,
          color: "rgba(255,230,203,0.7)",
          fontSize: size * 0.6,
        }}
      >
        ❯
      </span>
    );
  }
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/FFE6CB`}
      alt={`${provider} logo`}
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// Connections strip with a Global/Hermes toggle.
//   HERMES mode  → things Hermes can actually use (provider auths,
//                  gateway tokens, MCP servers). Default.
//   GLOBAL mode  → the broader machine integrations from /__live-data
//                  (Apify, Notion, Pinecone, etc.) — useful as a
//                  demo/showcase even if Hermes can't dispatch to them.
// Mode persists in localStorage. Marquee runs only when >6 items so the
// strip stays balanced for the short Hermes-mode list.
type ConnMode = "hermes" | "global";
const KIND_LABEL: Record<string, string> = {
  provider: "model",
  gateway: "channel",
  mcp: "mcp",
  memory: "memory",
  service: "service",
};

function HermesConnectionsStrip() {
  const [mode, setMode] = useState<ConnMode>(() => {
    if (typeof window === "undefined") return "hermes";
    return (window.localStorage.getItem("claude-os.hermes.conn-mode") as ConnMode) ?? "hermes";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("claude-os.hermes.conn-mode", mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const { data: hermesData } = useHermesConnections();
  const { data: globalData } = useHermesIntegrations();

  // Normalise both shapes to one render shape so the marquee loop is mode-
  // agnostic. Hermes connections carry an explicit `kind`; global integrations
  // are all displayed as "integration" since they describe the user's wider
  // machine, not what Hermes is wired into.
  type Row = { name: string; slug: string; kindLabel: string; color: string; status: string };
  const rows: Row[] =
    mode === "hermes"
      ? (hermesData?.connections ?? []).map((c) => ({
          name: c.name,
          slug: c.slug,
          kindLabel: KIND_LABEL[c.kind] ?? c.kind,
          color: "FFE6CB",
          status: c.status,
        }))
      : (globalData?.integrations ?? [])
          .filter((i) => i.connected)
          .map((i) => ({
            name: i.name,
            slug: i.slug,
            kindLabel: "integration",
            color: i.color,
            status: "connected",
          }));

  if (rows.length === 0 && mode === "hermes") {
    // Edge case — Hermes is installed but no auths/gateways yet. Show the
    // toggle so the user can flip to Global without rendering an empty bar.
    return (
      <section
        className="relative mb-5 border overflow-hidden"
        style={{ borderColor: "rgba(255,230,203,0.4)", background: "rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-stretch">
          <ConnectionsModeToggle mode={mode} setMode={setMode} />
          <div
            className="px-4 py-3 hermes-mono text-[10.5px] uppercase tracking-[0.22em] flex items-center"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            No Hermes connections yet · run{" "}
            <span style={{ color: CREAM, marginLeft: 6 }}>hermes setup</span>
          </div>
        </div>
      </section>
    );
  }

  const useMarquee = rows.length > 6;
  const durationSec = Math.max(18, rows.length * 3);
  return (
    <section
      className="relative mb-5 border overflow-hidden"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        background: "rgba(0,0,0,0.25)",
      }}
    >
      <div className="flex items-stretch">
        <ConnectionsModeToggle mode={mode} setMode={setMode} />
        <div className="flex-1 relative overflow-hidden flex items-center">
          {useMarquee && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10"
                style={{
                  width: 60,
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10"
                style={{
                  width: 30,
                  background:
                    "linear-gradient(270deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
                }}
              />
            </>
          )}
          <div
            className={useMarquee ? "flex" : "flex w-full justify-center"}
            style={
              useMarquee
                ? { animation: `hermes-marquee ${durationSec}s linear infinite`, width: "max-content" }
                : undefined
            }
          >
            {(useMarquee ? [...rows, ...rows] : rows).map((r, idx) => (
              <div
                key={`${r.name}-${idx}`}
                className="flex items-center gap-2 px-3.5 py-2.5 border-r shrink-0"
                style={{ borderColor: "rgba(255,230,203,0.12)" }}
                title={`${r.kindLabel} · ${r.name}`}
              >
                <ConnectionLogo slug={r.slug} name={r.name} color={r.color} />
                <span
                  className="hermes-mono text-[11.5px] tracking-[0.04em] truncate max-w-[160px]"
                  style={{ color: CREAM }}
                >
                  {r.name}
                </span>
                <span
                  className="inline-block rounded-full shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    background: r.status === "connected" ? "#86efac" : "#fbbf24",
                    boxShadow:
                      r.status === "connected"
                        ? "0 0 6px rgba(134,239,172,0.7)"
                        : "0 0 6px rgba(251,191,36,0.6)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConnectionsModeToggle({
  mode,
  setMode,
}: {
  mode: ConnMode;
  setMode: (m: ConnMode) => void;
}) {
  // Tight segmented control — no count line below (drops the unnecessary
  // height that was throwing the strip's vertical balance off).
  return (
    <div
      className="px-3 flex items-center shrink-0 border-r relative z-10"
      style={{
        borderColor: "rgba(255,230,203,0.25)",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center">
        {(["hermes", "global"] as ConnMode[]).map((m, i) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em] px-2.5 py-1.5 border transition-colors"
              style={{
                background: active ? CREAM : "transparent",
                color: active ? BG : "rgba(255,230,203,0.75)",
                borderColor: active ? CREAM : "rgba(255,230,203,0.3)",
                borderLeftWidth: i === 0 ? 1 : 0,
              }}
              title={
                m === "hermes"
                  ? "What Hermes is wired to (providers, gateways, MCP)"
                  : "All connections on this machine (broader live-data)"
              }
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionLogo({
  slug,
  name,
  color,
}: {
  slug: string;
  name: string;
  color: string;
}) {
  const key = slug.toLowerCase();
  const local = HERMES_LOCAL_LOGOS[key];
  const [fallback, setFallback] = useState(false);
  // 1. Local PNG/SVG → guaranteed render
  if (local && !fallback) {
    return (
      <img
        src={local}
        alt={name}
        className="object-contain shrink-0"
        style={{ width: 18, height: 18 }}
        loading="lazy"
        onError={() => setFallback(true)}
      />
    );
  }
  // 2. Simple Icons (only slugs we've verified work)
  if (SIMPLE_ICON_SLUGS.has(key) && !fallback) {
    return (
      <img
        src={`https://cdn.simpleicons.org/${key}/${color}`}
        alt={name}
        className="object-contain shrink-0"
        style={{ width: 18, height: 18 }}
        loading="lazy"
        onError={() => setFallback(true)}
      />
    );
  }
  // 3. Initial-letter fallback in a tinted square — never broken, always
  //    on-brand. Used for niche services Simple Icons doesn't cover
  //    (Stitch, Higgsfield, Granola, etc.).
  const bg = fallbackBgFromSlug(key);
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center hermes-mono"
      style={{
        width: 18,
        height: 18,
        background: `${bg}33`,
        color: bg,
        fontSize: 10,
        fontWeight: 600,
        border: `1px solid ${bg}66`,
      }}
      aria-label={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function HermesStatusBar({ status }: { status: HermesStatus }) {
  // Four-card instrument row. Each card is a self-contained tile with
  // its own visual punch — connection pill on Version, provider logo on
  // Model, memory progress ring on Memory, sparkline on Activity. Click
  // arrows go through to deeper pages (Hermes dashboard, /memory route).
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
      <VersionCard status={status} />
      <ModelCard status={status} />
      <MemoryCard />
      <ActivityCard />
    </section>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden border px-4 py-2.5"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        background: "rgba(0,0,0,0.22)",
        // Half the previous height — these cards are status indicators,
        // not the focus. Don't crowd the chat.
        minHeight: 70,
      }}
    >
      {/* Each card carries the same subtle scanline so they read as a set */}
      <svg
        aria-hidden
        className="absolute inset-0 w-full h-full opacity-[0.05]"
        preserveAspectRatio="none"
        viewBox="0 0 600 200"
      >
        <defs>
          <pattern id="card-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke={CREAM} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="600" height="200" fill="url(#card-grid)" />
      </svg>
      <div className="relative h-full flex items-center gap-3">{children}</div>
    </div>
  );
}

function VersionCard({ status }: { status: HermesStatus }) {
  // Try strict semver first (1.2.3), then fall back to any dotted number
  // sequence (0.13, 2026.5.7), then to the first whitespace-delimited token
  // of whatever Hermes returned. If all of that fails, show the latest known
  // shipping version rather than an ugly "v?" — the agent IS detected, the
  // version output just didn't parse cleanly. TODO: replace this
  // hardcoded fallback once we confirm the exact `hermes --version` format.
  const raw = status.version?.trim() ?? "";
  const semverMatch = raw.match(/v?(\d+\.\d+\.\d+)/);
  const looseMatch = !semverMatch ? raw.match(/v?(\d+(?:\.\d+)+)/) : null;
  const firstToken = !semverMatch && !looseMatch && raw ? raw.split(/\s+/)[0] : null;
  const versionNumber = semverMatch
    ? `v${semverMatch[1]}`
    : looseMatch
      ? `v${looseMatch[1]}`
      : firstToken || "v0.13.0";
  const releaseDate = status.version?.match(/\(([^)]+)\)/)?.[1] ?? null;
  const updateAvailable = (() => {
    if (!releaseDate) return false;
    const t = new Date(releaseDate).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t > 14 * 86_400_000;
  })();
  const [copied, setCopied] = useState(false);
  function copyUpdate() {
    void copyToClipboard("hermes update").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <CardShell>
      <div className="flex-1 min-w-0">
        <div
          className="hermes-mono text-[9px] uppercase tracking-[0.22em] mb-1"
          style={{ color: "rgba(255,230,203,0.55)" }}
        >
          Agent
        </div>
        <div
          className="hermes-display text-2xl leading-none mb-2"
          style={{
            color: CREAM,
            textShadow: status.needsSetup ? undefined : "0 0 14px rgba(134,239,172,0.25)",
          }}
        >
          {versionNumber}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {status.needsSetup ? (
            <span
              className="hermes-mono inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px]"
              style={{
                borderColor: "rgba(255, 210, 30, 0.55)",
                color: "#FFD21E",
                background: "rgba(255, 210, 30, 0.08)",
              }}
            >
              <AlertTriangle className="h-3 w-3" />
              SETUP
            </span>
          ) : (
            <span
              className="hermes-mono inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px]"
              style={{
                borderColor: "rgba(134, 239, 172, 0.55)",
                color: "#86efac",
                background: "rgba(134, 239, 172, 0.08)",
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: "#86efac",
                  boxShadow: "0 0 6px rgba(134,239,172,0.8)",
                }}
              />
              ONLINE
            </span>
          )}
          {releaseDate && (
            <span
              className="hermes-mono text-[10px] uppercase tracking-[0.18em] truncate"
              style={{ color: "rgba(255,230,203,0.5)" }}
            >
              {releaseDate}
            </span>
          )}
        </div>
      </div>
      {/* Update CTA — only visible when build is stale. Copies the update
          command so the user can run it in their terminal. */}
      {updateAvailable && (
        <button
          type="button"
          onClick={copyUpdate}
          className="absolute top-3 right-3 hermes-mono text-[9.5px] uppercase tracking-[0.22em] px-2 py-1 border inline-flex items-center gap-1 transition-colors"
          style={{
            background: copied ? "#FFD21E" : "rgba(255,210,30,0.08)",
            color: copied ? BG : "#FFD21E",
            borderColor: "#FFD21E",
            boxShadow: copied ? "0 0 12px rgba(255,210,30,0.6)" : undefined,
          }}
          title="Copy `hermes update` to clipboard"
        >
          {copied ? (
            <>✓ Copied</>
          ) : (
            <>
              <ArrowUp className="h-3 w-3" />
              Update
            </>
          )}
        </button>
      )}
    </CardShell>
  );
}

function MemoryCard() {
  const { data } = useHermesMemory();
  // Roll up the user-memory + agent-memory char counts into one visual.
  // We deliberately don't surface separate ring/ring/ring micro-charts —
  // single number, single bar, click-through arrow to the deeper page.
  const userChars = data?.user?.charCount ?? 0;
  const userLimit = data?.user?.charLimit ?? 0;
  const memChars = data?.memory?.charCount ?? 0;
  const memLimit = data?.memory?.charLimit ?? 0;
  const totalUsed = userChars + memChars;
  const totalLimit = userLimit + memLimit;
  const pct =
    totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;
  // Pretty-format the char count: 12 345 → "12.3k"
  function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }
  return (
    <CardShell>
      <div className="flex-1 min-w-0">
        <div
          className="hermes-mono text-[9px] uppercase tracking-[0.22em] mb-1"
          style={{ color: "rgba(255,230,203,0.55)" }}
        >
          Memory
        </div>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <div
            className="hermes-display text-2xl leading-none"
            style={{
              color: CREAM,
              textShadow: "0 0 14px rgba(96,165,250,0.25)",
            }}
          >
            {fmt(totalUsed)}
          </div>
          <span
            className="hermes-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            / {fmt(totalLimit)} chars
          </span>
        </div>
        {/* Capacity bar — segmented like a fuel gauge. */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 5,
            background: "rgba(255,230,203,0.08)",
          }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, #60a5fa 0%, #86efac ${Math.min(100, pct + 20)}%)`,
              boxShadow: "0 0 8px rgba(96,165,250,0.5)",
            }}
          />
        </div>
        <div
          className="hermes-mono text-[9px] uppercase tracking-[0.22em] mt-1"
          style={{ color: "rgba(255,230,203,0.5)" }}
        >
          {pct}% full · ~/.hermes/memories
        </div>
      </div>
      <a
        href="http://localhost:9119/memory"
        target="_blank"
        rel="noopener noreferrer"
        className="hermes-mono text-[9px] uppercase tracking-[0.22em] inline-flex items-center gap-0.5 transition-colors shrink-0 self-start mt-0.5"
        style={{ color: "rgba(255,230,203,0.5)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.5)")}
        title="Open memory in the Hermes dashboard"
      >
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </CardShell>
  );
}

function ModelCard({ status }: { status: HermesStatus }) {
  // Connected-models strip: every major provider gets a chip. Active
  // provider is full-colour + bordered; the rest are greyed out + slightly
  // blurred. OpenRouter unlocks Llama/Qwen by association (one auth ->
  // many model families). Hover shows "active" or "not connected".
  const { data: conns } = useHermesConnections();
  const connectedProviders = new Set(
    (conns?.connections ?? [])
      .filter((c) => c.kind === "provider")
      .map((c) => c.name.toLowerCase()),
  );
  const activeProvider = (status.provider ?? "").toLowerCase();
  const openrouterConnected =
    connectedProviders.has("openrouter") || activeProvider === "openrouter";

  // The set of providers to surface — chosen so the strip looks colourful
  // even when only one is wired. OpenRouter aggregates many models; if
  // it's connected, we treat Llama/Qwen/etc. as available too.
  const PROVIDERS: Array<{ key: string; label: string }> = [
    { key: "anthropic", label: "Claude" },
    { key: "openai-codex", label: "Codex" },
    { key: "openai", label: "GPT-5" },
    { key: "googlegemini", label: "Gemini" },
    { key: "openrouter", label: "OpenRouter" },
  ];

  function isConnected(key: string): boolean {
    if (key === "openai-codex" && activeProvider === "openai-codex") return true;
    if (key === activeProvider) return true;
    if (connectedProviders.has(key)) return true;
    // OpenRouter unlocks the long-tail model families:
    if (openrouterConnected && (key === "googlegemini" || key === "openai")) {
      return true; // technically yes — they're proxied through OpenRouter
    }
    return false;
  }

  return (
    <CardShell>
      <div className="min-w-0 flex-1 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <div
            className="hermes-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            Active Model
          </div>
          <a
            href="http://localhost:9119/models"
            target="_blank"
            rel="noopener noreferrer"
            className="hermes-mono text-[9px] uppercase tracking-[0.22em] inline-flex items-center gap-0.5 transition-colors"
            style={{ color: "rgba(255,230,203,0.5)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.5)")}
            title="Switch model in Hermes dashboard"
          >
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        {/* Active model display — provider mark next to the model name,
            both big enough to read at-a-glance. */}
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 inline-flex items-center justify-center border"
            style={{
              width: 44,
              height: 44,
              borderColor: CREAM,
              background: "rgba(255,230,203,0.08)",
              boxShadow: "0 0 12px rgba(255,210,30,0.25)",
            }}
            title={`${activeProvider} · active`}
          >
            <ProviderLogoChip provider={activeProvider} size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="hermes-display leading-tight truncate"
              style={{ color: CREAM, fontSize: 17, letterSpacing: "0.005em" }}
            >
              {status.defaultModel ?? "no model"}
            </div>
            <div
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em] truncate"
              style={{ color: "rgba(255,230,203,0.55)" }}
            >
              via {activeProvider || "—"}
            </div>
          </div>
        </div>

        {/* Available-providers strip — same height as the active block
            but in a row of bigger logo-name pairs. Connected ones are
            clear, not-connected ones are heavily greyed but still
            identifiable. Hover shows status. */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t"
          style={{ borderColor: "rgba(255,230,203,0.18)" }}>
          {PROVIDERS.filter((p) => p.key !== activeProvider).map((p) => {
            const connected = isConnected(p.key);
            return (
              <span
                key={p.key}
                className="inline-flex items-center gap-1.5 px-2 py-1 border transition-all"
                style={{
                  borderColor: `rgba(255,230,203,${connected ? 0.3 : 0.12})`,
                  background: "rgba(0,0,0,0.3)",
                  filter: connected ? "none" : "saturate(0) brightness(0.65)",
                  opacity: connected ? 1 : 0.55,
                }}
                title={
                  connected
                    ? `${p.label} · connected`
                    : `${p.label} · not connected`
                }
              >
                <ProviderLogoChip provider={p.key} size={16} />
                <span
                  className="hermes-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: connected ? CREAM : "rgba(255,230,203,0.7)" }}
                >
                  {p.label}
                </span>
                <span
                  className="inline-block rounded-full shrink-0"
                  style={{
                    width: 5,
                    height: 5,
                    background: connected ? "#86efac" : "rgba(255,230,203,0.25)",
                    boxShadow: connected ? "0 0 5px rgba(134,239,172,0.7)" : undefined,
                  }}
                />
              </span>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}

function ActivityCard() {
  const { data } = useHermesSessions();
  const sessions = data?.sessions ?? [];
  const total = sessions.length;

  // Build a 7-day bar chart from session timestamps.
  const buckets = (() => {
    const now = new Date();
    const days: Array<{ label: string; count: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      const end = start + 86_400_000;
      const count = sessions.filter((s) => {
        const t = new Date(s.startedAt || s.lastUpdated || 0).getTime();
        return t >= start && t < end;
      }).length;
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
        count,
        isToday: i === 0,
      });
    }
    return days;
  })();
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const totalThisWeek = buckets.reduce((a, b) => a + b.count, 0);

  return (
    <CardShell>
      <div className="shrink-0">
        <div
          className="hermes-display text-2xl leading-none"
          style={{
            color: "#FFD21E",
            textShadow: "0 0 18px rgba(255, 210, 30, 0.5)",
          }}
        >
          {totalThisWeek}
        </div>
        <div
          className="hermes-mono text-[9px] uppercase tracking-[0.22em] mt-0.5"
          style={{ color: "rgba(255,230,203,0.55)" }}
        >
          this week
        </div>
      </div>

      {/* Compact 7-day bar chart — half the previous height, denser. */}
      <div className="flex-1 flex items-end justify-between gap-1 h-9">
        {buckets.map((b, i) => {
          const h = (b.count / maxCount) * 100;
          const hasData = b.count > 0;
          const intensity = b.count / maxCount;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full"
                  style={{
                    height: `${Math.max(6, h)}%`,
                    background: hasData
                      ? `linear-gradient(180deg, #FFE6CB 0%, #FFD21E ${Math.max(30, 100 - intensity * 60)}%, #FF9D2F 100%)`
                      : "rgba(255,230,203,0.14)",
                    boxShadow: hasData
                      ? `0 0 ${6 + intensity * 10}px rgba(255,180,30,${0.2 + intensity * 0.3})`
                      : undefined,
                    border: b.isToday ? "1px solid rgba(255, 210, 30, 0.55)" : undefined,
                  }}
                  title={`${b.count} session${b.count === 1 ? "" : "s"}`}
                />
              </div>
              <span
                className="hermes-mono text-[8px] uppercase leading-none"
                style={{
                  color: b.isToday ? CREAM : "rgba(255,230,203,0.4)",
                  fontWeight: b.isToday ? 700 : 400,
                }}
              >
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="hermes-mono text-[9px] uppercase tracking-[0.22em] shrink-0 text-right"
        style={{ color: "rgba(255,230,203,0.45)" }}
      >
        {total} total
        <br />
        on disk
      </div>
    </CardShell>
  );
}

function StatusChip({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const okColor = "#86efac";
  const badColor = "#fca5a5";
  return (
    <div
      className="hidden md:flex flex-col px-3 py-1.5 border"
      style={{
        borderColor: ok ? "rgba(134, 239, 172, 0.4)" : "rgba(252, 165, 165, 0.4)",
      }}
    >
      <span
        className="hermes-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: "rgba(255,230,203,0.5)" }}
      >
        {label}
      </span>
      <span
        className="hermes-mono text-[11px] font-bold"
        style={{ color: ok ? okColor : badColor }}
      >
        {value}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chat — terminal-feeling, all cream on black
// ────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "hermes";
  content: string;
  timestamp: number;
}

function HermesChat({ status }: { status: HermesStatus }) {
  // When Hermes is installed but doesn't yet have a provider API key set,
  // the chat panel becomes a "run hermes setup in your terminal" card.
  // We deliberately don't try to mirror the full setup flow in the
  // browser — it's already a great terminal wizard. We just guide the
  // user there. Once they save a key, status refetches and the panel
  // flips to the live chat.
  if (status.needsSetup) {
    return (
      <RunInTerminalCard
        title="One more step — run hermes setup."
        body={
          <>
            Hermes is installed and configured to use{" "}
            <span style={{ color: CREAM }}>{status.defaultModel}</span> — but it doesn't have a
            provider API key yet. The fastest way to wire it up is the canonical wizard: it walks
            you through providers, OAuth, models, gateways, and tools.
          </>
        }
        command="hermes setup"
        hint="Once you've completed it, refresh this page — the chat will appear here."
      />
    );
  }
  return <HermesChatActive status={status} />;
}

function HermesChatActive({ status }: { status: HermesStatus }) {
  const demo = useDemoMode();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Image attachments — uploaded to ~/.hermes/image_cache/, referenced by
  // absolute path in the outgoing prompt so Hermes' vision-capable model
  // (and its file-read tool) can pick them up.
  type Attachment = { path: string; name: string; preview: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Active session id — null when on the "new chat" tab. When set, subsequent
  // sends pass --resume so Hermes loads the prior turns as context.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // Active persona — read from ?persona= in the URL. When set, every chat
  // turn POSTs `personaId` and the backend overrides Hermes' model + skills
  // + tools + system_prompt against that persona's YAML. URL is the single
  // source of truth so a deep link survives reloads and lets "Activate" in
  // the Pantheon modal trigger the switch with one navigate() call.
  const [activePersonaId, setActivePersonaId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("persona");
    return p && /^[a-z0-9_-]{1,32}$/.test(p) ? p : null;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const sp = new URLSearchParams(window.location.search);
      const p = sp.get("persona");
      const next = p && /^[a-z0-9_-]{1,32}$/.test(p) ? p : null;
      setActivePersonaId((prev) => (prev === next ? prev : next));
    };
    read();
    // TanStack Router pushes state without firing popstate, so poll the
    // search string at 250ms — invisible during normal use, cheap.
    const iv = window.setInterval(read, 250);
    window.addEventListener("popstate", read);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("popstate", read);
    };
  }, []);
  const { data: pantheonData } = useHermesPantheon();
  const activePersona =
    activePersonaId && pantheonData?.personas
      ? pantheonData.personas.find((p) => p.id === activePersonaId) ?? null
      : null;
  function exitPersona() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("persona");
    window.history.pushState({}, "", url.toString());
    setActivePersonaId(null);
  }

  // Auto-grow textarea up to ~8 lines so longer drafts stay visible
  // instead of scrolling out of sight.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const next = Math.min(ta.scrollHeight, 192);
    ta.style.height = `${next}px`;
  }, [input]);

  async function uploadImage(file: File): Promise<Attachment | null> {
    if (!file.type.startsWith("image/")) return null;
    setUploading(true);
    try {
      const t = await fetch("/__token").then((r) => r.json());
      const res = await fetch("/__hermes_image_upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Claude-OS-Token": t.token,
        },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const j = (await res.json()) as { path: string };
      const preview = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.readAsDataURL(file);
      });
      return { path: j.path, name: file.name, preview };
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const uploaded = await Promise.all(arr.map(uploadImage));
    setAttachments((prev) => [...prev, ...(uploaded.filter(Boolean) as Attachment[])]);
  }
  // Sidebar (session history) is collapsed by default to a narrow icon-rail
  // so the chat itself gets all the breathing room. Click the rail header
  // to expand it back into a full thread list.
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  // User-resizable height. Drag the bottom edge to make the chat taller
  // (up to ~80vh) or shorter (down to a 200px sliver). Persisted in
  // localStorage so the size sticks across reloads.
  const [chatHeight, setChatHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 480;
    const v = Number(window.localStorage.getItem("claude-os.hermes.chat-height") || "");
    return Number.isFinite(v) && v >= 200 && v <= 1600 ? v : 480;
  });
  // Refs for the drag handler — we read the start height + start Y at
  // pointerdown so the drag math doesn't fight React state batching.
  const resizeStateRef = useRef<{ startY: number; startH: number } | null>(null);
  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
    resizeStateRef.current = { startY: e.clientY, startH: chatHeight };
    const onMove = (ev: PointerEvent) => {
      const s = resizeStateRef.current;
      if (!s) return;
      const next = Math.max(200, Math.min(window.innerHeight * 0.85, s.startH + (ev.clientY - s.startY)));
      setChatHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      resizeStateRef.current = null;
      try {
        window.localStorage.setItem(
          "claude-os.hermes.chat-height",
          String(Math.round(chatHeight)),
        );
      } catch {
        /* localStorage may be disabled */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }
  // Persist the final height when chatHeight settles (covers the case
  // where the user drops outside the window). Debounced via effect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(
          "claude-os.hermes.chat-height",
          String(Math.round(chatHeight)),
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [chatHeight]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  const queryClient = useQueryClient();

  async function loadSession(sessionId: string) {
    if (sending || loadingSession) return;
    setLoadingSession(true);
    try {
      // Demo mode: synthesize a short canned conversation from the session's
      // firstUserMessage so screen-recordings and walkthrough demos can show
      // a click-loads-the-thread flow without a real ~/.hermes/ backend.
      if (demo) {
        const ds = DEMO_SESSIONS.find((s) => s.id === sessionId);
        if (ds) {
          setActiveSessionId(sessionId);
          setMessages([
            {
              id: `${sessionId}-0`,
              role: "user" as const,
              content: ds.firstUserMessage,
              timestamp: new Date(ds.startedAt).getTime(),
            },
            {
              id: `${sessionId}-1`,
              role: "hermes" as const,
              content: `On it. Pulling context from prior sessions and your SOUL.md preferences — give me a moment to scope this properly before I start drafting.`,
              timestamp: new Date(ds.startedAt).getTime() + 4_000,
            },
            {
              id: `${sessionId}-2`,
              role: "user" as const,
              content: `sounds good, take your time`,
              timestamp: new Date(ds.startedAt).getTime() + 30_000,
            },
            {
              id: `${sessionId}-3`,
              role: "hermes" as const,
              content: `Here's what I've put together. I leaned on the labyrinth persona for the structural pass and kept the tone tight per your usual preference. Want me to push this further or move on?`,
              timestamp: new Date(ds.startedAt).getTime() + 90_000,
            },
          ]);
        }
        return;
      }
      const res = await fetch(`/__hermes_session?id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const j = (await res.json()) as {
        sessionId: string;
        messages: Array<{ role: string; content: string; ts: string | null }>;
      };
      setActiveSessionId(j.sessionId);
      setMessages(
        j.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, i) => ({
            id: `${j.sessionId}-${i}`,
            role: m.role === "assistant" ? ("hermes" as const) : ("user" as const),
            content: m.content,
            timestamp: m.ts ? new Date(m.ts).getTime() : Date.now(),
          })),
      );
    } catch {
      /* fail silently — sidebar will still show the click did something */
    } finally {
      setLoadingSession(false);
    }
  }

  function startNewChat() {
    if (sending) return;
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  }

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    // Allow sending with images and no text (e.g. "what's in this?")
    if ((!text && attachments.length === 0) || sending) return;
    setInput("");
    setSending(true);

    // Prefix the prompt with image references so Hermes can read them
    // from disk. Vision-capable models pick the paths up via Hermes'
    // image input pipeline (`image_input_mode: auto` in config.yaml).
    const imagePrefix =
      attachments.length > 0
        ? attachments.map((a) => `[Image: ${a.path}]`).join("\n") + "\n\n"
        : "";
    const promptForServer = `${imagePrefix}${text}`.trim();
    // Visible chat shows the user's actual text + a count of attachments
    // (the absolute path is noisy for display).
    const displayText =
      attachments.length > 0
        ? `${text}${text ? "\n" : ""}📎 ${attachments.length} image${attachments.length === 1 ? "" : "s"} attached`
        : text;
    // The image paths are already baked into promptForServer above, so we
    // can clear UI state immediately.
    setAttachments([]);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayText,
      timestamp: Date.now(),
    };
    // Append the user message immediately. The Hermes placeholder is
    // added lazily on first chunk so the typing indicator can show in
    // its place without overlap.
    const replyId = crypto.randomUUID();
    let hermesAppended = false;
    setMessages((prev) => [...prev, userMsg]);

    // Fetch the per-run token that gates the chat endpoint.
    let token: string | null = null;
    try {
      const t = await fetch("/__token");
      if (t.ok) token = (await t.json()).token ?? null;
    } catch {
      /* token endpoint not exposed — request will 403 below */
    }

    let response: Response;
    try {
      response = await fetch("/__hermes_chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Claude-OS-Token": token } : {}),
        },
        // Pass the active session id when we're inside a loaded thread —
        // Hermes' --resume flag picks up the prior context.
        // Pass activePersonaId so the backend overrides Hermes' model +
        // skills + tools + system_prompt against the persona's YAML.
        body: JSON.stringify({
          prompt: promptForServer,
          ...(activeSessionId ? { sessionId: activeSessionId } : {}),
          ...(activePersonaId ? { personaId: activePersonaId } : {}),
        }),
      });
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? { ...m, content: `⚠ Could not reach hermes: ${err?.message ?? "unknown"}` }
            : m,
        ),
      );
      setSending(false);
      return;
    }

    if (!response.ok || !response.body) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId ? { ...m, content: `⚠ Chat endpoint returned ${response.status}.` } : m,
        ),
      );
      setSending(false);
      return;
    }

    // The endpoint streams SSE-formatted events:
    //   event: chunk  data: <text>
    //   event: info   data: <stderr line>   (we ignore for now)
    //   event: done   data: ok
    //   event: error  data: <message>
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const lines = evt.split("\n");
        let eventName = "chunk";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        }
        const data = dataLines.join("\n");
        if (eventName === "chunk" && data.length > 0) {
          accumulated += data + "\n";
          if (!hermesAppended) {
            hermesAppended = true;
            setMessages((prev) => [
              ...prev,
              {
                id: replyId,
                role: "hermes",
                content: accumulated.trimEnd(),
                timestamp: Date.now(),
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === replyId ? { ...m, content: accumulated.trimEnd() } : m)),
            );
          }
        } else if (eventName === "error") {
          if (!hermesAppended) {
            hermesAppended = true;
            setMessages((prev) => [
              ...prev,
              { id: replyId, role: "hermes", content: `⚠ ${data}`, timestamp: Date.now() },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === replyId
                  ? { ...m, content: (accumulated || "") + `\n\n⚠ ${data}` }
                  : m,
              ),
            );
          }
        } else if (eventName === "done") {
          // Final state already set by the chunks; just exit.
        }
      }
    }
    setSending(false);
    // Hermes just wrote a new session JSON (or appended to the resumed one).
    // Invalidate the sessions list so the sidebar reflects it immediately.
    void queryClient.invalidateQueries({ queryKey: ["hermes-sessions"] });
  }

  return (
    <section className="mb-10 relative">
      <div
        className="border flex"
        style={{
          borderColor: "rgba(255,230,203,0.4)",
          background: "rgba(0,0,0,0.25)",
          // User-resizable height — see handleResizeStart. Drag the
          // bottom edge to set it; persisted across reloads.
          height: chatHeight,
          width: "100%",
        }}
      >
        {/* LEFT — sessions sidebar (Telegram-style thread list).
            Collapsed to an icon-rail by default so the chat dominates. */}
        <ChatSidebar
          activeSessionId={activeSessionId}
          loadSession={loadSession}
          startNewChat={startNewChat}
          loadingSession={loadingSession}
          expanded={sidebarExpanded}
          onToggleExpanded={() => setSidebarExpanded((v) => !v)}
        />

        {/* RIGHT — active conversation */}
        <div
          className="flex-1 flex flex-col min-w-0 relative"
          style={{
            borderLeft: "1px solid rgba(255,230,203,0.4)",
            // Texture watermark — labyrinth at very low opacity so the
            // chat surface feels like aged paper, not a flat dark box.
            backgroundImage: `url(${pantheon06})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Lighter wash over the texture — texture is more visible now.
              Slight gradient (top a touch lighter) keeps the input bar's
              cream text legible without flattening the labyrinth grain. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,32,38,0.74) 0%, rgba(8,32,38,0.82) 100%)",
            }}
          />

          {/* Chat header — minimal pill, no expand toggle (chat is always
              full-width now). Pixel HERMES-AGENT logo moved out of the
              header and into the empty-state, centered h+w.
              When a Pantheon persona is active, the header swaps to a
              persona pill (avatar + name + model badge + exit X). This is
              the only visual cue the user has that they've left default
              Hermes, so it stays compact but unmistakable. */}
          <div
            data-hermes-chat-anchor
            className="relative border-b px-5 py-3 flex items-center justify-between gap-3"
            style={{ borderColor: "rgba(255,230,203,0.2)" }}
          >
            {activePersona ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  {PERSONA_AVATAR_BY_ID[activePersona.id] && (
                    <img
                      src={PERSONA_AVATAR_BY_ID[activePersona.id]}
                      alt=""
                      aria-hidden
                      className="h-6 w-6 rounded-sm object-cover shrink-0"
                      style={{ borderColor: "rgba(255,230,203,0.35)" }}
                    />
                  )}
                  <span
                    className="hermes-display text-[15px] truncate"
                    style={{ color: CREAM, letterSpacing: "0.01em" }}
                  >
                    {activePersona.name}
                  </span>
                  <span
                    className="hermes-mono text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 border shrink-0"
                    style={{
                      color: "rgba(255,230,203,0.85)",
                      borderColor: "rgba(255,230,203,0.35)",
                    }}
                  >
                    {activePersona.model?.provider ?? "?"} ·{" "}
                    {activePersona.model?.name ?? "?"}
                  </span>
                </div>
                <button
                  onClick={exitPersona}
                  title="Exit persona — return to default Hermes"
                  className="hermes-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 border transition-colors shrink-0"
                  style={{
                    color: "rgba(255,230,203,0.6)",
                    borderColor: "rgba(255,230,203,0.25)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = CREAM;
                    e.currentTarget.style.borderColor = "rgba(255,230,203,0.55)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,230,203,0.6)";
                    e.currentTarget.style.borderColor = "rgba(255,230,203,0.25)";
                  }}
                >
                  exit ×
                </button>
              </>
            ) : (
              <div
                className="hermes-mono text-[11px] uppercase tracking-[0.22em] truncate"
                style={{ color: CREAM }}
              >
                {activeSessionId ? `❯ Resuming · ${activeSessionId.slice(0, 18)}` : "❯ New Chat"}
              </div>
            )}
          </div>

          {/* Scrolling message area */}
          <div
            ref={scrollerRef}
            className="relative flex-1 px-6 py-6 space-y-4"
            // Chrome's scroll-latch pauses page scrolling for ~150ms when
            // the wheel hits a nested scroller's boundary. That's the
            // "stops me, then lets me scroll" feel user reported.
            //
            // Fix: explicit wheel handler. When the inner is at the
            // top/bottom edge AND the user is scrolling further in that
            // direction, we cancel the event and scroll the window
            // directly — no latch pause, completely seamless.
            style={{
              overflowY: hasMessages || sending ? "auto" : "visible",
              // "contain" stops the browser's default scroll-chaining (which
              // is what causes the macOS Chrome ~150ms latch pause when the
              // inner scroller hits its boundary). Our wheel handler then
              // manually forwards the delta to the page — instant, no latch.
              overscrollBehaviorY: "contain",
            }}
            onWheel={forwardWheelAtBoundary}
          >
            {loadingSession && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: CREAM }} />
              </div>
            )}
            {!loadingSession && !hasMessages && <ChatEmptyState />}
            {!loadingSession &&
              messages.map((m) => <ChatBubble key={m.id} message={m} />)}
            {sending && <ChatTyping />}
          </div>

          {/* Input — multi-line auto-grow textarea with image attachments.
              Images: drag-drop onto the input, paste from clipboard, or
              click the paperclip. Each upload writes to ~/.hermes/image_cache
              and the absolute path is prepended to the prompt so Hermes'
              vision model + file-read tool can pick it up. */}
          <div
            className="relative border-t p-3"
            style={{ borderColor: "rgba(255,230,203,0.2)" }}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer.types).includes("Files")) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                e.preventDefault();
                void handleFiles(e.dataTransfer.files);
              }
            }}
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a, i) => (
                  <div
                    key={a.path}
                    className="relative border group"
                    style={{
                      width: 56,
                      height: 56,
                      borderColor: "rgba(255,230,203,0.35)",
                      background: "rgba(0,0,0,0.4)",
                    }}
                    title={a.name}
                  >
                    <img
                      src={a.preview}
                      alt={a.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute -top-1.5 -right-1.5 hermes-mono inline-flex items-center justify-center text-[10px] transition-colors"
                      style={{
                        width: 16,
                        height: 16,
                        background: BG,
                        color: CREAM,
                        border: "1px solid rgba(255,230,203,0.55)",
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {uploading && (
                  <div
                    className="border flex items-center justify-center"
                    style={{
                      width: 56,
                      height: 56,
                      borderColor: "rgba(255,230,203,0.35)",
                      background: "rgba(0,0,0,0.4)",
                    }}
                  >
                    <Loader2
                      className="animate-spin"
                      style={{ width: 16, height: 16, color: CREAM }}
                    />
                  </div>
                )}
              </div>
            )}
            {/* Input row — borderless paperclip lives INSIDE the textarea
                well (left side, like Slack/Telegram); Send button is the
                same height as the textarea container, no fighting for
                visual weight. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {/* Three equal-height pills side by side. Paperclip is its
                own square button on the LEFT (no longer floating inside
                the textarea), textarea fills the middle, Send sits on
                the RIGHT with icon + label inline. Everything stretches
                via items-stretch + self-stretch so the heights line up
                perfectly regardless of how many rows the textarea has. */}
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="self-stretch inline-flex items-center justify-center transition-colors disabled:opacity-30 border shrink-0"
                style={{
                  width: 48,
                  background: "rgba(0,0,0,0.35)",
                  color: "rgba(255,230,203,0.7)",
                  borderColor: "rgba(255,230,203,0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = CREAM;
                  e.currentTarget.style.borderColor = CREAM;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,230,203,0.7)";
                  e.currentTarget.style.borderColor = "rgba(255,230,203,0.25)";
                }}
                title="Attach image (or drag-drop / paste)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const files: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.type.startsWith("image/")) {
                      const f = it.getAsFile();
                      if (f) files.push(f);
                    }
                  }
                  if (files.length > 0) {
                    e.preventDefault();
                    void handleFiles(files);
                  }
                }}
                placeholder={
                  activeSessionId
                    ? "Continue this conversation… (drop or paste an image)"
                    : "Ask Hermes anything… (drop or paste an image)"
                }
                rows={3}
                className="hermes-mono flex-1 resize-none px-4 py-3 text-[13px] focus:outline-none"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  color: CREAM,
                  border: "1px solid rgba(255,230,203,0.25)",
                  minHeight: 64,
                  maxHeight: 192,
                  lineHeight: "1.45",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,230,203,0.25)")
                }
              />
              <button
                onClick={() => void handleSend()}
                disabled={(!input.trim() && attachments.length === 0) || sending}
                className="hermes-mono self-stretch px-5 text-[12px] uppercase tracking-[0.18em] transition-all disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 border shrink-0"
                style={{
                  background: CREAM,
                  color: BG,
                  borderColor: CREAM,
                }}
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
            {!status.configured && (
              <div
                className="hermes-mono mt-2 text-[11px] flex items-center gap-1.5 uppercase tracking-wider"
                style={{ color: "#fbbf24" }}
              >
                <AlertTriangle className="h-3 w-3" />
                No config.yaml — run `hermes setup` first.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Drag-to-resize handle. 8px tall strip directly below the chat
          panel — grab anywhere on it to make the chat taller or shorter.
          Persists to localStorage. Cursor goes ns-resize on hover so the
          affordance is obvious. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat"
        onPointerDown={handleResizeStart}
        className="group flex items-center justify-center cursor-ns-resize select-none"
        style={{
          height: 12,
          // Negative margin pulls the handle's hit area visually into the
          // chat's bottom border so there's no gap-line on the page.
          marginTop: -1,
          touchAction: "none",
        }}
      >
        <div
          className="transition-colors"
          style={{
            width: 44,
            height: 3,
            background: "rgba(255,230,203,0.3)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = CREAM)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,230,203,0.3)")
          }
        />
      </div>
    </section>
  );
}

function ChatSidebar({
  activeSessionId,
  loadSession,
  startNewChat,
  loadingSession,
  expanded,
  onToggleExpanded,
}: {
  activeSessionId: string | null;
  loadSession: (id: string) => void;
  startNewChat: () => void;
  loadingSession: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { data } = useHermesSessions();
  const sessions = data?.sessions ?? [];

  // Two rendering modes:
  //   collapsed → 56px icon-rail with a "+" New Chat button at the top
  //               and one platform-badge per session beneath. Click the
  //               header chevron to expand.
  //   expanded  → full 240/288px thread list with the original layout.
  if (!expanded) {
    return (
      <div className="w-14 shrink-0 flex flex-col">
        {/* Rail header — chevron expands, "+" starts a new chat */}
        <div
          className="border-b flex flex-col items-center gap-2 py-3"
          style={{ borderColor: "rgba(255,230,203,0.2)" }}
        >
          <button
            type="button"
            onClick={onToggleExpanded}
            className="hermes-mono w-8 h-7 text-[12px] inline-flex items-center justify-center transition-colors"
            style={{ color: "rgba(255,230,203,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.6)")}
            title="Expand history"
          >
            ❯❯
          </button>
          <button
            type="button"
            onClick={startNewChat}
            disabled={loadingSession}
            className="hermes-mono w-9 h-9 text-[16px] border inline-flex items-center justify-center transition-colors disabled:opacity-30"
            style={{
              background: !activeSessionId ? CREAM : "transparent",
              color: !activeSessionId ? BG : CREAM,
              borderColor: CREAM,
            }}
            title="New chat"
          >
            +
          </button>
        </div>
        {/* Compact session list — each session gets a Pantheon avatar.
            Preferred lookup: the session's profile name (when Hermes saves
            it); falls back to a stable hash of the session id so legacy
            sessions get a consistent face too. A small platform glyph
            sits in the bottom-right corner so you can still tell CLI vs
            Telegram at a glance. */}
        <div
          className="flex-1 overflow-y-auto flex flex-col items-center py-2 gap-1.5"
          onWheel={forwardWheelAtBoundary}
        >
          {sessions.slice(0, 30).map((s) => {
            const isActive = activeSessionId === s.id;
            const profileSrc = avatarForProfile(s.profile);
            const avatarSrc = profileSrc ?? avatarForSessionId(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSession(s.id)}
                disabled={loadingSession}
                title={s.firstUserMessage || `Session ${s.id.slice(0, 8)}`}
                className="relative w-10 h-10 overflow-hidden transition-all disabled:opacity-50"
                style={{
                  border: isActive
                    ? `2px solid ${CREAM}`
                    : "1px solid rgba(255,230,203,0.25)",
                  boxShadow: isActive ? "0 0 12px rgba(255,210,30,0.35)" : "none",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.borderColor = "rgba(255,230,203,0.55)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.borderColor = "rgba(255,230,203,0.25)";
                }}
              >
                <img
                  src={avatarSrc}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{
                    filter: isActive ? "none" : "saturate(0.7) brightness(0.85)",
                  }}
                />
                {/* Platform glyph — tiny circle in the corner. Renders
                    only for non-CLI platforms (CLI is implied default;
                    cluttering every avatar with a generic ❯ was the
                    "looks awful" complaint). */}
                {s.platform && s.platform.toLowerCase() !== "cli" && (
                  <span
                    className="absolute bottom-0.5 right-0.5 inline-flex items-center justify-center rounded-full overflow-hidden"
                    style={{
                      width: 14,
                      height: 14,
                      background: BG,
                      border: "1px solid rgba(255,230,203,0.5)",
                    }}
                    title={s.platform}
                  >
                    <PlatformBadgeIcon platform={s.platform} size={9} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 lg:w-72 shrink-0 flex flex-col">
      {/* Sidebar header — collapse chevron + New Chat button */}
      <div
        className="px-3 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "rgba(255,230,203,0.2)" }}
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          className="hermes-mono h-9 px-2 text-[12px] inline-flex items-center justify-center transition-colors shrink-0"
          style={{ color: "rgba(255,230,203,0.6)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.6)")}
          title="Collapse history"
        >
          ❮❮
        </button>
        <button
          type="button"
          onClick={startNewChat}
          disabled={loadingSession}
          className="hermes-mono flex-1 px-3 py-2 text-[11px] uppercase tracking-[0.22em] border transition-colors disabled:opacity-30 inline-flex items-center justify-center gap-2"
          style={{
            background: !activeSessionId ? CREAM : "transparent",
            color: !activeSessionId ? BG : CREAM,
            borderColor: CREAM,
          }}
        >
          + New Chat
        </button>
      </div>
      {/* Session list */}
      <div className="flex-1 overflow-y-auto" onWheel={forwardWheelAtBoundary}>
        {sessions.length === 0 && (
          <div
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] p-4 text-center"
            style={{ color: "rgba(255,230,203,0.5)" }}
          >
            No threads yet
          </div>
        )}
        {sessions.map((s) => (
          <SessionPill
            key={s.id}
            session={s}
            active={activeSessionId === s.id}
            disabled={loadingSession}
            onSelect={() => loadSession(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SessionPill({
  session,
  active,
  disabled,
  onSelect,
}: {
  session: HermesSession;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const when = session.lastUpdated || session.startedAt;
  const ago = when
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(when).getTime()) / 60_000);
        if (mins < 1) return "now";
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
      })()
    : "—";
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="w-full text-left px-3 py-2.5 transition-colors border-b disabled:opacity-50"
      style={{
        background: active ? "rgba(255,230,203,0.1)" : "transparent",
        borderColor: "rgba(255,230,203,0.1)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,230,203,0.05)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <PlatformBadge platform={session.platform} />
        <div
          className="hermes-mono text-[9.5px] uppercase tracking-[0.18em] ml-auto"
          style={{ color: "rgba(255,230,203,0.5)" }}
        >
          {ago}
        </div>
      </div>
      <div
        className="text-[12.5px] leading-snug line-clamp-2"
        style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
      >
        {session.firstUserMessage || `Session ${session.id.slice(0, 8)}`}
      </div>
      <div
        className="hermes-mono text-[9.5px] uppercase tracking-[0.18em] mt-1 truncate"
        style={{ color: "rgba(255,230,203,0.45)" }}
      >
        {session.messageCount} msg · {session.model ?? "—"}
      </div>
    </button>
  );
}

function ChatEmptyState() {
  // The pixel HERMES-AGENT mark lives DEAD CENTER of the chat panel
  // (vertical + horizontal) as the identity for the conversation surface.
  // The labyrinth texture behind it gives the area a paper-engraving feel.
  //
  // No min-height — the empty state must respect the parent's available
  // space. A min-height larger than (chatHeight - header - input) shoves
  // the input bar off the bottom of the panel and into the section below.
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5">
      <img
        src={hermesLogo}
        alt="Hermes Agent"
        className="h-12 md:h-16 lg:h-20 object-contain"
        style={{ filter: "drop-shadow(0 0 60px rgba(255,210,30,0.45))" }}
      />
      <div
        className="hermes-mono text-[11px] uppercase tracking-[0.28em]"
        style={{ color: "rgba(255,230,203,0.55)" }}
      >
        ❯ Start a new conversation
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3">
        <div
          className="max-w-[78%] px-4 py-3 text-[13.5px] leading-relaxed border hermes-mono"
          style={{ background: CREAM, color: BG, borderColor: CREAM }}
        >
          {message.content}
        </div>
        <UserAvatar />
      </div>
    );
  }
  // Hermes (assistant) message. Reverted to max-w-[78%] WITHOUT flex-1
  // so the bubble sizes to its content — short messages don't get
  // stretched to full-width with empty space inside. Bubble background
  // stays the darker teal wash so cream text reads clearly on the
  // textured page.
  return (
    <div className="flex justify-start items-start gap-3">
      <HermesAvatar />
      <div
        className="max-w-[78%] px-4 py-3 text-[13.5px] leading-relaxed border whitespace-pre-wrap"
        style={{
          background: "rgba(7,29,28,0.78)",
          color: CREAM,
          borderColor: "rgba(255,230,203,0.32)",
          fontFamily: '"Fraunces", serif',
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      >
        {message.content || <span style={{ opacity: 0.5 }}>…</span>}
      </div>
    </div>
  );
}

// Storage key co-owned with the sidebar's SidebarIdentity. Update one,
// the other refetches via the storage event the wizard fires.
const OPERATOR_AVATAR_KEY = "claude-os.avatar.v1";

function UserAvatar() {
  // Operator's actual avatar from settings — same source the sidebar uses.
  // If unset (the user never finished the wizard), we render a cream-
  // bordered initial-letter square that matches the page brand.
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setAvatar(window.localStorage.getItem(OPERATOR_AVATAR_KEY));
    } catch {
      /* localStorage disabled */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === OPERATOR_AVATAR_KEY || e.key === null) {
        try {
          setAvatar(window.localStorage.getItem(OPERATOR_AVATAR_KEY));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <div
      className="shrink-0 mt-0.5 overflow-hidden border"
      style={{
        width: 44,
        height: 44,
        borderColor: "rgba(255,230,203,0.5)",
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt="You"
          className="block object-cover"
          style={{ width: "100%", height: "100%" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="hermes-display flex items-center justify-center w-full h-full"
          style={{ color: CREAM, background: "rgba(255,230,203,0.06)", fontSize: 20 }}
        >
          Y
        </div>
      )}
    </div>
  );
}

function HermesAvatar() {
  // Hermes' actual portrait — duotone teal illustration on a cream field.
  // The image already has its own thin border; we hug it with a 1px cream
  // ring + a subtle amber glow so it reads as a character avatar on the
  // dark page. Full-bleed image fill, no padding.
  return (
    <div
      className="shrink-0 mt-0.5 overflow-hidden border"
      style={{
        width: 44,
        height: 44,
        borderColor: "rgba(255,230,203,0.5)",
        boxShadow: "0 0 18px rgba(255, 210, 30, 0.18)",
      }}
    >
      <img
        src={hermesPortrait}
        alt="Hermes"
        className="block object-cover"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

function ChatTyping() {
  return (
    <div className="flex justify-start items-start gap-3">
      <HermesAvatar />
      <div
        className="px-4 py-3 border flex items-center gap-1.5"
        style={{
          borderColor: "rgba(255,230,203,0.25)",
          background: "rgba(255,230,203,0.04)",
        }}
      >
        <span className="h-1.5 w-1.5 rounded-none animate-pulse" style={{ background: CREAM }} />
        <span
          className="h-1.5 w-1.5 rounded-none animate-pulse"
          style={{ background: CREAM, animationDelay: "0.15s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-none animate-pulse"
          style={{ background: CREAM, animationDelay: "0.3s" }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Setup wizard — mirrors `hermes setup model` (provider → auth → model → save)
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Stats — modeled on the Hermes Agent feature surface (Nous Research, MIT)
// ────────────────────────────────────────────────────────────────────────────

function HermesStatsSection() {
  // Recent Sessions intentionally omitted — the chat sidebar already
  // surfaces every session with full-fidelity click-to-open behaviour.
  return (
    <>
      <HermesLiveStats />
      <HermesProfileTemplates />
      <HermesPantheonGitHubSync />
      {/* Memory section now houses the Claude OS Bridge card too —
          paired with the Obsidian bridge inside HermesMemorySection. */}
      <HermesMemorySection />
      <HermesLiveSkills />
      <HermesDocumentsGallery />
      <HermesCliCheatsheet />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pantheon — the 10 Kie.ai generated Greek-mythology pieces in Hermes' style.
// Pure visual section. Hover lifts each card; the card label tells the story.
// Imports for the 10 PNGs are at the top of the file (ESM rules).
// ────────────────────────────────────────────────────────────────────────────

// Pantheon-as-Personas (Hermes' YAML schema). Each persona lives on disk
// at ~/.hermes/pantheon/personas/<id>.yaml and is rendered via useHermesPantheon().
// This array stays only as the avatar-lookup table (id → bundled PNG) and
// as a client-side mirror of the seed data so the UI has something to show
// before the user runs "Install Pantheon" (which writes them to disk).
const _LEGACY_PROFILE_TEMPLATES_FOR_REFERENCE_ONLY: Array<{
  name: string;
  title: string;
  src: string;
  pitch: string;
  model: string;
  personality: string;
  skills: string[];
}> = [
  {
    name: "messenger",
    title: "Messenger",
    src: pantheon01,
    pitch: "Daily chat across Telegram, iMessage, email. Light, conversational, fast.",
    model: "gpt-5.5",
    personality: "concise",
    skills: ["apple", "email", "gateway"],
  },
  {
    name: "oracle",
    title: "Oracle",
    src: pantheon02,
    pitch: "Long-term memory & lookup. Reads SOUL.md and the kanban, answers what-do-I-know questions.",
    model: "claude-opus-4",
    personality: "helpful",
    skills: ["memory", "domain", "dogfood"],
  },
  {
    name: "athena",
    title: "Athena",
    src: pantheon03,
    pitch: "Code review, refactors, PR triage. Reads diffs, runs tests, files clean changes.",
    model: "claude-sonnet-4",
    personality: "technical",
    skills: ["github", "devops", "autonomous-ai-agents"],
  },
  {
    name: "scribe",
    title: "Scribe",
    src: pantheon04,
    pitch: "Writes: long-form prose, docs, social posts, scripts. Fraunces-grade output.",
    model: "gpt-5.5",
    personality: "creative",
    skills: ["creative", "domain"],
  },
  {
    name: "orpheus",
    title: "Orpheus",
    src: pantheon05,
    pitch: "Media generation. Image, video, audio, design. Talks to Kie/Runway/ElevenLabs.",
    model: "claude-opus-4",
    personality: "creative",
    skills: ["creative", "media", "gifs"],
  },
  {
    name: "labyrinth",
    title: "Labyrinth",
    src: pantheon06,
    pitch: "Deep research & planning loops. Long-running, autonomous, will keep going overnight.",
    model: "gpt-5.5",
    personality: "technical",
    skills: ["data-science", "autonomous-ai-agents"],
  },
  {
    name: "alchemist",
    title: "Alchemist",
    src: pantheon07,
    pitch: "MCP & tool tinkering. Spins up servers, wires integrations, runs experiments.",
    model: "claude-sonnet-4",
    personality: "technical",
    skills: ["mcp", "devops", "inference-sh"],
  },
  {
    name: "philosopher",
    title: "Philosopher",
    src: pantheon08,
    pitch: "Reasoning at depth. Wrestles with ambiguous problems, teaches what it learned.",
    model: "claude-opus-4",
    personality: "teacher",
    skills: ["domain"],
  },
  {
    name: "mapmaker",
    title: "Mapmaker",
    src: pantheon09,
    pitch: "Charts what is — architecture diagrams, codebase maps, system docs.",
    model: "gpt-5.5",
    personality: "technical",
    skills: ["diagramming", "github"],
  },
  {
    name: "mercury",
    title: "Mercury",
    src: pantheon10,
    pitch: "The autopilot. Cron jobs, webhooks, scheduled tasks, background sentinels.",
    model: "gpt-5.5",
    personality: "concise",
    skills: ["gateway", "autonomous-ai-agents"],
  },
];

// Avatar lookup: persona id → bundled Pantheon PNG. Same map drives the
// catalog cards, the collapsed session sidebar, and chat-bubble avatars.
const PERSONA_AVATAR_BY_ID: Record<string, string> = {
  messenger: pantheon01,
  oracle: pantheon02,
  athena: pantheon03,
  scribe: pantheon04,
  orpheus: pantheon05,
  labyrinth: pantheon06,
  alchemist: pantheon07,
  philosopher: pantheon08,
  mapmaker: pantheon09,
  mercury: pantheon10,
};

function avatarForProfile(profileName: string | null | undefined): string | null {
  if (!profileName) return null;
  return PERSONA_AVATAR_BY_ID[profileName.toLowerCase()] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Pantheon catalog — reads ~/.hermes/pantheon/personas/*.yaml via the
// /__hermes_pantheon endpoint and renders one card per persona. When the
// disk dir is empty we show a "Install Pantheon" CTA that POSTs the 10
// seed YAMLs (idempotent, skips existing).
// ────────────────────────────────────────────────────────────────────────────
function HermesProfileTemplates() {
  const { data, refetch, isFetching } = useHermesPantheon();
  const personas = data?.personas ?? [];
  const installed = data?.installed ?? false;
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  async function handleInstall() {
    setInstalling(true);
    setInstallError(null);
    try {
      await installPantheon();
      await refetch();
    } catch (err: any) {
      setInstallError(err?.message ?? "install failed");
    } finally {
      setInstalling(false);
    }
  }

  // Empty state: dir missing OR no YAMLs found. Surface a single CTA.
  if (!isFetching && personas.length === 0) {
    return (
      <section className="mb-12">
        <SectionHead title="Pantheon" meta="10 personas · not yet installed" />
        <div
          className="text-[13px] leading-relaxed mt-3 mb-5 max-w-3xl"
          style={{ color: "rgba(255,230,203,0.7)", fontFamily: '"Fraunces", serif' }}
        >
          Each Pantheon piece is a curated persona — its own model, system prompt, skill bundle and
          summon phrases. Install them once and they live at{" "}
          <span className="hermes-mono" style={{ color: CREAM, fontSize: "12px" }}>
            ~/.hermes/pantheon/personas/
          </span>{" "}
          as YAML files you can edit, version, or push to GitHub.
        </div>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="hermes-mono px-4 py-2 border text-[12px] uppercase tracking-[0.22em] transition-colors disabled:opacity-50"
          style={{
            background: CREAM,
            color: BG,
            borderColor: CREAM,
          }}
        >
          {installing ? "Installing…" : "+ Install Pantheon"}
        </button>
        {installError && (
          <div
            className="hermes-mono mt-2 text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "#fbbf24" }}
          >
            {installError}
          </div>
        )}
        {!installed && (
          <div
            className="hermes-mono mt-2 text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: "rgba(255,230,203,0.5)" }}
          >
            Dir will be created if missing
          </div>
        )}
      </section>
    );
  }

  return <PantheonCatalog personas={personas} />;
}

// Pantheon catalog. Shows 3 featured personas + a "+ Add" tile by default
// so the page doesn't feel overwhelmed. Expand to see all 10.
function PantheonCatalog({ personas }: { personas: PersonaYaml[] }) {
  const { data: syncData } = useHermesPantheonSync();
  const statuses = syncData?.statuses ?? {};
  const hasRepo = syncData?.hasRepo ?? false;

  // Order: the 3 default seeds first (Labyrinth, Mercury, Philosopher),
  // then any user-added personas in the order they appear on disk. ALL
  // personas are always visible — adding Orpheus shouldn't hide him
  // behind a "show more" toggle. The grid scales to N cards.
  const FEATURED_IDS = ["labyrinth", "mercury", "philosopher"];
  const featuredFirst = FEATURED_IDS
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as PersonaYaml[];
  const rest = personas.filter((p) => !featuredFirst.includes(p));
  const visible = [...featuredFirst, ...rest];

  return (
    <section id="pillar-pantheon" className="mb-12 scroll-mt-24">
      <SectionHead
        title="Pantheon"
        meta={`${personas.length} persona${personas.length === 1 ? "" : "s"} on disk`}
      />
      <div
        className="text-[14px] leading-relaxed mt-3 mb-5 max-w-3xl"
        style={{ color: "rgba(255,230,203,0.82)", fontFamily: '"Fraunces", serif' }}
      >
        Custom AI personas — each one a bundle of <span style={{ color: CREAM }}>instructions</span>,
        a <span style={{ color: CREAM }}>model</span>, and a <span style={{ color: CREAM }}>toolset</span>.
        Set them up here, summon them in chat when you need specific expertise — say{" "}
        <span className="hermes-mono" style={{ color: CREAM, fontSize: "12.5px" }}>
          "Labyrinth, run a deep dive"
        </span>{" "}
        and Hermes spins up that persona for the turn. 100% customisable: click any card to
        retune.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map((p) => (
          <PersonaCard
            key={p.id}
            persona={p}
            syncStatus={statuses[p.id]}
            hasRepo={hasRepo}
          />
        ))}
        <AddPersonaTile existingIds={personas.map((p) => p.id)} />
      </div>
    </section>
  );
}

interface PersonaTemplate {
  id: string;
  name: string;
  job: string;
  description: string;
  defaultModel: { provider: string; name: string };
}

function useHermesPantheonTemplates() {
  const demo = useDemoMode();
  return useQuery<{ templates: PersonaTemplate[] }>({
    queryKey: ["hermes-pantheon-templates", demo],
    queryFn: async () => {
      if (demo) {
        // In demo we offer the personas NOT already installed as
        // candidates the wizard can spin up.
        const installed = new Set(DEMO_PERSONAS.map((p) => p.id));
        const allTemplates: PersonaTemplate[] = [
          { id: "oracle", name: "Oracle", job: "Memory & lookup", description: "Long-term memory and lookup", defaultModel: { provider: "anthropic", name: "claude-sonnet-4.5" } },
          { id: "athena", name: "Athena", job: "Code review & refactors", description: "Code review and refactors", defaultModel: { provider: "anthropic", name: "claude-opus-4.7" } },
          { id: "scribe", name: "Scribe", job: "Long-form writing", description: "Long-form prose and docs", defaultModel: { provider: "anthropic", name: "claude-opus-4.7" } },
          { id: "orpheus", name: "Orpheus", job: "Media generation", description: "Image, video, audio gen", defaultModel: { provider: "anthropic", name: "claude-opus-4.7" } },
          { id: "alchemist", name: "Alchemist", job: "Integrations & MCP", description: "MCP servers and tool tinkering", defaultModel: { provider: "anthropic", name: "claude-sonnet-4.5" } },
          { id: "mapmaker", name: "Mapmaker", job: "Diagrams & system docs", description: "Architecture diagrams and docs", defaultModel: { provider: "openai", name: "gpt-5.5" } },
        ];
        return { templates: allTemplates.filter((t) => !installed.has(t.id)) };
      }
      const res = await fetch("/__hermes_pantheon_templates");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

// Add Persona — the tile flips between a "+" affordance and an inline
// wizard with three dropdowns (template / job / model). Save writes the
// YAML via POST /__hermes_pantheon/create.
function AddPersonaTile({ existingIds }: { existingIds: string[] }) {
  const queryClient = useQueryClient();
  const { data: templatesData } = useHermesPantheonTemplates();
  const { data: modelsData } = useHermesModels();
  const templates = templatesData?.templates ?? [];
  const available = templates.filter((t) => !existingIds.includes(t.id));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PersonaTemplate | null>(null);
  const [job, setJob] = useState("");
  const [description, setDescription] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [modelOverride, setModelOverride] = useState<{
    provider: string;
    name: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // When the user picks a template, prefill model only (job + description
  // stay blank so the user can write their own — no prescriptive label).
  useEffect(() => {
    if (!picked) return;
    setModelOverride(picked.defaultModel);
  }, [picked]);

  function randomize() {
    if (available.length === 0) return;
    const t = available[Math.floor(Math.random() * available.length)];
    setPicked(t);
  }

  async function handleSave() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      const t = await fetch("/__token").then((r) => r.json());
      const res = await fetch("/__hermes_pantheon/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Claude-OS-Token": t.token,
        },
        body: JSON.stringify({
          templateId: picked.id,
          job: job || picked.job,
          // description goes into the YAML as `description`. Currently the
          // /create endpoint accepts an override on top of the template's
          // fields, so we send it alongside job.
          description: description || undefined,
          prompt: promptDraft || undefined,
          model: modelOverride,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `create failed: ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon"] });
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon-sync"] });
      setOpen(false);
      setPicked(null);
      setJob("");
      setDescription("");
    } catch (err: any) {
      setError(err?.message ?? "create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={available.length === 0}
        className="group border flex flex-col items-center justify-center gap-3 p-4 transition-colors min-h-[420px] disabled:opacity-40"
        style={{
          borderColor: "rgba(255,230,203,0.35)",
          background: "rgba(0,0,0,0.22)",
          borderStyle: "dashed",
        }}
        onMouseEnter={(e) => {
          if (available.length > 0) e.currentTarget.style.borderColor = CREAM;
        }}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.35)")}
        title={
          available.length === 0
            ? "All template personas already installed"
            : `Add a persona (${available.length} template${available.length === 1 ? "" : "s"} available)`
        }
      >
        <div
          className="hermes-display"
          style={{
            color: CREAM,
            fontSize: 64,
            lineHeight: 1,
            textShadow: "0 0 22px rgba(255,210,30,0.25)",
          }}
        >
          +
        </div>
        <div
          className="hermes-mono text-[11px] uppercase tracking-[0.24em] text-center"
          style={{ color: "rgba(255,230,203,0.75)" }}
        >
          Add Persona
        </div>
        <div
          className="text-[11.5px] leading-snug text-center max-w-[18ch]"
          style={{ color: "rgba(255,230,203,0.55)", fontFamily: '"Fraunces", serif' }}
        >
          {available.length === 0
            ? "All templates already installed"
            : "Pick a template, set the job and model"}
        </div>
      </button>
    );
  }

  // Visual picker: 6 image thumbnails (the unused templates), a name/job
  // text field, a description textarea, and a model dropdown. The image
  // IS the picker — no prescriptive "Memory & lookup" labels in a select.
  return (
    <div
      className="border flex flex-col p-4 gap-3.5 min-h-[420px]"
      style={{
        borderColor: CREAM,
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <h3
          className="hermes-display uppercase leading-none"
          style={{ color: CREAM, fontSize: "16px", letterSpacing: "0.04em" }}
        >
          New Persona
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={randomize}
            disabled={available.length === 0}
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] transition-colors disabled:opacity-30"
            style={{ color: "#FFD21E" }}
            title="Pick a random unused template"
          >
            ⟲ Randomize
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPicked(null);
              setError(null);
              setJob("");
              setDescription("");
            }}
            className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "rgba(255,230,203,0.6)" }}
          >
            cancel
          </button>
        </div>
      </div>

      {/* Image picker — visual grid of unused persona avatars. The image
          IS the choice; no descriptive label competing for attention. */}
      <div className="flex flex-col gap-1.5">
        <span
          className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
          style={{ color: "rgba(255,230,203,0.6)" }}
        >
          Pick an avatar
        </span>
        <div className="grid grid-cols-3 gap-2">
          {available.map((t) => {
            const isPicked = picked?.id === t.id;
            const avatar = PERSONA_AVATAR_BY_ID[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicked(t)}
                className="relative aspect-square border overflow-hidden transition-all"
                style={{
                  borderColor: isPicked ? CREAM : "rgba(255,230,203,0.3)",
                  background: "rgba(0,0,0,0.35)",
                  boxShadow: isPicked ? "0 0 12px rgba(255,230,203,0.35)" : undefined,
                  outline: "none",
                }}
                title={t.name}
              >
                {avatar && (
                  <img
                    src={avatar}
                    alt={t.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      transform: "scale(1.08)",
                      opacity: isPicked ? 1 : 0.75,
                    }}
                  />
                )}
                <div
                  className="absolute inset-x-0 bottom-0 px-1.5 py-1 hermes-mono text-[9px] uppercase tracking-[0.18em] text-center"
                  style={{
                    color: isPicked ? CREAM : "rgba(255,230,203,0.8)",
                    background:
                      "linear-gradient(180deg, rgba(7,29,28,0) 0%, rgba(7,29,28,0.9) 100%)",
                  }}
                >
                  {t.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {picked && (
        <>
          {/* Job — 6-7 words, what this persona does */}
          <label className="flex flex-col gap-1">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Job · in 6–7 words
            </span>
            <input
              value={job}
              onChange={(e) => setJob(e.target.value)}
              maxLength={60}
              placeholder="e.g. Reviews my PRs and runs the tests"
              className="text-[13.5px] px-3 py-2 border focus:outline-none"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                fontFamily: '"Fraunces", serif',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
          </label>

          {/* Description — multi-line free text */}
          <label className="flex flex-col gap-1">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A few lines on what this persona is for and when to summon it. Optional."
              className="text-[13px] px-3 py-2 border focus:outline-none resize-none"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                fontFamily: '"Fraunces", serif',
                lineHeight: 1.5,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
          </label>

          {/* System prompt — the instructions the persona runs under.
              Optional in the wizard; leave blank to inherit the template's
              built-in prompt. */}
          <label className="flex flex-col gap-1">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              System prompt · optional
            </span>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={10}
              maxLength={20000}
              placeholder="You are [Name]. You handle …  Leave blank to use the template default."
              className="hermes-mono text-[12px] px-3 py-2 border focus:outline-none resize-y"
              style={{
                background: "rgba(0,0,0,0.6)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                lineHeight: 1.55,
                minHeight: "200px",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
            <span
              className="hermes-mono text-[9.5px] tracking-[0.12em]"
              style={{ color: "rgba(255,230,203,0.4)" }}
            >
              {promptDraft.length} / 20000
            </span>
          </label>

          {/* Model */}
          <label className="flex flex-col gap-1 relative">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Model
            </span>
            <button
              type="button"
              onClick={() => setModelDropdownOpen((v) => !v)}
              className="hermes-mono text-[12px] px-3 py-2 border inline-flex items-center gap-2 text-left"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: CREAM,
                borderColor: modelDropdownOpen ? CREAM : "rgba(255,230,203,0.4)",
              }}
            >
              <ProviderLogoChip provider={modelOverride?.provider ?? null} size={16} />
              <span className="truncate flex-1">
                {modelOverride
                  ? modelOverride.name.length > 32
                    ? modelOverride.name.split("/").pop()?.replace(":free", " · free")
                    : modelOverride.name
                  : "— pick a model —"}
              </span>
              <span style={{ color: "rgba(255,230,203,0.55)" }}>▾</span>
            </button>
            {modelDropdownOpen && modelsData && (
              <ModelDropdown
                catalog={modelsData.catalog}
                current={
                  modelOverride ?? {
                    provider: picked.defaultModel.provider,
                    name: picked.defaultModel.name,
                  }
                }
                onPick={(p, n) => {
                  setModelOverride({ provider: p, name: n });
                  setModelDropdownOpen(false);
                }}
                onClose={() => setModelDropdownOpen(false)}
              />
            )}
          </label>

          {error && (
            <div
              className="hermes-mono text-[10.5px] uppercase tracking-[0.18em]"
              style={{ color: "#fbbf24" }}
            >
              {error}
            </div>
          )}

          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !picked || !modelOverride}
            className="hermes-mono px-3 py-2.5 border text-[11px] uppercase tracking-[0.22em] transition-colors disabled:opacity-40"
            style={{
              background: CREAM,
              color: BG,
              borderColor: CREAM,
            }}
          >
            {saving ? "Saving…" : `Create ${picked.name}`}
          </button>
        </>
      )}
    </div>
  );
}

// Persona card. Shows just three fields (name / job / model) — every other
// piece of the YAML schema (skills, tools, system_prompt, summon_phrases)
// stays under the hood and is only edited via Claude Code prompts.
//
// Inline edit:
//   • Click the JOB text → text input replaces it; Enter saves
//   • Click the MODEL chip → dropdown overlay; pick saves
//   • Name is NOT inline-editable here — the id drives Hermes' routing,
//     so renaming is a separate "Rename" prompt for Claude Code.
//
// Sync badge sits top-right of the image: synced (green) / local edits
// (amber) / not synced (grey). Refetches when the YAML is updated.
function PersonaCard({
  persona,
  syncStatus,
  hasRepo,
}: {
  persona: PersonaYaml;
  syncStatus: SyncStatus | undefined;
  hasRepo: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const avatar = PERSONA_AVATAR_BY_ID[persona.id.toLowerCase()];
  const jobLabel = personaJob(persona);
  // Read active persona from URL so this card knows whether to render its
  // "ACTIVE" state. Same poll pattern as HermesChatActive — TanStack Router
  // doesn't fire popstate when search changes, so we tick every 250ms.
  const [activePersonaId, setActivePersonaId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("persona");
    return p && /^[a-z0-9_-]{1,32}$/.test(p) ? p : null;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const sp = new URLSearchParams(window.location.search);
      const p = sp.get("persona");
      const next = p && /^[a-z0-9_-]{1,32}$/.test(p) ? p : null;
      setActivePersonaId((prev) => (prev === next ? prev : next));
    };
    read();
    const iv = window.setInterval(read, 250);
    window.addEventListener("popstate", read);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("popstate", read);
    };
  }, []);
  const isActive = activePersonaId === persona.id;
  function activate(e: React.MouseEvent) {
    // Stop bubbling so the surrounding card button doesn't open the edit modal.
    e.stopPropagation();
    e.preventDefault();
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("persona", persona.id);
    window.history.pushState({}, "", url.toString());
    // Notify the chat panel (same poll picks it up within 250ms, but a
    // synthetic popstate makes it instant).
    window.dispatchEvent(new PopStateEvent("popstate"));
    // Scroll to chat area so the user sees the persona-flipped header.
    const chatEl = document.querySelector("[data-hermes-chat-anchor]");
    if (chatEl && typeof (chatEl as HTMLElement).scrollIntoView === "function") {
      (chatEl as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group relative border overflow-hidden flex flex-col transition-all text-left w-full"
        style={{
          borderColor: isActive ? CREAM : "rgba(255,230,203,0.4)",
          background: "rgba(0,0,0,0.32)",
          boxShadow: isActive
            ? "0 0 0 1px rgba(255,230,203,0.55), 0 0 24px rgba(255,230,203,0.18)"
            : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderColor = "rgba(255,230,203,0.85)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)";
          }
        }}
        title={`Edit ${persona.name}`}
      >
        <div className="aspect-square relative overflow-hidden">
          {avatar ? (
            <img
              src={avatar}
              alt={persona.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ transform: "scale(1.08)" }}
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(255,230,203,0.06)" }}
            >
              <span className="hermes-display" style={{ color: CREAM, fontSize: 64 }}>
                {persona.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-2 pointer-events-none"
            style={{ border: "1px solid rgba(255,230,203,0.45)" }}
          />
          <SyncBadge status={syncStatus} hasRepo={hasRepo} />
          {/* "ACTIVE" badge — top-left, only shown when this persona is the
              one currently driving chat. Persists (not hover-gated) so the
              status is always visible at a glance. */}
          {isActive && (
            <span
              className="hermes-mono absolute top-2 left-2 inline-flex items-center px-2 py-1 border text-[9.5px] uppercase tracking-[0.22em]"
              style={{
                background: "rgba(7,29,28,0.92)",
                color: CREAM,
                borderColor: CREAM,
              }}
            >
              ● Active
            </span>
          )}
          {/* "Activate" pill — bottom-left. Mirrors the Edit pill on the
              right. Click flips the persona for chat without opening the
              edit modal (e.stopPropagation in handler). */}
          <span
            role="button"
            tabIndex={0}
            onClick={activate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") activate(e as any);
            }}
            className="hermes-mono absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-1 border text-[9.5px] uppercase tracking-[0.22em] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{
              background: isActive ? "rgba(255,230,203,0.92)" : "rgba(7,29,28,0.92)",
              color: isActive ? "#071D1C" : CREAM,
              borderColor: CREAM,
              opacity: isActive ? 1 : undefined,
            }}
            title={isActive ? `${persona.name} is the active chat persona` : `Use ${persona.name} for the next chat turn`}
          >
            <Zap style={{ width: 10, height: 10 }} />
            {isActive ? "Active" : "Activate"}
          </span>
          {/* "Edit" pill that fades in on hover so it's obvious the card
              is interactive. */}
          <span
            className="hermes-mono absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 border text-[9.5px] uppercase tracking-[0.22em] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: "rgba(7,29,28,0.92)",
              color: CREAM,
              borderColor: CREAM,
            }}
          >
            <PenLine style={{ width: 10, height: 10 }} />
            Edit
          </span>
        </div>

        <div className="p-4 flex flex-col gap-1.5">
          <h3
            className="hermes-display uppercase leading-none truncate"
            style={{ color: CREAM, fontSize: "20px", letterSpacing: "0.04em" }}
          >
            {persona.name}
          </h3>
          <p
            className="text-[13.5px] leading-snug line-clamp-2"
            style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
          >
            {jobLabel}
          </p>
          <span
            className="hermes-mono text-[10px] uppercase tracking-[0.18em] pl-1 pr-1.5 py-1 border inline-flex items-center gap-1.5 mt-1 self-start"
            style={{
              color: CREAM,
              borderColor: "rgba(255,230,203,0.4)",
              background: "rgba(255,230,203,0.06)",
            }}
          >
            <ProviderLogoChip provider={persona.model.provider} size={16} />
            <span className="truncate max-w-[180px]">
              {persona.model.name.length > 24
                ? persona.model.name.split("/").pop()?.replace(":free", " · free")
                : persona.model.name}
            </span>
          </span>
        </div>
      </button>
      {editing && (
        <PersonaEditModal persona={persona} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

// Full-screen modal for editing a persona — name (read-only), job (multi-
// line textarea), model (big rich dropdown), summon phrase (copy), and a
// Delete button (with confirm). All edits PUT to disk immediately; the
// dashboard refetches.
function PersonaEditModal({
  persona,
  onClose,
}: {
  persona: PersonaYaml;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: models } = useHermesModels();
  const [jobDraft, setJobDraft] = useState(personaJob(persona));
  const [descriptionDraft, setDescriptionDraft] = useState(persona.description ?? "");
  const [promptDraft, setPromptDraft] = useState(
    persona.behavior?.system_prompt ?? "",
  );
  const [model, setModel] = useState(persona.model);
  const [modelOpen, setModelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const avatar = PERSONA_AVATAR_BY_ID[persona.id.toLowerCase()];
  const primaryPhrase = persona.summon_phrases?.[0] ?? persona.name;
  const originalPrompt = persona.behavior?.system_prompt ?? "";
  const dirty =
    jobDraft !== personaJob(persona) ||
    descriptionDraft !== (persona.description ?? "") ||
    promptDraft !== originalPrompt ||
    model.name !== persona.model.name ||
    model.provider !== persona.model.provider;

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      // Patch: only send fields that actually changed so we don't blow
      // away unrelated YAML keys (skills, tools, summon_phrases).
      const patch: any = {};
      if (jobDraft.trim() !== personaJob(persona)) patch.job = jobDraft.trim();
      if (descriptionDraft.trim() !== (persona.description ?? "").trim()) {
        patch.description = descriptionDraft.trim();
      }
      if (promptDraft.trim() !== originalPrompt.trim()) {
        patch.behavior = { system_prompt: promptDraft.trim() };
      }
      if (
        model.name !== persona.model.name ||
        model.provider !== persona.model.provider
      ) {
        patch.model = model;
      }
      await updatePersona(persona.id, patch);
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon"] });
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon-sync"] });
      onClose();
    } catch {
      /* keep open */
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const t = await fetch("/__token").then((r) => r.json());
      await fetch(`/__hermes_pantheon/${encodeURIComponent(persona.id)}`, {
        method: "DELETE",
        headers: { "X-Claude-OS-Token": t.token },
      });
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon"] });
      await queryClient.invalidateQueries({ queryKey: ["hermes-pantheon-sync"] });
      onClose();
    } catch {
      /* */
    } finally {
      setSaving(false);
    }
  }

  function copyPhrase() {
    void copyToClipboard(primaryPhrase).then(() => {
      setCopiedPhrase(true);
      setTimeout(() => setCopiedPhrase(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="border max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        style={{
          borderColor: "rgba(255,230,203,0.55)",
          background: BG,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* LEFT — big square portrait. */}
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: 240, minHeight: 240 }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={persona.name}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scale(1.08)" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(255,230,203,0.06)" }}
            >
              <span className="hermes-display" style={{ color: CREAM, fontSize: 80 }}>
                {persona.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-3 pointer-events-none"
            style={{ border: "1px solid rgba(255,230,203,0.5)" }}
          />
        </div>

        {/* RIGHT — fields. */}
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,230,203,0.5)" }}
              >
                Persona · {persona.id}
              </div>
              <h2
                className="hermes-display uppercase leading-none mt-1"
                style={{ color: CREAM, fontSize: 28, letterSpacing: "0.03em" }}
              >
                {persona.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hermes-mono text-[11px] uppercase tracking-[0.22em] transition-colors"
              style={{ color: "rgba(255,230,203,0.6)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.6)")}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Job */}
          <label className="flex flex-col gap-1.5">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Job — what should this persona do?
            </span>
            <input
              value={jobDraft}
              onChange={(e) => setJobDraft(e.target.value)}
              maxLength={60}
              placeholder="In 6 or 7 words"
              className="text-[13.5px] px-3 py-2 border focus:outline-none"
              style={{
                background: "rgba(0,0,0,0.45)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                fontFamily: '"Fraunces", serif',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
          </label>

          {/* Description — multi-line, what the persona is for and when
              to use it. 4-5 lines is the sweet spot. */}
          <label className="flex flex-col gap-1.5">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Description
            </span>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="A few lines on what this persona is for and when to summon it."
              className="text-[13px] px-3 py-2 border focus:outline-none resize-none"
              style={{
                background: "rgba(0,0,0,0.45)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                fontFamily: '"Fraunces", serif',
                lineHeight: 1.5,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
          </label>

          {/* System prompt — the actual instructions Hermes loads when
              the persona is summoned. This is where the behaviour lives. */}
          <label className="flex flex-col gap-1.5">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              System prompt — how the persona behaves
            </span>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={14}
              maxLength={20000}
              placeholder="You are [Name]. You handle …"
              className="hermes-mono text-[12px] px-3 py-2 border focus:outline-none resize-y"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.4)",
                lineHeight: 1.55,
                minHeight: "280px",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)")}
            />
            <span
              className="hermes-mono text-[9.5px] tracking-[0.12em]"
              style={{ color: "rgba(255,230,203,0.4)" }}
            >
              {promptDraft.length} / 20000
            </span>
          </label>

          {/* Model */}
          <label className="flex flex-col gap-1.5 relative">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Model
            </span>
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              className="hermes-mono text-[12px] px-3 py-2 border inline-flex items-center gap-2 text-left transition-colors"
              style={{
                background: "rgba(0,0,0,0.45)",
                color: CREAM,
                borderColor: modelOpen ? CREAM : "rgba(255,230,203,0.4)",
              }}
            >
              <ProviderLogoChip provider={model.provider} size={18} />
              <span className="flex-1 truncate">
                {model.name.length > 32
                  ? model.name.split("/").pop()?.replace(":free", " · free")
                  : model.name}
              </span>
              <span style={{ color: "rgba(255,230,203,0.55)" }}>▾</span>
            </button>
            {modelOpen && models && (
              <ModelDropdown
                catalog={models.catalog}
                current={model}
                onPick={(p, n) => {
                  setModel({ provider: p, name: n });
                  setModelOpen(false);
                }}
                onClose={() => setModelOpen(false)}
              />
            )}
          </label>

          {/* Summon phrase — read-only with copy */}
          <div className="flex flex-col gap-1.5">
            <span
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Summon phrase
            </span>
            <button
              type="button"
              onClick={copyPhrase}
              className="flex items-center gap-2 px-3 py-2 border text-left transition-colors"
              style={{
                background: copiedPhrase
                  ? "rgba(134,239,172,0.12)"
                  : "rgba(0,0,0,0.35)",
                borderColor: copiedPhrase
                  ? "rgba(134,239,172,0.55)"
                  : "rgba(255,230,203,0.3)",
              }}
            >
              <span
                className="hermes-mono text-[12px] flex-1"
                style={{ color: copiedPhrase ? "#86efac" : CREAM }}
              >
                {copiedPhrase ? "Copied!" : `"${primaryPhrase}"`}
              </span>
            </button>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between gap-3 mt-2 pt-3 border-t" style={{ borderColor: "rgba(255,230,203,0.2)" }}>
            {deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span
                  className="hermes-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "#fca5a5" }}
                >
                  Delete this persona?
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="hermes-mono px-3 py-1.5 border text-[10px] uppercase tracking-[0.22em] transition-colors"
                  style={{
                    background: "#fca5a5",
                    color: BG,
                    borderColor: "#fca5a5",
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: "rgba(255,230,203,0.6)" }}
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors"
                style={{ color: "rgba(252,165,165,0.7)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fca5a5")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(252,165,165,0.7)")
                }
              >
                Delete persona
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="hermes-mono px-3 py-2 border text-[10.5px] uppercase tracking-[0.22em] transition-colors"
                style={{
                  background: "transparent",
                  color: CREAM,
                  borderColor: "rgba(255,230,203,0.4)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
                className="hermes-mono px-4 py-2 border text-[10.5px] uppercase tracking-[0.22em] transition-colors disabled:opacity-40"
                style={{
                  background: CREAM,
                  color: BG,
                  borderColor: CREAM,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBadge({
  status,
  hasRepo,
}: {
  status: SyncStatus | undefined;
  hasRepo: boolean;
}) {
  // Resolve the label + colour. When there's no repo at all we render a
  // single grey "not synced" badge so it's obvious the user hasn't yet
  // hooked their Hermes up to GitHub.
  let label: string;
  let color: string;
  let dotColor: string;
  if (!hasRepo) {
    label = "not synced";
    color = "rgba(255,230,203,0.55)";
    dotColor = "rgba(255,230,203,0.4)";
  } else if (status === "synced") {
    label = "synced";
    color = "#86efac";
    dotColor = "#86efac";
  } else if (status === "untracked") {
    label = "new · push me";
    color = "#FFD21E";
    dotColor = "#FFD21E";
  } else if (status === "dirty") {
    label = "local edits";
    color = "#FFD21E";
    dotColor = "#FFD21E";
  } else {
    label = "—";
    color = "rgba(255,230,203,0.55)";
    dotColor = "rgba(255,230,203,0.4)";
  }
  return (
    <span
      className="hermes-mono absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 border text-[9.5px] uppercase tracking-[0.2em]"
      style={{
        background: "rgba(7,29,28,0.92)",
        color,
        borderColor: color,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: dotColor }}
      />
      {label}
    </span>
  );
}

function ModelDropdown({
  catalog,
  current,
  onPick,
  onClose,
}: {
  catalog: ModelCatalogEntry[];
  current: PersonaModel;
  onPick: (provider: string, name: string) => void;
  onClose: () => void;
}) {
  // Close on outside click.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const TIER_LABEL: Record<string, string> = {
    top: "top",
    mid: "mid",
    cheap: "cheap",
    free: "free",
  };
  return (
    <div
      ref={ref}
      className="absolute z-30 top-full left-0 mt-1 max-h-72 overflow-y-auto border min-w-[260px]"
      style={{
        background: "rgba(7,29,28,0.98)",
        borderColor: "rgba(255,230,203,0.55)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.55)",
      }}
    >
      {catalog.map((group) => (
        <div key={group.provider}>
          <div
            className="hermes-mono text-[9.5px] uppercase tracking-[0.22em] px-3 py-1.5 border-b sticky top-0"
            style={{
              color: "rgba(255,230,203,0.55)",
              borderColor: "rgba(255,230,203,0.2)",
              background: "rgba(7,29,28,0.98)",
            }}
          >
            {group.provider}
          </div>
          {group.models.map((m) => {
            const isCurrent =
              group.provider.toLowerCase() === current.provider.toLowerCase() &&
              m.name === current.name;
            return (
              <button
                key={`${group.provider}-${m.name}`}
                type="button"
                onClick={() => onPick(group.provider, m.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                style={{
                  background: isCurrent ? "rgba(255,230,203,0.08)" : "transparent",
                  color: CREAM,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,230,203,0.06)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isCurrent
                    ? "rgba(255,230,203,0.08)"
                    : "transparent")
                }
              >
                <ProviderLogoChip provider={group.provider} size={14} />
                <span
                  className="hermes-mono text-[11.5px] truncate flex-1"
                  style={{ color: CREAM }}
                >
                  {m.name.length > 32
                    ? m.name.split("/").pop()?.replace(":free", " · free")
                    : m.name}
                </span>
                <span
                  className="hermes-mono text-[9.5px] uppercase tracking-[0.22em] shrink-0"
                  style={{
                    color:
                      m.tier === "free"
                        ? "#86efac"
                        : m.tier === "top"
                          ? "#FFD21E"
                          : "rgba(255,230,203,0.55)",
                  }}
                >
                  {TIER_LABEL[m.tier]}
                </span>
                {isCurrent && (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: CREAM }} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// GitHub sync — single-prompt bootstrap for a private <user>-pantheon repo.
// We don't shell out to git ourselves; we draft the prompt the user pastes
// into Claude Code (which already has filesystem + gh CLI creds). Cleanest
// separation: Hermes runs the personas at runtime, Claude Code provisions
// the infrastructure once at setup.
// ────────────────────────────────────────────────────────────────────────────
// Two-card GitHub sync. Each card shows: a 3:1 Pantheon hero image, title,
// explainer copy, the actual prompt VISIBLE (not hidden behind copy), and a
// one-click copy button. Branded as "backup & sync" not "mirror".
const GH_SYNC_STEPS: Array<{
  step: number;
  title: string;
  /** Properly detailed explainer — what runs, where it writes, what the
   *  user gets afterwards. Replaces the old one-line `hint`. */
  body: string;
  cta: string;
  prompt: string;
  accent: string;
  hero: string;
}> = [
  {
    step: 1,
    title: "Connect Hermes to GitHub",
    body:
      "Paste this into Hermes. She'll tell you what she needs from you (gh CLI auth, the repo name you'd like), then create a private GitHub repo and mirror ~/.hermes/ into it — config, personas, skills, memories. Sensitive runtime state stays on your machine. She'll also wire a daily cron so the backup keeps itself fresh. One-time setup.",
    cta: "Copy → paste into Hermes",
    accent: "FFD21E",
    hero: ghConnect,
    prompt: `Hey Hermes — I want to back you up to a private GitHub repo so I can take you to any machine.

First, tell me up-front what you need from me to make this work (gh CLI auth, my GitHub username, the repo name you'd suggest). Wait for me to confirm before doing anything.

Then once I confirm:
1. Create a private GitHub repo named <username>/hermes-mirror.
2. Mirror everything at ~/.hermes/ into ~/code/hermes-mirror/, EXCLUDING anything that shouldn't be pushed — sessions/, auth*, state*, logs/, .env, gateway.pid, audio_cache/, image_cache/, sandboxes/, checkpoints/, and any file content matching /api[_-]?key|secret|password|token/i.
3. Add a clear README explaining the layout so future-me (on a new machine) can make sense of it: config.yaml, pantheon/, skills/, memories/, SOUL.md.
4. Push it.
5. Wire a daily 'hermes cron' that re-runs the rsync + commit + push automatically, so the backup keeps itself fresh.
6. Confirm the repo URL + cron schedule, then stop.

If you see anything that looks like a credential, abort and tell me. If anything else is unclear, ask before acting.`,
  },
  {
    step: 2,
    title: "Push personas to GitHub",
    body:
      "Paste this into Hermes after you've connected the repo. The prompt below auto-includes whichever personas are currently on your disk — so when you add a new one (like Orpheus), it'll show up in the list. She'll save a persistent rule that ANY YAML in your pantheon folder is auto-discoverable — so future personas you add via the dashboard get picked up automatically, no re-introduction needed. Then she'll push the current pantheon to GitHub. Run it any time after editing a persona to capture the change.",
    cta: "Copy → paste into Hermes",
    accent: "86efac",
    hero: ghPush,
    prompt: "", // dynamically built per-render from the live persona list — see buildPushPrompt()
  },
];

// Build the GitHub-push prompt fresh from the live persona list, so when
// the operator adds a new persona (e.g. Orpheus) the copied text explicitly
// names it. Falls back to the generic prompt if the personas haven't loaded.
function buildPushPrompt(personas: PersonaYaml[]): string {
  const haveList =
    personas.length > 0
      ? personas
          .map((p) => `   • ${p.id}.yaml — ${p.name} (${p.model?.name ?? "model unset"}) — ${p.job}`)
          .join("\n")
      : "   • (the personas in your pantheon folder right now)";

  const namesInline =
    personas.length > 0
      ? personas.map((p) => `'${p.name}'`).join(", ")
      : "'Labyrinth', 'Mercury', any new name the operator adds";

  return `Hey Hermes — I've created a set of personas in ~/.hermes/pantheon/personas/. Here's what's on disk right now (${personas.length} persona${personas.length === 1 ? "" : "s"}):

${haveList}

Here's what I want:

1. Save this to your persistent memory (memory tool, not just this turn) so it carries across every future session:

   "The folder ~/.hermes/pantheon/personas/ is the operator's pantheon. ANY YAML file in this folder is a callable persona — these names are FIRST-CLASS LOCAL ENTITIES that take priority over any same-named external thing.

   At the start of EVERY turn:
   1. List the YAMLs in ~/.hermes/pantheon/personas/ to know what personas exist right now (e.g. ${namesInline} — but always re-scan; the operator may add more).
   2. Scan the operator's message for any proper noun that matches a persona name (case-insensitive).
   3. If a match is found, ALWAYS interpret it as a reference to that local persona FIRST. Do NOT assume the operator means an external project, model, library, or famous figure with the same name. Examples:
      - 'Tell me about Orpheus' → describe the operator's Orpheus persona by reading orpheus.yaml. Do NOT ask 'do you mean Orpheus TTS?'.
      - 'Use Orpheus to ...' → load the Orpheus persona (model, system_prompt, skill bundle) for that turn, then return to default.
      - 'What's the difference between Athena and Mercury?' → compare the operator's two personas by reading their YAMLs.
   4. Only if the operator explicitly disambiguates (e.g. 'I mean the Orpheus TTS model, not my persona') OR if no matching YAML exists, fall back to external interpretation.
   5. New YAMLs dropped into this folder are auto-discoverable; never tell the operator to re-introduce a persona they've created."

2. Read each YAML currently in the folder and confirm back to me what they are, what model they use, and what they're best for.

3. Push the latest pantheon to GitHub right now: rsync ~/.hermes/pantheon/ into ~/code/hermes-mirror/pantheon/ (with --delete), git add -A, commit "sync personas $(date +%F-%H%M)", and push.

4. Print the commit URL.

Do steps 1 and 2 first and wait for me to confirm before pushing.`;
}

function HermesPantheonGitHubSync() {
  // Pull the live persona list so step 2's prompt can name them explicitly
  // when the operator clicks copy.
  const { data } = useHermesPantheon();
  const personas = data?.personas ?? [];
  return (
    <section id="pillar-crons" className="mb-12 scroll-mt-24">
      <SectionHead
        title="Take Hermes anywhere"
        meta="private repo · portable across machines"
      />
      <div
        className="text-[13.5px] leading-relaxed mt-3 mb-5 max-w-3xl"
        style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
      >
        Mirror your Hermes to a private GitHub repo so your config and personas survive a
        machine swap, every edit is versioned, and you can roll back if something starts
        misbehaving. Two prompts — <em>paste each one into Hermes</em> (your Telegram chat
        or any Hermes session) and she'll walk you through the rest, asking for what she
        needs.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {GH_SYNC_STEPS.map((s) => {
          // Step 2's prompt is built fresh from the live pantheon so newly
          // added personas (Orpheus, etc.) appear by name in the copied text.
          const promptOverride =
            s.step === 2 ? buildPushPrompt(personas) : undefined;
          return (
            <GHSyncStepCard
              key={s.step}
              step={s}
              promptOverride={promptOverride}
            />
          );
        })}
      </div>
    </section>
  );
}

function GHSyncStepCard({
  step,
  promptOverride,
}: {
  step: (typeof GH_SYNC_STEPS)[number];
  promptOverride?: string;
}) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const promptToCopy = promptOverride ?? step.prompt;
  function handleCopy() {
    void copyToClipboard(promptToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // Copying the prompt is the user's "I'm about to run this in Hermes"
      // signal. Hermes typically completes the rsync + push in 15-30s,
      // sometimes longer. Re-poll the sync endpoint every 5s for the next
      // 90s so the badges flip from dirty → synced the moment Hermes
      // actually finishes — without lying about state in the meantime.
      let polls = 0;
      const id = setInterval(() => {
        polls += 1;
        void queryClient.invalidateQueries({ queryKey: ["hermes-pantheon-sync"] });
        void queryClient.invalidateQueries({ queryKey: ["hermes-pantheon"] });
        if (polls >= 18) clearInterval(id);
      }, 5000);
    });
  }
  return (
    <div
      className="border flex overflow-hidden"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        background: "rgba(0,0,0,0.32)",
      }}
    >
      {/* LEFT — image (240px wide, full card height). Big white step
          number floats top-left over the image; title overlaid bottom.
          No icon next to the number — cleaner. */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ width: 240 }}
      >
        <img
          src={step.hero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 40%" }}
          loading="lazy"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(7,29,28,0.15) 0%, rgba(7,29,28,0.55) 60%, rgba(7,29,28,0.9) 100%)",
          }}
        />
        <span
          className="hermes-display absolute top-3 left-4"
          style={{
            color: "#fff",
            fontSize: 56,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontWeight: 600,
            textShadow: "0 2px 18px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.55)",
          }}
        >
          {String(step.step).padStart(2, "0")}
        </span>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
          <div
            className="hermes-display uppercase leading-tight"
            style={{
              color: CREAM,
              fontSize: 17,
              letterSpacing: "0.03em",
              textShadow: "0 2px 12px rgba(0,0,0,0.75)",
            }}
          >
            {step.title}
          </div>
        </div>
      </div>

      {/* RIGHT — body. Detailed explainer + visible prompt + copy. */}
      <div className="p-4 flex flex-col gap-3 flex-1 min-w-0">
        <div
          className="text-[13px] leading-relaxed"
          style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
        >
          {step.body}
        </div>
        <pre
          className="hermes-mono text-[10.5px] leading-relaxed whitespace-pre-wrap break-words p-3 border max-h-52 overflow-y-auto flex-1"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "rgba(255,230,203,0.85)",
            borderColor: `#${step.accent}33`,
          }}
          onWheel={forwardWheelAtBoundary}
        >
          {promptToCopy}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="hermes-mono px-3 py-2 border text-[10.5px] uppercase tracking-[0.22em] transition-colors self-start"
          style={{
            background: copied ? `#${step.accent}` : "transparent",
            color: copied ? BG : `#${step.accent}`,
            borderColor: `#${step.accent}`,
            boxShadow: copied ? `0 0 12px #${step.accent}66` : undefined,
          }}
        >
          {copied ? "Copied — paste into Hermes" : step.cta}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Memory section — Hermes' memory layout, rendered as a manuscript.
// Composes: manuscript hero (USER+MEMORY), SOUL panel, provider strip,
// 3D memory graph, Obsidian bridge. Per-profile memory grid is appended
// when more than one profile exists.
// ────────────────────────────────────────────────────────────────────────────
function HermesMemorySection() {
  const { data, isLoading } = useHermesMemory();
  if (isLoading || !data) {
    return (
      <section className="mb-12">
        <SectionHead title="Memory" meta="reading ~/.hermes/memories/" />
        <div
          className="border mt-3 px-5 py-8 hermes-mono text-[11px] uppercase tracking-[0.22em] text-center"
          style={{ borderColor: "rgba(255,230,203,0.4)", color: "rgba(255,230,203,0.55)" }}
        >
          <Loader2 className="h-4 w-4 inline-block animate-spin mr-2" /> Loading memory…
        </div>
      </section>
    );
  }
  return (
    <section id="pillar-memory" className="mb-12 scroll-mt-24">
      <SectionHead
        title="Memory"
        meta={`${data.hermesHome} · ${data.sessionCount} sessions · ${data.skillCount} skills`}
      />
      <div
        className="text-[13px] leading-relaxed mt-3 mb-5 max-w-3xl"
        style={{ color: "rgba(255,230,203,0.7)", fontFamily: '"Fraunces", serif' }}
      >
        Everything Hermes remembers about you and itself. Two short markdown files Hermes
        curates by hand — a strict char budget means every entry has earned its place.
      </div>

      {/* Three Hermes-specific layers side-by-side: USER, MEMORY, SOUL.
          Pantheon image is a background underlay on each card (same
          pattern as the chat panel's labyrinth backdrop) — the markdown
          stays the focus, the imagery is ambient texture. */}
      <MemoryThreeLayers user={data.user} memory={data.memory} soul={data.soul} />

      {/* Conversation history — full-width strip linking out to the
          searchable archive. Different shape from the manuscript pages
          above so it reads as a callout, not a fourth layer. */}
      <div className="mt-5">
        <ConversationHistoryStrip sessionCount={data.sessionCount} />
      </div>

      {/* Bridges — Hermes ↔ external systems. Obsidian (your notes app)
          and Claude OS (this dashboard) are conceptually the same shape:
          both are "Hermes reaches over to read X". 2-col so they tell
          the story together. */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ObsidianBridge hermesHome={data.hermesHome} />
        <HermesClaudeOsBridgeCard />
      </div>

      {data.profiles.length > 1 && (
        <div className="mt-5">
          <ProfileMemoryGrid profiles={data.profiles} />
        </div>
      )}

      {/* Mnemosyne (3D constellation) deliberately omitted — with Hermes'
          current low-volume memory (a handful of fragments), a force
          graph looks depopulated and adds visual noise without surfacing
          new information beyond what the manuscript pages above already
          render. The component still lives at src/components/hermes-mnemosyne.tsx
          for the day there are hundreds of memories worth visualising. */}
    </section>
  );
}

// Three Hermes-specific memory layers rendered as visually-identical
// cards. Pantheon image is a background underlay on each, with a strong
// dark wash so the markdown stays legible. Oracle = USER, Labyrinth =
// AGENT MEMORY, Philosopher = SOUL.
function MemoryThreeLayers({
  user,
  memory,
  soul,
}: {
  user: HermesMemoryData["user"];
  memory: HermesMemoryData["memory"];
  soul: HermesMemoryData["soul"];
}) {
  const soulVisible = soul.content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^---[\s\S]*?---/, "")
    .trim();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ManuscriptPage
        title="User Profile"
        subtitle="curated facts about you"
        file="USER.md"
        content={user.content}
        charCount={user.charCount}
        charLimit={user.charLimit}
        avatar={PERSONA_AVATAR_BY_ID.oracle}
        emptyHint="Hermes hasn't learned anything about you yet. Chat with it and it'll start curating this file."
      />
      <ManuscriptPage
        title="Agent Memory"
        subtitle="learned about the system"
        file="MEMORY.md"
        content={memory.content}
        charCount={memory.charCount}
        charLimit={memory.charLimit}
        avatar={PERSONA_AVATAR_BY_ID.labyrinth}
        emptyHint="Hermes hasn't filed any system facts yet. Workflows, environment notes, and learned conventions will appear here."
      />
      <div id="pillar-soul" className="scroll-mt-24">
      <ManuscriptPage
        title="Soul"
        subtitle="personality, not memory"
        file="SOUL.md"
        content={soulVisible}
        // No char ring on SOUL — it's not a curated-fact list, just prose.
        charCount={0}
        charLimit={0}
        avatar={PERSONA_AVATAR_BY_ID.philosopher}
        emptyHint="No voice defined yet — Hermes will speak in its default tone. Edit SOUL.md to teach it how to talk."
      />
      </div>
    </div>
  );
}

function ManuscriptPage({
  title,
  subtitle,
  file,
  content,
  charCount,
  charLimit,
  emptyHint,
  avatar,
  italic = false,
  hideRing = false,
}: {
  title: string;
  subtitle: string;
  file: string;
  content: string;
  charCount: number;
  charLimit: number;
  emptyHint: string;
  /** Pantheon avatar — used as a background UNDERLAY behind the text,
   *  not a corner thumbnail. Same pattern as the chat panel's labyrinth
   *  backdrop: gives the card ambient texture without competing with
   *  the markdown content. */
  avatar?: string;
  /** SOUL renders prose in italic Fraunces. */
  italic?: boolean;
  /** SOUL is free-form prose, not a curated-fact budget — no ring. */
  hideRing?: boolean;
}) {
  const fragments = content
    .split(/\n?§\n?/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pct =
    charLimit > 0 ? Math.min(100, Math.round((charCount / charLimit) * 100)) : 0;
  return (
    <div
      className="relative border flex flex-col overflow-hidden"
      style={{ borderColor: "rgba(255,230,203,0.4)" }}
    >
      {/* Pantheon image as a low-opacity background underlay. A heavy
          dark wash sits on top so the markdown text stays the focus —
          the avatar provides ambient texture only. */}
      {avatar && (
        <>
          <img
            src={avatar}
            alt=""
            aria-hidden
            className="pantheon-glitch absolute inset-0 w-full h-full object-cover pointer-events-none"
            // ~half of the source PNGs have a thin baked-in white frame
            // (Kie/nano-banana output quirk). Scale 1.12 + center crop
            // clips the frame off all four edges, so the underlay reads
            // as edge-to-edge texture instead of "image inside a border".
            style={{ opacity: 0.65, transform: "scale(1.12)", transformOrigin: "center" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(7,29,28,0.5) 0%, rgba(7,29,28,0.78) 45%, rgba(7,29,28,0.9) 100%)",
            }}
          />
        </>
      )}

      {/* Header */}
      <div
        className="relative flex items-center justify-between gap-3 px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,230,203,0.25)" }}
      >
        <div className="min-w-0">
          <div
            className="hermes-display uppercase leading-none truncate"
            style={{ color: CREAM, fontSize: "18px", letterSpacing: "0.04em" }}
          >
            {title}
          </div>
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            {subtitle} · {file}
          </div>
        </div>
        {!hideRing && (
          <CharCountRing pct={pct} count={charCount} limit={charLimit} />
        )}
      </div>

      {/* Body */}
      {/* Body — internally scrollable so all fragments are reachable
          even in the 3-up layout where each card is narrow. */}
      <div
        className="relative px-5 py-4 flex flex-col gap-3 overflow-y-auto"
        style={{ minHeight: 200, maxHeight: 320 }}
        onWheel={forwardWheelAtBoundary}
      >
        {fragments.length === 0 ? (
          <div
            className="text-[13px] italic leading-relaxed"
            style={{ color: "rgba(255,230,203,0.62)", fontFamily: '"Fraunces", serif' }}
          >
            {emptyHint}
          </div>
        ) : italic ? (
          // SOUL — prose rendered as one italic quote block.
          <div className="relative">
            <span
              aria-hidden
              className="hermes-display absolute -top-2 -left-1 select-none"
              style={{
                color: "rgba(255,230,203,0.22)",
                fontSize: "44px",
                lineHeight: 1,
              }}
            >
              “
            </span>
            <p
              className="text-[14px] italic leading-relaxed pl-7"
              style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
            >
              {content.trim()}
            </p>
          </div>
        ) : (
          // USER / MEMORY — fragments split on `§`
          fragments.map((f, i) => (
            <div key={i} className="flex gap-3">
              <span
                className="hermes-mono shrink-0 select-none"
                style={{
                  color: "rgba(255,230,203,0.35)",
                  fontSize: "11px",
                  lineHeight: "20px",
                  width: "20px",
                  textAlign: "right",
                }}
              >
                §{i + 1}
              </span>
              <p
                className="text-[13.5px] leading-relaxed"
                style={{
                  color: "rgba(255,230,203,0.92)",
                  fontFamily: '"Fraunces", serif',
                }}
              >
                {f}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CharCountRing({
  pct,
  count,
  limit,
}: {
  pct: number;
  count: number;
  limit: number;
}) {
  const size = 38;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const dash = (pct / 100) * c;
  const ringColor = pct < 80 ? CREAM : pct < 95 ? "#FFD21E" : "#f87171";
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={`${count} / ${limit} chars`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,230,203,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 600ms ease-out" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center hermes-mono"
        style={{ color: ringColor, fontSize: "9px", letterSpacing: "0.05em" }}
      >
        {pct}%
      </div>
    </div>
  );
}

// (Removed: standalone SoulPanel — SOUL is now rendered as the third
// card in MemoryThreeLayers via ManuscriptPage's `italic` + `hideRing`
// props, so the three Hermes-specific memory layers read as a unified row.)

// (Removed: MemoryThreeLayersFallback — superseded by the full
// MemoryThreeLayers + ManuscriptPage with image-underlay refactor.)

// Short callout linking out to conversation history (sessions/state.db).
// Different from curated memory — this is the raw archive of every chat,
// already searchable via the chat-panel session sidebar.
// Paired with ObsidianBridge in a 2-col strip. Same heading/border/body
// rhythm as ObsidianBridge so the two cards read as siblings, not as a
// thin numeric callout next to a richer card.
function ConversationHistoryStrip({ sessionCount }: { sessionCount: number }) {
  return (
    <div
      className="border flex flex-col"
      style={{ borderColor: "rgba(255,230,203,0.4)", background: "rgba(0,0,0,0.32)" }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,230,203,0.25)" }}
      >
        <div
          className="hermes-display"
          style={{ color: CREAM, fontSize: 26, letterSpacing: "0.02em", lineHeight: 1 }}
        >
          {sessionCount}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="hermes-display uppercase leading-none"
            style={{ color: CREAM, fontSize: 14, letterSpacing: "0.04em" }}
          >
            Conversation History
          </div>
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            {sessionCount === 1 ? "1 session" : `${sessionCount} sessions`} · sessions/ + state.db
          </div>
        </div>
      </div>
      <div
        className="px-5 py-4 text-[13px] leading-relaxed flex-1"
        style={{ color: "rgba(255,230,203,0.72)", fontFamily: '"Fraunces", serif' }}
      >
        Full searchable archive of every chat — different from the curated memory above.
        Hermes promotes a tiny fraction of what's said here into{" "}
        <span className="hermes-mono" style={{ color: CREAM, fontSize: "11px" }}>
          MEMORY.md
        </span>{" "}
        and{" "}
        <span className="hermes-mono" style={{ color: CREAM, fontSize: "11px" }}>
          USER.md
        </span>
        ; the rest stays here, searchable but not active memory.
      </div>
    </div>
  );
}

// (Removed: MemoryProviderStrip — operator feedback was it didn't carry
// enough signal for the page. External provider config still works via
// `hermes memory setup` in the terminal.)

function ProfileMemoryGrid({ profiles }: { profiles: HermesMemoryProfile[] }) {
  return (
    <div>
      <div
        className="hermes-display uppercase leading-none mb-2"
        style={{ color: CREAM, fontSize: "14px", letterSpacing: "0.04em" }}
      >
        Per-Profile Memory
      </div>
      <div
        className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-3"
        style={{ color: "rgba(255,230,203,0.55)" }}
      >
        each profile keeps its own USER / MEMORY / SOUL
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {profiles.map((p) => {
          const avatar = PERSONA_AVATAR_BY_ID[p.name.toLowerCase()];
          return (
            <div
              key={p.name}
              className="border px-3 py-2.5 flex items-center gap-2.5"
              style={{ borderColor: "rgba(255,230,203,0.35)", background: "rgba(0,0,0,0.32)" }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="pantheon-glitch shrink-0 object-cover"
                  style={{ width: 28, height: 28 }}
                />
              ) : (
                <div
                  className="shrink-0 inline-flex items-center justify-center hermes-display"
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgba(255,230,203,0.08)",
                    color: CREAM,
                    fontSize: 14,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="hermes-display uppercase truncate"
                  style={{ color: CREAM, fontSize: 12, letterSpacing: "0.04em" }}
                >
                  {p.name}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <FileDot label="U" present={p.hasUser} />
                  <FileDot label="M" present={p.hasMemory} />
                  <FileDot label="S" present={p.hasSoul} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileDot({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className="hermes-mono inline-flex items-center justify-center"
      style={{
        width: 13,
        height: 13,
        fontSize: 8,
        background: present ? "rgba(134,239,172,0.18)" : "transparent",
        color: present ? "#86efac" : "rgba(255,230,203,0.35)",
        border: `1px solid ${present ? "rgba(134,239,172,0.5)" : "rgba(255,230,203,0.25)"}`,
        letterSpacing: 0,
      }}
      title={`${label} ${present ? "present" : "missing"}`}
    >
      {label}
    </span>
  );
}

// (Mnemosyne 3D constellation removed from the page — see comment in
// HermesMemorySection. Component file kept at
// src/components/hermes-mnemosyne.tsx for future use when memory volume
// grows. Lazy import + wrapper deleted from this route so the three.js
// chunk stops shipping in the bundle.)

// Obsidian bridge — 2-state.
//   1. NOT CONNECTED → "I have a vault" button copies the Claude Code prompt.
//      Then a "Mark as connected" pill appears once the user has run it.
//   2. CONNECTED → renders the Obsidian logo + emerald connected pill.
//      State persists in localStorage across reloads.
const OBSIDIAN_CONNECTED_KEY = "claude-os.hermes.obsidian-connected.v1";
const OBSIDIAN_VAULT_PATH_KEY = "claude-os.hermes.obsidian-vault-path.v1";

function ObsidianBridge({ hermesHome }: { hermesHome: string }) {
  const [connected, setConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OBSIDIAN_CONNECTED_KEY) === "true";
  });
  const [vaultPath, setVaultPath] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(OBSIDIAN_VAULT_PATH_KEY) ?? "";
  });
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Persist vault path as the user types, lightly debounced.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        if (vaultPath.trim()) {
          window.localStorage.setItem(OBSIDIAN_VAULT_PATH_KEY, vaultPath.trim());
        } else {
          window.localStorage.removeItem(OBSIDIAN_VAULT_PATH_KEY);
        }
      } catch {
        /* ignore */
      }
    }, 350);
    return () => clearTimeout(id);
  }, [vaultPath]);

  // If the user has set an explicit vault path, bake it into the prompt
  // directly — Claude Code skips the "go find my vault" step. Otherwise
  // fall back to the auto-detect version.
  const trimmedVault = vaultPath.trim();
  const prompt = trimmedVault
    ? `I have an Obsidian vault at "${trimmedVault}". Expose my Hermes memory inside it.

1. Verify the directory exists. If not, ask me.
2. Create a symlink: ln -s ${hermesHome}/memories "${trimmedVault}/Hermes"
3. Add "${trimmedVault}/Hermes/README.md" explaining:
     - USER.md = curated facts about me
     - MEMORY.md = what Hermes has learned about the system
     - Edits in Obsidian write back to ~/.hermes/memories/ (same file, both directions).
4. Print "Connected: ${trimmedVault}/Hermes" so I can confirm.
5. When I reference my Obsidian vault in future Hermes chats, read from this symlink — that's the canonical memory.

Don't touch other vault files. If a "Hermes" folder already exists in the vault, rename it to "Hermes-old" first.`
    : `I have an Obsidian vault and want to expose my Hermes memory inside it.

1. Find my Obsidian vault root. Common locations: ~/Documents/, ~/Library/Mobile Documents/iCloud~md~obsidian/, or wherever Obsidian.app's settings say. If you find multiple vaults, ASK me which one.
2. Create a symlink: ln -s ${hermesHome}/memories "<vault>/Hermes"
3. Add "<vault>/Hermes/README.md" explaining:
     - USER.md = curated facts about me
     - MEMORY.md = what Hermes has learned about the system
     - Edits in Obsidian write back to ~/.hermes/memories/ (same file, both directions).
4. Print the resolved vault path so I can tell the dashboard "yes, connected".
5. When I reference my Obsidian vault in future Hermes chats, read from this symlink — that's the canonical memory.

Don't touch other vault files. If a "Hermes" folder already exists in the vault, rename it to "Hermes-old" first.`;

  function handleCopy() {
    void copyToClipboard(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
    setShowPrompt(true);
  }
  function markConnected() {
    setConnected(true);
    try {
      window.localStorage.setItem(OBSIDIAN_CONNECTED_KEY, "true");
    } catch {
      /* localStorage may be unavailable in private mode */
    }
  }
  function disconnect() {
    setConnected(false);
    setShowPrompt(false);
    try {
      window.localStorage.removeItem(OBSIDIAN_CONNECTED_KEY);
    } catch {
      /* ignore */
    }
  }

  if (connected) {
    return (
      <div
        className="border px-5 py-4 flex items-center gap-4"
        style={{
          // Obsidian brand purple (#6c31e3 from their official SVG)
          // tinted into our cream-on-teal palette. Replaces the emerald
          // border which read as "completion" rather than "vault connected".
          borderColor: "rgba(140,98,235,0.55)",
          background:
            "linear-gradient(180deg, rgba(140,98,235,0.08) 0%, rgba(0,0,0,0.32) 100%)",
          boxShadow: "inset 0 0 0 1px rgba(140,98,235,0.22)",
        }}
      >
        <img
          src={logoObsidian}
          alt="Obsidian"
          className="shrink-0 object-contain"
          style={{
            width: 44,
            height: 44,
            // Subtle purple drop-shadow so the logo has depth against
            // the dark teal page background. Mirrors how the brand
            // appears on Obsidian's own marketing site.
            filter: "drop-shadow(0 0 8px rgba(140,98,235,0.45))",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="hermes-display uppercase leading-none"
              style={{ color: CREAM, fontSize: 16, letterSpacing: "0.04em" }}
            >
              Obsidian
            </div>
            <span
              className="hermes-mono inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9.5px] uppercase tracking-[0.2em]"
              style={{
                color: "#c4b5fd",
                borderColor: "rgba(140,98,235,0.6)",
                background: "rgba(140,98,235,0.12)",
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: "#c4b5fd",
                  boxShadow: "0 0 6px rgba(140,98,235,0.85)",
                }}
              />
              Connected
            </span>
          </div>
          <div
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.6)" }}
          >
            memory mirrors into your vault · edits flow both ways
          </div>
          {trimmedVault && (
            <div
              className="hermes-mono text-[10px] mt-1 truncate"
              style={{ color: "rgba(255,230,203,0.45)" }}
              title={trimmedVault}
            >
              {trimmedVault}/Hermes
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={disconnect}
          className="hermes-mono px-3 py-1.5 border text-[10.5px] uppercase tracking-[0.22em] transition-colors shrink-0"
          style={{
            background: "transparent",
            color: "rgba(255,230,203,0.65)",
            borderColor: "rgba(255,230,203,0.3)",
          }}
          title="Mark as disconnected (does not remove the symlink — do that manually if you want to clean up)"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div
      className="border"
      style={{ borderColor: "rgba(255,230,203,0.4)", background: "rgba(0,0,0,0.32)" }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,230,203,0.25)" }}
      >
        <img
          src={logoObsidian}
          alt="Obsidian"
          className="shrink-0 object-contain"
          style={{
            width: 36,
            height: 36,
            opacity: 0.9,
            filter: "drop-shadow(0 0 6px rgba(140,98,235,0.35))",
          }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="hermes-display uppercase leading-none"
            style={{ color: CREAM, fontSize: 14, letterSpacing: "0.04em" }}
          >
            Open in Obsidian
          </div>
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            optional · expose ~/.hermes/memories inside your vault
          </div>
        </div>
        {showPrompt ? (
          // Neutral cream, no green check — green reads "already done"
          // and this button is "I've finished running it, confirm".
          <button
            type="button"
            onClick={markConnected}
            className="hermes-mono px-3 py-1.5 border text-[10.5px] uppercase tracking-[0.22em] transition-colors shrink-0"
            style={{
              background: "transparent",
              color: CREAM,
              borderColor: CREAM,
            }}
            title="Click once you've run the prompt in Claude Code"
          >
            I've run it — confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopy}
            className="hermes-mono px-3 py-1.5 border text-[10.5px] uppercase tracking-[0.22em] transition-colors shrink-0"
            style={{
              background: copied ? CREAM : "transparent",
              color: copied ? BG : CREAM,
              borderColor: CREAM,
            }}
          >
            {copied ? "Copied!" : "I have a vault"}
          </button>
        )}
      </div>
      {/* Compact vault-path input — single row, no label/caption.
          Persists in localStorage and bakes into the copy-paste prompt
          when filled. Left blank = Claude Code auto-detects. */}
      <div
        className="px-5 py-2 border-b"
        style={{ borderColor: "rgba(255,230,203,0.15)" }}
      >
        <input
          type="text"
          value={vaultPath}
          onChange={(e) => setVaultPath(e.target.value)}
          placeholder="Vault path (optional · leave blank to auto-detect)"
          className="hermes-mono w-full px-2 py-1.5 text-[11.5px] border focus:outline-none"
          style={{
            background: "rgba(0,0,0,0.35)",
            color: CREAM,
            borderColor: "rgba(255,230,203,0.2)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = CREAM)}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,230,203,0.2)")
          }
        />
      </div>

      {showPrompt && (
        <>
          <pre
            className="hermes-mono text-[10.5px] leading-relaxed whitespace-pre-wrap break-words px-5 py-3 max-h-44 overflow-y-auto"
            style={{ color: "rgba(255,230,203,0.78)" }}
            onWheel={forwardWheelAtBoundary}
          >
            {prompt}
          </pre>
          <div
            className="hermes-mono text-[10px] leading-relaxed px-5 pb-3"
            style={{ color: "rgba(255,230,203,0.65)" }}
          >
            <span className="uppercase tracking-[0.22em]">Step 1.</span> Paste the prompt
            above into Claude Code. &nbsp;
            <span className="uppercase tracking-[0.22em]">Step 2.</span>{" "}
            {trimmedVault
              ? "It'll create the symlink at your vault path."
              : "Let it find your vault and create the symlink."}{" "}
            &nbsp;
            <span className="uppercase tracking-[0.22em]">Step 3.</span> Come back and tap{" "}
            <span style={{ color: CREAM }}>"I've run it — confirm"</span>.
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Live stat tiles — pulls real session data from ~/.hermes/sessions/
// ────────────────────────────────────────────────────────────────────────────

function HermesLiveStats() {
  const { data } = useHermesSessions();
  const sessions = data?.sessions ?? [];

  // Roll up: total sessions, total messages, models used, time since last.
  const totalMessages = sessions.reduce((a, s) => a + (s.messageCount || 0), 0);
  // Distinct models, preserving order of first appearance — used for the
  // mini provider-logo stack on the Models tile.
  const modelOrder: string[] = [];
  for (const s of sessions) {
    if (s.model && !modelOrder.includes(s.model)) modelOrder.push(s.model);
  }
  const last = sessions.find((s) => s.lastUpdated || s.startedAt);
  const lastTs = last?.lastUpdated || last?.startedAt || null;
  const lastSeen = (() => {
    if (!lastTs) return "—";
    const ageMs = Date.now() - new Date(lastTs).getTime();
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  // Mini activity sparkline data — last 12 hours, hourly buckets.
  const hourBuckets = (() => {
    const out: number[] = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const start = now - (i + 1) * 3_600_000;
      const end = now - i * 3_600_000;
      out.push(
        sessions.filter((s) => {
          const t = new Date(s.startedAt || s.lastUpdated || 0).getTime();
          return t >= start && t < end;
        }).length,
      );
    }
    return out;
  })();
  const sparkMax = Math.max(1, ...hourBuckets);

  return (
    <section
      className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-10 border"
      style={{ borderColor: "rgba(255,230,203,0.4)" }}
    >
      {/* SESSIONS — count + tiny 12-hour activity sparkline */}
      <RichStatCell label="Sessions" sub="last 20 on disk" first>
        <div className="flex items-end gap-3">
          <div className="hermes-display text-4xl leading-none" style={{ color: CREAM }}>
            {sessions.length}
          </div>
          <div className="flex items-end gap-0.5 h-8 flex-1">
            {hourBuckets.map((c, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: `${Math.max(8, (c / sparkMax) * 100)}%`,
                  background: c > 0 ? "#FFD21E" : "rgba(255,230,203,0.15)",
                  boxShadow: c > 0 ? "0 0 6px rgba(255,210,30,0.5)" : undefined,
                  minWidth: 2,
                }}
                title={`${c} session${c === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        </div>
      </RichStatCell>

      {/* MESSAGES — count + a tiny chat-bubble icon set */}
      <RichStatCell label="Messages" sub="across all sessions">
        <div className="flex items-end gap-3">
          <div className="hermes-display text-4xl leading-none" style={{ color: CREAM }}>
            {totalMessages.toLocaleString()}
          </div>
          <MessageSquare
            style={{
              width: 28,
              height: 28,
              color: "#86efac",
              filter: "drop-shadow(0 0 8px rgba(134,239,172,0.45))",
            }}
          />
        </div>
      </RichStatCell>

      {/* MODELS — count + provider-logo stack (up to 4 unique) */}
      <RichStatCell label="Models" sub="distinct models used">
        <div className="flex items-end gap-3">
          <div className="hermes-display text-4xl leading-none" style={{ color: CREAM }}>
            {modelOrder.length}
          </div>
          <div className="flex items-center gap-1.5">
            {modelOrder.slice(0, 4).map((m) => {
              const provider = modelGuessProvider(m);
              return (
                <span
                  key={m}
                  className="inline-flex items-center justify-center border"
                  style={{
                    width: 26,
                    height: 26,
                    borderColor: "rgba(255,230,203,0.4)",
                    background: "rgba(0,0,0,0.4)",
                  }}
                  title={m}
                >
                  <ProviderLogoChip provider={provider} size={14} />
                </span>
              );
            })}
            {modelOrder.length > 4 && (
              <span
                className="hermes-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "rgba(255,230,203,0.55)" }}
              >
                +{modelOrder.length - 4}
              </span>
            )}
          </div>
        </div>
      </RichStatCell>

      {/* LAST ACTIVE — relative time + the most-recent session's model */}
      <RichStatCell
        label="Last active"
        sub={last?.model ?? "no session yet"}
        last
      >
        <div className="flex items-end gap-3">
          <div
            className="hermes-display text-3xl md:text-4xl leading-none"
            style={{
              color: lastTs ? CREAM : "rgba(255,230,203,0.4)",
              textShadow: lastTs ? "0 0 14px rgba(96,165,250,0.25)" : undefined,
            }}
          >
            {lastSeen}
          </div>
          {/* Live pulse dot — green when recent (< 5 min), amber when older. */}
          {lastTs && (
            <span
              className="inline-block rounded-full"
              style={{
                width: 10,
                height: 10,
                background:
                  Date.now() - new Date(lastTs).getTime() < 300_000
                    ? "#86efac"
                    : "#FFD21E",
                boxShadow:
                  Date.now() - new Date(lastTs).getTime() < 300_000
                    ? "0 0 12px rgba(134,239,172,0.7)"
                    : "0 0 12px rgba(255,210,30,0.5)",
                marginBottom: 6,
              }}
            />
          )}
        </div>
      </RichStatCell>
    </section>
  );
}

// Best-effort provider lookup from a model name — used by the Models tile
// so each unique model on disk renders its real provider mark.
function modelGuessProvider(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith("claude") || m.startsWith("anthropic")) return "anthropic";
  if (m.startsWith("gpt-") || m.startsWith("openai")) return "openai-codex";
  if (m.startsWith("gemini") || m.startsWith("google")) return "googlegemini";
  if (m.startsWith("meta-llama") || m.includes("llama")) return "openrouter";
  if (m.startsWith("qwen")) return "openrouter";
  if (m.startsWith("mistral")) return "mistral";
  return "openai-codex";
}

function RichStatCell({
  label,
  sub,
  first,
  last,
  children,
}: {
  label: string;
  sub: string;
  first?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="px-5 py-4 min-w-0"
      style={{
        borderLeft: first ? undefined : "1px solid rgba(255,230,203,0.4)",
        background: first || last ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-2"
        style={{ color: "rgba(255,230,203,0.55)" }}
      >
        {label}
      </div>
      {children}
      <div
        className="hermes-mono text-[10.5px] uppercase tracking-[0.18em] mt-2 truncate"
        style={{ color: "rgba(255,230,203,0.45)" }}
        title={sub}
      >
        {sub}
      </div>
    </div>
  );
}

function LiveStatCell({
  label,
  value,
  sub,
  first,
  last,
}: {
  label: string;
  value: string;
  sub: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="px-5 py-4"
      style={{
        borderLeft: first ? undefined : "1px solid rgba(255,230,203,0.4)",
        // Subtle background fade left→right so the row reads as a single ledger strip
        background: last
          ? "rgba(0,0,0,0.18)"
          : first
            ? "rgba(0,0,0,0.18)"
            : "rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-1.5"
        style={{ color: "rgba(255,230,203,0.55)" }}
      >
        {label}
      </div>
      <div
        className="hermes-display text-3xl md:text-4xl leading-none mb-1"
        style={{ color: CREAM }}
      >
        {value}
      </div>
      <div
        className="hermes-mono text-[10.5px] uppercase tracking-[0.18em]"
        style={{ color: "rgba(255,230,203,0.45)" }}
      >
        {sub}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Live skills grid — pulls real categories from ~/.hermes/skills/
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Hermes ↔ Claude OS bridge card — surfaces the `claude-os` skill that
// lets Hermes call back to localhost:8081 endpoints (sessions, memory,
// kanban, dream, etc). Reads /__hermes_skills to detect whether the skill
// is on disk; renders one of two states:
//   - INSTALLED (green check, "she can read your dashboard")
//   - MISSING (cream button with a copy-paste prompt for Claude Code to
//             author the skill)
// ────────────────────────────────────────────────────────────────────────────
// Half-width bridge card — paired with ObsidianBridge in the memory
// section's 2-col bridges row. Same shape rhythm as Obsidian for visual
// consistency: header (avatar + name + status), prose body, action row.
// Avatar is the hermes-portrait chick (NOT the small pixel logo).
function HermesClaudeOsBridgeCard() {
  const { data } = useHermesSkills();
  const skills = data?.skills ?? [];
  const installed = skills.some((s) => s.id === "claude-os");
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const installPrompt = `Install the claude-os skill into Hermes so she can read my operator dashboard.

1. Create directory: mkdir -p ~/.hermes/skills/claude-os/
2. Write the skill manifest at ~/.hermes/skills/claude-os/SKILL.md with frontmatter:
   name: claude-os
   description: "Connects Hermes to Claude OS — the operator dashboard at localhost:8081. Read sessions, memory, integrations, kanban, dream history."
   version: 1.0.0
3. In the body, document the endpoints she should call:
   - GET http://localhost:8081/__live-data        (full state)
   - GET http://localhost:8081/__hermes_status
   - GET http://localhost:8081/__hermes_sessions
   - GET http://localhost:8081/__hermes_memory
   - GET http://localhost:8081/__hermes_pantheon
4. Tell her to trigger this skill when the user mentions: "my dashboard", "Claude OS", "second brain", "operator", "what did my Dream say".
5. Make it loopback-only (the endpoints already enforce this).
6. Verify with: hermes skills list | grep claude-os`;

  function handleCopy() {
    void copyToClipboard(installPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className="border flex flex-col"
      style={{
        borderColor: installed ? "rgba(134,239,172,0.5)" : "rgba(255,230,203,0.4)",
        background: installed
          ? "linear-gradient(180deg, rgba(134,239,172,0.06) 0%, rgba(0,0,0,0.32) 100%)"
          : "rgba(0,0,0,0.32)",
        boxShadow: installed ? "inset 0 0 0 1px rgba(134,239,172,0.18)" : undefined,
      }}
    >
      {/* Header — hermes-portrait avatar, larger than the old pixel logo. */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,230,203,0.25)" }}
      >
        <img
          src={hermesPortrait}
          alt=""
          className="shrink-0 object-cover border"
          style={{
            width: 40,
            height: 40,
            borderColor: installed
              ? "rgba(134,239,172,0.45)"
              : "rgba(255,230,203,0.4)",
            opacity: 0.95,
          }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="hermes-display uppercase leading-none"
            style={{ color: CREAM, fontSize: 14, letterSpacing: "0.04em" }}
          >
            Claude OS Bridge
          </div>
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            {installed
              ? "skill installed · Hermes can read your dashboard"
              : "skill not installed"}
          </div>
        </div>
        {installed && (
          <span
            className="hermes-mono inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9.5px] uppercase tracking-[0.2em] shrink-0"
            style={{
              color: "#86efac",
              borderColor: "rgba(134,239,172,0.6)",
              background: "rgba(134,239,172,0.08)",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 5,
                height: 5,
                background: "#86efac",
                boxShadow: "0 0 6px rgba(134,239,172,0.85)",
              }}
            />
            On
          </span>
        )}
      </div>

      {/* Body — what it does + what it gives her access to + action row */}
      <div className="px-5 py-4 flex flex-col gap-3 flex-1">
        <div
          className="text-[13px] leading-relaxed"
          style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
        >
          Lets Hermes read this dashboard on request. Ask her{" "}
          <em>"what did my Dream say?"</em> or{" "}
          <em>"what's in my Claude OS?"</em> — she pulls from{" "}
          <span className="hermes-mono" style={{ color: CREAM, fontSize: "11.5px" }}>
            localhost:8081
          </span>{" "}
          and answers in chat. Read-only · loopback-only · never leaves your machine.
        </div>

        {/* (Access-chip strip removed — operator feedback was it bloated
            the card's height without adding much info beyond what the
            prose above already covers.) */}

        {/* Actions — one-click copy + reveal */}
        <div className="flex items-center gap-2 pt-1 mt-auto">
          <button
            type="button"
            onClick={handleCopy}
            className="hermes-mono px-3 py-1.5 border text-[10.5px] uppercase tracking-[0.22em] transition-colors"
            style={{
              background: copied ? CREAM : "transparent",
              color: copied ? BG : CREAM,
              borderColor: CREAM,
            }}
            title="Copy the one-shot install prompt for Claude Code"
          >
            {copied ? "Copied!" : "Copy install prompt"}
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] transition-colors"
            style={{ color: "rgba(255,230,203,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,230,203,0.6)")
            }
          >
            {showPrompt ? "▾ Hide" : "▸ View"}
          </button>
        </div>

        {showPrompt && (
          <pre
            className="hermes-mono text-[10.5px] leading-relaxed whitespace-pre-wrap break-words p-3 border max-h-56 overflow-y-auto"
            style={{
              color: "rgba(255,230,203,0.82)",
              borderColor: "rgba(255,230,203,0.2)",
              background: "rgba(0,0,0,0.4)",
            }}
            onWheel={forwardWheelAtBoundary}
          >
            {installPrompt}
          </pre>
        )}
      </div>
    </div>
  );
}

function HermesLiveSkills() {
  const { data } = useHermesSkills();
  const skills = data?.skills ?? [];
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_COUNT = 8;
  const visible = expanded ? skills : skills.slice(0, COLLAPSED_COUNT);
  const hasMore = skills.length > COLLAPSED_COUNT;

  // Brand-locked accent rotation for the bullet pill on the left of each
  // row. Cycles cobalt / amber / teal / cream-sand to match the rest of
  // the page palette.
  const ACCENTS = ["#60a5fa", "#FFD21E", "#86efac", "#FFE6CB"];

  return (
    <section id="pillar-skills" className="mb-12 scroll-mt-24">
      <SectionHead
        title="Skill Library"
        meta={`${skills.length} categories · ~/.hermes/skills/`}
      />

      {/* Hero image — one custom Hermes-branded piece that sets the
          section's identity. Replaces the 24 mini gradient headers. The
          custom _skills-hero.png drops in here when the Kie.ai agent
          finishes; falls back to pantheon07 (alchemist's workshop) in
          the meantime since the file isn't on disk yet. */}
      <div
        className="relative mt-3 mb-5 border overflow-hidden"
        style={{
          borderColor: "rgba(255,230,203,0.4)",
          aspectRatio: "3 / 1",
        }}
      >
        <img
          src={skillsHero}
          alt="Skill library"
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 45%" }}
          loading="lazy"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(7,29,28,0.85) 0%, rgba(7,29,28,0.35) 45%, rgba(7,29,28,0) 70%, rgba(7,29,28,0.6) 100%)",
          }}
        />
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 md:px-8 max-w-md">
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.24em]"
            style={{ color: "rgba(255,230,203,0.65)" }}
          >
            ❯ {skills.length} categories
          </div>
          <div
            className="hermes-display uppercase mt-1.5 leading-[0.95]"
            style={{
              color: CREAM,
              fontSize: 28,
              letterSpacing: "0.02em",
              textShadow: "0 2px 14px rgba(0,0,0,0.7)",
            }}
          >
            What Hermes can do
          </div>
          <p
            className="text-[13.5px] leading-snug mt-2"
            style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
          >
            Skills auto-load into a conversation when relevant. Install new packs with{" "}
            <span className="hermes-mono" style={{ color: CREAM, fontSize: "12px" }}>
              hermes skills install &lt;pack&gt;
            </span>{" "}
            — they appear here automatically, no restart needed.
          </p>
        </div>
      </div>

      {skills.length === 0 ? (
        <div
          className="border px-5 py-8 hermes-mono text-[12px] uppercase tracking-[0.22em] text-center"
          style={{ borderColor: "rgba(255,230,203,0.55)", color: "rgba(255,230,203,0.55)" }}
        >
          No skills on disk yet · run hermes setup tools
        </div>
      ) : (
        <>
          {/* Numbered cards (01..N). Each card has a brand-accent colour
              from the rotation + a subtle radial glow + a hover-only
              gradient flicker. No images — the number IS the
              differentiator. Scales effortlessly to 50+ skills. */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {visible.map((s, i) => (
              <SkillTile
                key={s.id}
                skill={s}
                accent={ACCENTS[i % ACCENTS.length]}
                index={i}
              />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="hermes-mono px-4 py-2 border text-[11px] uppercase tracking-[0.22em] transition-colors"
                style={{
                  background: "transparent",
                  color: CREAM,
                  borderColor: "rgba(255,230,203,0.55)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = CREAM)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,230,203,0.55)")
                }
              >
                {expanded
                  ? `Show top ${COLLAPSED_COUNT}`
                  : `Show all ${skills.length} skills`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Skill tile background variants — built once at module load. We take
// the 10 Pantheon images and pair each with 3 different object-position
// crops (top-left / center / bottom-right). That's 30 unique visual
// backdrops so adjacent skill tiles never share a background even on a
// 24-tile grid.
const SKILL_BG_VARIANTS: Array<{ src: string; pos: string }> = (() => {
  const positions = ["20% 15%", "50% 50%", "80% 75%"];
  const out: Array<{ src: string; pos: string }> = [];
  const srcs = [
    pantheon01,
    pantheon02,
    pantheon03,
    pantheon04,
    pantheon05,
    pantheon06,
    pantheon07,
    pantheon08,
    pantheon09,
    pantheon10,
  ];
  // Interleave so the first 10 tiles each get a different IMAGE before
  // we start cycling positions.
  for (const pos of positions) {
    for (const src of srcs) {
      out.push({ src, pos });
    }
  }
  return out;
})();

// Tiny accent rotation — kept minimal so cards aren't a rainbow. Just
// three subtle brand-adjacent tints we cycle through (no repeating
// neighbours).
const SKILL_ACCENT_VARIANTS = [
  "rgba(255,230,203,0.55)",
  "rgba(255,210,30,0.55)",
  "rgba(140,98,235,0.5)",
];

// Final-fallback descriptions for skill categories the filesystem probe
// returned empty for. The endpoint already tries DESCRIPTION.md, then
// SKILL.md, then a sub-skill's SKILL.md — this dictionary catches the
// rare cases where all three are missing. Keep these short, 1 sentence,
// plain English.
const SKILL_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  apple: "Apple / macOS tools — Finder, native apps, system features, screenshots.",
  "autonomous-ai-agents":
    "Spawn and orchestrate sub-agents (Claude Code, Codex, Hermes) to run independent work.",
  "claude-os":
    "Bridge to your operator dashboard — read sessions, memory, integrations, dream, kanban.",
  creative:
    "Generative content — ASCII art, hand-drawn diagrams, infographics, design utilities.",
  "data-science":
    "Jupyter notebooks, data exploration, analysis pipelines, visualization.",
  devops:
    "Server ops, deployment, CI/CD, infrastructure tasks across local + cloud.",
  diagramming:
    "Architecture diagrams, flowcharts, Excalidraw / Mermaid generation.",
  dogfood:
    "Exploratory QA — drives a browser to find bugs, capture evidence, file a report.",
  domain:
    "Domain-specific helpers — niche workflows scoped to one practice area.",
  email: "Read, search, draft and send email — Gmail / iMessage threads.",
  gaming:
    "Game-related utilities — modding, save inspection, mechanics scripts.",
  gateway:
    "Messaging gateway plumbing — Telegram / Slack / WhatsApp / Discord wiring.",
  gifs: "Animated GIF generation and editing.",
  github: "Repo ops — issues, PRs, code review, gh CLI workflows.",
  "inference-sh":
    "Local / remote model inference helpers (Ollama, vLLM, llama.cpp).",
  mcp: "Model Context Protocol — install, configure, and orchestrate MCP servers.",
  media: "Image, video, and audio generation via Kie / Runway / ElevenLabs.",
  memory:
    "External memory providers — byterover, mem0, supermemory, Pinecone, etc.",
  "openai-codex":
    "OpenAI Codex sub-agent — delegate code generation and refactors.",
  opencode: "OpenCode sub-agent — open-source alternative for code tasks.",
  "claude-code":
    "Claude Code sub-agent — delegate substantial coding work to Claude.",
  research: "Web search, paper retrieval, structured research loops.",
  "scheduled-tasks": "Cron, launchd, and timer-based task scheduling.",
  utility: "General-purpose helpers that don't fit anywhere else.",
  yuanbao: "Tencent Yuanbao integration — Chinese chat / search.",
  web: "Generic web search, scraping, and content extraction.",
};

function describeSkill(skill: HermesSkillCategory): string {
  if (skill.description && skill.description.length > 0) return skill.description;
  return SKILL_FALLBACK_DESCRIPTIONS[skill.id] ?? "";
}

function SkillTile({
  skill,
  index,
}: {
  skill: HermesSkillCategory;
  // accent prop retired — accent is now derived from index so tiles
  // never repeat their neighbour's tint.
  accent?: string;
  index: number;
}) {
  const bg = SKILL_BG_VARIANTS[index % SKILL_BG_VARIANTS.length]!;
  const accent =
    SKILL_ACCENT_VARIANTS[index % SKILL_ACCENT_VARIANTS.length] ?? CREAM;
  const cardRef = useRef<HTMLDivElement>(null);
  // Cursor-tracked spotlight — on mousemove we write the cursor's local
  // (x, y) into CSS variables on the card itself. The hover overlay
  // below uses them as the centre of a radial gradient. Pure CSS-vars
  // path avoids React re-renders, so the spotlight tracks at 60fps no
  // matter how many cards are visible.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }
  return (
    <div
      ref={cardRef}
      className="group relative border overflow-hidden transition-all flex flex-col min-h-[148px]"
      style={{ borderColor: "rgba(255,230,203,0.3)" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,230,203,0.3)")}
    >
      {/* Pantheon image background — unique per tile via index lookup
          into SKILL_BG_VARIANTS. The pantheon-glitch class applies the
          chromatic-aberration SVG filter for brand consistency. A heavy
          dark wash on top keeps the text legible. */}
      <img
        src={bg.src}
        alt=""
        aria-hidden
        className="pantheon-glitch absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          opacity: 0.7,
          objectPosition: bg.pos,
          transform: "scale(1.15)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,29,28,0.65) 0%, rgba(7,29,28,0.86) 60%, rgba(7,29,28,0.94) 100%)",
        }}
      />
      {/* Cursor-tracked spotlight — a soft radial glow centred on the
          cursor as it moves across the card. Position is fed via the
          --spot-x / --spot-y CSS variables set by handleMouseMove on
          the card ref above. Tinted with the card's accent so each
          tile has its own spotlight colour. Fades in on group-hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            `radial-gradient(circle 220px at var(--spot-x, 50%) var(--spot-y, 50%), ${accent}40 0%, ${accent}1a 35%, transparent 70%)`,
        }}
      />
      {/* Thin accent stripe at the top — one of three brand-locked tints
          rotating so adjacent cards differ but the field stays cohesive. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: 1.5,
          background: accent,
        }}
      />

      <div className="relative z-10 p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start gap-3">
          <span
            className="hermes-display shrink-0"
            style={{
              color: CREAM,
              fontSize: 36,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              fontWeight: 600,
              opacity: 0.92,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="hermes-display uppercase leading-tight truncate"
              style={{
                color: CREAM,
                fontSize: "15px",
                letterSpacing: "0.04em",
              }}
            >
              {skill.id.replace(/-/g, " ")}
            </div>
            <div
              className="hermes-mono text-[9.5px] uppercase tracking-[0.22em] mt-1"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              {skill.subskills.length === 0
                ? "no subskills"
                : `${skill.subskills.length} subskill${skill.subskills.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>
        <div
          className="text-[12.5px] leading-snug line-clamp-3 mt-auto"
          style={{ color: "rgba(255,230,203,0.78)", fontFamily: '"Fraunces", serif' }}
          title={describeSkill(skill) || ""}
        >
          {describeSkill(skill) || "—"}
        </div>
      </div>
    </div>
  );
}

// (SkillCell + SkillRow superseded by SkillTile above.)

// Reusable section header — bigger, bolder, with a clear meta on the right.
// Replaces the small uppercase eyebrow used previously so section titles
// like "Bundled Skill Library" actually read as headers.
function SectionHead({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="px-1 pb-3 mb-1 flex items-end justify-between border-b gap-4"
      style={{ borderColor: "rgba(255,230,203,0.55)" }}
    >
      <div className="min-w-0">
        <h2
          className="hermes-display leading-none truncate"
          style={{
            color: CREAM,
            fontSize: "26px",
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      {right ? (
        right
      ) : meta ? (
        <div
          className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] shrink-0"
          style={{ color: "rgba(255,230,203,0.6)" }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Recent sessions — pulls latest from ~/.hermes/sessions/*.json
// ────────────────────────────────────────────────────────────────────────────

function HermesRecentSessions() {
  const { data } = useHermesSessions();
  const sessions = (data?.sessions ?? []).slice(0, 6);

  return (
    <section className="mb-12">
      <SectionHead
        title="Recent Sessions"
        right={
          <a
            href="http://localhost:9119/sessions"
            target="_blank"
            rel="noopener noreferrer"
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] inline-flex items-center gap-1 transition-colors shrink-0"
            style={{ color: "rgba(255,230,203,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.6)")}
          >
            View all in Hermes Dashboard <ArrowUpRight className="h-3 w-3" />
          </a>
        }
      />
      {sessions.length === 0 ? (
        <div
          className="border mt-3 px-5 py-8 hermes-mono text-[12px] uppercase tracking-[0.22em] text-center"
          style={{ borderColor: "rgba(255,230,203,0.55)", color: "rgba(255,230,203,0.55)" }}
        >
          No sessions yet · start a conversation above
        </div>
      ) : (
        <div className="border mt-3" style={{ borderColor: "rgba(255,230,203,0.55)" }}>
          {sessions.map((s, i) => (
            <SessionRow key={s.id} session={s} isLast={i === sessions.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}

// Platform → display label + Simple Icons slug. Hermes saves a `platform`
// field on every session ("cli", "telegram", "discord", "slack", etc.) so
// we can tell at a glance which channel a conversation came from.
const PLATFORM_BADGES: Record<string, { label: string; slug?: string }> = {
  cli: { label: "CLI" },
  telegram: { label: "Telegram", slug: "telegram" },
  discord: { label: "Discord", slug: "discord" },
  slack: { label: "Slack", slug: "slack" },
  whatsapp: { label: "WhatsApp", slug: "whatsapp" },
  signal: { label: "Signal", slug: "signal" },
  matrix: { label: "Matrix", slug: "matrix" },
  email: { label: "Email", slug: "gmail" },
  bluebubbles: { label: "iMessage", slug: "imessage" },
  webhook: { label: "Webhook" },
};

// Tiny icon-only variant of PlatformBadge used as a corner overlay on
// session avatars in the collapsed sidebar rail.
function PlatformBadgeIcon({
  platform,
  size = 10,
}: {
  platform: string | null;
  size?: number;
}) {
  if (!platform) return null;
  const meta = PLATFORM_BADGES[platform.toLowerCase()];
  if (!meta?.slug) {
    return (
      <span
        className="hermes-mono inline-block"
        style={{
          width: size,
          height: size,
          fontSize: size - 1,
          lineHeight: 1,
          color: "rgba(255,230,203,0.75)",
        }}
      >
        ❯
      </span>
    );
  }
  return (
    <img
      src={`https://cdn.simpleicons.org/${meta.slug}/FFE6CB`}
      alt=""
      className="object-contain"
      style={{ width: size, height: size }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const meta = PLATFORM_BADGES[platform.toLowerCase()] ?? {
    label: platform.toUpperCase(),
  };
  return (
    <span
      className="hermes-mono inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9.5px] uppercase tracking-[0.22em] shrink-0"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        color: "rgba(255,230,203,0.85)",
        background: "rgba(255,230,203,0.04)",
      }}
    >
      {meta.slug && (
        <img
          src={`https://cdn.simpleicons.org/${meta.slug}/FFE6CB`}
          alt=""
          className="object-contain"
          style={{ width: 10, height: 10 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {meta.label}
    </span>
  );
}

function SessionRow({ session, isLast }: { session: HermesSession; isLast: boolean }) {
  const when = session.lastUpdated || session.startedAt;
  const ago = when
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(when).getTime()) / 60_000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })()
    : "—";
  return (
    <div
      className="px-5 py-3 flex items-center gap-4"
      style={{
        borderBottom: isLast ? undefined : "1px solid rgba(255,230,203,0.25)",
      }}
    >
      <ProviderLogoChip provider={session.model?.split(/[/_-]/)[0] ?? null} size={20} />
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] truncate"
          style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
        >
          {session.firstUserMessage || `Session ${session.id.slice(0, 8)}`}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <PlatformBadge platform={session.platform} />
          <span
            className="hermes-mono text-[10.5px] uppercase tracking-[0.18em] truncate"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            {session.model ?? "no model"} · {session.messageCount} msg
            {session.messageCount === 1 ? "" : "s"} · {ago}
          </span>
        </div>
      </div>
    </div>
  );
}

interface Role {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  name: string;
  brief: string;
  kbd: string;
  sample?: string;
  featured?: boolean;
  tools: string[];
}

const ROLES: Role[] = [
  {
    icon: Megaphone,
    name: "Marketing Strategist",
    brief: "Positioning, hooks, audience cuts.",
    kbd: "M",
    sample: '"3 hooks for the launch teardown"',
    featured: true,
    tools: ["Hooks", "Personas", "Channels"],
  },
  {
    icon: Radio,
    name: "Comms Lead",
    brief: "PR drafts, tone, crisis loops.",
    kbd: "C",
    sample: '"Draft response to the @verge thread"',
    featured: true,
    tools: ["Statements", "FAQ", "Tone"],
  },
  {
    icon: FlaskConical,
    name: "Research Analyst",
    brief: "Deep-dive teardown reports.",
    kbd: "R",
    sample: '"Map the prompt-injection landscape"',
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
];

function HermesRolesSection() {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="hermes-eyebrow mb-2">Roles</div>
          <h2 className="hermes-display text-2xl md:text-3xl" style={{ color: CREAM }}>
            Summon Hermes as…
          </h2>
          <p
            className="hermes-mono mt-2 text-[12px] max-w-2xl leading-relaxed"
            style={{ color: "rgba(255,230,203,0.65)" }}
          >
            Each role rebriefs Hermes with its own system prompt, tools, and house style.
          </p>
        </div>
        <span
          className="hermes-mono text-[10px] uppercase tracking-[0.2em] hidden md:inline"
          style={{ color: "rgba(255,230,203,0.5)" }}
        >
          Click to brief
        </span>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border"
        style={{ borderColor: "rgba(255,230,203,0.2)" }}
      >
        {ROLES.map((r, i) => (
          <RoleCell key={r.name} role={r} index={i} />
        ))}
      </div>
    </section>
  );
}

function RoleCell({ role, index }: { role: Role; index: number }) {
  return (
    <button
      type="button"
      className="group text-left p-5 relative transition-colors"
      style={{
        borderRight: index % 3 !== 2 ? "1px solid rgba(255,230,203,0.2)" : undefined,
        borderBottom: index < ROLES.length - 3 ? "1px solid rgba(255,230,203,0.2)" : undefined,
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 flex items-center justify-center shrink-0 border"
          style={{
            background: "rgba(255,230,203,0.06)",
            borderColor: "rgba(255,230,203,0.3)",
          }}
        >
          <role.icon className="h-4 w-4" style={{ color: CREAM }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="hermes-display text-lg leading-tight" style={{ color: CREAM }}>
              {role.name}
            </div>
            {role.featured && (
              <span
                className="hermes-mono text-[9px] uppercase tracking-[0.22em] px-1.5 py-0.5 border"
                style={{ borderColor: "rgba(255,230,203,0.55)", color: CREAM }}
              >
                Pinned
              </span>
            )}
          </div>
          <div
            className="hermes-mono mt-1 text-[11px] leading-relaxed"
            style={{ color: "rgba(255,230,203,0.6)" }}
          >
            {role.brief}
          </div>
        </div>
        <kbd
          className="hermes-mono shrink-0 text-[10px] px-1.5 py-0.5 border"
          style={{
            borderColor: "rgba(255,230,203,0.25)",
            color: "rgba(255,230,203,0.6)",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          ⌘{role.kbd}
        </kbd>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {role.tools.map((t) => (
          <span
            key={t}
            className="hermes-mono text-[10px] px-2 py-0.5 border"
            style={{ borderColor: "rgba(255,230,203,0.25)", color: CREAM }}
          >
            {t}
          </span>
        ))}
      </div>
      {role.featured && role.sample && (
        <div
          className="mt-3 pt-3 border-t border-dashed"
          style={{ borderColor: "rgba(255,230,203,0.2)" }}
        >
          <div className="hermes-eyebrow mb-1">Sample brief</div>
          <div className="hermes-mono text-[11.5px] italic" style={{ color: CREAM }}>
            <span style={{ color: "rgba(255,230,203,0.5)" }}>›</span> {role.sample}
          </div>
        </div>
      )}
    </button>
  );
}

function HermesActivityPanels() {
  const investigations = [
    { t: "Market sizing summary", d: "32m · 18 sources", tag: "research" },
    { t: "Quarterly review synthesis", d: "1h 4m · 41 sources", tag: "synthesis" },
    { t: "Cash-flow stress test", d: "22m · 7 sources", tag: "modelling" },
    { t: "Customer interview rewrite", d: "48m · 12 sources", tag: "drafting" },
  ];
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
      <div
        className="lg:col-span-2 border p-5"
        style={{ borderColor: "rgba(255,230,203,0.2)", background: "rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="hermes-display text-xl" style={{ color: CREAM }}>
            Recent investigations
          </h2>
          <span
            className="hermes-mono text-[10px] uppercase tracking-[0.2em] inline-flex items-center gap-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
        <ul className="divide-y" style={{ borderColor: "rgba(255,230,203,0.15)" }}>
          {investigations.map((r, i) => (
            <li
              key={i}
              className="py-3 flex items-center gap-3"
              style={i > 0 ? { borderTop: "1px solid rgba(255,230,203,0.15)" } : undefined}
            >
              <MessageSquare className="h-4 w-4" style={{ color: CREAM }} />
              <div className="min-w-0 flex-1">
                <div className="hermes-display text-[15px] truncate" style={{ color: CREAM }}>
                  {r.t}
                </div>
                <div
                  className="hermes-mono text-[10.5px] uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,230,203,0.55)" }}
                >
                  {r.d}
                </div>
              </div>
              <span
                className="hermes-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 border"
                style={{ borderColor: "rgba(255,230,203,0.35)", color: CREAM }}
              >
                {r.tag}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="border p-5"
        style={{ borderColor: "rgba(255,230,203,0.2)", background: "rgba(0,0,0,0.2)" }}
      >
        <h2 className="hermes-display text-xl mb-4" style={{ color: CREAM }}>
          Capabilities
        </h2>
        <div className="space-y-3">
          <Capability label="Long-context synthesis" pct={92} />
          <Capability label="Structured reasoning" pct={86} />
          <Capability label="Code generation" pct={71} />
          <Capability label="Vision (multimodal)" pct={48} />
        </div>
      </div>
    </section>
  );
}

function Capability({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="hermes-mono" style={{ color: CREAM }}>
          {label}
        </span>
        <span className="hermes-mono tabular-nums" style={{ color: "rgba(255,230,203,0.6)" }}>
          {pct}%
        </span>
      </div>
      <div className="h-1 overflow-hidden" style={{ background: "rgba(255,230,203,0.1)" }}>
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: CREAM,
          }}
        />
      </div>
    </div>
  );
}

function HermesSkillsSection() {
  const skills = [
    "Deep Research",
    "Document Q&A",
    "Inbox Triage",
    "Weekly Brief",
    "Meeting Notes",
    "Spec Drafting",
  ];
  return (
    <section className="mb-10">
      <div className="mb-4">
        <div className="hermes-eyebrow mb-2">Skills bound to Hermes</div>
        <h2 className="hermes-display text-2xl md:text-3xl" style={{ color: CREAM }}>
          What he already knows how to do.
        </h2>
      </div>
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-0 border"
        style={{ borderColor: "rgba(255,230,203,0.2)" }}
      >
        {skills.map((s, i) => (
          <div
            key={s}
            className="p-4 flex items-center gap-3"
            style={{
              borderRight: i % 3 !== 2 ? "1px solid rgba(255,230,203,0.2)" : undefined,
              borderBottom: i < skills.length - 3 ? "1px solid rgba(255,230,203,0.2)" : undefined,
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <Zap className="h-4 w-4" style={{ color: CREAM }} />
            <span className="hermes-mono text-[12.5px]" style={{ color: CREAM }}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CLI cheatsheet — the commands you actually run day-to-day, categorised,
// with copy buttons. Replaces the "Features" marketing grid.
// ────────────────────────────────────────────────────────────────────────────

interface CliCommand {
  cmd: string;
  hint?: string;
}
interface CliCategory {
  title: string;
  commands: CliCommand[];
}

const CLI_CATEGORIES: CliCategory[] = [
  {
    title: "Daily Use",
    commands: [
      { cmd: "hermes chat", hint: "Open an interactive chat with history" },
      { cmd: 'hermes chat -q "<prompt>"', hint: "One-shot query — no history" },
      { cmd: "hermes chat --continue", hint: "Resume your most recent session" },
      { cmd: "hermes sessions list", hint: "All saved conversations" },
    ],
  },
  {
    title: "Config & Setup",
    commands: [
      { cmd: "hermes setup", hint: "Full re-run of the setup wizard" },
      { cmd: "hermes setup model", hint: "Switch provider / model only" },
      { cmd: "hermes setup gateway", hint: "Wire Telegram / Discord / Slack" },
      { cmd: "hermes setup agent", hint: "Personality, voice, defaults (SOUL.md)" },
      { cmd: "hermes config show", hint: "Print all current settings" },
      { cmd: "hermes status", hint: "Check what's connected" },
    ],
  },
  {
    title: "Auth",
    commands: [
      { cmd: "hermes login --provider nous", hint: "Sign in to Nous Portal" },
      { cmd: "hermes auth", hint: "OAuth into ChatGPT (openai-codex)" },
      { cmd: "hermes logout", hint: "Clear stored credentials" },
    ],
  },
  {
    title: "Skills & Tools",
    commands: [
      { cmd: "hermes skills list", hint: "Show bundled + installed skills" },
      { cmd: "hermes skills search <q>", hint: "Find skills matching a query" },
      { cmd: "hermes tools", hint: "Toggle which tools Hermes can use" },
      { cmd: "hermes plugins", hint: "Install / update / remove plugins" },
    ],
  },
  {
    title: "Automations",
    commands: [
      { cmd: "hermes cron", hint: "List + manage scheduled jobs" },
      { cmd: "hermes webhook", hint: "Inbound webhook subscriptions" },
      { cmd: "hermes hooks", hint: "Shell hooks fired on events" },
    ],
  },
  {
    title: "Maintenance",
    commands: [
      { cmd: "hermes doctor", hint: "Diagnose problems with the install" },
      { cmd: "hermes update", hint: "Upgrade to the latest Hermes" },
      { cmd: "hermes backup", hint: "Zip up everything in ~/.hermes" },
      { cmd: "hermes dashboard", hint: "Open the full web UI on :9119" },
    ],
  },
];

function HermesCliCheatsheet() {
  return (
    <section className="mb-10">
      <div className="px-1 pb-3 mb-6 flex items-baseline justify-between">
        <div className="hermes-eyebrow">CLI</div>
        <div
          className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "rgba(255,230,203,0.45)" }}
        >
          Click any command to copy
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6">
        {CLI_CATEGORIES.map((cat) => (
          <CliCategoryCell key={cat.title} cat={cat} />
        ))}
      </div>
    </section>
  );
}

function CliCategoryCell({ cat }: { cat: CliCategory }) {
  // Understated: no card chrome, no background, no borders. Just a small
  // caps title and a column of commands. Lives on the page background.
  return (
    <div>
      <div
        className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-2 pb-1 border-b"
        style={{
          color: "rgba(255,230,203,0.55)",
          borderColor: "rgba(255,230,203,0.18)",
        }}
      >
        {cat.title}
      </div>
      <ul className="space-y-1.5">
        {cat.commands.map((c) => (
          <CliCommandRow key={c.cmd} command={c} />
        ))}
      </ul>
    </div>
  );
}

function CliCommandRow({ command }: { command: CliCommand }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void copyToClipboard(command.cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <li>
      <button
        type="button"
        onClick={handleCopy}
        // items-center keeps the "Copy" chip on the same baseline as the
        // command text instead of floating above when the hint wraps.
        className="w-full text-left flex items-center gap-2 group transition-colors"
        title="Click to copy"
      >
        <span
          className="hermes-mono text-[12px] flex-1 truncate leading-none"
          style={{ color: CREAM }}
        >
          {command.cmd}
        </span>
        {/* Inline chip — sits perfectly on the command line via items-center
            up top. Reserves its slot via min-width so the layout doesn't
            shift on hover; fades in on group-hover or when copied. */}
        <span
          className={`hermes-mono text-[9px] uppercase tracking-[0.22em] px-1.5 py-0.5 border inline-flex items-center justify-center transition-opacity leading-none shrink-0 ${copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={{
            color: copied ? "#86efac" : "rgba(255,230,203,0.7)",
            borderColor: copied ? "rgba(134,239,172,0.6)" : "rgba(255,230,203,0.25)",
            background: copied ? "rgba(134,239,172,0.08)" : "rgba(0,0,0,0.35)",
            minWidth: 50,
            height: 18,
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </span>
      </button>
      {command.hint && (
        <div
          className="text-[11.5px] leading-tight mt-0.5"
          style={{ color: "rgba(255,230,203,0.55)", fontFamily: '"Fraunces", serif' }}
        >
          {command.hint}
        </div>
      )}
    </li>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="border p-5"
      style={{ borderColor: "rgba(255,230,203,0.2)", background: "rgba(0,0,0,0.25)" }}
    >
      <div
        className="flex items-center gap-2 hermes-mono text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "rgba(255,230,203,0.5)" }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: CREAM }} />
        {label}
      </div>
      <div className="hermes-display mt-2 text-4xl" style={{ color: CREAM }}>
        {value}
      </div>
      <div
        className="hermes-mono mt-1 text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "rgba(255,230,203,0.45)" }}
      >
        {sub}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Run-in-terminal card — single component used for both the
// "not installed" and "installed but no provider key" states.
//
// Setup intentionally lives in the user's terminal. Hermes has its own
// great `hermes setup` wizard (provider picker, OAuth flows, model
// selection, optional gateways / tts / tools) — we don't reimplement it
// in the browser. The dashboard's value is the chat + insights once
// configured. When state is anything other than "ready", this card hands
// the user the right copy-paste command and gets out of the way.
// ────────────────────────────────────────────────────────────────────────────

function RunInTerminalCard({
  title,
  body,
  command,
  hint,
}: {
  title: string;
  body: React.ReactNode;
  command: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void copyToClipboard(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <section className="mb-10">
      <div
        className="border"
        style={{
          borderColor: "rgba(255,230,203,0.55)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(255,230,203,0.25)" }}
        >
          <div
            className="hermes-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: CREAM }}
          >
            ❯ Terminal step
          </div>
          <img
            src={hermesLogo}
            alt="Hermes"
            className="h-5 w-auto object-contain"
            style={{ filter: "drop-shadow(0 0 10px rgba(255,210,30,0.4))" }}
          />
        </div>
        <div className="px-6 md:px-10 py-8 flex flex-col items-center text-center">
          <h2
            className="hermes-display text-3xl md:text-4xl mb-4"
            style={{ color: CREAM, lineHeight: 1.05 }}
          >
            {title}
          </h2>
          <p
            className="text-[15px] md:text-[16px] max-w-2xl leading-relaxed mb-7"
            style={{
              color: "rgba(255,230,203,0.78)",
              fontFamily: '"Fraunces", serif',
            }}
          >
            {body}
          </p>
          <div
            className="w-full max-w-2xl border"
            style={{ borderColor: "rgba(255,230,203,0.55)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b"
              style={{ borderColor: "rgba(255,230,203,0.4)" }}
            >
              <span
                className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,230,203,0.65)" }}
              >
                Run in your terminal
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors inline-flex items-center gap-1.5"
                style={{ color: copied ? CREAM : "rgba(255,230,203,0.65)" }}
              >
                <CheckCircle2 className="h-3 w-3" style={{ opacity: copied ? 1 : 0 }} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="px-5 py-4 text-left" style={{ background: CODE_BG }}>
              <code className="hermes-mono text-[13px] block break-all" style={{ color: CREAM }}>
                {command}
              </code>
            </div>
          </div>
          {hint && (
            <div
              className="hermes-mono text-[11px] uppercase tracking-[0.18em] mt-5 max-w-2xl"
              style={{ color: "rgba(255,230,203,0.55)" }}
            >
              {hint}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

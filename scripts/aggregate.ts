#!/usr/bin/env bun
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const CODEX_DIR = join(HOME, ".codex");
const OPENCLAW_JSON = join(HOME, ".openclaw", "openclaw.json");
const OUT = join(import.meta.dir, "..", "src", "data", "live-data.json");

const IS_MACOS = process.platform === "darwin";
const REDACT_PREVIEWS = process.env.CLAUDE_OS_REDACT_PREVIEWS !== "0";
const SHOW_INDEX_NAMES = process.env.CLAUDE_OS_SHOW_INDEX_NAMES === "1";

if (!IS_MACOS) {
  console.warn(
    `[aggregate] platform: ${process.platform} — some macOS-only signals (Keychain credential count, exact plan-tier detection)`,
  );
  console.warn(
    `[aggregate] will be skipped. Project sessions, daily totals, and Pinecone indexes still aggregate normally.`,
  );
}

// Load .env.local from the parent (claude-os) directory so secrets like
// PINECONE_API_KEY and KIE_API_KEY are available without a manual export.
const envPath = join(import.meta.dir, "..", ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}

// ── Anonymization ──
// The dashboard is meant to be screenshot/streamed publicly. We strip the
// real macOS username, the operator's full name, GitHub handle, and any email
// addresses out of every string we emit. Toggle off only by setting
// CLAUDE_OS_ANONYMIZE=0 (default is on).
const ANON = process.env.CLAUDE_OS_ANONYMIZE !== "0";
const REAL_USER = (() => {
  const home = HOME;
  const m = home.match(/\/Users\/([^/]+)/);
  return m?.[1] ?? "operator";
})();

// On macOS, pull the user's full name from `dscl` and add each space-separated
// token (capitalised first/last/middle name) to the redact list automatically.
// This protects against memory-file previews that contain the operator's
// etc. without the user having to remember to set CLAUDE_OS_REDACT_NAMES.
function autoRedactNames(): string[] {
  if (!IS_MACOS) return [];
  try {
    const p = Bun.spawnSync(["dscl", ".", "-read", `/Users/${REAL_USER}`, "RealName"]);
    const out = new TextDecoder().decode(p.stdout);
    // Output looks like: "RealName:\n First Middle Last" (newline-prefixed)
    const match = out.match(/RealName:\s*\n?\s*(.+)/);
    if (!match) return [];
    return match[1]
      .trim()
      .split(/\s+/)
      .filter((n) => n.length >= 2 && /^[A-Z]/.test(n));
  } catch {
    return [];
  }
}

// Configure extra names to redact via env, e.g.:
//   CLAUDE_OS_REDACT_NAMES="Real Name,handle,nickname"
const REDACT_NAMES = [
  ...autoRedactNames(),
  ...(process.env.CLAUDE_OS_REDACT_NAMES || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean),
];

function sanitize(value: string | undefined | null): string | undefined {
  if (!value) return value ?? undefined;
  if (!ANON) return value;
  let s = value;
  // /Users/<realuser> → /Users/operator (and ~ shorthand)
  s = s.split(`/Users/${REAL_USER}`).join("/Users/operator");
  s = s.split(`/users/${REAL_USER}`).join("/users/operator");
  // Dash-encoded path form (Claude project keys flatten / to -)
  s = s.split(`-Users-${REAL_USER}`).join("-Users-operator");
  s = s.split(`users-${REAL_USER}`).join("users-operator");
  // Configured names from CLAUDE_OS_REDACT_NAMES
  for (const name of REDACT_NAMES) {
    s = s.split(name).join("Operator");
  }
  // Emails
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "<email-redacted>");
  return s;
}

function sanitizeForEmission(value: unknown, key?: string): unknown {
  if (key === "preview" && REDACT_PREVIEWS) return undefined;
  if (typeof value === "string") return sanitize(value) ?? value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForEmission(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const cleaned = sanitizeForEmission(childValue, childKey);
      if (cleaned !== undefined) out[childKey] = cleaned;
    }
    return out;
  }
  return value;
}

const PRICING_PER_MTOK = {
  "claude-opus-4-7": { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  "claude-opus-4-6": { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cache_read: 0.1, cache_write: 1.25 },
} as const;

const PLAN_5H_MESSAGE_CAPS: Record<string, number> = {
  "Claude Pro": 45,
  "Claude Max 5x": 225,
  "Claude Max 20x": 900,
};

interface AssistantUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

async function walkJsonl(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walkJsonl(p, out);
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

async function parseJsonls() {
  const files = await walkJsonl(PROJECTS_DIR);
  const now = Date.now();
  const FIVE_H = 5 * 60 * 60 * 1000;
  const SEVEN_D = 7 * 24 * 60 * 60 * 1000;
  const ONE_D = 24 * 60 * 60 * 1000;

  const modelTokens: Record<string, AssistantUsage & { messages: number }> = {};
  const dayBucket: Record<string, { tokens: number; messages: number; cost: number }> = {};
  const projectActivity: Record<
    string,
    { lastMs: number; sessions: Set<string>; messages: number }
  > = {};

  // Per-session accumulator — the Activity page renders one row per session.
  // Categories below map raw Claude Code tool names into the 5 lucide icon
  // buckets used by src/routes/activity.tsx: shell | git | browser | file edit | search.
  type RunAcc = {
    sessionId: string;
    projKey: string;
    startMs: number;
    endMs: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreateTokens: number;
    cost: number;
    tools: Set<string>;
    models: Map<string, number>;
    firstUserPrompt: string;
    slashCommand: string;
    messageCount: number;
    filesTouched: Set<string>;
    commandsRun: number;
    gitCommits: number;
  };
  const runs: Map<string, RunAcc> = new Map();

  let assistantTurnsLast5h = 0;
  let assistantTurnsLast7d = 0;
  // Real human-typed prompt counts. Anthropic's plan meter counts billable
  // user→assistant exchanges, not raw assistant rows (a single prompt with
  // tool use generates 5–10+ assistant rows). Counting JSONL `user` rows
  // whose content is NOT a tool_result gets us close to what the Claude
  // app shows in "Plan usage".
  let userPromptsLast5h = 0;
  let userPromptsLast7d = 0;
  // Per-model-family breakdown for rate-limit windows
  const familyTurns5h: Record<string, number> = {};
  const familyTurnsWeekly: Record<string, number> = {};
  let totalAssistant = 0;
  let totalUser = 0;
  let valueExtracted7d = 0;

  // Classify a model ID into its family (opus/sonnet/haiku/other)
  function modelFamily(m: string): string {
    if (/claude.*opus/i.test(m)) return "opus";
    if (/claude.*sonnet/i.test(m)) return "sonnet";
    if (/claude.*haiku/i.test(m)) return "haiku";
    return "other";
  }

  for (const file of files) {
    const projKey = file.replace(PROJECTS_DIR + "/", "").split("/")[0];
    if (!projectActivity[projKey])
      projectActivity[projKey] = { lastMs: 0, sessions: new Set(), messages: 0 };

    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      continue;
    }

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let row: any;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
      if (ts) {
        projectActivity[projKey].lastMs = Math.max(projectActivity[projKey].lastMs, ts);
        if (row.sessionId) projectActivity[projKey].sessions.add(row.sessionId);
      }

      // Per-session accumulator. Touch this on every row that carries a
      // sessionId so we capture the full life of the session, not just
      // assistant turns.
      const sid: string | undefined = row.sessionId;
      let run: RunAcc | undefined;
      if (sid) {
        run = runs.get(sid);
        if (!run) {
          run = {
            sessionId: sid,
            projKey,
            startMs: ts || 0,
            endMs: ts || 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreateTokens: 0,
            cost: 0,
            tools: new Set(),
            models: new Map(),
            firstUserPrompt: "",
            slashCommand: "",
            messageCount: 0,
            filesTouched: new Set(),
            commandsRun: 0,
            gitCommits: 0,
          };
          runs.set(sid, run);
        }
        if (ts) {
          if (!run.startMs || ts < run.startMs) run.startMs = ts;
          if (ts > run.endMs) run.endMs = ts;
        }
        run.messageCount++;
      }

      if (row.type === "user" && row.message?.role === "user") {
        totalUser++;
        projectActivity[projKey].messages++;
        // Real human-typed prompts vs tool-result rows: both arrive as
        // type=user, but tool-results carry content blocks of type=tool_result.
        // First-of-turn user rows have parentUuid=null; follow-ups in the
        // same session inherit the prior assistant's uuid as parentUuid, so
        // we can't filter on parentUuid alone — we must inspect content.
        const content = row.message?.content;
        const isToolResult =
          Array.isArray(content) &&
          content.some((b: any) => b && typeof b === "object" && b.type === "tool_result");
        if (!isToolResult && ts) {
          if (now - ts < FIVE_H) userPromptsLast5h++;
          if (now - ts < SEVEN_D) userPromptsLast7d++;
        }
        // Capture the FIRST human-typed prompt as the session summary line.
        if (run && !run.firstUserPrompt && !isToolResult) {
          let text = "";
          if (typeof content === "string") {
            text = content;
          } else if (Array.isArray(content)) {
            for (const b of content) {
              if (b && typeof b === "object" && b.type === "text" && typeof b.text === "string") {
                text += b.text + " ";
              }
            }
          }
          text = text.trim();
          if (text) {
            run.firstUserPrompt = text.slice(0, 140);
            const cmd = text.match(/^\/([\w-]+)/);
            if (cmd) run.slashCommand = "/" + cmd[1];
          }
        }
      }

      if (row.type === "assistant" && row.message?.usage) {
        totalAssistant++;
        const m = row.message.model || "unknown";
        if (m === "<synthetic>") continue;
        const u = row.message.usage as AssistantUsage;
        if (!modelTokens[m])
          modelTokens[m] = {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
            messages: 0,
          };
        modelTokens[m].input_tokens! += u.input_tokens || 0;
        modelTokens[m].output_tokens! += u.output_tokens || 0;
        modelTokens[m].cache_read_input_tokens! += u.cache_read_input_tokens || 0;
        modelTokens[m].cache_creation_input_tokens! += u.cache_creation_input_tokens || 0;
        modelTokens[m].messages++;

        // Count assistant API turns for rate-limit windows
        const fam = modelFamily(m);
        if (ts && now - ts < FIVE_H) {
          assistantTurnsLast5h++;
          familyTurns5h[fam] = (familyTurns5h[fam] || 0) + 1;
        }
        if (ts && now - ts < SEVEN_D) {
          assistantTurnsLast7d++;
          familyTurnsWeekly[fam] = (familyTurnsWeekly[fam] || 0) + 1;
        }

        const sessionCost = ts ? computeCost(m, u) : 0;
        if (ts) {
          const day = new Date(ts).toISOString().slice(0, 10);
          if (!dayBucket[day]) dayBucket[day] = { tokens: 0, messages: 0, cost: 0 };
          dayBucket[day].tokens += (u.input_tokens || 0) + (u.output_tokens || 0);
          dayBucket[day].messages++;
          dayBucket[day].cost += sessionCost;
          if (now - ts < SEVEN_D) valueExtracted7d += sessionCost;
        }

        // Accumulate into the per-session record.
        if (run) {
          run.inputTokens += u.input_tokens || 0;
          run.outputTokens += u.output_tokens || 0;
          run.cacheReadTokens += u.cache_read_input_tokens || 0;
          run.cacheCreateTokens += u.cache_creation_input_tokens || 0;
          run.cost += sessionCost;
          run.models.set(m, (run.models.get(m) ?? 0) + 1);

          // Walk content blocks for tool_use signatures.
          const acontent = row.message?.content;
          if (Array.isArray(acontent)) {
            for (const block of acontent) {
              if (!block || typeof block !== "object" || block.type !== "tool_use") continue;
              const tname: string = typeof block.name === "string" ? block.name : "";
              const input = (block as any).input ?? {};
              switch (tname) {
                case "Bash": {
                  const cmd = typeof input.command === "string" ? input.command : "";
                  if (/^\s*git\s/.test(cmd)) {
                    run.tools.add("git");
                    if (/\bgit\s+commit\b/.test(cmd)) run.gitCommits++;
                  } else {
                    run.tools.add("shell");
                  }
                  run.commandsRun++;
                  break;
                }
                case "Edit":
                case "MultiEdit":
                case "Write":
                case "NotebookEdit": {
                  run.tools.add("file edit");
                  const fp =
                    typeof input.file_path === "string" ? input.file_path : "";
                  if (fp) run.filesTouched.add(fp);
                  break;
                }
                case "WebFetch":
                case "WebSearch":
                  run.tools.add("browser");
                  break;
                case "Glob":
                case "Grep":
                case "Read":
                case "ToolSearch":
                  run.tools.add("search");
                  break;
              }
            }
          }
        }
      }
    }
  }

  return {
    modelTokens,
    dayBucket,
    projectActivity,
    assistantTurnsLast5h,
    assistantTurnsLast7d,
    userPromptsLast5h,
    userPromptsLast7d,
    familyTurns5h,
    familyTurnsWeekly,
    totalAssistant,
    totalUser,
    valueExtracted7d,
    runs,
  };
}

function computeCost(model: string, u: AssistantUsage): number {
  const p = (PRICING_PER_MTOK as any)[model];
  if (!p) return 0;
  const M = 1_000_000;
  return (
    ((u.input_tokens || 0) * p.input) / M +
    ((u.output_tokens || 0) * p.output) / M +
    ((u.cache_read_input_tokens || 0) * p.cache_read) / M +
    ((u.cache_creation_input_tokens || 0) * p.cache_write) / M
  );
}

async function detectClaudeAuth(usage?: {
  messagesUsedLast5h: number;
  assistantMessages7d: number;
}) {
  const authMode = process.env.ANTHROPIC_API_KEY ? "api_key" : "oauth";
  const credCount = await countKeychainCredentials();

  // Heuristic plan tier from observed message volume.
  // PLAN_5H_MESSAGE_CAPS: Pro 45 · Max 5x 225 · Max 20x 900.
  // We look at the last 5h window and 7d totals to pick the smallest plan
  // that comfortably fits the observed rate, with safety margin.
  let planGuess = "Claude Pro";
  let planConfidence: "low" | "medium" | "high" = "low";
  const evidence: string[] = [];
  if (usage) {
    const peak5h = usage.messagesUsedLast5h;
    const weekly = usage.assistantMessages7d;
    // Weekly total is the strongest signal because lower-tier plans can't
    // sustain high daily volumes without constant rate-limiting.
    // Max 20x: 900 msgs/5h → ~30k theoretical weekly
    // Max 5x:  225 msgs/5h → ~7.5k theoretical weekly
    // Pro:      45 msgs/5h → ~1.5k theoretical weekly
    if (weekly > 1000 || peak5h > 225) {
      planGuess = "Claude Max 20x";
      planConfidence = weekly > 3000 || peak5h > 450 ? "high" : "medium";
    } else if (weekly > 300 || peak5h > 45) {
      planGuess = "Claude Max 5x";
      planConfidence = weekly > 600 || peak5h > 90 ? "high" : "medium";
    } else {
      planGuess = "Claude Pro";
      planConfidence = weekly > 50 ? "medium" : "low";
    }
    evidence.push(`peak 5h window: ${peak5h} turns`);
    evidence.push(`weekly total: ${weekly} turns`);
    evidence.push(`plan guess: ${planGuess} (${planConfidence})`);
  }
  return { authMode, credCount, planGuess, planConfidence, evidence };
}

async function countKeychainCredentials(): Promise<number> {
  // `security dump-keychain` is macOS-only. On Linux/Windows we silently
  // return 0 — the warning at startup tells the user this signal is missing.
  if (!IS_MACOS) return 0;
  try {
    const p = Bun.spawn(["security", "dump-keychain"], { stdout: "pipe", stderr: "pipe" });
    const timer = new Promise<string>((resolve) => setTimeout(() => resolve(""), 2000));
    const reader = (async () => {
      try {
        return await new Response(p.stdout).text();
      } catch {
        return "";
      }
    })();
    const out = await Promise.race([reader, timer]);
    try {
      p.kill();
    } catch {}
    const matches = out.match(/Claude Code-credentials-/g);
    return matches?.length || 0;
  } catch {
    return 0;
  }
}

function detectChatgptAuth() {
  const authPath = join(CODEX_DIR, "auth.json");
  if (!existsSync(authPath)) return { present: false } as const;
  try {
    const j = JSON.parse(readFileSync(authPath, "utf-8"));
    const hasApiKey = Boolean(j.OPENAI_API_KEY);
    const hasOauth = Boolean(j.tokens);

    // Decode the JWT to extract the real plan type
    let jwtPlan: string | null = null;
    try {
      const accessToken = j.tokens?.access_token;
      if (accessToken) {
        const payload = accessToken.split(".")[1];
        const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
        const decoded = JSON.parse(Buffer.from(padded, "base64url").toString());
        jwtPlan = decoded?.["https://api.openai.com/auth"]?.chatgpt_plan_type ?? null;
      }
    } catch {
      // JWT decode failed — fall back to generic detection
    }

    // Read config.toml to check the default model (helps infer tier)
    let configModel: string | null = null;
    try {
      const tomlPath = join(CODEX_DIR, "config.toml");
      if (existsSync(tomlPath)) {
        const toml = readFileSync(tomlPath, "utf-8");
        const modelMatch = toml.match(/^model\s*=\s*"([^"]+)"/m);
        configModel = modelMatch?.[1] ?? null;
      }
    } catch {
      // config.toml read failed
    }

    // Map JWT plan + model to a display name and price
    const planInfo = inferChatgptPlan(jwtPlan, configModel);

    return {
      present: true,
      mode: j.auth_mode || (hasApiKey ? "api_key" : "oauth"),
      hasApiKey,
      hasOauth,
      lastRefresh: j.last_refresh || null,
      jwtPlan,
      configModel,
      ...planInfo,
    };
  } catch {
    return { present: false } as const;
  }
}

function inferChatgptPlan(
  jwtPlan: string | null,
  model: string | null,
): { planName: string; monthlyPrice: number; confidence: "high" | "medium" | "low" } {
  // JWT plan_type is the primary signal. Model name is unreliable because
  // Codex gives access to gpt-5.5/o3-pro even on Plus plans — Codex
  // billing is separate from ChatGPT billing.
  switch (jwtPlan) {
    case "plus":
      return { planName: "ChatGPT Plus", monthlyPrice: 20, confidence: "high" };
    case "pro":
      return { planName: "ChatGPT Pro", monthlyPrice: 200, confidence: "high" };
    case "team":
      return { planName: "ChatGPT Team", monthlyPrice: 25, confidence: "high" };
    case "enterprise":
      return { planName: "ChatGPT Enterprise", monthlyPrice: 0, confidence: "high" };
    case "max":
      return { planName: "ChatGPT Max", monthlyPrice: 200, confidence: "high" };
    default:
      // If we see a high-tier model but unknown plan, suggest Plus as safe default
      return { planName: "ChatGPT Plus", monthlyPrice: 20, confidence: "low" };
  }
}

async function fetchOpenRouterBalance() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return {
      label: j.data?.label || "OpenRouter",
      usage: j.data?.usage ?? null,
      limit: j.data?.limit ?? null,
      limit_remaining: j.data?.limit_remaining ?? null,
      is_free_tier: j.data?.is_free_tier ?? null,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MEMORY PARSER
// Walks the configured memory folders and emits MemNode/MemLink for the
// 3D constellation in src/components/memory-graph-3d.tsx.
// ──────────────────────────────────────────────────────────────────────────

const MEM_HUB_COLOR = "#3ddc97";
const MEM_WS_COLOR = "#e6ebf2";
const MEM_FILE_COLOR = "#8a93a3";
const MEM_DECISION_COLOR = "#a78bfa";
const MEM_STALE_COLOR = "#f5b14c";
const MEM_MISSING_COLOR = "#ef5a5a";

const STALE_DAYS = 10;

type MemKind = "hub" | "workspace" | "file" | "decision" | "session" | "skill" | "vector_store";
type MemStatus = "healthy" | "stale" | "missing";
type MemSource = "obsidian" | "claude" | "pinecone";

interface MemNode {
  id: string;
  name: string;
  kind: MemKind;
  source?: MemSource;
  indexName?: string;
  vectorCount?: number;
  namespaces?: { name: string; vectorCount: number }[];
  dimension?: number;
  embeddingModel?: string;
  workspaceId?: string;
  size?: string;
  updated?: string;
  status?: MemStatus;
  freshness?: number;
  meta?: string;
  val: number;
  color: string;
  path?: string;
  preview?: string;
}

interface MemLink {
  source: string;
  target: string;
  kind: "core" | "file" | "decision" | "session" | "skill" | "cross" | "vector";
}

interface MemEvent {
  type: "edit" | "vectorize" | "recall";
  target: string;
  destination?: string;
  time: string;
  meta?: { hits?: number; index?: string };
  source?: MemSource;
}

interface MemoryFrontmatter {
  name?: string;
  description?: string;
  type?: "user" | "feedback" | "project" | "reference" | string;
}

interface ParsedMemoryFile {
  absPath: string;
  relPath: string;
  basename: string;
  workspaceId: string;
  workspaceLabel: string;
  frontmatter: MemoryFrontmatter;
  body: string;
  mtimeMs: number;
  ageDays: number;
  sizeBytes: number;
  isStale: boolean;
  isIndex: boolean;
  isDecision: boolean;
}

async function walkMd(dir: string, root: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walkMd(p, root, out);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

function parseFrontmatter(content: string): { fm: MemoryFrontmatter; body: string } {
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  const fm: MemoryFrontmatter = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    if (kv) {
      const key = kv[1].toLowerCase();
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      (fm as any)[key] = val;
    }
  }
  return { fm, body: m[2] };
}

function slugify(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function parseMemoryFolder(root: string, sourceLabel: string): Promise<ParsedMemoryFile[]> {
  if (!existsSync(root)) return [];
  const files = await walkMd(root, root);
  const out: ParsedMemoryFile[] = [];
  const now = Date.now();
  for (const abs of files) {
    let raw: string;
    try {
      raw = await readFile(abs, "utf-8");
    } catch {
      continue;
    }
    const { fm, body } = parseFrontmatter(raw);
    const stats = await stat(abs);
    const relPath = abs.startsWith(root) ? abs.slice(root.length + 1) : abs;
    const parts = relPath.split("/");
    let workspaceId: string;
    let workspaceLabel: string;
    if (parts.length === 1) {
      workspaceId = slugify(`${sourceLabel}-root`);
      workspaceLabel = sourceLabel;
    } else {
      const folder = parts.length >= 3 ? parts.slice(0, 2).join("/") : parts[0];
      workspaceId = slugify(`${sourceLabel}-${folder}`);
      workspaceLabel = folder.replace(/^wiki\//, "").replace(/\//g, " · ");
    }
    const basename = parts[parts.length - 1].replace(/\.md$/i, "");
    const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    const isIndex = /^(index|memory|readme|claude)$/i.test(basename);
    const isDecision =
      fm.type === "feedback" ||
      /(^|\/)decisions(\/|$)/i.test(relPath) ||
      /^dec-|decision/i.test(basename);
    out.push({
      absPath: abs,
      relPath,
      basename,
      workspaceId,
      workspaceLabel,
      frontmatter: fm,
      body,
      mtimeMs: stats.mtimeMs,
      ageDays,
      sizeBytes: stats.size,
      isStale: ageDays > STALE_DAYS,
      isIndex,
      isDecision,
    });
  }
  return out;
}

interface ObsidianVaultInfo {
  root: string;
  label: string;
  files: number;
  primary: boolean;
  fromOverride?: boolean;
}

function expandHomePath(path: string): string {
  if (path === "~") return HOME;
  if (path.startsWith("~/")) return join(HOME, path.slice(2));
  return path;
}

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function collectObsidianVaultCandidates(): { root: string; fromOverride?: boolean }[] {
  const candidates = new Map<string, { root: string; fromOverride?: boolean }>();
  const add = (raw: string | undefined | null, fromOverride = false) => {
    if (!raw) return;
    const root = resolve(expandHomePath(raw.trim()));
    if (!isDirectory(root)) return;
    if (!fromOverride && !existsSync(join(root, ".obsidian"))) return;
    candidates.set(root, { root, fromOverride });
  };

  add(process.env.CLAUDE_OS_OBSIDIAN_PATH, true);
  add(join(HOME, "Obsidian"));
  add(join(HOME, "Documents", "Obsidian Vault"));
  add(join(HOME, "Documents", "Obsidian"));
  add(join(HOME, "Desktop", "Obsidian"));

  // Obsidian's own vault registry on macOS — every vault the user has opened in
  // the Obsidian app lives here, regardless of disk location. Treat each entry as
  // an override (fromOverride: true) because the registry itself is the trust
  // signal — vaults Obsidian remembers are real vaults even if the .obsidian
  // folder has been cleaned up or pruned.
  if (IS_MACOS) {
    const registryPath = join(
      HOME,
      "Library",
      "Application Support",
      "obsidian",
      "obsidian.json",
    );
    if (existsSync(registryPath)) {
      try {
        const raw = readFileSync(registryPath, "utf-8");
        const registry = JSON.parse(raw) as {
          vaults?: Record<string, { path?: string }>;
        };
        for (const entry of Object.values(registry.vaults ?? {})) {
          if (entry?.path) add(entry.path, true);
        }
      } catch {
        // registry malformed — skip silently
      }
    }
  }

  const scanOneLevel = (parent: string, scanChildren = false) => {
    if (!existsSync(parent)) return;
    try {
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const child = join(parent, entry.name);
        add(child);
        if (scanChildren) {
          try {
            for (const nested of readdirSync(child, { withFileTypes: true })) {
              if (nested.isDirectory() && !nested.name.startsWith("."))
                add(join(child, nested.name));
            }
          } catch {
            // ignore unreadable nested folders
          }
        }
      }
    } catch {
      // ignore unreadable folders
    }
  };

  scanOneLevel(join(HOME, "Documents"));
  scanOneLevel(join(HOME, "Desktop"));
  scanOneLevel(join(HOME, "Library", "Mobile Documents"), true);

  return Array.from(candidates.values());
}

async function findObsidianVaults(): Promise<ObsidianVaultInfo[]> {
  const candidates = collectObsidianVaultCandidates();
  const counted = await Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      files: (await walkMd(candidate.root, candidate.root)).length,
    })),
  );
  const sorted = counted.sort((a, b) => b.files - a.files || a.root.localeCompare(b.root));
  return sorted.map((vault, index) => ({
    ...vault,
    label:
      index === 0
        ? "obsidian"
        : `obsidian-${slugify(basename(vault.root) || `vault-${index + 1}`)}`,
    primary: index === 0,
  }));
}

// ──────────────────────────────────────────────────────────────────────────
// PINECONE POLLING — fetches index list + per-index stats via REST.
// ──────────────────────────────────────────────────────────────────────────

// Deterministic color picker — every index name maps to a stable tone
// based on a simple string hash. Avoids hardcoding any specific index name.
const PINECONE_FALLBACK_TONES = [
  "#EF4444",
  "#a855f7",
  "#c084fc",
  "#3b82f6",
  "#FF8A4C",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
];
function tonalForIndex(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PINECONE_FALLBACK_TONES[h % PINECONE_FALLBACK_TONES.length];
}

interface PineconeIndex {
  name: string;
  host: string;
  dimension: number;
  totalVectorCount: number;
  namespaces: { name: string; vectorCount: number }[];
}

async function fetchPineconeIndexes(): Promise<PineconeIndex[]> {
  const key = process.env.PINECONE_API_KEY;
  if (!key) return [];
  try {
    const list = await fetch("https://api.pinecone.io/indexes", {
      headers: { "Api-Key": key, "X-Pinecone-API-Version": "2024-07" },
      signal: AbortSignal.timeout(5000),
    });
    if (!list.ok) return [];
    const j: any = await list.json();
    const idxList: any[] = j.indexes || [];

    // Fan all per-index stats calls out in parallel — sequential was costing
    // the user up to N × 5s on the Setup wizard's first scan.
    const settled = await Promise.allSettled(
      idxList.map(async (idx) => {
        const stats = await fetch(`https://${idx.host}/describe_index_stats`, {
          headers: { "Api-Key": key, "X-Pinecone-API-Version": "2024-07" },
          signal: AbortSignal.timeout(5000),
        });
        if (!stats.ok) throw new Error(`stats ${stats.status}`);
        const s: any = await stats.json();
        return {
          name: idx.name,
          host: idx.host,
          dimension: idx.dimension || s.dimension || 0,
          totalVectorCount: s.totalVectorCount || 0,
          namespaces: Object.entries(s.namespaces || {}).map(([n, v]: [string, any]) => ({
            name: n,
            vectorCount: v.vectorCount || 0,
          })),
        } as PineconeIndex;
      }),
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<PineconeIndex> => r.status === "fulfilled")
      .map((r) => r.value);
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SLASH-COMMAND USAGE — walks every JSONL once to find user messages whose
// content begins with `/<name>` and aggregates last-7d counts + last-used.
// Powers the "Your skills" section on the home page.
// ──────────────────────────────────────────────────────────────────────────

interface SkillStat {
  name: string; // "/title", "/wrap-up"
  uses7d: number;
  totalUses: number;
  lastUsed: string; // human "2h ago"
  lastUsedMs: number; // raw timestamp for sorting
}

async function extractSkillUsage(): Promise<SkillStat[]> {
  const now = Date.now();
  const SEVEN_D = 7 * 24 * 60 * 60 * 1000;
  const stats: Record<string, { uses7d: number; total: number; lastMs: number }> = {};

  const files = await walkJsonl(PROJECTS_DIR);

  // ---- Method 1: Slash-command invocations (user types /command) ----
  const slashRe = /^\s*\/([a-zA-Z][a-zA-Z0-9_-]{1,40})(?:\s|$)/;

  // ---- Method 2: SKILL.md file reads (skills system loads them) ----
  // Matches paths like /skills/<name>/SKILL.md or /.claude/skills/<name>/
  const skillReadRe = /\/skills\/([a-zA-Z][a-zA-Z0-9_-]{1,60})\/SKILL\.md/;

  for (const file of files) {
    let fileBody: string;
    try {
      fileBody = await readFile(file, "utf-8");
    } catch {
      continue;
    }

    // Track per-conversation to avoid double-counting multiple reads in one session
    const seenInConv = new Set<string>();
    let convTs = 0;

    for (const line of fileBody.split("\n")) {
      if (!line.trim()) continue;
      let row: any;

      // Method 1: Check for /slash command from user
      if (line.includes('"/')) {
        try {
          row = row ?? JSON.parse(line);
        } catch {
          continue;
        }
        if (row.type === "user" && row.message?.role === "user") {
          let text = "";
          const msgContent = row.message?.content;
          if (typeof msgContent === "string") {
            text = msgContent;
          } else if (Array.isArray(msgContent)) {
            for (const c of msgContent) {
              if (typeof c === "string") { text = c; break; }
              if (c?.type === "text" && typeof c.text === "string") { text = c.text; break; }
            }
          }
          const m = text.match(slashRe);
          if (m) {
            const cmd = `/${m[1]}`;
            const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
            if (!stats[cmd]) stats[cmd] = { uses7d: 0, total: 0, lastMs: 0 };
            stats[cmd].total++;
            if (ts) {
              if (now - ts < SEVEN_D) stats[cmd].uses7d++;
              if (ts > stats[cmd].lastMs) stats[cmd].lastMs = ts;
            }
          }
        }
      }

      // Method 2: Check for SKILL.md file reads (any message type)
      if (line.includes("SKILL.md")) {
        try {
          row = row ?? JSON.parse(line);
        } catch {
          continue;
        }
        const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
        if (ts) convTs = ts;
        // Search the entire line for skill path references
        const matches = line.matchAll(/\/skills\/([a-zA-Z][a-zA-Z0-9_-]{1,60})\/SKILL\.md/g);
        for (const match of matches) {
          const skillName = `/${match[1]}`;
          // Only count once per conversation file to avoid inflation
          const convKey = `${file}:${skillName}`;
          if (seenInConv.has(convKey)) continue;
          seenInConv.add(convKey);

          const useTs = ts || convTs;
          if (!stats[skillName]) stats[skillName] = { uses7d: 0, total: 0, lastMs: 0 };
          stats[skillName].total++;
          if (useTs) {
            if (now - useTs < SEVEN_D) stats[skillName].uses7d++;
            if (useTs > stats[skillName].lastMs) stats[skillName].lastMs = useTs;
          }
        }
      }
    }
  }
  return Object.entries(stats)
    .map(([name, v]) => ({
      name,
      uses7d: v.uses7d,
      totalUses: v.total,
      lastUsed: v.lastMs ? humanAgo(now - v.lastMs) : "never",
      lastUsedMs: v.lastMs,
    }))
    .sort((a, b) => b.uses7d - a.uses7d || b.lastUsedMs - a.lastUsedMs);
}

// ──────────────────────────────────────────────────────────────────────────
// INSTALLED SKILLS — scans ~/.claude/skills/ for directories. Each
// subdirectory is an installed skill. We merge these with JSONL usage stats
// so the dashboard shows all skills even if they haven't been invoked via
// slash command yet.
// ──────────────────────────────────────────────────────────────────────────

async function scanInstalledSkills(): Promise<SkillStat[]> {
  const skillsDir = join(HOME, ".claude", "skills");
  if (!existsSync(skillsDir)) return [];
  const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const installed: SkillStat[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    // Follow symlinks — many skills are symlinked from ~/.agents/skills/
    const fullPath = join(skillsDir, entry.name);
    let isDir = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        const resolved = await Bun.file(fullPath).exists();
        const stat = await import("node:fs/promises").then((fs) => fs.stat(fullPath));
        isDir = stat.isDirectory();
      } catch {
        continue; // broken symlink
      }
    }
    if (!isDir) continue;
    installed.push({
      name: `/${entry.name}`,
      uses7d: 0,
      totalUses: 0,
      lastUsed: "installed",
      lastUsedMs: 0,
    });
  }
  return installed;
}

/**
 * Merge JSONL usage stats with installed skills so we always show installed
 * skills even if they haven't been invoked recently. Usage stats take priority.
 */
function mergeSkillStats(usage: SkillStat[], installed: SkillStat[]): SkillStat[] {
  const map = new Map<string, SkillStat>();
  // Installed first (lower priority)
  for (const s of installed) map.set(s.name, s);
  // Usage overwrites installed entries
  for (const s of usage) map.set(s.name, s);
  return [...map.values()].sort(
    (a, b) => b.uses7d - a.uses7d || b.lastUsedMs - a.lastUsedMs || a.name.localeCompare(b.name),
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SCHEDULED TASKS — walks ~/.claude/tasks/ for cron-style automation files.
// Returns [] if the directory doesn't exist.
// ──────────────────────────────────────────────────────────────────────────

interface AutomationStat {
  name: string;
  cadence: string;
  lastRun: string;
  nextRun: string;
  status: "success" | "failed" | "pending";
  source?: "cowork" | "codex" | "claude" | "claude-os";
  meta?: string;
}

async function loadAutomations(): Promise<AutomationStat[]> {
  const out: AutomationStat[] = [];
  const now = Date.now();

  // Helper: convert cron expression to human-readable cadence
  function cronToHuman(cron: string): string {
    if (!cron) return "—";
    const parts = cron.split(/\s+/);
    if (parts.length < 5) return cron;
    const [min, hour, dayOfMonth, , dayOfWeek] = parts;
    const timeStr = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    if (dayOfMonth !== "*" && dayOfMonth !== "?") return `Monthly day ${dayOfMonth} at ${timeStr}`;
    if (dayOfWeek !== "*" && dayOfWeek !== "?") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayNames = dayOfWeek.split(",").map(d => days[Number(d)] ?? d).join(", ");
      return `Weekly ${dayNames} at ${timeStr}`;
    }
    return `Daily at ${timeStr}`;
  }

  // Helper: convert RRULE to human-readable
  function rruleToHuman(rrule: string): string {
    if (!rrule) return "—";
    const freq = rrule.match(/FREQ=(\w+)/)?.[1] ?? "";
    const hour = rrule.match(/BYHOUR=(\d+)/)?.[1] ?? "?";
    const min = rrule.match(/BYMINUTE=(\d+)/)?.[1] ?? "00";
    const days = rrule.match(/BYDAY=([A-Z,]+)/)?.[1] ?? "";
    const timeStr = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    if (freq === "DAILY") return `Daily at ${timeStr}`;
    if (freq === "WEEKLY" && days) return `Weekly ${days} at ${timeStr}`;
    if (freq === "MONTHLY") return `Monthly at ${timeStr}`;
    return `${freq.toLowerCase()} at ${timeStr}`;
  }

  // ── 1. Cowork scheduled tasks ──
  // Path: ~/Library/Application Support/Claude/local-agent-mode-sessions/<account>/<org>/scheduled-tasks.json
  try {
    const agentSessionsDir = join(
      HOME,
      "Library",
      "Application Support",
      "Claude",
      "local-agent-mode-sessions",
    );
    if (existsSync(agentSessionsDir)) {
      const accountDirs = readdirSync(agentSessionsDir).filter(
        (d) => !d.startsWith(".") && statSync(join(agentSessionsDir, d)).isDirectory(),
      );
      for (const acctDir of accountDirs) {
        const acctPath = join(agentSessionsDir, acctDir);
        const orgDirs = readdirSync(acctPath).filter(
          (d) => !d.startsWith(".") && statSync(join(acctPath, d)).isDirectory(),
        );
        for (const orgDir of orgDirs) {
          const tasksFile = join(acctPath, orgDir, "scheduled-tasks.json");
          if (!existsSync(tasksFile)) continue;
          try {
            const data = JSON.parse(readFileSync(tasksFile, "utf-8"));
            const tasks = data.scheduledTasks || [];
            for (const t of tasks) {
              if (!t.id) continue;
              const lastRunMs = t.lastRunAt ? new Date(t.lastRunAt).getTime() : null;
              out.push({
                name: sanitize(t.id.replace(/-/g, " ").replace(/^\w/, (c: string) => c.toUpperCase())) ?? t.id,
                cadence: cronToHuman(t.cronExpression || ""),
                lastRun: lastRunMs ? humanAgo(now - lastRunMs) : "never",
                nextRun: "—",
                status: t.enabled === false ? "pending" : "success",
                source: "cowork",
              });
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* skip */ }

  // ── 2. Codex automations ──
  // Path: ~/.codex/automations/<name>/automation.toml
  try {
    const codexAutoDir = join(HOME, ".codex", "automations");
    if (existsSync(codexAutoDir)) {
      const subdirs = readdirSync(codexAutoDir).filter(
        (d) => !d.startsWith(".") && statSync(join(codexAutoDir, d)).isDirectory(),
      );
      for (const sub of subdirs) {
        const tomlPath = join(codexAutoDir, sub, "automation.toml");
        if (!existsSync(tomlPath)) continue;
        try {
          const raw = readFileSync(tomlPath, "utf-8");
          // Simple TOML value extraction
          const get = (key: string) => raw.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? "";
          const name = get("name") || sub;
          const status = get("status");
          const rrule = get("rrule");
          const model = get("model");
          out.push({
            name: sanitize(name) ?? name,
            cadence: rruleToHuman(rrule),
            lastRun: "—",
            nextRun: "—",
            status: status === "ACTIVE" ? "success" : status === "PAUSED" ? "pending" : "success",
            source: "codex",
            meta: model ? `model: ${model}` : undefined,
          });
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  // ── 3. ~/.claude/tasks/ (legacy/Claude Code tasks) ──
  try {
    const tasksDir = join(CLAUDE_DIR, "tasks");
    if (existsSync(tasksDir)) {
      const entries = readdirSync(tasksDir);
      for (const name of entries) {
        if (name.startsWith(".")) continue;
        const fullPath = join(tasksDir, name);
        let st;
        try { st = statSync(fullPath); } catch { continue; }
        if (st.isDirectory()) continue;
        let parsed: any = null;
        try {
          if (name.endsWith(".json")) parsed = JSON.parse(readFileSync(fullPath, "utf-8"));
        } catch {}
        const baseName = name.replace(/\.(json|yaml|yml|toml)$/i, "");
        const cadence = parsed?.cadence || parsed?.schedule || parsed?.cron || "—";
        const lastRunMs = parsed?.lastRunAt
          ? new Date(parsed.lastRunAt).getTime()
          : parsed?.last_run
            ? new Date(parsed.last_run).getTime()
            : st.mtimeMs;
        const rawStatus = (parsed?.status || parsed?.lastStatus || "").toLowerCase();
        out.push({
          name: sanitize(parsed?.name || baseName) ?? baseName,
          cadence: sanitize(String(cadence)) ?? String(cadence),
          lastRun: lastRunMs ? humanAgo(now - lastRunMs) : "—",
          nextRun: "—",
          status: rawStatus === "failed" || rawStatus === "error" ? "failed"
            : rawStatus === "pending" || rawStatus === "queued" ? "pending"
            : "success",
          source: "claude",
        });
      }
    }
  } catch { /* skip */ }

  // ── 4. Dream cron (claude-os launchd) ──
  try {
    const dreamPlist = join(HOME, "Library", "LaunchAgents", "com.claude-os.dream.plist");
    if (existsSync(dreamPlist)) {
      out.push({
        name: "Dream Review",
        cadence: "Daily at 07:00",
        lastRun: "—",
        nextRun: "—",
        status: "success",
        source: "claude-os",
      });
    }
  } catch { /* skip */ }

  return out;
}


// ──────────────────────────────────────────────────────────────────────────
// MODEL DISPLAY HELPERS — map raw model id → human name + provider/slug/color.
// ──────────────────────────────────────────────────────────────────────────

function humanModelName(model: string): string {
  if (/^claude-opus-4-7/.test(model)) return "Claude Opus 4.7";
  if (/^claude-opus-4-6/.test(model)) return "Claude Opus 4.6";
  if (/^claude-sonnet-4-6/.test(model)) return "Claude Sonnet 4.6";
  if (/^claude-haiku-4-5/.test(model)) return "Claude Haiku 4.5";
  if (/^claude-haiku/.test(model)) return "Claude Haiku";
  if (/^claude-sonnet/.test(model)) return "Claude Sonnet";
  if (/^claude-opus/.test(model)) return "Claude Opus";
  if (/^gpt-5/.test(model)) return "GPT-5";
  if (/^gpt-4/.test(model)) return "GPT-4";
  if (/^gemini/.test(model)) return "Gemini";
  if (/^deepseek/.test(model)) return "DeepSeek";
  if (/^codex/.test(model)) return "Codex";
  return model;
}

function providerSlug(model: string): string {
  if (/^claude/.test(model)) return "anthropic";
  if (/^gpt|^o1|^codex/.test(model)) return "openai";
  if (/^gemini/.test(model)) return "googlegemini";
  if (/^deepseek/.test(model)) return "deepseek";
  return "anthropic";
}

function providerName(model: string): string {
  if (/^claude/.test(model)) return "Anthropic";
  if (/^gpt|^o1|^codex/.test(model)) return "OpenAI";
  if (/^gemini/.test(model)) return "Google";
  if (/^deepseek/.test(model)) return "DeepSeek";
  return "Other";
}

function providerColor(model: string): string {
  if (/^claude-opus/.test(model)) return "F45A2A";
  if (/^claude/.test(model)) return "FF8A4C";
  if (/^gpt|^o1|^codex/.test(model)) return "10D49C";
  if (/^gemini/.test(model)) return "5C9CFF";
  if (/^deepseek/.test(model)) return "6B8AFF";
  return "B794F6";
}

// ──────────────────────────────────────────────────────────────────────────
// SKILL EVENT EXTRACTION — finds /recall and /wrap-up calls in JSONLs
// emits MemEvent entries for the activity feed.
// ──────────────────────────────────────────────────────────────────────────

async function extractMemoryEvents(maxAgeDays = 14): Promise<MemEvent[]> {
  const events: MemEvent[] = [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const files = await walkJsonl(PROJECTS_DIR);
  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      if (!line.includes("recall") && !line.includes("wrap-up") && !line.includes("wrapup"))
        continue;
      let row: any;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
      if (!ts || now - ts > maxAgeMs) continue;
      const text = JSON.stringify(row.message?.content || row.content || "").toLowerCase();
      if (
        text.includes("/recall") ||
        text.includes("recall skill") ||
        (row.message?.content || []).some?.((c: any) => c?.name === "recall")
      ) {
        const queryMatch = text.match(/"([^"]{4,80})"/);
        events.push({
          type: "recall",
          target: queryMatch ? queryMatch[1] : "(query)",
          time: humanAgo(now - ts),
          source: "pinecone",
          meta: { hits: 0 },
        });
      }
      if (text.includes("/wrap-up") || text.includes("wrap-up skill") || text.includes("wrapup")) {
        events.push({
          type: "vectorize",
          target: row.sessionId ? `session-${row.sessionId.slice(0, 8)}` : "session",
          destination: "vector-store",
          time: humanAgo(now - ts),
          source: "pinecone",
        });
      }
    }
  }
  return events.slice(0, 12);
}

async function parseMemory() {
  const sources: Array<{ root: string; label: string }> = [];

  // Obsidian vaults. A pasted env override wins if present, then common
  // macOS/iCloud locations. Multiple vaults are parsed; the largest is primary.
  const obsidianVaults = await findObsidianVaults();
  for (const vault of obsidianVaults) {
    sources.push({ root: vault.root, label: vault.label });
  }

  // Claude project memory dirs
  if (existsSync(PROJECTS_DIR)) {
    let projDirs: string[] = [];
    try {
      projDirs = await readdir(PROJECTS_DIR);
    } catch {}
    for (const proj of projDirs) {
      const memDir = join(PROJECTS_DIR, proj, "memory");
      if (existsSync(memDir)) sources.push({ root: memDir, label: `claude-${proj}` });
    }
  }

  // Aggregate
  const allFiles: ParsedMemoryFile[] = [];
  for (const src of sources) {
    const files = await parseMemoryFolder(src.root, src.label);
    allFiles.push(...files);
  }

  // Build nodes + links
  const nodes: MemNode[] = [];
  const links: MemLink[] = [];

  // Hub
  nodes.push({ id: "hub", name: "Memory Core", kind: "hub", val: 60, color: MEM_HUB_COLOR });

  // Workspaces (by workspaceId)
  const workspaceMap = new Map<string, { label: string; files: ParsedMemoryFile[] }>();
  for (const f of allFiles) {
    if (!workspaceMap.has(f.workspaceId))
      workspaceMap.set(f.workspaceId, { label: f.workspaceLabel, files: [] });
    workspaceMap.get(f.workspaceId)!.files.push(f);
  }

  for (const [wsId, ws] of workspaceMap.entries()) {
    const hasIndex = ws.files.some((f) => f.isIndex);
    const freshFiles = ws.files.filter((f) => !f.isStale).length;
    const freshness = ws.files.length === 0 ? 0 : Math.round((freshFiles / ws.files.length) * 100);
    // "missing" used to fire on workspaces lacking a MEMORY.md, which is
    // misleading when the files are actually on disk. Reserve "missing"
    // for zero-file workspaces; surface the no-index case via a separate
    // `noIndex` flag.
    const noIndex = !hasIndex;
    const status: MemStatus =
      ws.files.length === 0 ? "missing" : freshness < 60 ? "stale" : "healthy";
    const wsColor =
      status === "missing"
        ? MEM_MISSING_COLOR
        : status === "stale"
          ? MEM_STALE_COLOR
          : MEM_WS_COLOR;
    const wsSource: MemSource = ws.files[0]?.workspaceId.startsWith("claude-")
      ? "claude"
      : "obsidian";
    // Derive the workspace's source folder by chopping the relPath suffix
    // off the first file's absPath. Lets the dashboard show "where this
    // came from" so a stale Obsidian vault doesn't look mysterious.
    let sourcePath: string | undefined;
    const firstFile = ws.files[0];
    if (firstFile) {
      const abs = firstFile.absPath;
      const rel = firstFile.relPath;
      sourcePath = abs.endsWith(rel) ? abs.slice(0, abs.length - rel.length).replace(/\/$/, "") : abs;
    }
    nodes.push({
      id: `ws-${wsId}`,
      name: ws.label,
      kind: "workspace",
      workspaceId: wsId,
      source: wsSource,
      status,
      noIndex,
      freshness,
      val: 22,
      color: wsColor,
      path: sourcePath,
    });
    links.push({ source: "hub", target: `ws-${wsId}`, kind: "core" });
  }

  // File / decision nodes
  const fileIdByRelPath = new Map<string, string>();
  for (const f of allFiles) {
    const fileId = `f-${slugify(f.relPath)}`;
    fileIdByRelPath.set(f.relPath, fileId);
    fileIdByRelPath.set(f.basename, fileId); // also lookup by basename for wikilinks
    const isDecision = f.isDecision;
    const color = isDecision ? MEM_DECISION_COLOR : f.isStale ? MEM_STALE_COLOR : MEM_FILE_COLOR;
    const fSource: MemSource = f.workspaceId.startsWith("claude-") ? "claude" : "obsidian";
    nodes.push({
      id: fileId,
      name: sanitize(f.frontmatter.name || f.basename) || f.basename,
      kind: isDecision ? "decision" : "file",
      workspaceId: f.workspaceId,
      source: fSource,
      size: humanSize(f.sizeBytes),
      updated: humanAgo(Date.now() - f.mtimeMs),
      status: f.isStale ? "stale" : "healthy",
      val: isDecision ? 9 : f.isIndex ? 8 : 5,
      color,
      meta: sanitize(f.frontmatter.description),
      path: sanitize(f.relPath),
      preview: REDACT_PREVIEWS
        ? undefined
        : sanitize(f.body.slice(0, 200).replace(/\n+/g, " ").trim()),
    });
    links.push({
      source: `ws-${f.workspaceId}`,
      target: fileId,
      kind: isDecision ? "decision" : "file",
    });
  }

  // Cross-references — parse [[wikilinks]] and [text](path.md)
  for (const f of allFiles) {
    const fromId = fileIdByRelPath.get(f.relPath)!;
    const wiki = [...f.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim());
    const md = [...f.body.matchAll(/\]\(([^)\s]+\.md)\)/g)].map((m) => m[1].trim());
    const targets = new Set<string>([...wiki, ...md]);
    for (const t of targets) {
      const cleaned = t.replace(/^\.\//, "").replace(/^\.\.\//, "");
      const candidates = [
        cleaned,
        cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`,
        cleaned.split("/").pop() || cleaned,
      ];
      for (const cand of candidates) {
        const targetId =
          fileIdByRelPath.get(cand) || fileIdByRelPath.get(cand.replace(/\.md$/, ""));
        if (targetId && targetId !== fromId) {
          links.push({ source: fromId, target: targetId, kind: "cross" });
          break;
        }
      }
    }
  }

  // ── Pinecone vector-store nodes ──
  console.log("[aggregate] polling Pinecone ...");
  const pineconeIndexes = await fetchPineconeIndexes();
  const sourceList: { kind: MemSource; label: string; root?: string; vectorCount?: number }[] = [];
  for (const src of sources) {
    const kind: MemSource = src.label.startsWith("claude-") ? "claude" : "obsidian";
    sourceList.push({
      kind,
      label: sanitize(src.label) ?? src.label,
      root: sanitize(src.root),
    });
  }
  const pineconeDisplay = pineconeIndexes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((idx, index) => ({
      idx,
      label: SHOW_INDEX_NAMES ? (sanitize(idx.name) ?? idx.name) : `vector-store-${index + 1}`,
    }));
  for (const { idx, label } of pineconeDisplay) {
    const tone = tonalForIndex(label);
    const id = `pc-${slugify(label)}`;
    nodes.push({
      id,
      name: label,
      kind: "vector_store",
      source: "pinecone",
      indexName: label,
      vectorCount: idx.totalVectorCount,
      namespaces: idx.namespaces.map((ns) => ({
        name: sanitize(ns.name) ?? ns.name,
        vectorCount: ns.vectorCount,
      })),
      dimension: idx.dimension,
      val: 28,
      color: tone,
      meta: `${idx.totalVectorCount.toLocaleString()} vectors · ${idx.namespaces.length} namespaces`,
    });
    links.push({ source: "hub", target: id, kind: "vector" });
    sourceList.push({
      kind: "pinecone",
      label,
      vectorCount: idx.totalVectorCount,
    });
  }

  // ── Skill-event activity feed (recall + wrap-up) ──
  const skillEvents = await extractMemoryEvents(14);

  // ── Stats ──
  const totalFiles = allFiles.length;
  const stale = allFiles.filter((f) => f.isStale).length;
  const missing = Array.from(workspaceMap.values()).filter(
    (ws) => !ws.files.some((f) => f.isIndex),
  ).length;
  const freshness = totalFiles === 0 ? 0 : Math.round(((totalFiles - stale) / totalFiles) * 100);

  const SEVEN_D_MS = 7 * 24 * 60 * 60 * 1000;
  const activeLast7d = allFiles.filter((f) => Date.now() - f.mtimeMs < SEVEN_D_MS).length;
  const activatedLast7d = skillEvents.filter(
    (e) => e.type === "recall" || e.type === "vectorize",
  ).length;
  const totalVectors = pineconeIndexes.reduce((a, i) => a + i.totalVectorCount, 0);
  const totalDataSources = sourceList.length;

  // ── Type distribution ──
  const typeBreakdown: Record<string, number> = {
    user: 0,
    feedback: 0,
    project: 0,
    reference: 0,
    untyped: 0,
  };
  for (const f of allFiles) {
    const t = (f.frontmatter.type || "untyped").toLowerCase();
    typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
  }

  // ── Build edit events from file mtimes for "Recently updated" feed ──
  const editEvents: MemEvent[] = allFiles
    .slice()
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 8)
    .map((f) => ({
      type: "edit" as const,
      target: f.relPath,
      time: humanAgo(Date.now() - f.mtimeMs),
      source: (f.workspaceId.startsWith("claude-") ? "claude" : "obsidian") as MemSource,
    }));

  // Merge edit + skill events, sort by approximate recency by string ordering
  const events: MemEvent[] = [...editEvents, ...skillEvents].slice(0, 14);

  return {
    obsidianVaults,
    sources: sourceList,
    nodes,
    links,
    events,
    stats: {
      totalFiles,
      totalWorkspaces: workspaceMap.size,
      stale,
      missing,
      freshness,
      typeBreakdown,
      activeLast7d,
      activatedLast7d,
      totalVectors,
      totalDataSources,
      pineconeIndexes: pineconeIndexes.length,
    },
    pinecone: pineconeDisplay.map(({ idx, label }) => ({
      name: label,
      totalVectorCount: idx.totalVectorCount,
      dimension: idx.dimension,
      namespaces: idx.namespaces.map((ns) => ({
        name: sanitize(ns.name) ?? ns.name,
        vectorCount: ns.vectorCount,
      })),
    })),
    recentlyUpdated: allFiles
      .slice()
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 6)
      .map((f) => ({
        name: sanitize(f.basename) ?? f.basename,
        path: sanitize(f.relPath) ?? "",
        updated: humanAgo(Date.now() - f.mtimeMs),
      })),
    staleFiles: allFiles
      .filter((f) => f.isStale)
      .slice()
      .sort((a, b) => a.mtimeMs - b.mtimeMs)
      .slice(0, 6)
      .map((f) => ({
        name: sanitize(f.basename) ?? f.basename,
        path: sanitize(f.relPath) ?? "",
        updated: humanAgo(Date.now() - f.mtimeMs),
      })),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// APP + MEMORY-STORE DETECTION — surfaces installed AI tooling and the
// memory backends Claude OS can wire into. Consumed by the setup wizard
// so a fresh-clone user gets a sensible defaults list without touching
// the filesystem themselves. All probes are best-effort: a thrown error
// or a missing CLI degrades to `detected: false` rather than crashing.
// ──────────────────────────────────────────────────────────────────────────

interface AppDetection {
  detected: boolean;
  version?: string;
  path?: string;
  name?: string;
  // Optional secondary path for tools that have both a CLI and a config dir.
  configPath?: string;
  // For aggregate entries (e.g. JetBrains) — a list of nested labels.
  variants?: string[];
}

interface TerminalDetections {
  current: { detected: boolean; name: string };
  installed: {
    warp: AppDetection;
    ghostty: AppDetection;
    iterm: AppDetection;
    hyper: AppDetection;
    alacritty: AppDetection;
    wezterm: AppDetection;
    tabby: AppDetection;
    appleTerminal: AppDetection;
  };
}

interface AppDetections {
  // Existing
  antigravity: AppDetection;
  claudeApp: AppDetection;
  claudeCode: AppDetection;
  cursor: AppDetection;
  codex: AppDetection;
  // IDEs / editors
  vscode: AppDetection;
  vscodeInsiders: AppDetection;
  zed: AppDetection;
  windsurf: AppDetection;
  jetbrains: AppDetection;
  // AI CLIs
  aider: AppDetection;
  continueCli: AppDetection;
  copilotCli: AppDetection;
  cody: AppDetection;
  goose: AppDetection;
  // Terminals (current + installed)
  terminals: TerminalDetections;
}

interface MemoryStoreDetections {
  pinecone: { detected: boolean; hasKey: boolean; indexes?: number; totalVectors?: number };
  obsidian: {
    detected: boolean;
    vaultPath?: string;
    files?: number;
    vaults?: { path: string; files: number }[];
  };
  notion: { detected: boolean; appPath?: string; hasToken: boolean };
  logseq: { detected: boolean; appPath?: string; configPath?: string };
}

interface EnvKeyNeeded {
  name: string;
  reason: string;
  url?: string;
  optional: boolean;
}

// Probe a CLI binary's `--version` output with a short timeout. Returns the
// trimmed stdout if the process exits cleanly, otherwise undefined. Never
// throws — detection logic must not be able to crash the aggregator.
async function probeCliVersion(
  cmd: string,
  args: string[] = ["--version"],
  timeoutMs = 1000,
): Promise<string | undefined> {
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
    const timer = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );
    const reader = (async () => {
      try {
        const out = await new Response(proc.stdout).text();
        return out.trim().split("\n")[0]?.trim() || undefined;
      } catch {
        return undefined;
      }
    })();
    const result = await Promise.race([reader, timer]);
    try {
      proc.kill();
    } catch {}
    return result || undefined;
  } catch {
    return undefined;
  }
}

// Resolve a CLI on PATH using `which`, with a short timeout. Returns the
// resolved absolute path or undefined.
async function resolveCliPath(cmd: string, timeoutMs = 1000): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["which", cmd], { stdout: "pipe", stderr: "pipe" });
    const timer = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );
    const reader = (async () => {
      try {
        const out = await new Response(proc.stdout).text();
        const path = out.trim().split("\n")[0]?.trim();
        return path && existsSync(path) ? path : undefined;
      } catch {
        return undefined;
      }
    })();
    const result = await Promise.race([reader, timer]);
    try {
      proc.kill();
    } catch {}
    return result || undefined;
  } catch {
    return undefined;
  }
}

// Resolve an installed macOS .app, checking both /Applications and
// ~/Applications. Returns the first match (sanitized for emission).
function findMacApp(appName: string): string | undefined {
  const candidates = [`/Applications/${appName}.app`, join(HOME, "Applications", `${appName}.app`)];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

// Try multiple .app names (some tools ship under different bundle names
// across versions, e.g. "iTerm" vs "iTerm2").
function findAnyMacApp(appNames: string[]): string | undefined {
  for (const name of appNames) {
    const p = findMacApp(name);
    if (p) return p;
  }
  return undefined;
}

// Cheap probe — does any subdirectory of `parent` match (case-insensitive)
// one of the patterns? Used for VS Code extension detection (Continue/Cody/
// Copilot extensions live under ~/.vscode/extensions/<publisher.name-version>).
function findExtensionMatch(parent: string, patterns: string[]): string[] {
  if (!existsSync(parent)) return [];
  try {
    const entries = readdirSync(parent) as string[];
    const found = new Set<string>();
    const lowerPatterns = patterns.map((p) => p.toLowerCase());
    for (const e of entries) {
      const low = e.toLowerCase();
      for (const p of lowerPatterns) {
        if (low.includes(p)) found.add(p);
      }
    }
    return Array.from(found);
  } catch {
    return [];
  }
}

// Probe `gh extension list` to see if `gh-copilot` is installed. Crash-safe
// with a 1s timeout — `gh` is slow to start when not pre-warmed.
async function probeGhCopilot(timeoutMs = 1000): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gh", "extension", "list"], { stdout: "pipe", stderr: "pipe" });
    const timer = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );
    const reader = (async () => {
      try {
        return await new Response(proc.stdout).text();
      } catch {
        return "";
      }
    })();
    const result = await Promise.race([reader, timer]);
    try {
      proc.kill();
    } catch {}
    if (typeof result !== "string") return false;
    return /copilot/i.test(result);
  } catch {
    return false;
  }
}

async function detectApps(): Promise<AppDetections> {
  // AntiGravity (.app)
  const agPath = findMacApp("Antigravity");
  const antigravity: AppDetection = agPath
    ? { detected: true, path: sanitize(agPath) }
    : { detected: false };

  // Claude.app desktop client
  const claudeAppPath = findMacApp("Claude");
  const claudeApp: AppDetection = claudeAppPath
    ? { detected: true, path: sanitize(claudeAppPath) }
    : { detected: false };

  // Claude Code CLI
  const claudeCli = await resolveCliPath("claude");
  let claudeCodeVersion: string | undefined;
  if (claudeCli) claudeCodeVersion = await probeCliVersion("claude", ["--version"], 1000);
  const claudeCode: AppDetection = claudeCli
    ? { detected: true, version: sanitize(claudeCodeVersion) }
    : { detected: false };

  // Cursor (.app)
  const cursorPath = findMacApp("Cursor");
  const cursor: AppDetection = cursorPath
    ? { detected: true, path: sanitize(cursorPath) }
    : { detected: false };

  // Codex CLI — `which codex` OR existing ~/.codex/auth.json (re-using
  // the signal the existing detectChatgptAuth() relies on).
  const codexCli = await resolveCliPath("codex");
  const codexAuthPresent = existsSync(join(CODEX_DIR, "auth.json"));
  let codexVersion: string | undefined;
  if (codexCli) codexVersion = await probeCliVersion("codex", ["--version"], 1000);
  const codex: AppDetection =
    codexCli || codexAuthPresent
      ? { detected: true, version: sanitize(codexVersion) }
      : { detected: false };

  // ---------- IDEs / editors ----------

  // VS Code — .app + `code` CLI + extension scan for AI plugins.
  const vscodeAppPath = findAnyMacApp(["Visual Studio Code"]);
  const vscodeCli = await resolveCliPath("code");
  let vscodeVersion: string | undefined;
  if (vscodeCli) vscodeVersion = await probeCliVersion("code", ["--version"], 1000);
  const vscodeExtDir = join(HOME, ".vscode", "extensions");
  // Common AI-related extension publishers (case-insensitive substring match).
  const vscodeAiExts = findExtensionMatch(vscodeExtDir, [
    "continue.continue",
    "sourcegraph.cody",
    "github.copilot",
    "anthropic",
    "anysphere", // Cursor (when cohabiting)
  ]);
  const vscodeDetected = !!(vscodeAppPath || vscodeCli);
  const vscode: AppDetection = vscodeDetected
    ? {
        detected: true,
        path: sanitize(vscodeAppPath),
        version: sanitize(vscodeVersion),
        ...(vscodeAiExts.length > 0 ? { variants: vscodeAiExts } : {}),
      }
    : { detected: false };

  // VS Code Insiders — separate build with separate config dir.
  const vscodeInsidersPath = findAnyMacApp(["Visual Studio Code - Insiders"]);
  const vscodeInsidersCli = await resolveCliPath("code-insiders");
  const vscodeInsiders: AppDetection =
    vscodeInsidersPath || vscodeInsidersCli
      ? {
          detected: true,
          ...(vscodeInsidersPath ? { path: sanitize(vscodeInsidersPath) } : {}),
        }
      : { detected: false };

  // Zed — .app + `zed` CLI + ~/.config/zed/.
  const zedPath = findMacApp("Zed");
  const zedCli = await resolveCliPath("zed");
  const zedConfig = join(HOME, ".config", "zed");
  const zedConfigExists = existsSync(zedConfig);
  let zedVersion: string | undefined;
  if (zedCli) zedVersion = await probeCliVersion("zed", ["--version"], 1000);
  const zed: AppDetection =
    zedPath || zedCli || zedConfigExists
      ? {
          detected: true,
          ...(zedPath ? { path: sanitize(zedPath) } : {}),
          ...(zedVersion ? { version: sanitize(zedVersion) } : {}),
          ...(zedConfigExists ? { configPath: sanitize(zedConfig) } : {}),
        }
      : { detected: false };

  // Windsurf (Codeium)
  const windsurfPath = findMacApp("Windsurf");
  const windsurfCli = await resolveCliPath("windsurf");
  const windsurf: AppDetection =
    windsurfPath || windsurfCli
      ? {
          detected: true,
          ...(windsurfPath ? { path: sanitize(windsurfPath) } : {}),
        }
      : { detected: false };

  // JetBrains — single entry, with sub-IDEs as variants. Inspect
  // ~/Library/Application Support/JetBrains/ for product folders like
  // PyCharm2024.1, IntelliJIdea2024.2, WebStorm2024.3.
  const jetbrainsRoot = join(HOME, "Library", "Application Support", "JetBrains");
  let jetbrainsVariants: string[] = [];
  if (existsSync(jetbrainsRoot)) {
    try {
      const entries = readdirSync(jetbrainsRoot) as string[];
      // Group by product family (strip trailing version digits + dots).
      const families = new Set<string>();
      for (const e of entries) {
        const m = e.match(/^([A-Za-z]+)/);
        if (m && m[1] && m[1] !== "consentOptions" && m[1] !== "JetBrainsClient") {
          families.add(m[1]);
        }
      }
      jetbrainsVariants = Array.from(families).sort();
    } catch {
      jetbrainsVariants = [];
    }
  }
  const jetbrains: AppDetection =
    jetbrainsVariants.length > 0
      ? {
          detected: true,
          configPath: sanitize(jetbrainsRoot),
          variants: jetbrainsVariants,
        }
      : { detected: false };

  // ---------- AI CLIs ----------

  const aiderCli = await resolveCliPath("aider");
  let aiderVersion: string | undefined;
  if (aiderCli) aiderVersion = await probeCliVersion("aider", ["--version"], 1000);
  const aider: AppDetection = aiderCli
    ? { detected: true, version: sanitize(aiderVersion), path: sanitize(aiderCli) }
    : { detected: false };

  // Continue.dev CLI — `continue` is the bin name on PATH for the CLI build.
  const continueCli_ = await resolveCliPath("continue");
  let continueVersion: string | undefined;
  if (continueCli_) continueVersion = await probeCliVersion("continue", ["--version"], 1000);
  const continueCli: AppDetection = continueCli_
    ? { detected: true, version: sanitize(continueVersion), path: sanitize(continueCli_) }
    : { detected: false };

  // GitHub Copilot CLI via `gh extension list` (1s timeout, fail-closed).
  const ghCli = await resolveCliPath("gh");
  let copilotInstalled = false;
  if (ghCli) copilotInstalled = await probeGhCopilot(1000);
  const copilotCli: AppDetection = copilotInstalled
    ? { detected: true, name: "gh copilot" }
    : { detected: false };

  // Cody (Sourcegraph) CLI
  const codyCli = await resolveCliPath("cody");
  let codyVersion: string | undefined;
  if (codyCli) codyVersion = await probeCliVersion("cody", ["--version"], 1000);
  const cody: AppDetection = codyCli
    ? { detected: true, version: sanitize(codyVersion), path: sanitize(codyCli) }
    : { detected: false };

  // Goose (Block AI agent)
  const gooseCli = await resolveCliPath("goose");
  let gooseVersion: string | undefined;
  if (gooseCli) gooseVersion = await probeCliVersion("goose", ["--version"], 1000);
  const goose: AppDetection = gooseCli
    ? { detected: true, version: sanitize(gooseVersion), path: sanitize(gooseCli) }
    : { detected: false };

  // ---------- Terminals ----------

  // Current terminal best-effort: TERM_PROGRAM env var.
  const tp = process.env.TERM_PROGRAM;
  let currentTerminalName = "unknown";
  if (tp === "Apple_Terminal") currentTerminalName = "Apple Terminal";
  else if (tp === "iTerm.app") currentTerminalName = "iTerm";
  else if (tp === "vscode") currentTerminalName = "VS Code";
  else if (tp === "ghostty") currentTerminalName = "Ghostty";
  else if (tp === "WarpTerminal") currentTerminalName = "Warp";
  else if (tp === "Hyper") currentTerminalName = "Hyper";
  else if (tp === "WezTerm") currentTerminalName = "WezTerm";
  else if (tp === "Tabby") currentTerminalName = "Tabby";
  else if (tp === "alacritty") currentTerminalName = "Alacritty";
  else if (tp) currentTerminalName = tp;

  const installedTerminals: TerminalDetections["installed"] = {
    warp: (() => {
      const p = findMacApp("Warp");
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    ghostty: (() => {
      const p = findMacApp("Ghostty");
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    iterm: (() => {
      const p = findAnyMacApp(["iTerm", "iTerm2"]);
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    hyper: (() => {
      const p = findMacApp("Hyper");
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    alacritty: (() => {
      const p = findMacApp("Alacritty");
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    wezterm: (() => {
      const p = findAnyMacApp(["WezTerm", "wezterm"]);
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    tabby: (() => {
      const p = findMacApp("Tabby");
      return p ? { detected: true, path: sanitize(p) } : { detected: false };
    })(),
    // Apple Terminal lives in /System/Applications on modern macOS, not /Applications.
    appleTerminal: (() => {
      const sysPath = "/System/Applications/Utilities/Terminal.app";
      const altPath = "/Applications/Utilities/Terminal.app";
      const found = existsSync(sysPath) ? sysPath : existsSync(altPath) ? altPath : undefined;
      return found ? { detected: true, path: sanitize(found) } : { detected: false };
    })(),
  };
  const terminals: TerminalDetections = {
    current: currentTerminalName !== "unknown"
      ? { detected: true, name: currentTerminalName }
      : { detected: false, name: "unknown" },
    installed: installedTerminals,
  };

  return {
    antigravity,
    claudeApp,
    claudeCode,
    cursor,
    codex,
    vscode,
    vscodeInsiders,
    zed,
    windsurf,
    jetbrains,
    aider,
    continueCli,
    copilotCli,
    cody,
    goose,
    terminals,
  };
}

function detectMemoryStores(
  memory: {
    sources?: any[];
    stats?: { totalFiles?: number };
    obsidianVaults?: ObsidianVaultInfo[];
  } | null,
  pineconeIndexes: PineconeIndex[],
): MemoryStoreDetections {
  const hasKey = Boolean(process.env.PINECONE_API_KEY);
  const indexCount = pineconeIndexes.length;
  const totalVectors = pineconeIndexes.reduce((a, i) => a + (i.totalVectorCount || 0), 0);
  const pinecone = {
    detected: indexCount > 0 || hasKey,
    hasKey,
    ...(indexCount > 0 ? { indexes: indexCount, totalVectors } : {}),
  };

  const obsidianVaults = Array.isArray(memory?.obsidianVaults) ? memory!.obsidianVaults : [];
  const primaryVault = obsidianVaults.find((v) => v.primary) ?? obsidianVaults[0];
  const filesCount = obsidianVaults.reduce((sum, vault) => sum + (vault.files || 0), 0);
  const obsidian = {
    detected: obsidianVaults.length > 0,
    ...(primaryVault ? { vaultPath: sanitize(primaryVault.root) ?? primaryVault.root } : {}),
    ...(filesCount > 0 ? { files: filesCount } : {}),
    ...(obsidianVaults.length > 0
      ? {
          vaults: obsidianVaults.map((vault) => ({
            path: sanitize(vault.root) ?? vault.root,
            files: vault.files,
          })),
        }
      : {}),
  };

  // Notion — desktop client OR NOTION_TOKEN env var.
  const notionAppPath = findMacApp("Notion");
  const notionSupportPath = join(HOME, "Library", "Application Support", "Notion");
  const notionAppPresent = !!notionAppPath || existsSync(notionSupportPath);
  const notionHasToken = Boolean(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY);
  const notion = {
    detected: notionAppPresent || notionHasToken,
    hasToken: notionHasToken,
    ...(notionAppPath ? { appPath: sanitize(notionAppPath) ?? notionAppPath } : {}),
  };

  // Logseq — desktop client OR ~/.logseq/.
  const logseqAppPath = findMacApp("Logseq");
  const logseqConfigPath = join(HOME, ".logseq");
  const logseqConfigExists = existsSync(logseqConfigPath);
  const logseq = {
    detected: !!logseqAppPath || logseqConfigExists,
    ...(logseqAppPath ? { appPath: sanitize(logseqAppPath) ?? logseqAppPath } : {}),
    ...(logseqConfigExists ? { configPath: sanitize(logseqConfigPath) ?? logseqConfigPath } : {}),
  };

  return { pinecone, obsidian, notion, logseq };
}

// Walks the well-known optional env keys and produces (a) names of keys
// currently set in process.env and (b) prompts for the wizard for any
// missing keys that would unlock features. Mutates `envKeysPresent` in
// place so the caller can emit it alongside the needed list.
function computeEnvKeysNeeded(envKeysPresent: string[]): EnvKeyNeeded[] {
  const candidates: Array<{
    name: string;
    reason: string;
    url?: string;
    optional: boolean;
  }> = [
    {
      name: "PINECONE_API_KEY",
      reason:
        "Pinecone vector indexes won't appear in the memory constellation until this key is set.",
      url: "https://app.pinecone.io/organizations/-/projects/-/keys",
      optional: true,
    },
    {
      name: "OPENROUTER_API_KEY",
      reason: "Live OpenRouter balance and model usage won't load without this key.",
      url: "https://openrouter.ai/keys",
      optional: true,
    },
    {
      name: "KIE_API_KEY",
      reason: "Image-generation scripts (kie.ai nano-banana-2) require this to run.",
      url: "https://kie.ai/dashboard",
      optional: true,
    },
    {
      name: "ANTHROPIC_API_KEY",
      reason:
        "Optional — Claude OAuth via Keychain works fine. Only needed if you want a raw API key for non-OAuth scripts.",
      url: "https://console.anthropic.com/settings/keys",
      optional: true,
    },
    {
      name: "NOTION_TOKEN",
      reason:
        "Optional — required to pull Notion pages and databases into the memory constellation.",
      url: "https://www.notion.so/profile/integrations",
      optional: true,
    },
  ];

  const needed: EnvKeyNeeded[] = [];
  for (const c of candidates) {
    if (process.env[c.name]) {
      envKeysPresent.push(c.name);
    } else {
      needed.push(c);
    }
  }
  return needed;
}

function detectOpenclaw() {
  if (!existsSync(OPENCLAW_JSON)) return null;
  try {
    const j = JSON.parse(readFileSync(OPENCLAW_JSON, "utf-8"));
    const profiles = Object.entries(j.auth?.profiles || {}).map(([k, v]: [string, any]) => ({
      name: sanitize(k) ?? k,
      provider: sanitize(v.provider),
      mode: sanitize(v.mode),
    }));
    return {
      lastTouchedAt: sanitize(j.meta?.lastTouchedAt),
      lastTouchedVersion: sanitize(j.meta?.lastTouchedVersion),
      profiles,
    };
  } catch {
    return null;
  }
}

async function loadLatestDream() {
  // Reads the most recent ~/.claude-os/dreams/dream-YYYY-MM-DD.json if it
  // exists. The Dream pipeline (separate cron / `claude -p "/dream"`) writes
  // these files; the aggregator just inlines the latest into liveData so the
  // dashboard can render without filesystem access.
  const dreamsDir = join(HOME, ".claude-os", "dreams");
  if (!existsSync(dreamsDir)) return null;
  let entries: string[] = [];
  try {
    entries = await readdir(dreamsDir);
  } catch {
    return null;
  }
  const dated = entries
    .filter((f) => /^dream-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  if (dated.length === 0) return null;
  try {
    const raw = readFileSync(join(dreamsDir, dated[0]), "utf-8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn(`[aggregate] failed to parse latest dream JSON (${dated[0]}):`, err);
    return null;
  }
}

async function probeProjectsDir() {
  // Helps us emit a clear error if macOS Full Disk Access hasn't been
  // granted to the terminal — the most common silent-failure mode.
  if (!existsSync(PROJECTS_DIR)) {
    console.warn(`[aggregate] ~/.claude/projects/ not found.`);
    console.warn(`[aggregate]   - First run of Claude Code? Run a session first to populate it.`);
    console.warn(`[aggregate]   - Otherwise check that ${PROJECTS_DIR} exists.`);
    return false;
  }
  try {
    await readdir(PROJECTS_DIR);
    return true;
  } catch (err: any) {
    if (err?.code === "EACCES" || err?.code === "EPERM") {
      console.error(`[aggregate] permission denied reading ${PROJECTS_DIR}`);
      if (IS_MACOS) {
        console.error(`[aggregate]   macOS likely needs Full Disk Access for your terminal:`);
        console.error(
          `[aggregate]   System Settings → Privacy & Security → Full Disk Access → toggle on for Terminal/iTerm/your shell host.`,
        );
      }
      return false;
    }
    throw err;
  }
}

async function main() {
  console.log("[aggregate] scanning ~/.claude/projects ...");
  const ok = await probeProjectsDir();
  if (!ok) {
    console.warn(
      `[aggregate] continuing with empty Claude project data — other sources will still aggregate.`,
    );
  }
  const parsed = await parseJsonls();
  console.log(
    `[aggregate] ${Object.keys(parsed.projectActivity).length} projects, ${parsed.totalAssistant} assistant msgs`,
  );

  const claude = await detectClaudeAuth({
    messagesUsedLast5h: parsed.assistantTurnsLast5h,
    assistantMessages7d: parsed.assistantTurnsLast7d,
  });
  const chatgpt = detectChatgptAuth();
  const openrouter = await fetchOpenRouterBalance();
  const openclaw = detectOpenclaw();
  console.log("[aggregate] scanning memory folders ...");
  const memory = await parseMemory();
  console.log(
    `[aggregate] memory: ${memory.stats.totalFiles} files / ${memory.stats.totalWorkspaces} workspaces / ${memory.stats.pineconeIndexes} Pinecone indexes / ${memory.stats.totalVectors.toLocaleString()} vectors / ${memory.events.length} events`,
  );

  const dream = await loadLatestDream();
  if (dream) {
    const n = Array.isArray(dream?.prescriptions) ? dream.prescriptions.length : 0;
    console.log(`[aggregate] dream: ${n} prescription(s) from ${dream?.date ?? "(unknown date)"}`);
  } else {
    console.log(
      `[aggregate] dream: no ~/.claude-os/dreams/*.json found yet — UI will show sample prescriptions.`,
    );
  }

  console.log("[aggregate] scanning slash-command usage ...");
  const skillUsage = await extractSkillUsage();
  const installedSkills = await scanInstalledSkills();
  const skillStats = mergeSkillStats(skillUsage, installedSkills);
  console.log(
    `[aggregate] skills: ${skillStats.length} installed · ${skillUsage.length} used in logs · ${skillUsage.reduce((a, s) => a + s.uses7d, 0)} runs in last 7d`,
  );

  console.log("[aggregate] reading ~/.claude/tasks/ ...");
  const automations = await loadAutomations();
  console.log(`[aggregate] automations: ${automations.length} scheduled task(s)`);

  // ── App + memory-store detection (consumed by setup wizard) ──
  console.log("[aggregate] detecting installed apps + memory stores ...");
  const apps = await detectApps();
  // Re-shape memory.pinecone (which is already fetched + sanitized) into
  // the PineconeIndex shape the detector expects. We don't re-fetch.
  const pineconeForDetect: PineconeIndex[] = (memory?.pinecone ?? []).map((i: any) => ({
    name: i.name,
    host: "",
    dimension: i.dimension || 0,
    totalVectorCount: i.totalVectorCount || 0,
    namespaces: i.namespaces || [],
  }));
  const memoryStores = detectMemoryStores(memory as any, pineconeForDetect);
  const envKeysPresent: string[] = [];
  const envKeysNeeded = computeEnvKeysNeeded(envKeysPresent);
  const detection = { apps, memoryStores, envKeysNeeded, envKeysPresent };
  const detectedApps = (Object.entries(apps) as Array<[string, AppDetection]>)
    .filter(([, v]) => v.detected)
    .map(([k]) => k)
    .join(", ");
  console.log(`[aggregate] apps detected: ${detectedApps || "(none)"}`);
  console.log(
    `[aggregate] env keys present: ${envKeysPresent.length} · needed: ${envKeysNeeded.length}`,
  );

  const cap = PLAN_5H_MESSAGE_CAPS[claude.planGuess] || 225;
  // Weekly caps by plan (calibrated from observed Claude Plan Usage UI percentages)
  const PLAN_WEEKLY_CAPS: Record<string, number> = {
    "Claude Pro": 300,
    "Claude Max 5x": 1500,
    "Claude Max 20x": 5000,
  };
  const weeklyCap = PLAN_WEEKLY_CAPS[claude.planGuess] || 1500;
  // Sonnet-only cap (unlimited on most plans, but we show as a separate bar)
  const sonnetCap = claude.planGuess === "Claude Pro" ? 200 : 5000;

  const sonnet5h = parsed.familyTurns5h["sonnet"] || 0;
  const sonnetWeekly = parsed.familyTurnsWeekly["sonnet"] || 0;

  // Use real user prompts (rows whose content is NOT a tool_result) for the
  // rate-limit windows. Anthropic counts billable user→assistant exchanges,
  // not the 5–10 tool-use chunks each prompt expands into. Falls back to
  // assistant-row count for older JSONL files where the filter yields zero.
  const used5h = parsed.userPromptsLast5h || parsed.assistantTurnsLast5h;
  const used7d = parsed.userPromptsLast7d || parsed.assistantTurnsLast7d;
  const claudeWindow = {
    plan: claude.planGuess,
    authMode: claude.authMode,
    messagesUsed: used5h,
    messageCap: cap,
    pctUsed: Math.min(100, Math.round((used5h / cap) * 100)),
    keychainCredentials: claude.credCount,
    // Multiple rate-limit windows matching Claude's Plan Usage UI
    windows: [
      {
        label: "5-hour limit",
        used: used5h,
        cap,
        pct: Math.min(100, Math.round((used5h / cap) * 100)),
      },
      {
        label: "Weekly · all models",
        used: used7d,
        cap: weeklyCap,
        pct: Math.min(100, Math.round((used7d / weeklyCap) * 100)),
      },
      {
        label: "Sonnet only",
        used: sonnetWeekly,
        cap: sonnetCap,
        pct: Math.min(100, Math.round((sonnetWeekly / sonnetCap) * 100)),
      },
    ],
    familyBreakdown: {
      "5h": parsed.familyTurns5h,
      weekly: parsed.familyTurnsWeekly,
    },
  };

  // Message caps vary by ChatGPT plan tier
  const chatgptCaps: Record<string, number> = {
    "ChatGPT Max": 100,
    "ChatGPT Pro": 100,
    "ChatGPT Plus": 80,
    "ChatGPT Team": 100,
    "ChatGPT Enterprise": 200,
  };
  const chatgptPlanName = (chatgpt as any).planName ?? "ChatGPT Plus";
  const chatgptWindow = chatgpt.present
    ? {
        plan: chatgptPlanName,
        authMode: chatgpt.mode,
        messagesUsed: 0,
        messageCap: chatgptCaps[chatgptPlanName] ?? 80,
        pctUsed: 0,
        note: "ChatGPT message counts not parsed in v1 — Codex archives parse pending",
        hasApiKey: chatgpt.hasApiKey,
        hasOauth: chatgpt.hasOauth,
      }
    : null;

  const data = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAssistantMessages: parsed.totalAssistant,
      totalUserMessages: parsed.totalUser,
      messagesLast7d: used7d,
      messagesLast5h: used5h,
      projectsTracked: Object.keys(parsed.projectActivity).length,
      valueExtracted7d: Math.round(parsed.valueExtracted7d * 100) / 100,
    },
    subscriptions: {
      claude: {
        ...claude,
        plan: claude.planGuess,
        monthlyPrice:
          claude.planGuess === "Claude Pro" ? 20 : claude.planGuess === "Claude Max 5x" ? 100 : 200,
        confidence: claude.planConfidence,
        evidence: claude.evidence,
      },
      chatgpt: chatgpt.present
        ? {
            ...chatgpt,
            plan: (chatgpt as any).planName ?? "ChatGPT Plus",
            monthlyPrice: (chatgpt as any).monthlyPrice ?? 20,
            confidence: (chatgpt as any).confidence ?? "low",
            evidence: [
              `OAuth detected via ~/.codex/auth.json`,
              ...(chatgpt as any).jwtPlan ? [`JWT plan_type: ${(chatgpt as any).jwtPlan}`] : [],
              ...(chatgpt as any).configModel ? [`Default model: ${(chatgpt as any).configModel}`] : [],
            ],
          }
        : { present: false, plan: null, monthlyPrice: 0 },
      // Codex (OpenAI's CLI) has its own billing separate from ChatGPT
      codex: chatgpt.present && chatgpt.hasOauth
        ? {
            present: true,
            plan: "Codex",
            monthlyPrice: 0,
            confidence: "medium" as const,
            evidence: [
              "Codex CLI detected with OAuth",
              ...(chatgpt as any).configModel ? [`Default model: ${(chatgpt as any).configModel}`] : [],
            ],
          }
        : { present: false, plan: null, monthlyPrice: 0 },
      openrouter: openrouter
        ? {
            ...openrouter,
            plan: "Pay-as-you-go",
            monthlyPrice: 0,
            confidence: "high",
            evidence: [`live balance from auth/key endpoint`],
          }
        : { present: false, plan: null, monthlyPrice: 0 },
      openclaw,
    },
    usage: {
      claudeWindow,
      chatgptWindow,
      openrouter: openrouter
        ? {
            usage: openrouter.usage,
            limit: openrouter.limit,
            limit_remaining: openrouter.limit_remaining,
            label: openrouter.label,
          }
        : null,
    },
    modelUsage: Object.entries(parsed.modelTokens)
      .map(([model, t]) => ({
        model,
        messages: t.messages,
        input_tokens: t.input_tokens,
        output_tokens: t.output_tokens,
        cache_read_input_tokens: t.cache_read_input_tokens,
        cache_creation_input_tokens: t.cache_creation_input_tokens,
        cost_usd: Math.round(computeCost(model, t) * 100) / 100,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd),
    daily: Object.entries(parsed.dayBucket)
      .map(([day, v]) => ({ day, ...v, cost: Math.round(v.cost * 100) / 100 }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-30),
    recentProjects: Object.entries(parsed.projectActivity)
      .map(([key, v]) => ({
        key: sanitize(key) ?? key,
        displayName: sanitize(key.replace(/^-/, "/").replace(/-/g, "/")) ?? "",
        lastActiveMs: v.lastMs,
        lastActiveAgo: v.lastMs ? humanAgo(Date.now() - v.lastMs) : "never",
        sessions: v.sessions.size,
        messages: v.messages,
      }))
      .sort((a, b) => b.lastActiveMs - a.lastActiveMs)
      .slice(0, 10),
    runs: Array.from(parsed.runs.values())
      .filter((r) => r.messageCount > 0)
      .map((r) => {
        const primaryModel = r.models.size
          ? Array.from(r.models.entries()).sort((a, b) => b[1] - a[1])[0][0]
          : "";
        const durMs = Math.max(0, r.endMs - r.startMs);
        const sanitizedProj = sanitize(r.projKey) ?? r.projKey;
        const workspace = sanitizedProj.replace(/^-Users-[^-]+-/, "/").replace(/-/g, "/");
        const summary = sanitize(r.firstUserPrompt) ?? "";
        return {
          id: r.sessionId.slice(0, 8),
          sessionId: r.sessionId,
          workspace,
          projKey: sanitizedProj,
          skill: r.slashCommand || "",
          started: r.startMs ? humanAgo(Date.now() - r.startMs) : "—",
          startedMs: r.startMs,
          startedAt: r.startMs ? new Date(r.startMs).toISOString() : null,
          duration: humanDuration(durMs),
          durationMs: durMs,
          status: "succeeded" as const,
          tools: Array.from(r.tools).sort(),
          tokens: r.inputTokens + r.outputTokens,
          tokensIn: r.inputTokens,
          tokensOut: r.outputTokens,
          cacheRead: r.cacheReadTokens,
          cacheCreate: r.cacheCreateTokens,
          cost: Math.round(r.cost * 100) / 100,
          summary: summary || "(no prompt captured)",
          model: primaryModel,
          messages: r.messageCount,
          filesTouched: r.filesTouched.size,
          commandsRun: r.commandsRun,
          gitCommits: r.gitCommits,
        };
      })
      .sort((a, b) => b.startedMs - a.startedMs)
      .slice(0, 60),
    outputs: Array.from(parsed.runs.values())
      .flatMap((r) => {
        const sanitizedProj = sanitize(r.projKey) ?? r.projKey;
        const workspace = sanitizedProj.replace(/^-Users-[^-]+-/, "/").replace(/-/g, "/");
        return Array.from(r.filesTouched).map((rawPath) => {
          const fp = sanitize(rawPath) ?? rawPath;
          const name = fp.split("/").pop() ?? fp;
          const ext = (name.split(".").pop() ?? "").toLowerCase();
          const type =
            ext === "md"
              ? "summary"
              : ext === "tsx" || ext === "jsx"
                ? "page"
                : ext === "ts" || ext === "js"
                  ? "page"
                  : ext === "json"
                    ? "data"
                    : ext === "css" || ext === "scss"
                      ? "page"
                      : "summary";
          return {
            name,
            path: fp,
            type,
            size: "—",
            workspace,
            skill: r.slashCommand || "",
            run: r.sessionId.slice(0, 8),
            updated: r.endMs ? humanAgo(Date.now() - r.endMs) : "—",
            updatedMs: r.endMs,
          };
        });
      })
      .sort((a, b) => b.updatedMs - a.updatedMs)
      .slice(0, 80),
    skills: {
      active: skillStats.map((s) => ({
        name: sanitize(s.name) ?? s.name,
        uses7d: s.uses7d,
        totalUses: s.totalUses,
        lastUsed: s.lastUsed,
        lastUsedMs: s.lastUsedMs,
      })),
      // Recommendations are pattern-based and not implemented in v1.
      // The UI hides the section when this list is empty.
      recommended: [] as never[],
    },
    integrations: (() => {
      const obsidianVaults = Array.isArray((memory as any)?.obsidianVaults)
        ? ((memory as any).obsidianVaults as ObsidianVaultInfo[])
        : [];
      const memObsidianFiles = obsidianVaults.reduce((sum, vault) => sum + (vault.files || 0), 0);
      const out: {
        name: string;
        slug: string;
        connected: boolean;
        tagline: string;
        color: string;
      }[] = [];
      // Always show signals we have a real check for.
      if (claude.credCount > 0) {
        out.push({
          name: "Anthropic API",
          slug: "anthropic",
          connected: true,
          tagline: `${claude.credCount} keychain creds · ${claude.authMode}`,
          color: "FF7A3D",
        });
      }
      if (chatgpt.present) {
        out.push({
          name: "OpenAI Codex",
          slug: "openai",
          connected: true,
          tagline: `Codex · ${chatgpt.mode}`,
          color: "FFFFFF",
        });
      }
      if (openrouter) {
        const remaining = openrouter.limit_remaining;
        out.push({
          name: "OpenRouter",
          slug: "openrouter",
          connected: true,
          tagline:
            remaining !== null && remaining !== undefined
              ? `$${Number(remaining).toFixed(2)} left`
              : "API key",
          color: "7C8CFF",
        });
      }
      const totalVectors = (memory?.pinecone ?? []).reduce(
        (a: number, i: any) => a + (i.totalVectorCount || 0),
        0,
      );
      if ((memory?.pinecone ?? []).length > 0) {
        out.push({
          name: "Pinecone",
          slug: "pinecone",
          connected: true,
          tagline: `${memory.pinecone.length} indexes · ${totalVectors.toLocaleString()} vectors`,
          color: "FFFFFF",
        });
      }
      if (obsidianVaults.length > 0) {
        out.push({
          name: "Obsidian",
          slug: "obsidian",
          connected: true,
          tagline: memObsidianFiles > 0 ? `${memObsidianFiles} files` : "vault detected",
          color: "7c3aed",
        });
      }
      if (openclaw) {
        out.push({
          name: "OpenClaw",
          slug: "openclaw",
          connected: true,
          tagline: openclaw.lastTouchedVersion ? `v${openclaw.lastTouchedVersion}` : "configured",
          color: "FF7A3D",
        });
      }
      // Optional integrations — only emit when env signal exists.
      const optional: Array<{
        env: string;
        entry: { name: string; slug: string; tagline: string; color: string };
      }> = [
        {
          env: "SUPABASE_URL",
          entry: {
            name: "Supabase",
            slug: "supabase",
            tagline: "service URL set",
            color: "3FCF8E",
          },
        },
        {
          env: "SUPABASE_ANON_KEY",
          entry: { name: "Supabase", slug: "supabase", tagline: "anon key set", color: "3FCF8E" },
        },
        {
          env: "NOTION_TOKEN",
          entry: { name: "Notion", slug: "notion", tagline: "API token set", color: "FFFFFF" },
        },
        {
          env: "YOUTUBE_API_KEY",
          entry: { name: "YouTube API", slug: "youtube", tagline: "API key set", color: "FF0033" },
        },
        {
          env: "GMAIL_OAUTH_TOKEN",
          entry: { name: "Gmail", slug: "gmail", tagline: "OAuth set", color: "EA4335" },
        },
        {
          env: "GOOGLE_CALENDAR_TOKEN",
          entry: {
            name: "Google Calendar",
            slug: "googlecalendar",
            tagline: "OAuth set",
            color: "4285F4",
          },
        },
        {
          env: "GOOGLE_DRIVE_TOKEN",
          entry: {
            name: "Google Drive",
            slug: "googledrive",
            tagline: "OAuth set",
            color: "1FA463",
          },
        },
        {
          env: "GEMINI_API_KEY",
          entry: {
            name: "Google Gemini",
            slug: "googlegemini",
            tagline: "API key set",
            color: "8E75B2",
          },
        },
        {
          env: "ZAPIER_NLA_API_KEY",
          entry: { name: "Zapier", slug: "zapier", tagline: "NLA key set", color: "FF4F00" },
        },
        {
          env: "FIRECRAWL_API_KEY",
          entry: { name: "Firecrawl", slug: "firecrawl", tagline: "API key set", color: "FF6B35" },
        },
        {
          env: "CANVA_API_KEY",
          entry: { name: "Canva", slug: "canva", tagline: "API key set", color: "00C4CC" },
        },
        {
          env: "GAMMA_API_KEY",
          entry: { name: "Gamma", slug: "gamma", tagline: "API key set", color: "8B5CF6" },
        },
        {
          env: "TELEGRAM_BOT_TOKEN",
          entry: { name: "Telegram", slug: "telegram", tagline: "bot token set", color: "26A5E4" },
        },
        {
          env: "APIFY_API_TOKEN",
          entry: { name: "Apify", slug: "apify", tagline: "API token set", color: "97D700" },
        },
      ];
      const seenNames = new Set(out.map((i) => i.name));
      for (const o of optional) {
        if (process.env[o.env] && !seenNames.has(o.entry.name)) {
          seenNames.add(o.entry.name);
          out.push({ ...o.entry, connected: true });
        }
      }

      // ── MCP Servers from ~/.claude.json ──
      try {
        const claudeJsonPath = join(HOME, ".claude.json");
        if (existsSync(claudeJsonPath)) {
          const claudeJson = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
          const mcpServers = claudeJson.mcpServers || {};
          const mcpMeta: Record<string, { name: string; color: string }> = {
            "n8n-mcp": { name: "n8n", color: "FF6D5A" },
            granola: { name: "Granola", color: "8B5CF6" },
            stitch: { name: "Stitch (Google)", color: "4285F4" },
            higgsfield: { name: "Higgsfield", color: "EC4899" },
            supabase: { name: "Supabase", color: "3FCF8E" },
            notion: { name: "Notion", color: "FFFFFF" },
            slack: { name: "Slack", color: "4A154B" },
            linear: { name: "Linear", color: "5E6AD2" },
            github: { name: "GitHub", color: "FFFFFF" },
            postgres: { name: "PostgreSQL", color: "336791" },
            browserbase: { name: "Browserbase", color: "FF6B35" },
            puppeteer: { name: "Puppeteer", color: "00D8A2" },
            playwright: { name: "Playwright", color: "2EAD33" },
            sentry: { name: "Sentry", color: "362D59" },
          };
          for (const [key, config] of Object.entries(mcpServers)) {
            const meta = mcpMeta[key];
            const displayName = meta?.name ?? key.replace(/-mcp$/i, "").replace(/^./, (c: string) => c.toUpperCase());
            if (seenNames.has(displayName)) continue;
            seenNames.add(displayName);
            const serverType = (config as any)?.type === "http" ? "HTTP" : "stdio";
            out.push({
              name: displayName,
              slug: key.toLowerCase().replace(/[^a-z0-9]/g, ""),
              connected: true,
              tagline: `MCP · ${serverType}`,
              color: meta?.color ?? "8B8B8B",
            });
          }
        }
      } catch { /* ignore parse errors */ }

      // ── Claude Plugins from ~/.claude/settings.json ──
      try {
        const settingsPath = join(HOME, ".claude", "settings.json");
        if (existsSync(settingsPath)) {
          const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
          const plugins = settings.enabledPlugins || {};
          const pluginMeta: Record<string, { name: string; color: string }> = {
            telegram: { name: "Telegram", color: "26A5E4" },
            codex: { name: "Codex Plugin", color: "10A37F" },
            "cc-gemini-plugin": { name: "Gemini Plugin", color: "8E75B2" },
            "browser-use": { name: "Browser Use", color: "FF6B35" },
            github: { name: "GitHub Plugin", color: "FFFFFF" },
          };
          for (const [pluginKey, enabled] of Object.entries(plugins)) {
            if (!enabled) continue;
            const shortKey = pluginKey.split("@")[0];
            const meta = pluginMeta[shortKey];
            const displayName = meta?.name ?? shortKey.replace(/^./, (c: string) => c.toUpperCase());
            if (seenNames.has(displayName)) continue;
            seenNames.add(displayName);
            out.push({
              name: displayName,
              slug: shortKey.toLowerCase().replace(/[^a-z0-9]/g, ""),
              connected: true,
              tagline: "plugin",
              color: meta?.color ?? "8B8B8B",
            });
          }
        }
      } catch { /* ignore parse errors */ }

      // ── Claude AI Connectors from ~/.claude.json (claudeAiMcpEverConnected) ──
      try {
        const claudeJsonPath = join(HOME, ".claude.json");
        if (existsSync(claudeJsonPath)) {
          const cj = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
          const connectors: string[] = cj.claudeAiMcpEverConnected || [];
          const connectorMeta: Record<string, { name: string; color: string }> = {
            gamma: { name: "Gamma", color: "8B5CF6" },
            mercury: { name: "Mercury", color: "6366F1" },
            fireflies: { name: "Fireflies", color: "A855F7" },
            notion: { name: "Notion", color: "FFFFFF" },
            gmail: { name: "Gmail", color: "EA4335" },
            "google calendar": { name: "Google Calendar", color: "4285F4" },
            "google drive": { name: "Google Drive", color: "1FA463" },
            canva: { name: "Canva", color: "00C4CC" },
            apify: { name: "Apify", color: "97D700" },
            firecrawl: { name: "Firecrawl", color: "FF6B35" },
            pipedream: { name: "Pipedream", color: "22C55E" },
            supabase: { name: "Supabase", color: "3FCF8E" },
            zapier: { name: "Zapier", color: "FF4F00" },
            spotify: { name: "Spotify", color: "1DB954" },
            "apple notes": { name: "Apple Notes", color: "FFD60A" },
          };
          for (const raw of connectors) {
            // Strip "claude.ai " prefix: "claude.ai Notion" → "Notion"
            const stripped = raw.replace(/^claude\.ai\s*/i, "").trim();
            const key = stripped.toLowerCase();
            const meta = connectorMeta[key];
            const displayName = meta?.name ?? stripped;
            if (seenNames.has(displayName)) continue;
            seenNames.add(displayName);
            out.push({
              name: displayName,
              slug: key.replace(/[^a-z0-9]/g, ""),
              connected: true,
              tagline: "connector",
              color: meta?.color ?? "8B8B8B",
            });
          }
        }
      } catch { /* ignore parse errors */ }

      // ── Codex Plugins from ~/.codex/config.toml ──
      try {
        const tomlPath = join(HOME, ".codex", "config.toml");
        if (existsSync(tomlPath)) {
          const toml = readFileSync(tomlPath, "utf-8");
          // Parse [plugins."name@marketplace"] blocks with enabled = true
          const pluginRe = /\[plugins\."([^"]+)"\]\s*\nenabled\s*=\s*true/g;
          const codexMeta: Record<string, { name: string; color: string }> = {
            documents: { name: "Codex Documents", color: "10A37F" },
            spreadsheets: { name: "Codex Spreadsheets", color: "10A37F" },
            presentations: { name: "Codex Presentations", color: "10A37F" },
            "computer-use": { name: "Codex Computer Use", color: "10A37F" },
            "browser-use": { name: "Codex Browser Use", color: "10A37F" },
          };
          let m: RegExpExecArray | null;
          while ((m = pluginRe.exec(toml)) !== null) {
            const fullKey = m[1]; // e.g. "documents@openai-primary-runtime"
            const shortKey = fullKey.split("@")[0];
            const meta = codexMeta[shortKey];
            const displayName = meta?.name ?? `Codex ${shortKey.replace(/^./, (c: string) => c.toUpperCase())}`;
            if (seenNames.has(displayName)) continue;
            seenNames.add(displayName);
            out.push({
              name: displayName,
              slug: `codex-${shortKey}`.replace(/[^a-z0-9-]/g, ""),
              connected: true,
              tagline: "Codex plugin",
              color: meta?.color ?? "10A37F",
            });
          }

          // Codex MCP servers from config.toml: [mcp_servers.name]
          const mcpRe = /\[mcp_servers\.(\w+)\]/g;
          while ((m = mcpRe.exec(toml)) !== null) {
            const name = m[1];
            const displayName = name.replace(/^./, (c: string) => c.toUpperCase());
            if (seenNames.has(displayName)) continue;
            seenNames.add(displayName);
            out.push({
              name: displayName,
              slug: `codex-mcp-${name}`.replace(/[^a-z0-9-]/g, ""),
              connected: true,
              tagline: "Codex MCP",
              color: "10A37F",
            });
          }
        }
      } catch { /* ignore parse errors */ }

      return out;
    })(),
    automations,
    knowledgeStores: (() => {
      const out: {
        kind: string;
        slug: string;
        title: string;
        detail: string;
        brand: string;
        color: string;
        connected: boolean;
      }[] = [];
      if ((memory?.pinecone ?? []).length > 0) {
        const totalVectors = memory.pinecone.reduce(
          (a: number, i: any) => a + (i.totalVectorCount || 0),
          0,
        );
        const first = memory.pinecone[0];
        out.push({
          kind: "pinecone",
          slug: "pinecone",
          title: sanitize(first.name) ?? first.name,
          detail: `${memory.pinecone.length} indexes · ${totalVectors.toLocaleString()} vectors`,
          brand: "FFFFFF",
          color: "1F1F1F",
          connected: true,
        });
      }
      return out;
    })(),
    modelSplit: (() => {
      const sorted = Object.entries(parsed.modelTokens)
        .map(([model, t]) => ({ model, cost: computeCost(model, t) }))
        .filter((m) => m.cost > 0)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 6);
      const totalCost = sorted.reduce((a, m) => a + m.cost, 0);
      if (sorted.length === 0 || totalCost <= 0) return [] as never[];
      return sorted.map((m) => ({
        name: humanModelName(m.model),
        slug: providerSlug(m.model),
        share: m.cost / totalCost,
        tagline: providerName(m.model),
        color: providerColor(m.model),
      }));
    })(),
    memory,
    detection,
    dream,
  };

  const emitted = sanitizeForEmission(data);
  await Bun.write(OUT, JSON.stringify(emitted, null, 2));
  console.log(`[aggregate] wrote ${OUT}`);
  console.log(
    `[aggregate] subs: claude=${claude.authMode} chatgpt=${chatgpt.present ? chatgpt.mode : "none"} openrouter=${openrouter ? "ok" : "missing"} openclaw=${openclaw ? "ok" : "missing"}`,
  );
  console.log(`[aggregate] value extracted last 7d: $${data.summary.valueExtracted7d}`);
}

function humanAgo(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function humanDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

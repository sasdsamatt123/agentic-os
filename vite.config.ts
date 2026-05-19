import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Pantheon — the 10 canonical persona recipes. Schema co-designed with
// Hermes (see chat 2026-05-12). Model names follow the provider/name split
// the YAML schema uses; the dashboard renders the matching local logo from
// HERMES_LOCAL_LOGOS in agents.hermes.tsx. Skill ids are real Hermes skill
// folder names (run `hermes skills list` to verify).
//
// Models are tiered so cheap/silly tasks use cheap/fast models and reasoning
// tasks get top-tier models:
//   gpt-5.5            — Hermes default, capable mid-tier
//   claude-opus-4.7    — top reasoning, slow, $$$
//   claude-sonnet-4.5  — top execution, fast, $$
//   gpt-4o-mini        — fast, cheap, "free tier" for silly tasks
//   llama-3.3-70b      — free via OpenRouter, great for cheap orchestration
// ────────────────────────────────────────────────────────────────────────────
// Each seed carries a `default` flag — only `default: true` personas are
// written to disk by the install endpoint. The others are available as
// templates the user can spin up via the Add Persona wizard.
// Defaults are Labyrinth, Mercury, Philosopher (a research persona, an
// automation persona, a reasoning persona — covers most early use).
const PANTHEON_SEEDS: Array<{
  id: string;
  name: string;
  job: string;
  description: string;
  avatar: string;
  default: boolean;
  model: { provider: string; name: string };
  behavior: { tone: string; system_prompt: string };
  skills: string[];
  tools: string[];
  summon_phrases: string[];
}> = [
  {
    id: "oracle",
    name: "Oracle",
    job: "Memory & lookup",
    description: "Long-term memory and lookup. Reads SOUL.md and kanban; answers what-do-I-know.",
    avatar: "assets/oracle.png",
    default: false,
    model: { provider: "anthropic", name: "claude-sonnet-4.5" },
    behavior: {
      tone: "calm, precise, source-cited",
      system_prompt:
        "You are the Oracle. Read SOUL.md, the kanban, memory stores, and past sessions before answering. Cite sources. If you don't know, say so — never fabricate.",
    },
    skills: ["memory", "domain", "dogfood"],
    tools: ["file", "memory", "kanban"],
    summon_phrases: ["Oracle", "ask Oracle", "what do I know about"],
  },
  {
    id: "athena",
    name: "Athena",
    job: "Code review & refactors",
    description: "Code review, refactors, PR triage. Reads diffs, runs tests, files clean changes.",
    avatar: "assets/athena.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "sharp, skeptical, technical",
      system_prompt:
        "You are Athena. Review code with precision. Identify risks, suggest fixes, prefer evidence from tests, diffs, and repo inspection. Be direct — no flattery, no hedging.",
    },
    skills: ["github", "devops", "autonomous-ai-agents"],
    tools: ["file", "terminal", "github"],
    summon_phrases: ["Athena", "use Athena", "ask Athena to review", "review this PR"],
  },
  {
    id: "scribe",
    name: "Scribe",
    job: "Long-form writing",
    description: "Long-form writing: prose, docs, social posts, scripts. Fraunces-grade output.",
    avatar: "assets/scribe.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "literate, considered, voice-matched",
      system_prompt:
        "You are the Scribe. Write with craft. Match the user's voice. Read prior work before drafting. Prefer specificity over generality.",
    },
    skills: ["creative", "domain"],
    tools: ["file", "memory"],
    summon_phrases: ["Scribe", "ask Scribe to write", "draft this"],
  },
  {
    id: "orpheus",
    name: "Orpheus",
    job: "Media generation",
    description: "Media generation — image, video, audio, design. Talks to Kie / Runway / ElevenLabs.",
    avatar: "assets/orpheus.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "imaginative, visual-thinking, brief-first",
      system_prompt:
        "You are Orpheus. Generate media. Always confirm the brief — aspect, style, mood, references — before firing a render. Show your prompts before submitting.",
    },
    skills: ["creative", "media", "gifs"],
    tools: ["kie", "runway", "elevenlabs", "file"],
    summon_phrases: ["Orpheus", "generate an image", "make a video"],
  },
  {
    id: "labyrinth",
    name: "Labyrinth",
    job: "Deep research loops",
    description:
      "Long form research. Will spend hours digging through a topic before answering. Best for problems where the right answer requires reading everything available before reaching a conclusion. Persists progress to disk so it can resume after interruptions. Reports findings in structured deltas at each milestone instead of one wall of prose.",
    avatar: "assets/labyrinth.png",
    default: true,
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "patient, exhaustive, structured",
      system_prompt:
        "You are the Labyrinth. You handle deep multi step research and planning tasks that need patience. Before answering, decompose the problem into an explicit plan and confirm it with the user. Execute step by step, persisting progress at each milestone so the work can resume if interrupted. When a step fails, surface the failure clearly and propose two alternatives. Avoid summarising before you have the evidence to summarise. End every response with the next concrete action.",
    },
    skills: ["data-science", "autonomous-ai-agents"],
    tools: ["file", "terminal", "web", "memory"],
    summon_phrases: ["Labyrinth", "research this thoroughly", "run a deep dive"],
  },
  {
    id: "alchemist",
    name: "Alchemist",
    job: "Integrations & MCP",
    description: "MCP and tool tinkering. Spins up servers, wires integrations, runs experiments.",
    avatar: "assets/alchemist.png",
    default: false,
    model: { provider: "anthropic", name: "claude-sonnet-4.5" },
    behavior: {
      tone: "experimental, curious, hands-on",
      system_prompt:
        "You are the Alchemist. Stand up MCP servers, wire APIs, test integrations. Iterate fast — fail loud and recover. Document what worked, prune what didn't.",
    },
    skills: ["mcp", "devops", "inference-sh"],
    tools: ["file", "terminal", "mcp"],
    summon_phrases: ["Alchemist", "wire this up", "test this integration"],
  },
  {
    id: "philosopher",
    name: "Philosopher",
    job: "Deep reasoning",
    description:
      "For wrestling with ambiguous problems. Pulls on threads, questions premises, and surfaces the meta question behind the question. Slower than the others because depth costs tokens. Best when you genuinely do not know what you are trying to figure out before you have spent some time thinking.",
    avatar: "assets/philosopher.png",
    default: true,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "patient, socratic, layered",
      system_prompt:
        "You are the Philosopher. Treat every question as a starting point, not an instruction. Before answering, surface the meta question behind the question and confirm which the user actually wants resolved. Pull on threads. Question premises. Explain your reasoning step by step so the user can disagree with each step independently. It is better to admit uncertainty than to fabricate confidence.",
    },
    skills: ["domain"],
    tools: ["file", "memory"],
    summon_phrases: ["Philosopher", "think about this", "wrestle with this"],
  },
  {
    id: "mapmaker",
    name: "Mapmaker",
    job: "Diagrams & system docs",
    description: "Charts what is — architecture diagrams, codebase maps, system docs.",
    avatar: "assets/mapmaker.png",
    default: false,
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "visual, precise, no-jargon",
      system_prompt:
        "You are the Mapmaker. Render the system as a diagram first, prose second. Use Mermaid or Excalidraw for everything structural. Keep one screen = one idea.",
    },
    skills: ["diagramming", "github"],
    tools: ["file", "excalidraw", "mermaid"],
    summon_phrases: ["Mapmaker", "diagram this", "chart the architecture"],
  },
  {
    id: "mercury",
    name: "Mercury",
    job: "Autopilot and cron",
    description:
      "The autopilot. Built for tasks that should happen on a schedule with no human in the loop. Cron jobs, webhook handlers, status checks, scheduled summaries. Cheap and fast on purpose. Logs everything to disk so you can audit what ran while you slept.",
    avatar: "assets/mercury.png",
    default: true,
    model: { provider: "openrouter", name: "meta-llama/llama-3.3-70b-instruct:free" },
    behavior: {
      tone: "robotic, deterministic, status-led",
      system_prompt:
        "You are Mercury. You run on a schedule, not on demand. Your job is to do one task well, log the result, and exit cleanly. Never wait for a human reply mid run. If something blocks you, write it to the log and surface it through a kanban entry the user can read later. Keep responses terse and structured. Status first, then evidence.",
    },
    skills: ["gateway", "autonomous-ai-agents"],
    tools: ["cron", "webhook", "file"],
    summon_phrases: ["Mercury", "schedule this", "run this on a cron"],
  },
];

// Per-run secret used to gate /__refresh_data. The dev server writes it once
// at boot, the dashboard reads it via /__token, and includes it as a header
// on the refresh POST. A drive-by request from a malicious browser tab or
// extension cannot guess it. Rotated every dev-server start.
const REFRESH_TOKEN = randomBytes(32).toString("hex");
// Write the token to a tmp file so the same-origin browser fetch can read it
// only once at app boot (the file is short-lived, mode 0600).
const TOKEN_DIR = join(homedir(), ".claude-os");
const TOKEN_FILE = join(TOKEN_DIR, "dev-token");
try {
  if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, REFRESH_TOKEN, { mode: 0o600 });
} catch {
  /* non-fatal — the endpoint just won't accept refreshes */
}

// Reject any socket whose remote isn't 127.0.0.1 / ::1. Belt-and-braces
// alongside server.host = "127.0.0.1" — even if a future config change
// re-exposes the dev server, the privileged endpoints stay loopback-only.
function isLoopback(req: { socket?: { remoteAddress?: string | null } }): boolean {
  const a = req.socket?.remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

// Module-level response cache for slow endpoints. Each endpoint computes
// its result once, serves it from memory until the TTL expires, then
// recomputes. Massively speeds up the dashboard because /__hermes_status
// polls every 4s, /__hermes_connections every 20s, and /__hermes_pantheon_sync
// every 5s after a Copy click — all of which would otherwise re-shell-out
// to git/CLI on every hit.
const responseCache = new Map<string, { expires: number; body: string }>();
function sendCached(key: string, res: any): boolean {
  const cached = responseCache.get(key);
  if (cached && cached.expires > Date.now()) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Cache", "HIT");
    res.end(cached.body);
    return true;
  }
  return false;
}
function storeCached(key: string, ttlMs: number, body: string): void {
  responseCache.set(key, { expires: Date.now() + ttlMs, body });
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
//
// Port 8081 is hardcoded in scripts/server.ts CORS allowlist and the README — if a fresh
// user lands on the preset's default 8080, the sidecar refuses CORS and "Activate now" /
// "Run this fix" silently fail. Override here, with strictPort so a port collision fails
// loudly instead of drifting to 8082.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "claude-os-live-data",
        configureServer(server) {
          // GET /__live-data — serves live-data.json fresh from disk on every
          // request.  This replaces the static `import liveData from "…"`
          // pattern so the browser always gets the latest aggregator output
          // without a server restart.
          server.middlewares.use("/__live-data", (req, res, next) => {
            if (req.method !== "GET") return next();
            try {
              const filePath = resolve(__dirname, "src/data/live-data.json");
              const raw = readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(raw);
            } catch {
              // Fall back to example file on fresh clones
              try {
                const fallback = resolve(__dirname, "src/data/live-data.example.json");
                const raw = readFileSync(fallback, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(raw);
              } catch {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "No live-data.json found" }));
              }
            }
          });

          // GET /__hermes_status — live filesystem probe for Hermes Agent.
          // Returns whether Hermes is installed (~/.hermes + binary on PATH),
          // its version, and whether config.yaml is present + parseable.
          // Loopback-only because the response leaks the user's binary path
          // and default model id. The Hermes page hits this on mount to
          // decide whether to render Install / Setup / Chat states.
          server.middlewares.use("/__hermes_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 3s cache — frontend polls this every 4s, so a 3s TTL means
            // every other poll is an instant cache hit instead of re-running
            // `hermes --version` which can take a full second.
            if (sendCached("hermes-status", res)) return;
            const home = homedir();
            const hermesDir = join(home, ".hermes");
            const installedDir = existsSync(hermesDir);
            // Resolve the hermes binary across common install locations.
            const binCandidates = [
              join(home, ".local", "bin", "hermes"),
              "/opt/homebrew/bin/hermes",
              "/usr/local/bin/hermes",
            ];
            const binPath = binCandidates.find((p) => existsSync(p)) ?? null;
            let version: string | null = null;
            if (binPath) {
              try {
                const out = execSync(`"${binPath}" --version`, {
                  stdio: "pipe",
                  // Reduced from 3000ms — hermes --version either responds
                  // quickly or it's hung waiting for a TTY that never comes.
                  // 800ms is plenty for the happy path; if it times out the
                  // version just stays null and the dashboard falls back to
                  // its known-shipping fallback (currently v0.13.0).
                  timeout: 800,
                }).toString();
                version = out.trim().split("\n")[0] || null;
              } catch {
                /* version probe failed, leave null */
              }
            }
            // Parse Hermes' canonical config.yaml. The `model:` block has
            // BOTH `default:` (model name) AND `provider:` (canonical
            // inference provider). Previously we assumed the provider was
            // the prefix on the model name ("anthropic/claude-opus-4.6" →
            // anthropic), but Hermes also stores models bare ("gpt-5.5")
            // with provider declared separately. The `provider:` field is
            // the truth.
            const configPath = join(hermesDir, "config.yaml");
            const configured = existsSync(configPath);
            let defaultModel: string | null = null;
            let provider: string | null = null;
            if (configured) {
              try {
                const yaml = readFileSync(configPath, "utf-8");
                // Only match `default:` and `provider:` INSIDE the top-level
                // model block. Hermes' config.yaml repeats the same key
                // names inside fallback-providers entries, so we slice out
                // the model block by finding the next top-level key
                // (anything starting with non-space at column 0, on its
                // own line). Avoid /m flag — its $ would let the lazy
                // capture stop at the first line inside the block.
                const headerIdx = yaml.indexOf("model:\n");
                if (headerIdx !== -1) {
                  const afterHeader = yaml.slice(headerIdx + "model:\n".length);
                  // End at the next line that starts with a non-space char.
                  const endIdx = afterHeader.search(/\n[^\s]/);
                  const blockText =
                    endIdx === -1 ? afterHeader : afterHeader.slice(0, endIdx);
                  const m1 = blockText.match(/^\s*default:\s*["']?([^"'\n]+)["']?/m);
                  defaultModel = m1?.[1]?.trim() || null;
                  const m2 = blockText.match(/^\s*provider:\s*["']?([^"'\n]+)["']?/m);
                  provider = m2?.[1]?.trim() || null;
                }
              } catch {
                /* ignore */
              }
            }

            // OAuth providers don't store an API key in ~/.hermes/.env —
            // credentials live in Hermes' OAuth token store. For those,
            // having `provider:` set in config.yaml is sufficient to say
            // "Hermes can answer." For API-key providers we still verify
            // the matching env var is present.
            const OAUTH_PROVIDERS = new Set(["openai-codex", "nous"]);
            const PROVIDER_KEY_MAP: Record<string, string> = {
              anthropic: "ANTHROPIC_API_KEY",
              openrouter: "OPENROUTER_API_KEY",
              openai: "OPENAI_API_KEY",
              gemini: "GOOGLE_API_KEY",
              copilot: "GITHUB_TOKEN",
              huggingface: "HF_TOKEN",
              groq: "GROQ_API_KEY",
              "ollama-cloud": "OLLAMA_API_KEY",
              nvidia: "NVIDIA_API_KEY",
              zai: "GLM_API_KEY",
              "kimi-coding": "KIMI_API_KEY",
              minimax: "MINIMAX_API_KEY",
            };
            const providerKeyName = provider ? PROVIDER_KEY_MAP[provider] ?? null : null;
            const envPath = join(hermesDir, ".env");
            let hasProviderKey = false;
            if (provider && OAUTH_PROVIDERS.has(provider)) {
              // OAuth-authed; we don't check env. Hermes' OAuth store is
              // sufficient and `hermes status` will catch a missing token.
              hasProviderKey = true;
            } else if (providerKeyName && existsSync(envPath)) {
              try {
                const envText = readFileSync(envPath, "utf-8");
                const re = new RegExp(`^\\s*${providerKeyName}\\s*=\\s*[^\\s#]`, "m");
                hasProviderKey = re.test(envText);
              } catch {
                /* ignore */
              }
            }
            const installed = installedDir && Boolean(binPath);
            // "needsSetup" only fires when there's a real gap: Hermes is
            // installed but config.yaml has no provider set, OR the
            // declared provider expects a key we can't find. Don't trip
            // for unknown providers — we'd rather show the chat and let
            // it fail with a real error than block a working install.
            const needsSetup =
              installed &&
              (!provider ||
                (!OAUTH_PROVIDERS.has(provider) &&
                  providerKeyName !== null &&
                  !hasProviderKey));
            const body = JSON.stringify({
              installed,
              binPath,
              version,
              configured,
              defaultModel,
              provider,
              providerKeyName,
              hasProviderKey,
              needsSetup,
              envPath,
            });
            storeCached("hermes-status", 3000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // POST /__hermes_image_upload — accept a raw image body, save it
          // to ~/.hermes/image_cache/<uuid>.<ext>, return the absolute path
          // so the chat can prepend it to the prompt. Hermes' vision-capable
          // models (and the file-read tool) then pick the image up by path.
          // Token-gated, loopback only, 8MB hard cap.
          server.middlewares.use("/__hermes_image_upload", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            const contentType = String(req.headers["content-type"] ?? "");
            // Map common image content-types → extensions. Anything else
            // is rejected — we don't want arbitrary file types written
            // into the Hermes image cache.
            const EXT_BY_CT: Record<string, string> = {
              "image/png": "png",
              "image/jpeg": "jpg",
              "image/jpg": "jpg",
              "image/webp": "webp",
              "image/gif": "gif",
            };
            const ext = EXT_BY_CT[contentType.split(";")[0].trim()];
            if (!ext) {
              res.statusCode = 415;
              res.end(JSON.stringify({ error: "unsupported image type" }));
              return;
            }
            const MAX = 8 * 1024 * 1024;
            const chunks: Buffer[] = [];
            let total = 0;
            let aborted = false;
            req.on("data", (c: Buffer) => {
              total += c.length;
              if (total > MAX) {
                aborted = true;
                req.destroy();
                return;
              }
              chunks.push(c);
            });
            req.on("end", () => {
              if (aborted) {
                res.statusCode = 413;
                res.end(JSON.stringify({ error: "too large (8MB max)" }));
                return;
              }
              const buf = Buffer.concat(chunks);
              const cacheDir = join(homedir(), ".hermes", "image_cache");
              try {
                mkdirSync(cacheDir, { recursive: true });
              } catch {
                /* ignore */
              }
              const id = randomBytes(8).toString("hex");
              const filename = `dashboard-${Date.now()}-${id}.${ext}`;
              const path = join(cacheDir, filename);
              try {
                writeFileSync(path, buf);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
                return;
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ path, size: buf.length, type: contentType }));
            });
          });

          // POST /__hermes_chat — shells out to `hermes chat -Q -q "<prompt>"`
          // (single-query mode with quiet/programmatic output) and streams
          // the response back to the dashboard as SSE.
          // Loopback + token gated. Body: { prompt: "<user message>" }.
          // The prompt is passed as a single argv string — argv doesn't
          // get shell-interpreted, so a malicious prompt can't smuggle
          // shell commands. Browser disconnect kills the child.
          server.middlewares.use("/__hermes_chat", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const provided = req.headers["x-claude-os-token"];
            if (provided !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "invalid token" }));
              return;
            }
            let body = "";
            for await (const chunk of req as any) body += chunk;
            let payload: { prompt?: string; sessionId?: string };
            try {
              payload = JSON.parse(body || "{}");
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid json" }));
              return;
            }
            const prompt = payload.prompt?.trim() ?? "";
            if (!prompt || prompt.length > 12_000) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "prompt empty or too long" }));
              return;
            }
            // Optional sessionId resumes an existing conversation. Hermes'
            // --resume flag loads the prior turns as context so this reply
            // builds on them. We validate the id to a safe character set
            // (alphanumerics + - and _) so it can't escape to argv.
            const sessionId = payload.sessionId?.trim() ?? "";
            if (sessionId && !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid sessionId" }));
              return;
            }

            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Connection", "keep-alive");
            // Disable any in-between proxy buffering and flush headers so
            // the browser opens the stream immediately. Without this the
            // first chunk can take multiple seconds to appear even after
            // hermes starts producing output.
            res.setHeader("X-Accel-Buffering", "no");
            (res as any).flushHeaders?.();
            // Heartbeat comment every 15s so connections through proxies
            // don't time out mid-thought on a long hermes reply.
            const heartbeat = setInterval(() => {
              res.write(":keepalive\n\n");
            }, 15_000);

            const sendEvent = (event: string, data: string) => {
              const safe = data.replace(/\r/g, "");
              for (const line of safe.split("\n")) {
                res.write(`event: ${event}\n`);
                res.write(`data: ${line}\n\n`);
              }
            };

            // Resolve Hermes. Prefer the venv's Python + source entrypoint
            // (`python hermes_cli/main.py …`) over the `hermes` shim because
            // some installer revisions ship a broken bash shim at
            // ~/.hermes/hermes-agent/venv/bin/hermes that recursively execs
            // ITSELF — every fresh CLI call hangs forever before reaching
            // the Python entry. Calling Python + main.py directly bypasses
            // the shim entirely. Falls back to the wrapper binaries on
            // installs where the source tree isn't present (e.g. pipx).
            const home = homedir();
            const hermesRoot = join(home, ".hermes", "hermes-agent");
            const hermesPython = join(hermesRoot, "venv", "bin", "python");
            const hermesMain = join(hermesRoot, "hermes_cli", "main.py");
            const useSourceEntrypoint =
              existsSync(hermesPython) && existsSync(hermesMain);
            const binCandidates = [
              join(home, ".local", "bin", "hermes"),
              "/opt/homebrew/bin/hermes",
              "/usr/local/bin/hermes",
            ];
            const binPath = useSourceEntrypoint
              ? hermesPython
              : binCandidates.find((p) => existsSync(p));
            if (!binPath) {
              sendEvent("error", "Hermes binary not found on PATH.");
              res.end();
              return;
            }

            // Run hermes from the user's home directory rather than the
            // dev server's cwd. Otherwise hermes auto-injects this repo's
            // CLAUDE.md / AGENTS.md as system context and replies as if
            // it were Claude OS's setup agent. The home dir is a neutral
            // ground — the user's personal ~/.hermes/SOUL.md and memory
            // still load (those are global, not cwd-relative).
            const cwd = home;
            // Nous Research's Hermes uses an explicit `chat` subcommand with
            // -q/--query for single-shot programmatic use and -Q/--quiet to
            // suppress banner/spinner/tool-preview noise so only the model's
            // final reply lands in the SSE stream. (The old `-z` shortcut
            // from earlier Hermes builds doesn't exist in this version.)
            const args = useSourceEntrypoint
              ? [hermesMain, "chat", "-Q", "-q", prompt]
              : ["chat", "-Q", "-q", prompt];
            if (sessionId) args.push("--resume", sessionId);
            // Strip any inherited PYTHONPATH/PYTHONHOME so the venv's own
            // site-packages resolution wins. Inherited values from a parent
            // shell can shadow Hermes' bundled deps and cause silent imports
            // failures that look identical to a hang.
            const hermesEnv = { ...process.env };
            delete hermesEnv.PYTHONPATH;
            delete hermesEnv.PYTHONHOME;
            const child = spawn(binPath, args, {
              cwd,
              env: {
                ...hermesEnv,
                // Python buffers stdout when it isn't a TTY. Without this
                // every reply came out all at once after hermes exited
                // (looked like a hang). Forces line-buffered output so
                // the SSE stream actually streams.
                PYTHONUNBUFFERED: "1",
                // Force a wide pseudo-tty so Hermes doesn't truncate output
                // when its TTY detection misfires under spawn().
                TERM: "xterm-256color",
                COLUMNS: "180",
                LINES: "60",
              },
            });

            // Two-stage watchdog because Nous Research's Hermes CLI has two
            // distinct failure modes:
            //   1. Slow first-output cold start (sqlite migrations, model
            //      load, skills sync) — can take 30-90s on a fresh boot
            //      after the gateway has just claimed locks. We must NOT
            //      kill during this window even though stdout is silent.
            //   2. Post-completion curses/rich hang in --query mode — after
            //      the answer is on stdout, the process spins forever at
            //      100% CPU. Once we see SOME output, an 8s silence means
            //      it's done and we can SIGTERM cleanly.
            const FIRST_OUTPUT_TIMEOUT_MS = 120_000; // 2 min cold-start grace
            const POST_OUTPUT_IDLE_MS = 8_000; // strict after streaming starts
            let watchdog: NodeJS.Timeout | null = null;
            let receivedAnyOutput = false;
            const setIdle = (ms: number) => {
              if (watchdog) clearTimeout(watchdog);
              watchdog = setTimeout(() => {
                if (child.killed) return;
                // Pre-output: hermes is hung waiting for something it
                // can't get (auth lock, network, etc.) — surface as error.
                // Post-output: assume done, terminate cleanly.
                child.kill("SIGTERM");
                setTimeout(() => {
                  if (!child.killed) child.kill("SIGKILL");
                }, 2_000);
              }, ms);
            };
            setIdle(FIRST_OUTPUT_TIMEOUT_MS);

            child.stdout.on("data", (buf: Buffer) => {
              receivedAnyOutput = true;
              sendEvent("chunk", buf.toString("utf-8"));
              setIdle(POST_OUTPUT_IDLE_MS);
            });
            child.stderr.on("data", (buf: Buffer) => {
              // Hermes pipes status into stderr; keep the user's chat
              // bubble clean by routing stderr to an "info" event the
              // client can choose to display dimly.
              receivedAnyOutput = true;
              sendEvent("info", buf.toString("utf-8"));
              setIdle(POST_OUTPUT_IDLE_MS);
            });
            child.on("error", (err) => {
              if (watchdog) clearTimeout(watchdog);
              sendEvent("error", String(err.message || err));
              res.end();
            });
            child.on("close", (code, signal) => {
              clearInterval(heartbeat);
              if (watchdog) clearTimeout(watchdog);
              // SIGTERM/SIGKILL from our watchdog after Hermes already
              // produced its reply counts as a successful turn — the model
              // gave us output, the hang is just in the curses cleanup.
              // Pre-output kills (cold-start timeout) surface as errors so
              // the user knows something's genuinely wrong.
              if (
                code === 0 ||
                ((signal === "SIGTERM" || signal === "SIGKILL") && receivedAnyOutput)
              ) {
                sendEvent("done", "ok");
              } else if (signal === "SIGTERM" || signal === "SIGKILL") {
                sendEvent(
                  "error",
                  "Hermes didn't respond in 2 minutes. Check ~/.hermes/.env has provider credentials and run `hermes gateway restart`.",
                );
              } else {
                sendEvent("error", `hermes exited with code ${code ?? signal}`);
              }
              res.end();
            });
            req.on("close", () => {
              clearInterval(heartbeat);
              if (watchdog) clearTimeout(watchdog);
              if (!child.killed) child.kill("SIGTERM");
            });
          });

          // GET /__hermes_skills — list installed Hermes skill categories
          // by walking ~/.hermes/skills/. Each top-level directory is a
          // category (apple, devops, research, etc.) with a DESCRIPTION.md
          // and zero-or-more sub-skill subdirectories. Loopback only.
          server.middlewares.use("/__hermes_skills", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const skillsDir = join(homedir(), ".hermes", "skills");
            const out: Array<{
              id: string;
              description: string;
              subskills: string[];
            }> = [];
            try {
              if (existsSync(skillsDir)) {
                const entries = readdirSync(skillsDir, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                );
                // Helper: pull a description from a markdown file with
                // YAML frontmatter. Prefers an explicit `description:`
                // line in the frontmatter, then falls back to the first
                // 1–2 non-heading body lines. Returns "" on any failure.
                function describeFromMd(path: string): string {
                  try {
                    let raw = readFileSync(path, "utf-8");
                    const fm = raw.match(/^---\n[\s\S]*?\n---\n?/);
                    if (fm) raw = raw.slice(fm[0].length);
                    const explicit = fm
                      ? fm[0].match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1]
                      : undefined;
                    let description =
                      explicit?.trim() ||
                      raw
                        .split("\n")
                        .filter((l) => l.trim() && !l.startsWith("#"))
                        .slice(0, 2)
                        .join(" ")
                        .trim();
                    return description.slice(0, 240);
                  } catch {
                    return "";
                  }
                }
                for (const e of entries) {
                  const dir = join(skillsDir, e.name);
                  // 1) Prefer a top-level DESCRIPTION.md (Hermes-style).
                  let description = "";
                  const descPath = join(dir, "DESCRIPTION.md");
                  if (existsSync(descPath)) {
                    description = describeFromMd(descPath);
                  }
                  // 2) Fall back to a top-level SKILL.md — bundled Hermes
                  //    skills (dogfood, claude-os, etc.) carry their
                  //    description in the SKILL.md frontmatter instead.
                  if (!description) {
                    const skillPath = join(dir, "SKILL.md");
                    if (existsSync(skillPath)) {
                      description = describeFromMd(skillPath);
                    }
                  }
                  // 3) Some categories have neither at the top level but
                  //    DO have subskill directories with their own
                  //    SKILL.md (e.g. devops/<some-skill>/SKILL.md). For
                  //    those we synthesize a description from the first
                  //    sub-skill's frontmatter — better than empty.
                  if (!description) {
                    try {
                      const subs = readdirSync(dir, { withFileTypes: true })
                        .filter((s) => s.isDirectory() && !s.name.startsWith("."))
                        .map((s) => s.name);
                      for (const sub of subs) {
                        const subSkillPath = join(dir, sub, "SKILL.md");
                        if (existsSync(subSkillPath)) {
                          const subDesc = describeFromMd(subSkillPath);
                          if (subDesc) {
                            description = subDesc;
                            break;
                          }
                        }
                      }
                    } catch {
                      /* ignore */
                    }
                  }
                  let subskills: string[] = [];
                  try {
                    subskills = readdirSync(dir, { withFileTypes: true })
                      .filter((s) => s.isDirectory() && !s.name.startsWith("."))
                      .map((s) => s.name)
                      .slice(0, 12);
                  } catch {
                    /* ignore */
                  }
                  out.push({ id: e.name, description, subskills });
                }
              }
            } catch {
              /* surface empty list rather than 500 */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ skills: out }));
          });

          // GET /__hermes_profiles — list configured Hermes profiles by
          // shelling out to `hermes profile list`. Each row in the output
          // is a profile (◆default → name, model, gateway, alias). The
          // active profile is marked with ◆. Loopback only.
          server.middlewares.use("/__hermes_profiles", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const out: Array<{
              name: string;
              model: string | null;
              gateway: string | null;
              alias: string | null;
              distribution: string | null;
              active: boolean;
            }> = [];
            try {
              // Use `hermes profile list` with no --json flag — the binary's
              // table output is stable enough for line-parsing. The leading
              // ◆ glyph marks the sticky-default profile. We strip Rich box-
              // drawing chars and split on 2+ spaces between cells.
              const raw = execSync("hermes profile list", {
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                env: { ...process.env, NO_COLOR: "1" },
                timeout: 5000,
              });
              const lines = raw.split("\n");
              for (const line of lines) {
                // Strip Rich's heavy box-drawing characters so we can split
                // on 2+ spaces cleanly.
                const clean = line.replace(/[┃│┏┓┗┛━─╇┡┩┛┃◇]/g, " ").trim();
                if (!clean) continue;
                // Header / divider rows
                if (
                  /^Profile/i.test(clean) ||
                  /^[\s─━]+$/.test(clean) ||
                  /^Name\s+Model/i.test(clean)
                )
                  continue;
                const cells = clean.split(/\s{2,}/).map((c) => c.trim());
                if (cells.length < 2) continue;
                let name = cells[0];
                const active = name.startsWith("◆") || name.startsWith("*");
                name = name.replace(/^[◆*]\s*/, "").trim();
                if (!name || /^[—-]+$/.test(name)) continue;
                // Skip rows that are just emoji-only or look bogus
                if (!/[a-z0-9_-]/i.test(name)) continue;
                const model = cells[1] && !/^[—-]+$/.test(cells[1]) ? cells[1] : null;
                const gateway = cells[2] && !/^[—-]+$/.test(cells[2]) ? cells[2] : null;
                const alias = cells[3] && !/^[—-]+$/.test(cells[3]) ? cells[3] : null;
                const distribution =
                  cells[4] && !/^[—-]+$/.test(cells[4]) ? cells[4] : null;
                out.push({ name, model, gateway, alias, distribution, active });
              }
            } catch {
              /* hermes binary not found / errored — surface empty list */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ profiles: out }));
          });

          // GET /__hermes_connections — Hermes-specific connectivity. Real
          // signals only: provider auths from auth.json, messaging gateway
          // tokens from ~/.hermes/.env, configured MCP servers. NOT the
          // dashboard's broader machine integrations — those don't
          // necessarily plumb into Hermes. Loopback only.
          //
          // Returns { connections: [{kind, name, slug, status}] }
          //   kind = "provider" | "gateway" | "mcp" | "memory"
          //   slug = brand-icon slug for logo lookup
          //   status = "connected" | "needs_setup"
          server.middlewares.use("/__hermes_connections", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 30s cache — connections rarely change inside one user session;
            // running 6 CLI probes on every page focus is wasteful.
            if (sendCached("hermes-connections", res)) return;
            const conns: Array<{
              kind: string;
              name: string;
              slug: string;
              status: string;
            }> = [];

            // 1. Provider auths — read auth.json's providers map.
            try {
              const authPath = join(homedir(), ".hermes", "auth.json");
              if (existsSync(authPath)) {
                const raw = readFileSync(authPath, "utf-8");
                const j = JSON.parse(raw);
                const providers = j?.providers ?? {};
                for (const key of Object.keys(providers)) {
                  conns.push({
                    kind: "provider",
                    name: key,
                    slug: key.toLowerCase().replace(/-codex$/, ""),
                    status: "connected",
                  });
                }
              }
            } catch {
              /* ignore */
            }

            // 2. Messaging gateway tokens — read .env, look for known keys.
            //    Also: GENERIC API-key scan. Any other *_API_KEY / *_TOKEN /
            //    *_SECRET that the user has set (uncommented + non-empty)
            //    surfaces as a "service" connection automatically. This
            //    means dropping APOLLO_API_KEY into ~/.hermes/.env is all
            //    it takes for Apollo to show up in the dashboard strip —
            //    no code changes needed for every new skill/service.
            try {
              const envPath = join(homedir(), ".hermes", ".env");
              if (existsSync(envPath)) {
                const env = readFileSync(envPath, "utf-8");
                const GATEWAY_TOKENS: Record<
                  string,
                  { name: string; slug: string }
                > = {
                  TELEGRAM_BOT_TOKEN: { name: "Telegram", slug: "telegram" },
                  SLACK_BOT_TOKEN: { name: "Slack", slug: "slack" },
                  DISCORD_TOKEN: { name: "Discord", slug: "discord" },
                  WHATSAPP_CLOUD_TOKEN: { name: "WhatsApp", slug: "whatsapp" },
                  TWILIO_AUTH_TOKEN: { name: "SMS", slug: "twilio" },
                  RESEND_API_KEY: { name: "Email", slug: "resend" },
                  SENDGRID_API_KEY: { name: "Email", slug: "sendgrid" },
                };
                const knownTokenKeys = new Set(Object.keys(GATEWAY_TOKENS));
                for (const [token, meta] of Object.entries(GATEWAY_TOKENS)) {
                  const re = new RegExp(`^\\s*${token}\\s*=\\s*[^\\s#]`, "m");
                  if (re.test(env)) {
                    conns.push({
                      kind: "gateway",
                      name: meta.name,
                      slug: meta.slug,
                      status: "connected",
                    });
                  }
                }

                // Generic pass: catch ANY service the user has added via
                // an API key / token / secret env var. Skip anything we've
                // already surfaced above + provider creds (those come from
                // auth.json) + bare-noise tokens (HF_HOME etc. that aren't
                // credentials).
                const PROVIDER_KEYS = new Set([
                  "ANTHROPIC_API_KEY",
                  "OPENAI_API_KEY",
                  "OPENROUTER_API_KEY",
                  "GROQ_API_KEY",
                  "MISTRAL_API_KEY",
                  "GEMINI_API_KEY",
                  "GOOGLE_API_KEY",
                  "GOOGLE_GENERATIVE_AI_API_KEY",
                  "PERPLEXITY_API_KEY",
                  "COHERE_API_KEY",
                ]);
                const NON_CREDENTIAL_NOISE = new Set([
                  "HF_TOKEN", // some setups use this for HuggingFace download cache, still a token though
                ]);
                const seenServices = new Set<string>();
                // Match `NAME_API_KEY=value`, `NAME_TOKEN=value`, etc.
                const pattern = /^\s*([A-Z][A-Z0-9_]*?)_(API_KEY|TOKEN|SECRET|ACCESS_TOKEN|API_TOKEN)\s*=\s*([^\s#].*)$/gm;
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(env)) !== null) {
                  const fullKey = `${m[1]}_${m[2]}`;
                  if (knownTokenKeys.has(fullKey)) continue; // already surfaced as gateway
                  if (PROVIDER_KEYS.has(fullKey)) continue;  // provider, comes from auth.json
                  if (NON_CREDENTIAL_NOISE.has(fullKey)) continue;
                  const root = m[1].toLowerCase();
                  if (seenServices.has(root)) continue;
                  seenServices.add(root);
                  // Derive a human-readable name: APOLLO -> "Apollo",
                  // STRIPE_LIVE -> "Stripe Live", AIRTABLE -> "Airtable".
                  const niceName = root
                    .split("_")
                    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
                    .join(" ");
                  const slug = root.replace(/_/g, "-");
                  conns.push({
                    kind: "service",
                    name: niceName,
                    slug,
                    status: "connected",
                  });
                }
              }
            } catch {
              /* ignore */
            }

            // 3. MCP servers — Hermes CLI requires a TTY for `mcp list`,
            // which means execSync from a non-TTY context hangs until
            // timeout. The endpoint was eating 3s per request for zero
            // benefit. Skip until Hermes ships a non-interactive flag.

            // 4. CLI-backed services — Hermes' skills use external CLIs
            // (gh, gws, linear-cli, spotify, etc.) for their actual work.
            // We probe each CLI's "am I authenticated?" command. If it
            // returns 0, the user has a working connection. Probes are
            // 500ms timeout + silent so missing/slow CLIs never block.
            // Most fail instantly (command not found) which is sub-ms.
            const cliServices: Array<{
              name: string;
              slug: string;
              probe: string;
            }> = [
              { name: "GitHub", slug: "github", probe: "gh auth status" },
              { name: "Google Workspace", slug: "google", probe: "gws auth status" },
              { name: "Linear", slug: "linear", probe: "linear whoami" },
              { name: "Spotify", slug: "spotify", probe: "spotify auth status" },
              { name: "Notion", slug: "notion", probe: "test -n \"$NOTION_TOKEN\"" },
              { name: "Airtable", slug: "airtable", probe: "test -n \"$AIRTABLE_API_KEY\"" },
            ];
            for (const svc of cliServices) {
              try {
                execSync(svc.probe, {
                  stdio: ["ignore", "ignore", "ignore"],
                  env: { ...process.env, NO_COLOR: "1" },
                  timeout: 500,
                });
                conns.push({
                  kind: "service",
                  name: svc.name,
                  slug: svc.slug,
                  status: "connected",
                });
              } catch {
                /* not authenticated or CLI not installed — skip */
              }
            }

            const body = JSON.stringify({ connections: conns });
            storeCached("hermes-connections", 30000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // ────────────────────────────────────────────────────────────────
          // Pantheon — persona YAMLs at ~/.hermes/pantheon/personas/*.yaml.
          // Schema (per Hermes' spec, see PROFILE_TEMPLATES.tsx):
          //   id, name, description, avatar?, model:{provider,name},
          //   behavior:{tone,system_prompt}, skills:[], tools:[],
          //   summon_phrases:[]
          //
          // GET  /__hermes_pantheon         → list installed personas
          // POST /__hermes_pantheon/install → write the seed 10 YAMLs
          //                                   (idempotent — skips files
          //                                   that already exist so user
          //                                   edits aren't clobbered).
          //                                   Token-gated.
          // POST /__hermes_pantheon/validate → schema-check a single
          //                                    persona payload
          // ────────────────────────────────────────────────────────────────
          // Lazy-loaded — only the pantheon routes use it, so we keep
          // top-level imports stable.
          const pantheonDir = join(homedir(), ".hermes", "pantheon", "personas");
          const pantheonAssetsDir = join(homedir(), ".hermes", "pantheon", "assets");

          /** Read one persona YAML file → parsed object + path. Returns
           *  null on parse error (we log to stderr but don't 500 the
           *  whole listing for one bad file). */
          async function readPersonaFile(path: string): Promise<any | null> {
            try {
              const yaml = await import("js-yaml");
              const raw = readFileSync(path, "utf-8");
              return yaml.load(raw);
            } catch {
              return null;
            }
          }

          server.middlewares.use("/__hermes_pantheon", async (req, res, next) => {
            // vite strips the mount prefix; inside this handler req.url is
            // "/" for bare GETs and "/install" / "/validate" for sub-paths.
            // We only handle the bare GET here — sub-paths fall through to
            // the install/validate handlers below.
            const url = new URL(req.url ?? "/", "http://x");
            if (url.pathname !== "/") return next();
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const personas: any[] = [];
            try {
              if (existsSync(pantheonDir)) {
                const files = readdirSync(pantheonDir).filter(
                  (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
                );
                for (const f of files) {
                  const obj = await readPersonaFile(join(pantheonDir, f));
                  if (obj && typeof obj === "object" && obj.id) {
                    personas.push({ ...obj, _file: f });
                  }
                }
              }
            } catch {
              /* surface empty list rather than 500 */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(
              JSON.stringify({
                personas,
                installed: existsSync(pantheonDir),
                dir: pantheonDir,
              }),
            );
          });

          // POST /__hermes_pantheon/install — writes the 10 seed YAMLs
          // (curated by the operator + Hermes) to ~/.hermes/pantheon/personas/.
          // Skips any file that already exists, so re-running is safe
          // and doesn't clobber user customisations.
          server.middlewares.use("/__hermes_pantheon/install", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            try {
              mkdirSync(pantheonDir, { recursive: true });
              mkdirSync(pantheonAssetsDir, { recursive: true });
            } catch {
              /* ignore */
            }
            const yaml = await import("js-yaml");
            const written: string[] = [];
            const skipped: string[] = [];
            // Only seed personas flagged as default. The rest are still
            // available as templates via /create but don't get auto-written
            // on install (design call — fewer personas by default is better
            // UX than 10 unfamiliar tiles).
            for (const seed of PANTHEON_SEEDS.filter((s) => s.default)) {
              const dest = join(pantheonDir, `${seed.id}.yaml`);
              if (existsSync(dest)) {
                skipped.push(seed.id);
                continue;
              }
              try {
                const body = yaml.dump(seed, {
                  lineWidth: 100,
                  noRefs: true,
                  sortKeys: false,
                });
                writeFileSync(dest, body, "utf-8");
                written.push(seed.id);
              } catch {
                /* file write fail — leave it out */
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                written,
                skipped,
                dir: pantheonDir,
              }),
            );
          });

          // POST /__hermes_pantheon/validate — schema-checks a persona
          // payload (request body = JSON {persona: <obj>}). Returns
          // {errors: [], warnings: []} so the dashboard can light up
          // a card before allowing export.
          server.middlewares.use("/__hermes_pantheon/validate", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
              let payload: any;
              try {
                payload = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              const p = payload?.persona ?? payload;
              const errors: string[] = [];
              const warnings: string[] = [];
              if (!p?.id) errors.push("missing id");
              if (!p?.name) errors.push("missing name");
              if (!p?.model?.name) errors.push("missing model.name");
              if (!p?.model?.provider) warnings.push("missing model.provider");
              if (!p?.behavior?.system_prompt) errors.push("missing behavior.system_prompt");
              if (!Array.isArray(p?.skills) || p.skills.length === 0)
                warnings.push("no skills listed");
              if (!Array.isArray(p?.summon_phrases) || p.summon_phrases.length === 0)
                errors.push("missing summon_phrases (at least 1 required)");
              // Tripwire — common secret patterns that should never appear
              // in a YAML you're about to push to GitHub.
              const flat = JSON.stringify(p ?? {});
              if (/sk-[a-z0-9]{20,}/i.test(flat)) errors.push("looks like an api key in payload");
              if (/(api_?key|secret|password)\s*[:=]/i.test(flat))
                warnings.push("payload mentions 'api_key/secret/password' — double-check");
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: errors.length === 0, errors, warnings }));
            });
          });

          // POST /__hermes_pantheon/create — create a new persona from one
          // of the PANTHEON_SEEDS templates, with the user's model + job
          // overrides applied. Returns 409 if a YAML with that id already
          // exists (the user is expected to pick an unused template).
          server.middlewares.use("/__hermes_pantheon/create", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", async () => {
              let payload: any;
              try {
                payload = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              const { templateId, model, job, description, prompt } = payload ?? {};
              const seed = PANTHEON_SEEDS.find((s) => s.id === templateId);
              if (!seed) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "unknown template id" }));
                return;
              }
              const dest = join(pantheonDir, `${seed.id}.yaml`);
              if (existsSync(dest)) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "persona already exists" }));
                return;
              }
              try {
                mkdirSync(pantheonDir, { recursive: true });
              } catch {
                /* ignore */
              }
              const merged = {
                ...seed,
                job: typeof job === "string" && job.trim() ? job.trim() : seed.job,
                description:
                  typeof description === "string" && description.trim()
                    ? description.trim()
                    : seed.description,
                model:
                  model && model.provider && model.name
                    ? { provider: model.provider, name: model.name }
                    : seed.model,
                behavior:
                  typeof prompt === "string" && prompt.trim()
                    ? { ...seed.behavior, system_prompt: prompt.trim() }
                    : seed.behavior,
              };
              try {
                const yaml = await import("js-yaml");
                writeFileSync(
                  dest,
                  yaml.dump(merged, { lineWidth: 100, noRefs: true, sortKeys: false }),
                  "utf-8",
                );
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, persona: merged }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
              }
            });
          });

          // GET /__hermes_pantheon_templates — surface the seed catalog
          // (id, name, job, default model) so the dashboard's Add Persona
          // wizard can show what's available without duplicating the data.
          server.middlewares.use("/__hermes_pantheon_templates", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const out = PANTHEON_SEEDS.map((s) => ({
              id: s.id,
              name: s.name,
              job: s.job ?? "",
              description: s.description,
              defaultModel: s.model,
            }));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ templates: out }));
          });

          // PUT or DELETE /__hermes_pantheon/<id> — edit or remove a
          // persona's YAML on disk. Body for PUT: JSON patch (shallow
          // merged onto the existing YAML). DELETE just unlinks the file.
          // Token-gated, loopback only.
          server.middlewares.use("/__hermes_pantheon/", async (req, res, next) => {
            // Mounted on /__hermes_pantheon/ so we catch /<id> requests
            // (install / validate / create are mounted separately above).
            if (req.method !== "PUT" && req.method !== "POST" && req.method !== "DELETE")
              return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const url = new URL(req.url ?? "/", "http://x");
            const id = url.pathname.replace(/^\//, "").split("/")[0];
            // The /install and /validate sub-routes are handled by their own
            // middleware higher up. Anything else falls through to here as
            // an "edit this persona by id" request.
            if (!id || id === "install" || id === "validate") return next();
            if (!/^[a-z0-9_-]+$/i.test(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid id" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            const filePath = join(pantheonDir, `${id}.yaml`);
            if (!existsSync(filePath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "persona not found" }));
              return;
            }

            // DELETE — unlink the YAML and return ok.
            if (req.method === "DELETE") {
              try {
                unlinkSync(filePath);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, deleted: id }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "delete failed" }));
              }
              return;
            }

            // PUT/POST — JSON-patch the YAML on disk.
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", async () => {
              let patch: any;
              try {
                patch = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              try {
                const yaml = await import("js-yaml");
                const existing = (yaml.load(readFileSync(filePath, "utf-8")) as any) ?? {};
                // Shallow merge for top-level fields; nested merge for
                // model + behavior so partial updates don't clobber other keys.
                const merged = { ...existing, ...patch };
                if (patch.model && existing.model)
                  merged.model = { ...existing.model, ...patch.model };
                if (patch.behavior && existing.behavior)
                  merged.behavior = { ...existing.behavior, ...patch.behavior };
                const out = yaml.dump(merged, {
                  lineWidth: 100,
                  noRefs: true,
                  sortKeys: false,
                });
                writeFileSync(filePath, out, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, persona: merged }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
              }
            });
          });

          // GET /__hermes_models — list the user's available models so the
          // persona-edit dropdown is grounded in reality. Sources:
          //   1. The default in ~/.hermes/config.yaml (highest signal —
          //      this is what the user has actually set up)
          //   2. A curated catalog of widely-supported models grouped by
          //      provider, used as the dropdown's "recommended" section.
          // Loopback only.
          server.middlewares.use("/__hermes_models", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // Default from config.yaml
            let defaultModel: { provider: string; name: string } | null = null;
            try {
              const cfgPath = join(homedir(), ".hermes", "config.yaml");
              if (existsSync(cfgPath)) {
                const text = readFileSync(cfgPath, "utf-8");
                const m = text.match(/^model:\s*\n((?:[ \t]+.+\n)+)/m);
                if (m) {
                  const block = m[1];
                  const name = block.match(/^\s+default:\s*["']?([^"'\n]+)/m)?.[1]?.trim();
                  const provider = block
                    .match(/^\s+provider:\s*["']?([^"'\n]+)/m)?.[1]
                    ?.trim();
                  if (name) defaultModel = { provider: provider ?? "openai", name };
                }
              }
            } catch {
              /* ignore */
            }
            // Curated catalog. Names match real model ids accepted by their
            // respective providers. Free tier flagged so the dropdown can
            // surface them.
            // Comprehensive catalog reflecting what Hermes can integrate
            // with as of v0.13. Groups by provider (OpenAI / Anthropic /
            // Google / OpenRouter / xAI / Mistral / Ollama / Cohere).
            // Tiers: top (frontier), mid (default), cheap (fast/small),
            // free (no-cost tier).
            const catalog = [
              {
                provider: "openai",
                models: [
                  { name: "gpt-5.5", tier: "top" },
                  { name: "gpt-5", tier: "mid" },
                  { name: "gpt-4.5", tier: "mid" },
                  { name: "gpt-4o", tier: "mid" },
                  { name: "gpt-4o-mini", tier: "cheap" },
                  { name: "o3", tier: "top" },
                  { name: "o3-mini", tier: "mid" },
                  { name: "o1", tier: "top" },
                ],
              },
              {
                provider: "anthropic",
                models: [
                  { name: "claude-opus-4.7", tier: "top" },
                  { name: "claude-sonnet-4.5", tier: "mid" },
                  { name: "claude-sonnet-4", tier: "mid" },
                  { name: "claude-haiku-4", tier: "cheap" },
                ],
              },
              {
                provider: "googlegemini",
                models: [
                  { name: "gemini-2.5-pro", tier: "top" },
                  { name: "gemini-2.5-flash", tier: "mid" },
                  { name: "gemini-2.0-flash", tier: "cheap" },
                  { name: "gemini-1.5-pro", tier: "mid" },
                ],
              },
              {
                provider: "openrouter",
                models: [
                  { name: "meta-llama/llama-3.3-70b-instruct:free", tier: "free" },
                  { name: "google/gemini-2.0-flash-exp:free", tier: "free" },
                  { name: "qwen/qwen-2.5-72b-instruct:free", tier: "free" },
                  { name: "mistralai/mistral-7b-instruct:free", tier: "free" },
                  { name: "deepseek/deepseek-r1:free", tier: "free" },
                ],
              },
              {
                provider: "xai",
                models: [
                  { name: "grok-3", tier: "top" },
                  { name: "grok-2", tier: "mid" },
                ],
              },
              {
                provider: "mistral",
                models: [
                  { name: "mistral-large-2", tier: "top" },
                  { name: "mistral-small-3", tier: "cheap" },
                ],
              },
              {
                provider: "ollama",
                models: [
                  { name: "llama3.3", tier: "free" },
                  { name: "qwen2.5", tier: "free" },
                  { name: "mistral", tier: "free" },
                ],
              },
              {
                provider: "groq",
                models: [
                  { name: "llama-3.3-70b-versatile", tier: "mid" },
                  { name: "mixtral-8x7b-32768", tier: "mid" },
                ],
              },
              {
                provider: "cohere",
                models: [
                  { name: "command-r-plus", tier: "mid" },
                ],
              },
            ];
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ default: defaultModel, catalog }));
          });

          // GET /__hermes_pantheon_sync — per-persona git sync status.
          //
          // Architecture: personas live at ~/.hermes/pantheon/personas/
          // (NOT a git repo). The Hermes "Take Hermes anywhere" flow
          // rsyncs ~/.hermes/ into a mirror dir (default ~/code/hermes-mirror/)
          // and pushes THAT to GitHub. So sync status = "does the mirror's
          // pantheon/personas/<id>.yaml byte-match the source AND is the
          // mirror clean + pushed?"
          //
          // Mirror path resolution (in order):
          //   1. $HERMES_MIRROR env var
          //   2. ~/.hermes/.mirror_path marker file (one line, absolute path)
          //   3. ~/code/hermes-mirror/ (the default the install prompt uses)
          //
          // Classification (mapped to the frontend's existing 4 states):
          //   synced    = source matches mirror, mirror clean, at or behind upstream
          //   dirty     = source differs from mirror, OR mirror has uncommitted changes
          //   untracked = persona missing from mirror entirely
          //   no_repo   = no mirror configured
          // Loopback only.
          server.middlewares.use("/__hermes_pantheon_sync", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 5s cache — short because GHSyncStepCard's Copy click polls
            // every 5s for 90s expecting badges to flip green. 5s TTL
            // means each poll hits the cache once then recomputes — fast
            // enough to feel live, slow enough to not thrash git on every
            // tick.
            if (sendCached("hermes-pantheon-sync", res)) return;
            const out: Record<string, "synced" | "dirty" | "untracked" | "no_repo"> = {};

            // List source personas first — these are what we're checking sync for.
            let sourceFiles: string[] = [];
            try {
              if (existsSync(pantheonDir)) {
                sourceFiles = readdirSync(pantheonDir).filter((f) => f.endsWith(".yaml"));
              }
            } catch {
              /* ignore */
            }

            // Resolve mirror path.
            let mirrorRoot = process.env.HERMES_MIRROR ?? "";
            if (!mirrorRoot) {
              try {
                const markerPath = join(homedir(), ".hermes", ".mirror_path");
                if (existsSync(markerPath)) {
                  mirrorRoot = readFileSync(markerPath, "utf-8").trim();
                }
              } catch {
                /* ignore */
              }
            }
            if (!mirrorRoot) {
              mirrorRoot = join(homedir(), "code", "hermes-mirror");
            }
            const mirrorGit = join(mirrorRoot, ".git");
            const mirrorPersonas = join(mirrorRoot, "pantheon", "personas");

            // No mirror configured → every persona is no_repo.
            if (!existsSync(mirrorGit)) {
              for (const f of sourceFiles) {
                out[f.replace(/\.yaml$/, "")] = "no_repo";
              }
              const body = JSON.stringify({ statuses: out, hasRepo: false, mirrorRoot });
              storeCached("hermes-pantheon-sync", 5000, body);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("X-Cache", "MISS");
              res.end(body);
              return;
            }

            // Check whether the mirror has uncommitted changes in pantheon/.
            let mirrorDirty = false;
            const dirtyMirrorIds = new Set<string>();
            const untrackedMirrorIds = new Set<string>();
            try {
              const porcelain = execSync("git status --porcelain pantheon/personas/", {
                cwd: mirrorRoot,
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                timeout: 3000,
              });
              for (const line of porcelain.split("\n")) {
                if (!line) continue;
                const flag = line.slice(0, 2);
                const path = line.slice(3).trim();
                const m = path.match(/pantheon\/personas\/([a-z0-9_-]+)\.yaml/i);
                if (!m) continue;
                const id = m[1];
                if (flag.includes("?")) untrackedMirrorIds.add(id);
                else dirtyMirrorIds.add(id);
                mirrorDirty = true;
              }
            } catch {
              /* leave defaults */
            }

            // Compare each source file byte-for-byte against the mirror copy.
            for (const f of sourceFiles) {
              const id = f.replace(/\.yaml$/, "");
              const srcPath = join(pantheonDir, f);
              const mirrorPath = join(mirrorPersonas, f);
              if (!existsSync(mirrorPath)) {
                out[id] = "untracked";
                continue;
              }
              let same = false;
              try {
                same =
                  readFileSync(srcPath, "utf-8") === readFileSync(mirrorPath, "utf-8");
              } catch {
                /* treat as different */
              }
              if (!same) {
                out[id] = "dirty";
                continue;
              }
              if (dirtyMirrorIds.has(id) || untrackedMirrorIds.has(id)) {
                out[id] = "dirty";
                continue;
              }
              out[id] = "synced";
            }

            const body = JSON.stringify({
              statuses: out,
              hasRepo: true,
              mirrorRoot,
              mirrorDirty,
            });
            storeCached("hermes-pantheon-sync", 5000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // ────────────────────────────────────────────────────────────────
          // GET /__hermes_memory — universal memory readout for whichever
          // Hermes install is on this box. Respects $HERMES_HOME with a
          // fallback to ~/.hermes (per Hermes' own spec), so the dashboard
          // works for anyone who's installed Hermes in a non-default dir.
          // Returns:
          //   hermesHome             — resolved path
          //   user                   — { content, charCount, charLimit }
          //   memory                 — { content, charCount, charLimit }
          //   soul                   — { content, charCount, isTemplate }
          //                            (SOUL is the personality file, NOT
          //                            memory — surfaced separately so the
          //                            dashboard can render it differently)
          //   provider               — { active, available[] }
          //   profiles               — per-profile { name, hasMemory, hasUser, hasSoul }
          //   sessionCount, skillCount — quick counts so the dashboard can
          //                              render a system-wide overview
          //                              without firing 4 endpoints.
          // Loopback only.
          // ────────────────────────────────────────────────────────────────
          server.middlewares.use("/__hermes_memory", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const hermesHome = process.env.HERMES_HOME || join(homedir(), ".hermes");

            // Memory files — read MEMORY.md/USER.md and pair with the
            // configured char limit from config.yaml (2200 default).
            function safeRead(p: string): string {
              try {
                return readFileSync(p, "utf-8");
              } catch {
                return "";
              }
            }
            function parseCharLimit(): number {
              try {
                const cfg = readFileSync(join(hermesHome, "config.yaml"), "utf-8");
                const m = cfg.match(/memory_char_limit:\s*(\d+)/);
                if (m) return Number.parseInt(m[1] ?? "2200", 10);
              } catch {
                /* default */
              }
              return 2200;
            }
            const charLimit = parseCharLimit();

            const memoryDir = join(hermesHome, "memories");
            const userContent = safeRead(join(memoryDir, "USER.md"));
            const memoryContent = safeRead(join(memoryDir, "MEMORY.md"));
            const soulContent = safeRead(join(hermesHome, "SOUL.md"));
            // Default SOUL.md ships with only a comment block; detect that
            // so the dashboard can render a "define your voice" CTA rather
            // than rendering boilerplate comments as the persona.
            const stripped = soulContent
              .replace(/<!--[\s\S]*?-->/g, "")
              .replace(/^---[\s\S]*?---/, "")
              .trim();
            const isTemplate = stripped.length === 0;

            // Provider status — shell out to `hermes memory status` for
            // the authoritative list. Best-effort; fall back to empty.
            let providerActive: string | null = null;
            const providerAvailable: Array<{ name: string; needsKey: boolean }> = [];
            try {
              const raw = execSync("hermes memory status", {
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                env: { ...process.env, NO_COLOR: "1" },
                timeout: 4000,
              });
              const lines = raw.split("\n");
              for (const line of lines) {
                const clean = line.trim();
                if (!clean) continue;
                // Active provider line — "Provider: name" or "(none …)"
                const provMatch = clean.match(
                  /^Provider:\s*([a-z0-9_-]+)/i,
                );
                if (provMatch) providerActive = provMatch[1] ?? null;
                // Available plugin rows — "• name  (requires API key)" etc.
                const pluginMatch = clean.match(
                  /^[•·*]\s+([a-z0-9_-]+)\s*(?:\(([^)]+)\))?/i,
                );
                if (pluginMatch) {
                  const name = pluginMatch[1] ?? "";
                  const meta = (pluginMatch[2] ?? "").toLowerCase();
                  const needsKey = /(requires|needs)\s+api\s*key/.test(meta) ||
                    /api\s+key/.test(meta);
                  if (name) providerAvailable.push({ name, needsKey });
                }
              }
            } catch {
              /* hermes binary missing — leave defaults */
            }

            // Per-profile memory — Hermes profiles live at
            // $HERMES_HOME/profiles/<name>/ and each has its own
            // memories/, SOUL.md, sessions/, etc.
            const profilesDir = join(hermesHome, "profiles");
            const profiles: Array<{
              name: string;
              hasMemory: boolean;
              hasUser: boolean;
              hasSoul: boolean;
            }> = [];
            try {
              if (existsSync(profilesDir)) {
                const entries = readdirSync(profilesDir, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                );
                for (const e of entries) {
                  const dir = join(profilesDir, e.name);
                  profiles.push({
                    name: e.name,
                    hasMemory: existsSync(join(dir, "memories", "MEMORY.md")),
                    hasUser: existsSync(join(dir, "memories", "USER.md")),
                    hasSoul: existsSync(join(dir, "SOUL.md")),
                  });
                }
              }
            } catch {
              /* surface empty */
            }

            // Quick counts for the readout
            let sessionCount = 0;
            try {
              const sd = join(hermesHome, "sessions");
              if (existsSync(sd)) {
                sessionCount = readdirSync(sd).filter((f) => f.endsWith(".json")).length;
              }
            } catch {
              /* ignore */
            }
            let skillCount = 0;
            try {
              const sd = join(hermesHome, "skills");
              if (existsSync(sd)) {
                skillCount = readdirSync(sd, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                ).length;
              }
            } catch {
              /* ignore */
            }

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(
              JSON.stringify({
                hermesHome,
                user: {
                  content: userContent,
                  charCount: userContent.length,
                  charLimit,
                  path: join(memoryDir, "USER.md"),
                },
                memory: {
                  content: memoryContent,
                  charCount: memoryContent.length,
                  charLimit,
                  path: join(memoryDir, "MEMORY.md"),
                },
                soul: {
                  content: soulContent,
                  charCount: soulContent.length,
                  isTemplate,
                  path: join(hermesHome, "SOUL.md"),
                },
                provider: { active: providerActive, available: providerAvailable },
                profiles,
                sessionCount,
                skillCount,
              }),
            );
          });

          // GET /__hermes_sessions — summary of recent sessions from
          // ~/.hermes/sessions/*.json. Returns last 20 with model,
          // message count, system prompt preview, start/end timestamps.
          // Loopback only.
          server.middlewares.use("/__hermes_sessions", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const sessionsDir = join(homedir(), ".hermes", "sessions");
            const out: Array<{
              id: string;
              model: string | null;
              platform: string | null;
              messageCount: number;
              startedAt: string | null;
              lastUpdated: string | null;
              firstUserMessage: string | null;
            }> = [];
            try {
              if (existsSync(sessionsDir)) {
                const files = readdirSync(sessionsDir)
                  // Real Hermes session JSONs are named
                  // `session_<timestamp>_<id>.json`. The directory also
                  // contains `sessions.json` (Hermes' session-index, NOT
                  // a session) — explicitly exclude it or it shows up as
                  // a phantom "sessions" entry with all-null fields.
                  .filter(
                    (f) =>
                      f.endsWith(".json") &&
                      f !== "sessions.json" &&
                      !f.startsWith("."),
                  )
                  .map((name) => ({
                    name,
                    mtime: statSync(join(sessionsDir, name)).mtimeMs,
                  }))
                  .sort((a, b) => b.mtime - a.mtime)
                  .slice(0, 20);
                for (const f of files) {
                  try {
                    const raw = readFileSync(join(sessionsDir, f.name), "utf-8");
                    const j = JSON.parse(raw);
                    const msgs = Array.isArray(j.messages) ? j.messages : [];
                    const firstUser =
                      msgs.find((m: any) => m?.role === "user")?.content ?? null;
                    out.push({
                      id: j.session_id ?? f.name.replace(/\.json$/, ""),
                      model: j.model ?? null,
                      platform: j.platform ?? null,
                      messageCount:
                        typeof j.message_count === "number" ? j.message_count : msgs.length,
                      startedAt: j.session_start ?? null,
                      lastUpdated: j.last_updated ?? null,
                      firstUserMessage:
                        typeof firstUser === "string" ? firstUser.slice(0, 200) : null,
                    });
                  } catch {
                    /* skip unreadable session */
                  }
                }
              }
            } catch {
              /* ignore */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ sessions: out }));
          });

          // GET /__hermes_session?id=<session_id> — full message list for one
          // session, so the dashboard can render a Telegram-style sidebar:
          // click a thread, see its history. Loopback only. Returns the
          // session_id, model, platform, and full messages array.
          server.middlewares.use("/__hermes_session", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const url = new URL(req.url || "", "http://localhost");
            const id = url.searchParams.get("id");
            if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid id" }));
              return;
            }
            const sessionsDir = join(homedir(), ".hermes", "sessions");
            // Hermes session files include a timestamp prefix, so we search
            // by suffix match. Bounded scan because we only ship 20 recent
            // anyway, and the directory is the user's own.
            let match: string | null = null;
            try {
              const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
              for (const f of files) {
                if (f.includes(id) || f.startsWith(id) || f.replace(/\.json$/, "") === id) {
                  match = f;
                  break;
                }
              }
            } catch {
              /* ignore */
            }
            if (!match) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "not found" }));
              return;
            }
            try {
              const raw = readFileSync(join(sessionsDir, match), "utf-8");
              const j = JSON.parse(raw);
              const msgs = Array.isArray(j.messages) ? j.messages : [];
              // Surface only what the UI needs — drop system prompts and
              // raw tool blobs from the response payload.
              const clean = msgs.map((m: any) => ({
                role: m?.role ?? "unknown",
                content:
                  typeof m?.content === "string"
                    ? m.content
                    : Array.isArray(m?.content)
                      ? m.content
                          .map((c: any) =>
                            typeof c === "string" ? c : c?.text ?? c?.content ?? "",
                          )
                          .join("\n")
                      : "",
                ts: m?.timestamp ?? null,
              }));
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(
                JSON.stringify({
                  sessionId: j.session_id ?? id,
                  model: j.model ?? null,
                  platform: j.platform ?? null,
                  startedAt: j.session_start ?? null,
                  lastUpdated: j.last_updated ?? null,
                  messages: clean,
                }),
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message ?? "read failed" }));
            }
          });

          // GET /__just-installed — true the first time after `bun run setup`,
          // false thereafter. Setup writes ~/.claude-os/show-wizard; this
          // endpoint reads + deletes it so the dashboard force-opens the
          // wizard once even if the browser has stale claude-os-config from
          // a prior install.
          server.middlewares.use("/__just-installed", (req, res, next) => {
            if (req.method !== "GET") return next();
            const marker = join(homedir(), ".claude-os", "show-wizard");
            let justInstalled = false;
            try {
              if (existsSync(marker)) {
                justInstalled = true;
                unlinkSync(marker);
              }
            } catch {
              /* ignore */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ justInstalled }));
          });

          // GET /__token — hands the per-run refresh token to the dashboard
          // so it can authenticate /__refresh_data. Loopback-only and must
          // match the local file's contents (which only the user account
          // can read), so a browser extension on another origin can't get
          // it. Rotated every dev-server boot.
          server.middlewares.use("/__token", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ token: REFRESH_TOKEN }));
          });

          // POST /__refresh_data — re-runs the aggregator. Locked down to
          // (a) loopback origin only, and (b) a per-run token in the
          // X-Claude-OS-Token header. Any drive-by request from another
          // origin or extension is rejected with 403. Without this, every
          // tab on localhost:8081 could trigger a full machine scan that
          // reads ~/.claude/, decodes JWTs, and runs `security
          // dump-keychain`.
          server.middlewares.use("/__refresh_data", (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method not allowed");
              return;
            }
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            const provided = req.headers["x-claude-os-token"];
            if (provided !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "invalid token" }));
              return;
            }
            try {
              const root = resolve(__dirname);
              execSync("bun run scripts/aggregate.ts", {
                cwd: root,
                stdio: "pipe",
                timeout: 30000,
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
        },
      },
    ],
    server: {
      // Bind to localhost (resolves to 127.0.0.1 / ::1 — loopback only).
      // The dev server scans private user data (~/.claude/, keychain, JWTs)
      // so it must never be reachable from another machine on the LAN.
      // Using "localhost" (not "127.0.0.1") makes Vite display the
      // friendlier URL, and means the browser treats every visit as the
      // same origin — so localStorage (saved config, profile photo) stays
      // consistent regardless of whether the user types localhost or 127…
      host: "localhost",
      port: 8081,
      strictPort: true,
      // Exclude live-data.json from the file watcher. The aggregator writes
      // this file during the wizard (Steps 2 and 7). Without this exclusion,
      // Vite triggers HMR on every write, which re-mounts route components,
      // destroys React state, and creates infinite scan/activate loops.
      // The app reads the file at import time; hot-reloading it mid-wizard
      // is actively harmful.
      watch: { ignored: ["**/src/data/live-data.json"] },
    },
  },
});

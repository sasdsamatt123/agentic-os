#!/usr/bin/env bun
/**
 * argus.ts — Direct xAI Grok-4.20 wrapper with X live search enabled.
 *
 * Why: Hermes' xai plugin doesn't pass server-side tools (live_search) to
 * Grok, so Grok says "I have no X search" when called through Hermes. This
 * script bypasses Hermes, reads the OAuth access token from Hermes' credential
 * pool (~/.hermes/auth.json), and calls xAI directly with the live_search
 * tool enabled — giving Argus real-time X firehose access.
 *
 * Auth: reuses Hermes' xai-oauth token (X Premium subscription quota).
 * Cost: $0 for standard chat (subscription); $5 per 1000 live_search calls.
 *
 * Usage:
 *   bun run scripts/argus.ts "son 1 saatte AI builder X'te ne konuşuluyor?"
 *   bun run scripts/argus.ts --no-search "düz Grok cevabı, X aramasız"
 *   bun run scripts/argus.ts --json "raw JSON dön"
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface Credential {
  id: string;
  label: string;
  auth_type: string;
  access_token: string;
  refresh_token?: string;
  base_url: string;
  last_refresh?: string;
}

interface AuthJson {
  credential_pool: Record<string, Credential[]>;
}

function readHermesXaiToken(): { token: string; baseUrl: string } {
  const authPath = join(homedir(), ".hermes", "auth.json");
  if (!existsSync(authPath)) {
    throw new Error(
      "~/.hermes/auth.json not found. Hermes installed and authenticated?",
    );
  }
  const auth: AuthJson = JSON.parse(readFileSync(authPath, "utf-8"));
  const xoCreds = auth.credential_pool["xai-oauth"] ?? [];
  if (xoCreds.length === 0) {
    throw new Error(
      "No xai-oauth credential. Run: hermes auth add xai-oauth (then approve in browser).",
    );
  }
  const cred = xoCreds[0]!;
  if (!cred.access_token) {
    throw new Error("xai-oauth credential has no access_token.");
  }
  return { token: cred.access_token, baseUrl: cred.base_url ?? "https://api.x.ai/v1" };
}

// Parse args
const args = process.argv.slice(2);
const noSearch = args.includes("--no-search");
const jsonOutput = args.includes("--json");
const prompt = args
  .filter((a) => a !== "--no-search" && a !== "--json")
  .join(" ")
  .trim();

if (!prompt) {
  console.error("Usage: bun run scripts/argus.ts [--no-search] [--json] <prompt>");
  console.error("Example: bun run scripts/argus.ts 'AI builder X'te bugün ne trending?'");
  process.exit(2);
}

const { token, baseUrl } = readHermesXaiToken();

// Build request body — xAI Responses API spec (matches Hermes' codex_responses api_mode).
const body: Record<string, unknown> = {
  model: "grok-4.20",
  input: [{ role: "user", content: prompt }],
};

if (!noSearch) {
  // xAI tool taxonomy (confirmed from HTTP 422 error response):
  //   function | web_search | x_search | collections_search | file_search
  //   code_execution | code_interpreter | mcp | shell
  // For X (Twitter) firehose real-time search → use x_search.
  body.tools = [{ type: "x_search" }];
}

const url = `${baseUrl}/responses`;
const t0 = Date.now();

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(body),
});

const elapsedMs = Date.now() - t0;

if (!res.ok) {
  const errText = await res.text();
  console.error(`❌ HTTP ${res.status} after ${elapsedMs}ms:`);
  console.error(errText.slice(0, 1500));
  process.exit(1);
}

const data: any = await res.json();

if (jsonOutput) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

// Extract assistant text — xAI Responses API output shape:
//   data.output: array of items
//   item.type === "message" → item.content[0].text
//   item.type === "live_search" → item.results (citations)
const outputs = Array.isArray(data?.output) ? data.output : [];
let answer = "";
const citations: Array<{ url: string; title?: string }> = [];

for (const item of outputs) {
  if (item?.type === "message") {
    const blocks = item.content ?? [];
    for (const b of blocks) {
      if (b?.text) answer += b.text;
      else if (typeof b === "string") answer += b;
    }
  } else if (item?.type === "live_search" || item?.type === "web_search") {
    const results = item.results ?? item.search_results ?? [];
    for (const r of results) {
      citations.push({ url: r.url ?? r.link ?? "", title: r.title });
    }
  }
}

// Fallback for unexpected shapes
if (!answer) {
  answer = data?.output_text ?? data?.text ?? data?.content ?? "";
  if (!answer) {
    console.error("⚠ Unexpected response shape. Use --json to inspect:");
    console.log(JSON.stringify(data, null, 2).slice(0, 2000));
    process.exit(1);
  }
}

console.log(answer.trim());

if (citations.length > 0) {
  console.log("\n--- X SOURCES ---");
  for (const c of citations.slice(0, 8)) {
    console.log(`• ${c.title ? c.title + " — " : ""}${c.url}`);
  }
}

console.error(`\n[argus] grok-4.20 via xai-oauth · ${elapsedMs}ms · ${noSearch ? "no-search" : "live_search:x"}`);

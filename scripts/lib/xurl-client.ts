/**
 * xurl-client.ts — subprocess wrapper around xdevplatform's xurl CLI.
 *
 * Why xurl: it handles OAuth 2.0 PKCE refresh automatically, stores tokens
 * in ~/.xurl, supports multi-app/multi-account. We don't reimplement OAuth.
 *
 * Pricing (X API pay-per-use, May 2026):
 *   - $0.015  per text/media write (post, reply, like)
 *   - $0.20   per write whose body contains a URL  ← BEWARE
 *   - $0.005  per generic read
 *   - $0.001  per owned-read (your own posts, followers, etc.)
 *
 * The wrapper invokes `xurl --app argus <subcommand> ...`. We do NOT pass
 * tokens on the CLI (security: per the xurl skill rules).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { addCost, log } from "./argus-state";

const APP_LABEL = process.env.ARGUS_XURL_APP ?? "argus";

function findXurlBinary(): string {
  // Common install paths from the xurl install.sh
  const candidates = [
    join(homedir(), ".local", "bin", "xurl"),
    "/opt/homebrew/bin/xurl",
    "/usr/local/bin/xurl",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Fall back to PATH lookup at exec time
  return "xurl";
}

const XURL = findXurlBinary();

export interface XurlResult {
  ok: boolean;
  status: number;
  body: any;
  rawText: string;
  costUsd: number;
  durationMs: number;
}

function hasUrl(text: string): boolean {
  return /\bhttps?:\/\/\S+/.test(text);
}

function priceForWrite(text: string): number {
  return hasUrl(text) ? 0.2 : 0.015;
}

/**
 * Invoke xurl with the given args. Returns parsed JSON + HTTP status.
 * If xurl is missing or auth fails, returns ok=false with diagnostic body.
 */
async function invoke(args: string[]): Promise<{ status: number; body: any; rawText: string; durationMs: number }> {
  const t0 = Date.now();
  const fullArgs = ["--app", APP_LABEL, "--include-headers", ...args];
  const proc = Bun.spawn([XURL, ...fullArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdoutText, stderrText] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  const durationMs = Date.now() - t0;
  const combined = stdoutText + (stderrText ? `\n[stderr]\n${stderrText}` : "");
  // xurl with --include-headers prints "HTTP/2 200" first line, then headers,
  // blank line, then body. We parse the status and isolate body.
  const lines = stdoutText.split("\n");
  let status = 0;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^HTTP\/[\d.]+\s+(\d+)/);
    if (m) {
      status = parseInt(m[1]!, 10);
    }
    if (lines[i]!.trim() === "" && status > 0) {
      bodyStart = i + 1;
      break;
    }
  }
  const bodyText = lines.slice(bodyStart).join("\n").trim();
  let body: any = bodyText;
  try {
    body = JSON.parse(bodyText);
  } catch {
    // Non-JSON body — keep as text
  }
  if (status === 0 && stderrText) {
    body = { error: stderrText.trim() };
  }
  return { status, body, rawText: combined, durationMs };
}

// ── Likes ─────────────────────────────────────────────────────────────
export async function like(meUserId: string, tweetId: string): Promise<XurlResult> {
  const result = await invoke([
    "-X",
    "POST",
    `/2/users/${meUserId}/likes`,
    "-d",
    JSON.stringify({ tweet_id: tweetId }),
    "-H",
    "Content-Type: application/json",
  ]);
  const ok = result.status >= 200 && result.status < 300;
  const cost = ok ? 0.015 : 0;
  if (ok) addCost("write", 1, cost);
  log("xurl_like", { tweet_id: tweetId, status: result.status, duration_ms: result.durationMs }, ok ? "info" : "error");
  return { ok, status: result.status, body: result.body, rawText: result.rawText, costUsd: cost, durationMs: result.durationMs };
}

// ── Reply ─────────────────────────────────────────────────────────────
export async function reply(inReplyToTweetId: string, text: string): Promise<XurlResult> {
  const result = await invoke([
    "-X",
    "POST",
    `/2/tweets`,
    "-d",
    JSON.stringify({ text, reply: { in_reply_to_tweet_id: inReplyToTweetId } }),
    "-H",
    "Content-Type: application/json",
  ]);
  const ok = result.status >= 200 && result.status < 300;
  const cost = ok ? priceForWrite(text) : 0;
  if (ok) addCost("write", 1, cost);
  log(
    "xurl_reply",
    { reply_to: inReplyToTweetId, has_url: hasUrl(text), status: result.status, duration_ms: result.durationMs, cost_usd: cost },
    ok ? "info" : "error",
  );
  return { ok, status: result.status, body: result.body, rawText: result.rawText, costUsd: cost, durationMs: result.durationMs };
}

// ── Original post ─────────────────────────────────────────────────────
export async function post(text: string): Promise<XurlResult> {
  const result = await invoke([
    "-X",
    "POST",
    `/2/tweets`,
    "-d",
    JSON.stringify({ text }),
    "-H",
    "Content-Type: application/json",
  ]);
  const ok = result.status >= 200 && result.status < 300;
  const cost = ok ? priceForWrite(text) : 0;
  if (ok) addCost("write", 1, cost);
  log("xurl_post", { has_url: hasUrl(text), status: result.status, duration_ms: result.durationMs, cost_usd: cost }, ok ? "info" : "error");
  return { ok, status: result.status, body: result.body, rawText: result.rawText, costUsd: cost, durationMs: result.durationMs };
}

// ── Reads (engagement metrics) ────────────────────────────────────────
export async function getTweetMetrics(tweetId: string): Promise<XurlResult> {
  const result = await invoke([
    "-X",
    "GET",
    `/2/tweets/${tweetId}?tweet.fields=public_metrics,created_at,author_id`,
  ]);
  const ok = result.status >= 200 && result.status < 300;
  // Owned read pricing (our own posts) — $0.001 per resource
  const cost = ok ? 0.001 : 0;
  if (ok) addCost("write", 0, 0); // tracked separately via x_search bucket? use write bucket=0
  // Actually use a dedicated bucket: add to write_cost but with type tag
  if (ok) addCost("x_search", 0, cost); // cheapest grouping — re-classified in cost report
  log("xurl_get_tweet", { tweet_id: tweetId, status: result.status }, ok ? "info" : "error");
  return { ok, status: result.status, body: result.body, rawText: result.rawText, costUsd: cost, durationMs: result.durationMs };
}

export async function getUser(userIdOrMe: string = "me"): Promise<XurlResult> {
  const path =
    userIdOrMe === "me"
      ? `/2/users/me?user.fields=public_metrics,id,username`
      : `/2/users/${userIdOrMe}?user.fields=public_metrics,id,username`;
  const result = await invoke(["-X", "GET", path]);
  const ok = result.status >= 200 && result.status < 300;
  const cost = ok ? 0.001 : 0;
  if (ok) addCost("x_search", 0, cost);
  log("xurl_get_user", { id: userIdOrMe, status: result.status }, ok ? "info" : "error");
  return { ok, status: result.status, body: result.body, rawText: result.rawText, costUsd: cost, durationMs: result.durationMs };
}

// ── Self-test ─────────────────────────────────────────────────────────
export async function authStatus(): Promise<{ ok: boolean; details: string }> {
  const proc = Bun.spawn([XURL, "auth", "status"], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  const combined = (out + "\n" + err).trim();
  const ok = /authenticated|✓|valid/i.test(combined) && !/error|failed|missing/i.test(combined);
  return { ok, details: combined.slice(0, 800) };
}

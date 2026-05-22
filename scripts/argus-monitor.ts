#!/usr/bin/env bun
/**
 * argus-monitor.ts — 24/7 X engagement monitor.
 *
 * Runs every 15 min (via launchd). Per run:
 *   1. Load watchlist + state
 *   2. For each watch entry → x_search query via xai-oauth (Grok-4.20)
 *   3. Dedupe new tweets vs state.last_seen
 *   4. Batch-score new tweets with Grok (relevance + sentiment + draft text)
 *   5. Apply rules engine → auto_like / auto_reply / draft_only / skip
 *   6. Queue to pending_review.json or pending_auto.json
 *   7. Persist state + cost
 *
 * Usage:
 *   bun run scripts/argus-monitor.ts            # normal run
 *   bun run scripts/argus-monitor.ts --dry-run  # no state mutations
 *   bun run scripts/argus-monitor.ts --once     # alias of normal
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import {
  loadState,
  saveState,
  appendPendingReview,
  appendPendingAuto,
  addCost,
  log,
  type ArgusState,
  type PendingItem,
} from "./lib/argus-state";
import {
  loadWatchlist,
  enumerateBatches,
  type WatchBatch,
} from "./lib/argus-watchlist";
import { evaluate, type TweetForRules, type Scoring } from "./lib/argus-rules";

const DRY = process.argv.includes("--dry-run");

// ── xAI client (inline; argus.ts kept CLI-only) ───────────────────────
interface XaiCred {
  access_token: string;
  base_url: string;
}

function readXaiOauthToken(): XaiCred {
  const authPath = join(homedir(), ".hermes", "auth.json");
  if (!existsSync(authPath)) throw new Error("~/.hermes/auth.json not found");
  const auth = JSON.parse(readFileSync(authPath, "utf-8"));
  const creds = auth.credential_pool?.["xai-oauth"] ?? [];
  if (creds.length === 0) {
    throw new Error("No xai-oauth credential. Run: hermes auth add xai-oauth");
  }
  return {
    access_token: creds[0].access_token,
    base_url: creds[0].base_url ?? "https://api.x.ai/v1",
  };
}

/**
 * Trigger Hermes' auto-refresh by issuing a tiny chat call. Hermes detects
 * an expired access_token and uses the stored refresh_token to mint a new
 * one, then writes it back to auth.json. We then re-read the token.
 *
 * xAI OAuth tokens default to ~2h. Cron runs every 15m so usually fresh,
 * but if the monitor is paused for a while, this primes it cheaply ($0).
 */
function ensureFreshToken(): XaiCred {
  try {
    const hermesBin = join(homedir(), ".hermes", "hermes-agent", "venv", "bin", "hermes");
    if (existsSync(hermesBin)) {
      execSync(`'${hermesBin}' --provider xai-oauth --model grok-4.20 -t file -z "ping"`, {
        timeout: 30_000,
        stdio: "pipe",
      });
    }
  } catch {
    // Non-fatal — main x_search loop will surface auth errors per-watch.
  }
  return readXaiOauthToken();
}

interface XaiResponseBlock {
  type: string;
  content?: Array<{ text?: string }>;
  results?: any[];
}

async function callGrok(
  cred: XaiCred,
  userPrompt: string,
  opts: { withSearch?: boolean; jsonObject?: boolean; timeout?: number } = {},
): Promise<{ text: string; raw: any; citations: any[] }> {
  const body: Record<string, unknown> = {
    model: "grok-4.20",
    input: [{ role: "user", content: userPrompt }],
  };
  if (opts.withSearch) {
    body.tools = [{ type: "x_search" }];
  }
  if (opts.jsonObject) {
    // xAI Responses API uses text.format (not response_format which is /v1/chat/completions only)
    body.text = { format: { type: "json_object" } };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 120_000);
  try {
    const res = await fetch(`${cred.base_url}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`xAI HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }
    const raw = await res.json();
    const outputs: XaiResponseBlock[] = Array.isArray(raw?.output) ? raw.output : [];
    let text = "";
    const citations: any[] = [];
    for (const item of outputs) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const b of item.content) {
          if (b?.text) text += b.text;
        }
      } else if (item?.type === "x_search" || item?.type === "live_search") {
        if (Array.isArray(item.results)) citations.push(...item.results);
      }
    }
    if (!text) text = raw?.output_text ?? raw?.text ?? "";
    return { text: text.trim(), raw, citations };
  } finally {
    clearTimeout(t);
  }
}

// ── Search & parse tweet results ──────────────────────────────────────
interface SearchTweet {
  id: string;
  url: string;
  author: string;
  text: string;
  created_at?: string;
  has_url?: boolean;
}

/**
 * Use Grok with x_search tool to find tweets matching a BATCHED OR-query.
 * One x_search call covers up to ~5 watch terms, slashing per-run cost.
 */
async function searchTweetsBatch(
  cred: XaiCred,
  batch: WatchBatch,
): Promise<SearchTweet[]> {
  const prompt = `Use the x_search tool to find the latest ${batch.max_results} tweets matching this X (Twitter) search query:

  query: ${batch.query}

  Return ONLY a JSON object of the form:
  {
    "tweets": [
      {"id": "<tweet_id>", "url": "<x.com URL>", "author": "<handle without @>", "text": "<full tweet text>", "created_at": "<ISO timestamp>", "has_url": <true/false: does the tweet body contain a URL>}
    ]
  }

  No commentary, just JSON. If x_search returns zero results, return {"tweets": []}.
  Newest first. Skip retweets and self-replies.`;
  const { text } = await callGrok(cred, prompt, { withSearch: true, jsonObject: true, timeout: 120_000 });
  addCost("x_search", 1, 0.005);
  try {
    const parsed = JSON.parse(text);
    const tweets: SearchTweet[] = Array.isArray(parsed?.tweets) ? parsed.tweets : [];
    return tweets.filter((t) => t?.id && t?.text);
  } catch (e) {
    log("search_parse_failed", { batch_id: batch.batch_id, text: text.slice(0, 400) }, "warn");
    return [];
  }
}

// ── Batch scoring ─────────────────────────────────────────────────────
interface ScoredTweet extends SearchTweet {
  scoring: Scoring;
  draft_reply: string;
}

/**
 * Load the operator brief from ~/.hermes/argus/argus-program.md.
 *
 * argus-program.md is the user's "who am I + how do I sound + hard
 * constraints" document, written by `bun run install-argus` and editable
 * any time. The monitor reads it on every run so the user can revise
 * voice anchors without touching code.
 *
 * Fallback (file missing): a minimal generic brief — Argus still works
 * but replies will be bland.
 */
function loadOperatorBrief(): string {
  const path = join(homedir(), ".hermes", "argus", "argus-program.md");
  try {
    if (existsSync(path)) {
      const md = readFileSync(path, "utf-8");
      // Strip headings/markdown — the scorer just needs the prose.
      return md.replace(/^#+\s.*$/gm, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
    }
  } catch {}
  return [
    "Operator: a builder on X.",
    "Voice: concrete, useful, value-first. Avoid hype clichés ('AI will change everything').",
    "Match the tweet's language (Turkish, English, etc.) in any draft reply.",
    "Hard avoids: crypto/airdrop, DM-bait, political flame wars.",
  ].join(" ");
}

async function scoreTweetsBatch(cred: XaiCred, tweets: SearchTweet[]): Promise<ScoredTweet[]> {
  if (tweets.length === 0) return [];
  const operatorBrief = loadOperatorBrief();

  const tweetsJson = tweets
    .map(
      (t, i) => `{"i":${i},"author":"@${t.author}","text":${JSON.stringify(t.text)}}`,
    )
    .join(",\n");

  const prompt = `${operatorBrief}

  For each tweet below, return JSON: {"results": [{"i": <index>, "relevance_score": 0-100, "sentiment": "friendly|question|opportunity|hostile|spam|neutral", "draft_reply": "<<=280 char reply in the operator's voice (from the brief above); empty string if not worth replying>"}]}

  Score 0-30 = irrelevant. 60-79 = worth manual review. 80+ = high-value engagement.

  Tweets:
  [${tweetsJson}]

  Return ONLY the JSON object. No prose.`;

  const { text } = await callGrok(cred, prompt, { withSearch: false, jsonObject: true, timeout: 120_000 });
  addCost("x_search", 0, 0); // scoring is non-search inference; tracked under chat (free with subscription)
  try {
    const parsed = JSON.parse(text);
    const results: any[] = Array.isArray(parsed?.results) ? parsed.results : [];
    return tweets.map((t, i): ScoredTweet => {
      const r = results.find((x) => x?.i === i);
      return {
        ...t,
        scoring: {
          relevance_score: typeof r?.relevance_score === "number" ? r.relevance_score : 0,
          sentiment: r?.sentiment ?? "neutral",
        },
        draft_reply: typeof r?.draft_reply === "string" ? r.draft_reply : "",
      };
    });
  } catch (e) {
    log("score_parse_failed", { text: text.slice(0, 400) }, "warn");
    return tweets.map((t): ScoredTweet => ({
      ...t,
      scoring: { relevance_score: 50, sentiment: "neutral" },
      draft_reply: "",
    }));
  }
}

// ── Main loop ─────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  log("monitor_start", { dry_run: DRY });

  const wl = loadWatchlist();
  const state: ArgusState = loadState();
  const cred = ensureFreshToken();
  const batches = enumerateBatches(wl);

  console.log(
    `[argus] ${batches.length} batched queries across ${wl.polling.scan_categories.join(", ")} · interval ${wl.polling.interval_minutes}m`,
  );

  // Stage 1: search per batch (OR-combined queries)
  let totalSearched = 0;
  let totalNew = 0;
  const newPerBatch: Array<{ batch: WatchBatch; tweets: SearchTweet[] }> = [];

  // Track which tweets have already been seen across the whole watchlist.
  // The state still keys by batch_id; the newest tweet of each batch is the
  // "last_seen" marker, but we also build an in-memory set of every recently
  // queued tweet id to defend against same-tweet showing up in multiple
  // batches (e.g. a hashtag tweet that also mentions @your_handle).
  const queuedTweetIds = new Set<string>();

  // Pre-filter knobs
  const MAX_AGE_HOURS_ACCOUNTS = 24;  // skip account tweets older than 1d
  const MAX_AGE_HOURS_KEYWORDS = 6;   // keywords: only recent (last 6h)
  const MAX_AGE_HOURS_HASHTAGS = 12;
  const MAX_AGE_HOURS_MENTIONS = 72;  // mentions: be more patient (3 days)

  for (const batch of batches) {
    try {
      const tweets = await searchTweetsBatch(cred, batch);
      totalSearched += tweets.length;
      const lastSeenId = state.last_seen[batch.batch_id];
      // Dedupe: against state + in-memory set
      const newTweets = tweets.filter(
        (t) => t.id !== lastSeenId && !queuedTweetIds.has(t.id),
      );
      // Pre-filter exclude_keywords
      const blacklist = wl.exclude_keywords.map((k) => k.toLowerCase());
      const ageFilter = (t: SearchTweet) => {
        if (!t.created_at) return true;
        const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 3_600_000;
        const cutoff =
          batch.category === "accounts"
            ? MAX_AGE_HOURS_ACCOUNTS
            : batch.category === "keywords"
              ? MAX_AGE_HOURS_KEYWORDS
              : batch.category === "hashtags"
                ? MAX_AGE_HOURS_HASHTAGS
                : MAX_AGE_HOURS_MENTIONS;
        return ageHours <= cutoff;
      };
      const filtered = newTweets.filter((t) => {
        if (!ageFilter(t)) return false;
        const lower = t.text.toLowerCase();
        return !blacklist.some((kw) => lower.includes(kw));
      });
      if (filtered.length > 0) {
        if (!DRY) state.last_seen[batch.batch_id] = filtered[0]!.id;
        newPerBatch.push({ batch, tweets: filtered });
        for (const t of filtered) queuedTweetIds.add(t.id);
        totalNew += filtered.length;
      }
      console.log(
        `  · ${batch.batch_id.padEnd(32)} (${batch.terms.length} terms) → ${tweets.length} found, ${filtered.length} new`,
      );
    } catch (e: any) {
      log("search_failed", { batch_id: batch.batch_id, error: e?.message }, "error");
      console.error(`  ✗ ${batch.batch_id}: ${e?.message ?? e}`);
    }
  }

  console.log(
    `\n[argus] searched: ${totalSearched} tweets, new (post-filter): ${totalNew}\n`,
  );

  if (totalNew === 0) {
    if (!DRY) saveState(state);
    log("monitor_done", { elapsed_ms: Date.now() - startedAt, new: 0 });
    console.log("[argus] no new tweets; done");
    return;
  }

  // Stage 2: batch score all new tweets
  const scored: Array<{ batch: WatchBatch; t: ScoredTweet }> = [];

  const CHUNK = 10;
  for (const block of newPerBatch) {
    for (let i = 0; i < block.tweets.length; i += CHUNK) {
      const slice = block.tweets.slice(i, i + CHUNK);
      try {
        const out = await scoreTweetsBatch(cred, slice);
        for (const t of out) scored.push({ batch: block.batch, t });
      } catch (e: any) {
        log("score_batch_failed", { batch_id: block.batch.batch_id, error: e?.message }, "error");
      }
    }
  }

  console.log(`[argus] scored ${scored.length} tweets\n`);

  // Stage 3: rules + queue
  let qReview = 0;
  let qAuto = 0;
  let skipped = 0;
  for (const { batch, t } of scored) {
    const ruleInput: TweetForRules = {
      id: t.id,
      author: t.author,
      text: t.text,
      created_at: t.created_at,
      has_url: t.has_url,
      is_mention_of_operator: batch.category === "mentions",
    };
    const decision = evaluate(ruleInput, t.scoring, wl.auto_rules);

    if (decision.action === "skip") {
      skipped++;
      log("skip", { tweet_id: t.id, reason: decision.reason });
      continue;
    }

    const item: PendingItem = {
      id: randomBytes(6).toString("hex"),
      created_at: new Date().toISOString(),
      watch_id: batch.batch_id,
      tweet: {
        id: t.id,
        url: t.url,
        author: t.author,
        text: t.text,
        created_at: t.created_at,
        has_url: t.has_url,
      },
      scoring: t.scoring,
      action: decision.action,
      draft_text: t.draft_reply,
      template: decision.template,
      reason: decision.reason,
    };

    if (!DRY) {
      if (decision.action === "draft_only") {
        appendPendingReview(item);
        qReview++;
      } else {
        appendPendingAuto(item);
        qAuto++;
      }
    } else {
      console.log(`  [dry] ${decision.action.padEnd(11)} @${t.author}: ${t.text.slice(0, 80)}...`);
    }
  }

  // Persist state at end
  if (!DRY) saveState(state);

  const elapsed = Date.now() - startedAt;
  console.log(`\n[argus] ${totalNew} tweets scanned, queue: review=${qReview} auto=${qAuto} skip=${skipped} · ${elapsed}ms`);
  log("monitor_done", {
    elapsed_ms: elapsed,
    searched: totalSearched,
    new: totalNew,
    queue_review: qReview,
    queue_auto: qAuto,
    skipped,
  });
}

main().catch((e) => {
  console.error("[argus] fatal:", e);
  log("monitor_fatal", { error: e?.message ?? String(e) }, "error");
  process.exit(1);
});

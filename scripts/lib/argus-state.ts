/**
 * argus-state.ts — read/write helpers for ~/.hermes/argus/ state files.
 *
 * State files:
 *   state.json          → last_seen map (watch_id -> last_tweet_id)
 *   pending_review.json → drafts awaiting Telegram approval
 *   pending_auto.json   → drafts queued for auto-fire
 *   sent.json           → action history
 *   cost.json           → daily cost log
 *   log.jsonl           → line-by-line event log
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export const ARGUS_DIR = join(homedir(), ".hermes", "argus");
export const STATE_PATH = join(ARGUS_DIR, "state.json");
export const PENDING_REVIEW_PATH = join(ARGUS_DIR, "pending_review.json");
export const PENDING_AUTO_PATH = join(ARGUS_DIR, "pending_auto.json");
export const SENT_PATH = join(ARGUS_DIR, "sent.json");
export const COST_PATH = join(ARGUS_DIR, "cost.json");
export const LOG_PATH = join(ARGUS_DIR, "log.jsonl");

export interface ArgusState {
  version: number;
  created_at: string;
  last_run_at: string | null;
  last_seen: Record<string, string>;
}

export interface PendingItem {
  id: string;
  created_at: string;
  watch_id: string;
  tweet: {
    id: string;
    url: string;
    author: string;
    text: string;
    created_at?: string;
    has_url?: boolean;
  };
  scoring: {
    relevance_score: number;
    sentiment: "friendly" | "question" | "opportunity" | "hostile" | "spam" | "neutral";
  };
  action: "auto_like" | "auto_reply" | "draft_only" | "skip";
  draft_text?: string;
  template?: string;
  reason?: string;
}

export interface SentItem {
  id: string;
  sent_at: string;
  action_type: "like" | "reply" | "post";
  tweet_id: string;            // for likes: the liked tweet id; for replies: the new tweet id
  in_reply_to_tweet_id?: string;
  reply_url?: string;
  cost_usd: number;
  source_pending_id?: string;
  // ── Autoresearch features (captured at engage time) ──
  experiment_id?: string;      // groups variants of the same hypothesis
  template?: string;           // concrete_answer, ...
  sentiment?: string;
  watch_category?: string;     // mention | hashtag | account | keyword
  author?: string;             // @handle of source tweet author
  posted_hour?: number;        // 0-23 local time
  draft_length?: number;
  had_url?: boolean;
  baseline_score?: number;     // Grok relevance at engage time
  // ── Finalization (populated by track.ts after 24h) ──
  finalized?: boolean;
  finalized_at?: string;
  public_metrics?: {
    like_count: number;
    reply_count: number;
    quote_count: number;
    impression_count?: number;
  };
  follow_delta?: number;
  composite_score?: number;
}

export interface DailyCost {
  date: string;
  x_search_calls: number;
  x_search_cost_usd: number;
  writes: number;
  write_cost_usd: number;
  total_usd: number;
}

export interface CostFile {
  version: number;
  daily: Record<string, DailyCost>;
  monthly_total_usd: number;
}

function ensureDir() {
  if (!existsSync(ARGUS_DIR)) {
    mkdirSync(ARGUS_DIR, { recursive: true });
  }
}

function safeRead<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(path: string, data: unknown) {
  ensureDir();
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// ── State ─────────────────────────────────────────────────────────────
export function loadState(): ArgusState {
  return safeRead<ArgusState>(STATE_PATH, {
    version: 1,
    created_at: new Date().toISOString(),
    last_run_at: null,
    last_seen: {},
  });
}

export function saveState(state: ArgusState) {
  state.last_run_at = new Date().toISOString();
  safeWrite(STATE_PATH, state);
}

export function markSeen(state: ArgusState, watchId: string, tweetId: string) {
  state.last_seen[watchId] = tweetId;
}

export function hasSeen(state: ArgusState, watchId: string, tweetId: string): boolean {
  return state.last_seen[watchId] === tweetId;
}

// ── Pending queues ────────────────────────────────────────────────────
export function loadPendingReview(): PendingItem[] {
  return safeRead<PendingItem[]>(PENDING_REVIEW_PATH, []);
}

export function loadPendingAuto(): PendingItem[] {
  return safeRead<PendingItem[]>(PENDING_AUTO_PATH, []);
}

export function appendPendingReview(item: PendingItem) {
  const list = loadPendingReview();
  list.push(item);
  safeWrite(PENDING_REVIEW_PATH, list);
}

export function appendPendingAuto(item: PendingItem) {
  const list = loadPendingAuto();
  list.push(item);
  safeWrite(PENDING_AUTO_PATH, list);
}

export function removeFromPending(id: string, queue: "review" | "auto") {
  const path = queue === "review" ? PENDING_REVIEW_PATH : PENDING_AUTO_PATH;
  const list = safeRead<PendingItem[]>(path, []);
  const filtered = list.filter((x) => x.id !== id);
  safeWrite(path, filtered);
}

// ── Sent history ──────────────────────────────────────────────────────
export function appendSent(item: SentItem) {
  const list = safeRead<SentItem[]>(SENT_PATH, []);
  list.push(item);
  safeWrite(SENT_PATH, list);
}

export function loadSent(limit = 100): SentItem[] {
  const list = safeRead<SentItem[]>(SENT_PATH, []);
  return list.slice(-limit);
}

export function loadAllSent(): SentItem[] {
  return safeRead<SentItem[]>(SENT_PATH, []);
}

export function updateSent(id: string, patch: Partial<SentItem>) {
  const list = safeRead<SentItem[]>(SENT_PATH, []);
  const next = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
  safeWrite(SENT_PATH, next);
}

// Count today's sent items by action_type — used by hard-ceiling enforcement.
export function countSentToday(actionType?: SentItem["action_type"]): number {
  const today = new Date().toISOString().slice(0, 10);
  const all = safeRead<SentItem[]>(SENT_PATH, []);
  return all.filter(
    (s) =>
      s.sent_at.slice(0, 10) === today &&
      (actionType ? s.action_type === actionType : true),
  ).length;
}

// Count sent items in the last N minutes (for per-hour rate limit).
export function countSentSince(minutesAgo: number, actionType?: SentItem["action_type"]): number {
  const cutoff = Date.now() - minutesAgo * 60 * 1000;
  const all = safeRead<SentItem[]>(SENT_PATH, []);
  return all.filter(
    (s) =>
      new Date(s.sent_at).getTime() >= cutoff &&
      (actionType ? s.action_type === actionType : true),
  ).length;
}

// ── Cost tracking ─────────────────────────────────────────────────────
export function loadCost(): CostFile {
  return safeRead<CostFile>(COST_PATH, {
    version: 1,
    daily: {},
    monthly_total_usd: 0,
  });
}

export function addCost(
  type: "x_search" | "write",
  count: number,
  costUsd: number,
) {
  const cost = loadCost();
  const today = new Date().toISOString().slice(0, 10);
  if (!cost.daily[today]) {
    cost.daily[today] = {
      date: today,
      x_search_calls: 0,
      x_search_cost_usd: 0,
      writes: 0,
      write_cost_usd: 0,
      total_usd: 0,
    };
  }
  const day = cost.daily[today];
  if (type === "x_search") {
    day.x_search_calls += count;
    day.x_search_cost_usd += costUsd;
  } else {
    day.writes += count;
    day.write_cost_usd += costUsd;
  }
  day.total_usd = day.x_search_cost_usd + day.write_cost_usd;
  // Recompute monthly
  const yearMonth = today.slice(0, 7);
  cost.monthly_total_usd = Object.entries(cost.daily)
    .filter(([d]) => d.startsWith(yearMonth))
    .reduce((sum, [, d]) => sum + d.total_usd, 0);
  safeWrite(COST_PATH, cost);
}

// ── Logging ───────────────────────────────────────────────────────────
export interface LogEvent {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  [key: string]: unknown;
}

export function log(event: string, extra: Record<string, unknown> = {}, level: LogEvent["level"] = "info") {
  ensureDir();
  const line: LogEvent = {
    ts: new Date().toISOString(),
    level,
    event,
    ...extra,
  };
  appendFileSync(LOG_PATH, JSON.stringify(line) + "\n");
}

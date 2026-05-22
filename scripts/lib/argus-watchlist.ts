/**
 * argus-watchlist.ts — load + validate config/argus-watchlist.json.
 *
 * Exposes typed watchlist + auto_rules with sensible defaults.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AutoLikeRules {
  enabled: boolean;
  max_per_day: number;
  conditions: {
    sentiment: string[];
    is_mention?: boolean;
    account_age_min_days?: number;
    follower_count_min?: number;
  };
}

export interface AutoReplyRules {
  enabled: boolean;
  max_per_day: number;
  max_per_hour: number;
  active_hours: string; // "07:00-23:00"
  conditions: {
    sentiment: string[];
    relevance_score_min: number;
    tweet_age_max_minutes?: number;
    thread_depth_max?: number;
    must_match_any_pattern?: string[];
    exclude_url_replies?: boolean;
  };
  templates: string[];
}

export interface HardCeilings {
  daily_total_actions: number;
  after_ceiling: string;
  emergency_kill_switch: string;
}

export interface AutoRules {
  auto_like_rules: AutoLikeRules;
  auto_reply_rules: AutoReplyRules;
  auto_post_rules: { enabled: boolean; comment?: string };
  hard_ceilings: HardCeilings;
}

export interface Watchlist {
  version: number;
  updated_at?: string;
  mentions: string[];
  hashtags: string[];
  accounts: string[];
  keywords: string[];
  exclude_keywords: string[];
  auto_rules: AutoRules;
  polling: {
    interval_minutes: number;
    max_results_per_query: number;
    scan_categories: string[];
  };
}

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const WATCHLIST_PATH = join(REPO_ROOT, "config", "argus-watchlist.json");

export function loadWatchlist(): Watchlist {
  if (!existsSync(WATCHLIST_PATH)) {
    throw new Error(`Watchlist not found: ${WATCHLIST_PATH}`);
  }
  const raw = JSON.parse(readFileSync(WATCHLIST_PATH, "utf-8"));
  return validateAndDefault(raw);
}

function validateAndDefault(raw: any): Watchlist {
  return {
    version: raw.version ?? 1,
    updated_at: raw.updated_at,
    mentions: raw.mentions ?? [],
    hashtags: raw.hashtags ?? [],
    accounts: raw.accounts ?? [],
    keywords: raw.keywords ?? [],
    exclude_keywords: raw.exclude_keywords ?? [],
    auto_rules: {
      auto_like_rules: {
        enabled: raw.auto_rules?.auto_like_rules?.enabled ?? false,
        max_per_day: raw.auto_rules?.auto_like_rules?.max_per_day ?? 50,
        conditions: {
          sentiment: raw.auto_rules?.auto_like_rules?.conditions?.sentiment ?? ["friendly", "neutral"],
          is_mention: raw.auto_rules?.auto_like_rules?.conditions?.is_mention,
          account_age_min_days: raw.auto_rules?.auto_like_rules?.conditions?.account_age_min_days,
          follower_count_min: raw.auto_rules?.auto_like_rules?.conditions?.follower_count_min,
        },
      },
      auto_reply_rules: {
        enabled: raw.auto_rules?.auto_reply_rules?.enabled ?? false,
        max_per_day: raw.auto_rules?.auto_reply_rules?.max_per_day ?? 10,
        max_per_hour: raw.auto_rules?.auto_reply_rules?.max_per_hour ?? 3,
        active_hours: raw.auto_rules?.auto_reply_rules?.active_hours ?? "07:00-23:00",
        conditions: {
          sentiment: raw.auto_rules?.auto_reply_rules?.conditions?.sentiment ?? ["question", "friendly"],
          relevance_score_min: raw.auto_rules?.auto_reply_rules?.conditions?.relevance_score_min ?? 75,
          tweet_age_max_minutes: raw.auto_rules?.auto_reply_rules?.conditions?.tweet_age_max_minutes ?? 60,
          thread_depth_max: raw.auto_rules?.auto_reply_rules?.conditions?.thread_depth_max ?? 2,
          must_match_any_pattern: raw.auto_rules?.auto_reply_rules?.conditions?.must_match_any_pattern ?? [],
          exclude_url_replies: raw.auto_rules?.auto_reply_rules?.conditions?.exclude_url_replies ?? true,
        },
        templates: raw.auto_rules?.auto_reply_rules?.templates ?? ["concrete_answer"],
      },
      auto_post_rules: {
        enabled: raw.auto_rules?.auto_post_rules?.enabled ?? false,
        comment: raw.auto_rules?.auto_post_rules?.comment,
      },
      hard_ceilings: {
        daily_total_actions: raw.auto_rules?.hard_ceilings?.daily_total_actions ?? 60,
        after_ceiling: raw.auto_rules?.hard_ceilings?.after_ceiling ?? "queue_for_manual_review",
        emergency_kill_switch: raw.auto_rules?.hard_ceilings?.emergency_kill_switch ?? "pause_via_telegram",
      },
    },
    polling: {
      interval_minutes: raw.polling?.interval_minutes ?? 15,
      max_results_per_query: raw.polling?.max_results_per_query ?? 10,
      scan_categories: raw.polling?.scan_categories ?? ["mentions", "hashtags", "accounts", "keywords"],
    },
  };
}

/** Build the x_search query string for a given watch entry. */
export function buildQuery(category: string, term: string): string {
  switch (category) {
    case "mentions":
      // Mentions of your handle, exclude replies you sent yourself
      return `${term} -from:${term.replace(/^@/, "")} -is:retweet`;
    case "hashtags":
      return `${term} -is:retweet lang:tr OR lang:en`;
    case "accounts":
      return `from:${term} -is:reply`;
    case "keywords":
      return `"${term}" -is:retweet`;
    default:
      return term;
  }
}

/** All watch entries flattened with category metadata. */
export interface WatchEntry {
  watch_id: string;
  category: "mentions" | "hashtags" | "accounts" | "keywords";
  term: string;
  query: string;
}

export function enumerateWatches(wl: Watchlist): WatchEntry[] {
  const entries: WatchEntry[] = [];
  for (const cat of wl.polling.scan_categories) {
    const items = (wl as any)[cat] as string[] | undefined;
    if (!Array.isArray(items)) continue;
    for (const term of items) {
      entries.push({
        watch_id: `${cat}_${term.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        category: cat as WatchEntry["category"],
        term,
        query: buildQuery(cat, term),
      });
    }
  }
  return entries;
}

/**
 * Batched watch enumeration — groups same-category terms into single OR
 * queries to slash x_search call count.
 *
 *   32 individual queries × $0.005 = $0.16 per run
 *   →  7 batched queries × $0.005 = $0.035 per run (-78% cost)
 *
 * Within a category, terms are grouped in chunks of `chunkSize` (default 5).
 * Returns batches with a synthetic watch_id and an OR-combined query.
 */
export interface WatchBatch {
  batch_id: string;
  category: WatchEntry["category"];
  terms: string[];
  query: string;
  max_results: number;
}

function buildBatchQuery(category: string, terms: string[]): string {
  switch (category) {
    case "mentions": {
      // Match any of the mention handles, exclude self-replies/RTs
      const mentions = terms.join(" OR ");
      const fromExcludes = terms
        .map((t) => `-from:${t.replace(/^@/, "")}`)
        .join(" ");
      return `(${mentions}) ${fromExcludes} -is:retweet`;
    }
    case "hashtags": {
      const hashtags = terms.join(" OR ");
      return `(${hashtags}) -is:retweet lang:tr OR lang:en`;
    }
    case "accounts": {
      const fromClauses = terms.map((t) => `from:${t}`).join(" OR ");
      return `(${fromClauses}) -is:reply -is:retweet`;
    }
    case "keywords": {
      const quoted = terms.map((t) => `"${t}"`).join(" OR ");
      return `(${quoted}) -is:retweet`;
    }
    default:
      return terms.join(" OR ");
  }
}

export function enumerateBatches(wl: Watchlist, chunkSize = 5): WatchBatch[] {
  const batches: WatchBatch[] = [];
  for (const cat of wl.polling.scan_categories) {
    const items = (wl as any)[cat] as string[] | undefined;
    if (!Array.isArray(items) || items.length === 0) continue;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batchIdx = Math.floor(i / chunkSize);
      batches.push({
        batch_id: `${cat}_batch_${batchIdx}`,
        category: cat as WatchEntry["category"],
        terms: chunk,
        query: buildBatchQuery(cat, chunk),
        // Pull more results when more terms are bundled, capped to keep one
        // x_search call cheap and Grok JSON response stable.
        max_results: Math.min(50, Math.max(10, chunk.length * 5)),
      });
    }
  }
  return batches;
}

/**
 * argus-metrics.ts — composite scoring + group analysis for the autoresearch loop.
 *
 * Pipeline: sent.json items are enriched by argus-track.ts with public_metrics
 * (likes, replies, quotes, impressions) and a follow_delta (followers gained
 * in the 24h window). argus-learn.ts then groups + analyzes these to surface
 * winning patterns (template, hour-of-day, author, sentiment, etc.) and
 * proposes a patch to watchlist.json + argus.yaml.
 *
 * Composite formula (default weights — tune in `DEFAULT_WEIGHTS` below):
 *   like × 0.3  + reply × 0.4  + follow_delta × 0.3
 * Each component is normalized inside its own dimension (z-score) so a
 * weight of 0.4 truly means 40% of variance, not 40% of raw counts.
 */
import type { SentItem } from "./argus-state";

export interface PublicMetrics {
  like_count: number;
  reply_count: number;
  quote_count: number;
  impression_count?: number;
}

export interface FinalizedSent extends SentItem {
  finalized: true;
  finalized_at: string;
  public_metrics: PublicMetrics;
  follow_delta: number;
  composite_score: number;
  experiment_id: string;
  // Optional dimensions captured at engage time
  template?: string;
  sentiment?: string;
  author?: string;
  watch_category?: string;
  posted_hour?: number; // 0-23, local time
  draft_length?: number;
  had_url?: boolean;
}

// Default weights — operator-configurable (composite: like 0.3, reply 0.4, follow 0.3).
export const DEFAULT_WEIGHTS = { like: 0.3, reply: 0.4, follow: 0.3 } as const;

export function computeRawComposite(metrics: PublicMetrics, followDelta: number): number {
  // Raw weighted sum — useful for ranking same-cohort items.
  const w = DEFAULT_WEIGHTS;
  return (
    w.like * (metrics.like_count ?? 0) +
    w.reply * (metrics.reply_count ?? 0) +
    w.follow * (followDelta ?? 0)
  );
}

/**
 * Compute z-normalized composite over a population. Use this to rank
 * experiments fairly across days (when follower base shifts).
 */
export function computeNormalizedComposite(items: FinalizedSent[]): FinalizedSent[] {
  if (items.length === 0) return [];
  const stats = (vals: number[]) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1);
    return { mean, std: Math.sqrt(variance) || 1 };
  };
  const likeStats = stats(items.map((i) => i.public_metrics?.like_count ?? 0));
  const replyStats = stats(items.map((i) => i.public_metrics?.reply_count ?? 0));
  const followStats = stats(items.map((i) => i.follow_delta ?? 0));
  const z = (v: number, s: { mean: number; std: number }) => (v - s.mean) / s.std;
  return items.map((i) => ({
    ...i,
    composite_score:
      DEFAULT_WEIGHTS.like * z(i.public_metrics?.like_count ?? 0, likeStats) +
      DEFAULT_WEIGHTS.reply * z(i.public_metrics?.reply_count ?? 0, replyStats) +
      DEFAULT_WEIGHTS.follow * z(i.follow_delta ?? 0, followStats),
  }));
}

// ── Grouping ──────────────────────────────────────────────────────────
export interface GroupStat {
  key: string;
  count: number;
  avg_composite: number;
  avg_likes: number;
  avg_replies: number;
  avg_follow_delta: number;
  std_composite: number;
}

export type Dimension =
  | "template"
  | "sentiment"
  | "watch_category"
  | "author"
  | "posted_hour"
  | "draft_length_bucket"
  | "had_url";

function pickDimensionValue(item: FinalizedSent, dim: Dimension): string {
  switch (dim) {
    case "template":
      return item.template ?? "(none)";
    case "sentiment":
      return item.sentiment ?? "(none)";
    case "watch_category":
      return item.watch_category ?? "(none)";
    case "author":
      return item.author ?? "(none)";
    case "posted_hour":
      return item.posted_hour !== undefined ? `${item.posted_hour}:00` : "(none)";
    case "draft_length_bucket": {
      const n = item.draft_length ?? 0;
      if (n === 0) return "0 (like)";
      if (n < 100) return "<100";
      if (n < 200) return "100-200";
      return "200+";
    }
    case "had_url":
      return item.had_url ? "url" : "no_url";
  }
}

export function groupBy(items: FinalizedSent[], dim: Dimension): GroupStat[] {
  const buckets = new Map<string, FinalizedSent[]>();
  for (const item of items) {
    const key = pickDimensionValue(item, dim);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }
  const groups: GroupStat[] = [];
  for (const [key, list] of buckets) {
    const n = list.length;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const composites = list.map((i) => i.composite_score ?? 0);
    const avg_c = mean(composites);
    const std_c = Math.sqrt(
      composites.reduce((a, b) => a + (b - avg_c) ** 2, 0) / Math.max(1, n - 1),
    );
    groups.push({
      key,
      count: n,
      avg_composite: avg_c,
      avg_likes: mean(list.map((i) => i.public_metrics?.like_count ?? 0)),
      avg_replies: mean(list.map((i) => i.public_metrics?.reply_count ?? 0)),
      avg_follow_delta: mean(list.map((i) => i.follow_delta ?? 0)),
      std_composite: std_c || 0,
    });
  }
  // Sort by avg_composite desc
  groups.sort((a, b) => b.avg_composite - a.avg_composite);
  return groups;
}

// ── Winner / loser detection ──────────────────────────────────────────
export interface Verdict {
  dimension: Dimension;
  winners: GroupStat[]; // > +1σ above population mean
  losers: GroupStat[];  // < -1σ below population mean
  population_mean: number;
  population_std: number;
}

export function findVerdicts(
  items: FinalizedSent[],
  dim: Dimension,
  minSample = 3,
): Verdict {
  const groups = groupBy(items, dim).filter((g) => g.count >= minSample);
  if (groups.length < 2) {
    return { dimension: dim, winners: [], losers: [], population_mean: 0, population_std: 0 };
  }
  const composites = groups.map((g) => g.avg_composite);
  const mean = composites.reduce((a, b) => a + b, 0) / composites.length;
  const variance =
    composites.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, composites.length - 1);
  const std = Math.sqrt(variance) || 0;
  const winners = groups.filter((g) => g.avg_composite > mean + std);
  const losers = groups.filter((g) => g.avg_composite < mean - std);
  return { dimension: dim, winners, losers, population_mean: mean, population_std: std };
}

// ── Patch proposal ────────────────────────────────────────────────────
export interface RulePatch {
  reason: string;
  watchlist_diff: Record<string, unknown>; // partial patches to merge into config/argus-watchlist.json
  persona_addendum: string;                // markdown to append to argus.yaml system_prompt
}

/**
 * Translate verdicts into concrete watchlist + persona patches.
 *
 * IMPORTANT: This function NEVER proposes patches that would:
 *   - Raise hard_ceilings (operator-set safety net)
 *   - Disable hostile sentiment filter
 *   - Enable auto_post_rules (always off)
 *   - Add URLs to allowed reply set
 *
 * These constraints are enforced in argus-program.md and double-checked here.
 */
export function proposePatches(verdicts: Verdict[]): RulePatch[] {
  const patches: RulePatch[] = [];

  for (const v of verdicts) {
    // TEMPLATES
    if (v.dimension === "template") {
      const top = v.winners[0];
      const bot = v.losers[0];
      if (top && bot) {
        patches.push({
          reason: `Template "${top.key}" outperforms "${bot.key}" (${top.avg_composite.toFixed(2)} vs ${bot.avg_composite.toFixed(2)} composite over ${top.count + bot.count} samples).`,
          watchlist_diff: {
            auto_rules: {
              auto_reply_rules: {
                templates: [top.key, "concrete_answer"], // keep one fallback
              },
            },
          },
          persona_addendum: `\n## Learning (auto-applied): preferred reply template\n- Use \`${top.key}\` first.\n- Avoid \`${bot.key}\` (low engagement in last 7-day data).\n`,
        });
      }
    }

    // POSTED_HOUR — narrow active_hours toward winners
    if (v.dimension === "posted_hour" && v.winners.length > 0) {
      const winningHours = v.winners
        .map((w) => parseInt(w.key.split(":")[0]!, 10))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      if (winningHours.length > 0) {
        const start = `${String(winningHours[0]).padStart(2, "0")}:00`;
        const end = `${String(winningHours[winningHours.length - 1]! + 1).padStart(2, "0")}:00`;
        patches.push({
          reason: `Posts at hours [${winningHours.join(", ")}] outperform other times by >1σ.`,
          watchlist_diff: {
            auto_rules: {
              auto_reply_rules: {
                active_hours: `${start}-${end}`,
              },
            },
          },
          persona_addendum: `\n## Learning: active hours narrowed to ${start}-${end}\n`,
        });
      }
    }

    // SENTIMENT — drop loser sentiments
    if (v.dimension === "sentiment" && v.winners.length > 0) {
      const allowedSentiments = v.winners.map((w) => w.key);
      patches.push({
        reason: `Sentiment(s) ${allowedSentiments.join(", ")} drive +1σ engagement; others underperform.`,
        watchlist_diff: {
          auto_rules: {
            auto_reply_rules: {
              conditions: {
                sentiment: allowedSentiments,
              },
            },
          },
        },
        persona_addendum: `\n## Learning: focus on sentiments ${allowedSentiments.join(", ")}\n`,
      });
    }

    // HAD_URL — confirm or relax the url exclusion
    if (v.dimension === "had_url") {
      const urlGroup = v.winners.concat(v.losers).find((g) => g.key === "url");
      const noUrlGroup = v.winners.concat(v.losers).find((g) => g.key === "no_url");
      if (urlGroup && noUrlGroup && noUrlGroup.avg_composite > urlGroup.avg_composite) {
        patches.push({
          reason: `Non-URL replies outperform URL replies (${noUrlGroup.avg_composite.toFixed(2)} vs ${urlGroup.avg_composite.toFixed(2)}). Keeping exclude_url_replies=true.`,
          watchlist_diff: {
            auto_rules: {
              auto_reply_rules: {
                conditions: { exclude_url_replies: true },
              },
            },
          },
          persona_addendum: "",
        });
      }
    }

    // AUTHOR — promote watch priority for high-ROI accounts (additive only)
    if (v.dimension === "author" && v.winners.length > 0) {
      const topAuthors = v.winners.map((w) => w.key);
      patches.push({
        reason: `Replying to ${topAuthors.join(", ")} yields highest engagement.`,
        watchlist_diff: {
          // Not modifying the accounts list (operator curates). Instead add a
          // priority hint via persona addendum so the rules engine can boost.
        },
        persona_addendum: `\n## Learning: high-ROI accounts\n- Prioritize replies to: ${topAuthors.join(", ")}.\n`,
      });
    }
  }

  // Safety filter: strip anything that touches hard_ceilings, auto_post_rules,
  // hostile sentiment, or exclude_url_replies=false.
  return patches.filter((p) => {
    const json = JSON.stringify(p.watchlist_diff);
    if (/hard_ceilings/.test(json)) return false;
    if (/auto_post_rules/.test(json)) return false;
    if (/"hostile"/i.test(json) || /"spam"/i.test(json)) return false;
    if (/exclude_url_replies"\s*:\s*false/.test(json)) return false;
    return true;
  });
}

/**
 * Deep merge a patch into an existing config object.
 * Returns a NEW object — never mutates input.
 */
export function mergePatch<T extends Record<string, any>>(base: T, patch: Record<string, any>): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object") {
      out[k] = mergePatch(out[k], v as Record<string, any>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

// ── Filters for the learn cycle ───────────────────────────────────────
export function finalizedLastNDays(items: SentItem[], days = 7): FinalizedSent[] {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  return items.filter(
    (i: any) =>
      i?.finalized === true &&
      i?.composite_score !== undefined &&
      new Date(i.sent_at).getTime() >= cutoff,
  ) as FinalizedSent[];
}

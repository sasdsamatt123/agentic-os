/**
 * argus-rules.ts — auto-rule engine.
 *
 * Given a tweet + Grok scoring, decide:
 *   - skip
 *   - draft_only (queue for manual review)
 *   - auto_like
 *   - auto_reply (with template)
 *
 * Enforces hard ceilings (daily total actions) by reading sent.json counts.
 */
import type { AutoRules, AutoReplyRules, AutoLikeRules } from "./argus-watchlist";
import { loadSent, type SentItem } from "./argus-state";

export interface TweetForRules {
  id: string;
  author: string;
  text: string;
  created_at?: string;
  has_url?: boolean;
  is_mention_of_operator?: boolean;
  follower_count?: number;
  account_age_days?: number;
  thread_depth?: number;
}

export interface Scoring {
  relevance_score: number; // 0-100
  sentiment: "friendly" | "question" | "opportunity" | "hostile" | "spam" | "neutral";
}

export type Action = "auto_like" | "auto_reply" | "draft_only" | "skip";

export interface Decision {
  action: Action;
  reason: string;
  template?: string;
}

function inActiveHours(activeHours: string, now: Date = new Date()): boolean {
  const [start, end] = activeHours.split("-");
  if (!start || !end) return true;
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  const curMin = now.getHours() * 60 + now.getMinutes();
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 23) * 60 + (em ?? 59);
  if (startMin <= endMin) return curMin >= startMin && curMin <= endMin;
  // wraps midnight
  return curMin >= startMin || curMin <= endMin;
}

function countTodayActions(): { likes: number; replies: number; total: number } {
  const today = new Date().toISOString().slice(0, 10);
  const sent = loadSent(500);
  const todaySent = sent.filter((s) => s.sent_at.startsWith(today));
  return {
    likes: todaySent.filter((s) => s.action_type === "like").length,
    replies: todaySent.filter((s) => s.action_type === "reply").length,
    total: todaySent.length,
  };
}

function countLastHourReplies(): number {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const sent = loadSent(200);
  return sent.filter(
    (s) => s.action_type === "reply" && new Date(s.sent_at).getTime() > oneHourAgo,
  ).length;
}

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) return true; // no pattern requirement
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(p.toLowerCase()));
}

function tweetAgeMinutes(createdAt?: string): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return (Date.now() - created) / 60000;
}

function checkAutoLike(rules: AutoLikeRules, tweet: TweetForRules, scoring: Scoring): boolean {
  if (!rules.enabled) return false;
  if (!rules.conditions.sentiment.includes(scoring.sentiment)) return false;
  if (rules.conditions.is_mention && !tweet.is_mention_of_operator) return false;
  if (
    rules.conditions.account_age_min_days !== undefined &&
    tweet.account_age_days !== undefined &&
    tweet.account_age_days < rules.conditions.account_age_min_days
  )
    return false;
  if (
    rules.conditions.follower_count_min !== undefined &&
    tweet.follower_count !== undefined &&
    tweet.follower_count < rules.conditions.follower_count_min
  )
    return false;
  return true;
}

function checkAutoReply(rules: AutoReplyRules, tweet: TweetForRules, scoring: Scoring): boolean {
  if (!rules.enabled) return false;
  if (!rules.conditions.sentiment.includes(scoring.sentiment)) return false;
  if (scoring.relevance_score < rules.conditions.relevance_score_min) return false;
  if (rules.conditions.exclude_url_replies && tweet.has_url) return false;
  if (
    rules.conditions.thread_depth_max !== undefined &&
    tweet.thread_depth !== undefined &&
    tweet.thread_depth > rules.conditions.thread_depth_max
  )
    return false;
  if (rules.conditions.tweet_age_max_minutes !== undefined) {
    const age = tweetAgeMinutes(tweet.created_at);
    if (age !== null && age > rules.conditions.tweet_age_max_minutes) return false;
  }
  if (rules.conditions.must_match_any_pattern && rules.conditions.must_match_any_pattern.length > 0) {
    if (!matchesAnyPattern(tweet.text, rules.conditions.must_match_any_pattern)) return false;
  }
  if (!inActiveHours(rules.active_hours)) return false;
  return true;
}

export function evaluate(
  tweet: TweetForRules,
  scoring: Scoring,
  rules: AutoRules,
): Decision {
  // Hard ceiling first
  const today = countTodayActions();
  if (today.total >= rules.hard_ceilings.daily_total_actions) {
    return {
      action: "draft_only",
      reason: `hard_ceiling: ${today.total}/${rules.hard_ceilings.daily_total_actions} actions today`,
    };
  }

  // Sentiment-based hard exclusions
  if (scoring.sentiment === "hostile" || scoring.sentiment === "spam") {
    return { action: "skip", reason: `sentiment=${scoring.sentiment}` };
  }

  // Try auto-reply first (higher value)
  if (checkAutoReply(rules.auto_reply_rules, tweet, scoring)) {
    if (today.replies >= rules.auto_reply_rules.max_per_day) {
      return {
        action: "draft_only",
        reason: `auto_reply daily ceiling: ${today.replies}/${rules.auto_reply_rules.max_per_day}`,
      };
    }
    const lastHour = countLastHourReplies();
    if (lastHour >= rules.auto_reply_rules.max_per_hour) {
      return {
        action: "draft_only",
        reason: `auto_reply hourly ceiling: ${lastHour}/${rules.auto_reply_rules.max_per_hour}`,
      };
    }
    return {
      action: "auto_reply",
      reason: "all auto_reply conditions met",
      template: rules.auto_reply_rules.templates[0],
    };
  }

  // Then auto-like
  if (checkAutoLike(rules.auto_like_rules, tweet, scoring)) {
    if (today.likes >= rules.auto_like_rules.max_per_day) {
      return {
        action: "draft_only",
        reason: `auto_like daily ceiling: ${today.likes}/${rules.auto_like_rules.max_per_day}`,
      };
    }
    return { action: "auto_like", reason: "all auto_like conditions met" };
  }

  // Default: queue for manual review if relevance is high enough; otherwise skip
  if (scoring.relevance_score >= 60) {
    return { action: "draft_only", reason: "relevance_score adequate but no auto conditions met" };
  }
  return { action: "skip", reason: `relevance_score=${scoring.relevance_score} too low` };
}

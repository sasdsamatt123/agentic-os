#!/usr/bin/env bun
/**
 * argus-engage.ts — auto-fire pending_auto.json via xurl + manual mode.
 *
 * Run modes:
 *   bun run scripts/argus-engage.ts                   # batch: drain pending_auto
 *   bun run scripts/argus-engage.ts --batch           # same, explicit
 *   bun run scripts/argus-engage.ts --id <ID>         # fire one item (from review or auto)
 *   bun run scripts/argus-engage.ts --dry-run         # show what would be fired
 *
 * Safety:
 *   - Hard daily ceiling (config/argus-watchlist.json → auto_rules.hard_ceilings)
 *   - Per-hour reply rate limit
 *   - Active hours for replies
 *   - URL-in-reply gate ($0.20 vs $0.015 — refuses unless --allow-url-reply)
 *   - xurl auth pre-check; aborts with clear message if not authenticated
 */
import { loadWatchlist } from "./lib/argus-watchlist";
import {
  loadPendingAuto,
  loadPendingReview,
  removeFromPending,
  appendSent,
  countSentToday,
  countSentSince,
  log,
  type PendingItem,
  type SentItem,
} from "./lib/argus-state";
import { authStatus, getUser, like, reply, post } from "./lib/xurl-client";

const args = process.argv.slice(2);
const flagBatch = args.includes("--batch") || (!args.includes("--id") && !args.includes("--dry-run") || args.length === 0);
const flagDryRun = args.includes("--dry-run");
const flagAllowUrl = args.includes("--allow-url-reply");
const idIdx = args.indexOf("--id");
const onlyId = idIdx >= 0 ? args[idIdx + 1] : null;

interface Ceilings {
  daily: number;
  reply_per_day: number;
  reply_per_hour: number;
  like_per_day: number;
  active_hours: string;
}

function parseActiveHours(s: string): { start: number; end: number } {
  const m = s.match(/^(\d{2}):\d{2}-(\d{2}):\d{2}$/);
  if (!m) return { start: 0, end: 24 };
  return { start: parseInt(m[1]!, 10), end: parseInt(m[2]!, 10) };
}

function withinActiveHours(active: string): boolean {
  const { start, end } = parseActiveHours(active);
  const hour = new Date().getHours();
  return hour >= start && hour < end;
}

function hourOfDay(): number {
  return new Date().getHours();
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function genExperimentId(item: PendingItem): string {
  // Group same template + same watch_id into a single experiment.
  // Each fired action is a "trial" inside that experiment.
  const tpl = item.template ?? "no_template";
  const cat = item.watch_id.split("_")[0] ?? "unknown";
  return `exp_${cat}_${tpl}`;
}

async function fireOne(
  item: PendingItem,
  ceilings: Ceilings,
  meUserId: string | null,
): Promise<{ ok: boolean; reason?: string; sent?: SentItem }> {
  // 1) Hard daily ceiling
  const today = countSentToday();
  if (today >= ceilings.daily) {
    return { ok: false, reason: `hard_ceiling_daily_total(${today}/${ceilings.daily})` };
  }

  if (item.action === "auto_like") {
    if (countSentToday("like") >= ceilings.like_per_day) {
      return { ok: false, reason: "like_per_day_reached" };
    }
    if (flagDryRun) {
      console.log(`[dry-run] LIKE  tweet=${item.tweet.id} watch=${item.watch_id}`);
      return { ok: true };
    }
    if (!meUserId) {
      return { ok: false, reason: "no_me_user_id" };
    }
    const res = await like(meUserId, item.tweet.id);
    if (!res.ok) {
      return { ok: false, reason: `like_failed_${res.status}` };
    }
    const sent: SentItem = {
      id: genId("sent"),
      sent_at: new Date().toISOString(),
      action_type: "like",
      tweet_id: item.tweet.id,
      cost_usd: res.costUsd,
      source_pending_id: item.id,
      experiment_id: genExperimentId(item),
      template: item.template,
      sentiment: item.scoring.sentiment,
      watch_category: item.watch_id.split("_")[0],
      author: item.tweet.author,
      posted_hour: hourOfDay(),
      draft_length: 0,
      had_url: false,
      baseline_score: item.scoring.relevance_score,
    };
    appendSent(sent);
    return { ok: true, sent };
  }

  if (item.action === "auto_reply") {
    // Reply-specific gates
    if (!withinActiveHours(ceilings.active_hours)) {
      return { ok: false, reason: `outside_active_hours(${ceilings.active_hours})` };
    }
    if (countSentToday("reply") >= ceilings.reply_per_day) {
      return { ok: false, reason: "reply_per_day_reached" };
    }
    if (countSentSince(60, "reply") >= ceilings.reply_per_hour) {
      return { ok: false, reason: "reply_per_hour_reached" };
    }
    const text = (item.draft_text ?? "").trim();
    if (!text) {
      return { ok: false, reason: "empty_draft" };
    }
    const hasUrl = /\bhttps?:\/\/\S+/.test(text);
    if (hasUrl && !flagAllowUrl) {
      return { ok: false, reason: "url_in_reply_blocked_by_default" };
    }

    if (flagDryRun) {
      console.log(`[dry-run] REPLY tweet=${item.tweet.id} watch=${item.watch_id}`);
      console.log(`         text="${text.slice(0, 120)}${text.length > 120 ? "..." : ""}"`);
      return { ok: true };
    }

    const res = await reply(item.tweet.id, text);
    if (!res.ok) {
      return { ok: false, reason: `reply_failed_${res.status}` };
    }
    const newTweetId = res.body?.data?.id ?? "unknown";
    const sent: SentItem = {
      id: genId("sent"),
      sent_at: new Date().toISOString(),
      action_type: "reply",
      tweet_id: newTweetId,
      in_reply_to_tweet_id: item.tweet.id,
      reply_url: meUserId ? `https://x.com/i/web/status/${newTweetId}` : undefined,
      cost_usd: res.costUsd,
      source_pending_id: item.id,
      experiment_id: genExperimentId(item),
      template: item.template,
      sentiment: item.scoring.sentiment,
      watch_category: item.watch_id.split("_")[0],
      author: item.tweet.author,
      posted_hour: hourOfDay(),
      draft_length: text.length,
      had_url: hasUrl,
      baseline_score: item.scoring.relevance_score,
    };
    appendSent(sent);
    return { ok: true, sent };
  }

  return { ok: false, reason: `unsupported_action(${item.action})` };
}

async function main() {
  log("engage_start", { batch: flagBatch, dry_run: flagDryRun, only_id: onlyId });

  const wl = loadWatchlist();
  const ceilings: Ceilings = {
    daily: wl.auto_rules.hard_ceilings.daily_total_actions,
    reply_per_day: wl.auto_rules.auto_reply_rules.max_per_day,
    reply_per_hour: wl.auto_rules.auto_reply_rules.max_per_hour,
    like_per_day: wl.auto_rules.auto_like_rules.max_per_day,
    active_hours: wl.auto_rules.auto_reply_rules.active_hours,
  };

  // Pre-flight: xurl auth + me user id
  let meUserId: string | null = null;
  if (!flagDryRun) {
    const auth = await authStatus();
    if (!auth.ok) {
      console.error("[engage] xurl not authenticated. Run:");
      console.error("  xurl auth oauth2 --app argus --client-id=<CID> --client-secret=<CSEC>");
      console.error("Details:", auth.details);
      log("engage_abort", { reason: "xurl_not_authenticated", details: auth.details }, "error");
      process.exit(2);
    }
    const meRes = await getUser("me");
    meUserId = meRes.body?.data?.id ?? null;
    if (!meUserId) {
      console.error("[engage] could not resolve me user id; like actions will be skipped.");
      log("engage_warn", { reason: "no_me_user_id" }, "warn");
    }
  }

  // Determine work set
  let queue: { item: PendingItem; from: "review" | "auto" }[] = [];
  if (onlyId) {
    const review = loadPendingReview().find((p) => p.id === onlyId);
    if (review) queue.push({ item: review, from: "review" });
    const auto = loadPendingAuto().find((p) => p.id === onlyId);
    if (auto) queue.push({ item: auto, from: "auto" });
    if (queue.length === 0) {
      console.error(`[engage] pending id not found: ${onlyId}`);
      log("engage_abort", { reason: "id_not_found", id: onlyId }, "error");
      process.exit(3);
    }
  } else {
    queue = loadPendingAuto().map((item) => ({ item, from: "auto" as const }));
  }

  console.log(`[engage] candidates=${queue.length} dry_run=${flagDryRun}`);

  let fired = 0;
  let blocked = 0;
  let failed = 0;

  for (const { item, from } of queue) {
    const result = await fireOne(item, ceilings, meUserId);
    if (result.ok) {
      fired += 1;
      if (!flagDryRun) {
        removeFromPending(item.id, from);
      }
      log("engage_fire", {
        pending_id: item.id,
        action: item.action,
        watch_id: item.watch_id,
        experiment_id: result.sent?.experiment_id,
        sent_id: result.sent?.id,
      });
    } else if (result.reason?.startsWith("hard_ceiling") || result.reason?.startsWith("outside_") || result.reason?.endsWith("_reached")) {
      blocked += 1;
      log("engage_block", { pending_id: item.id, reason: result.reason }, "warn");
      // Stop the loop on daily ceiling — anything after is also blocked.
      if (result.reason?.startsWith("hard_ceiling")) break;
    } else {
      failed += 1;
      log("engage_fail", { pending_id: item.id, reason: result.reason }, "error");
    }
  }

  console.log(`[engage] done fired=${fired} blocked=${blocked} failed=${failed}`);
  log("engage_done", { fired, blocked, failed });
}

main().catch((e) => {
  console.error("[engage] crashed:", e);
  log("engage_crash", { error: String(e) }, "error");
  process.exit(1);
});

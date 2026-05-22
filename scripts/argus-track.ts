#!/usr/bin/env bun
/**
 * argus-track.ts — finalize 24h-aged posts with public_metrics + follow_delta.
 *
 * Cron: hourly. Cheap (~$0.001/read).
 *
 * Flow:
 *   1) Load me-user public_metrics → snapshot follower_count + timestamp
 *   2) Find sent[] items where !finalized && age >= 24h && action_type=reply|post
 *   3) For each: xurl GET /2/tweets/:id?tweet.fields=public_metrics
 *   4) Compute follow_delta = (current_followers - followers_at_send_time)
 *      Note: we approximate by reading me-user each cycle. The first time
 *      we see an item, we just record current followers as baseline; on
 *      subsequent ticks we re-compute. With hourly cron this converges.
 *   5) composite = raw weighted sum (z-normalization happens in learn.ts)
 *   6) sent.json patch: finalized=true, public_metrics, follow_delta,
 *      composite_score, finalized_at
 *
 * Flags:
 *   --once       (default for cron)
 *   --force      ignore age gate; reprocess every non-finalized item
 *   --dry-run
 */
import {
  loadAllSent,
  updateSent,
  log,
  ARGUS_DIR,
  type SentItem,
} from "./lib/argus-state";
import { authStatus, getTweetMetrics, getUser } from "./lib/xurl-client";
import { computeRawComposite } from "./lib/argus-metrics";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flagForce = args.includes("--force");
const flagDryRun = args.includes("--dry-run");

const FOLLOWER_SNAPSHOT_PATH = join(ARGUS_DIR, "follower_snapshots.json");
const AGE_MIN_HOURS = 24;

interface FollowerSnapshot {
  ts: string;
  follower_count: number;
}

function loadSnapshots(): FollowerSnapshot[] {
  if (!existsSync(FOLLOWER_SNAPSHOT_PATH)) return [];
  try {
    return JSON.parse(readFileSync(FOLLOWER_SNAPSHOT_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveSnapshots(list: FollowerSnapshot[]) {
  writeFileSync(FOLLOWER_SNAPSHOT_PATH, JSON.stringify(list, null, 2) + "\n");
}

/**
 * Find the follower_count closest in time to `targetTime`, used as the
 * baseline for a 24h-old post. Returns null if no snapshot is older than
 * the target.
 */
function baselineFollowerCountAt(targetTime: number, snapshots: FollowerSnapshot[]): number | null {
  let best: FollowerSnapshot | null = null;
  let bestDiff = Infinity;
  for (const s of snapshots) {
    const t = new Date(s.ts).getTime();
    if (t > targetTime) continue;
    const diff = targetTime - t;
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  // Require a snapshot within ±6h of target to be meaningful
  if (best && bestDiff < 6 * 3600 * 1000) return best.follower_count;
  return null;
}

async function main() {
  log("track_start", { force: flagForce, dry_run: flagDryRun });

  if (!flagDryRun) {
    const auth = await authStatus();
    if (!auth.ok) {
      console.error("[track] xurl not authenticated:", auth.details);
      log("track_abort", { reason: "no_auth" }, "error");
      process.exit(2);
    }
  }

  // 1) Record current follower snapshot
  let currentFollowers: number | null = null;
  if (!flagDryRun) {
    const meRes = await getUser("me");
    currentFollowers = meRes.body?.data?.public_metrics?.followers_count ?? null;
    if (currentFollowers !== null) {
      const snapshots = loadSnapshots();
      snapshots.push({ ts: new Date().toISOString(), follower_count: currentFollowers });
      // Keep last 30 days only
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      const trimmed = snapshots.filter((s) => new Date(s.ts).getTime() >= cutoff);
      saveSnapshots(trimmed);
      log("track_snapshot", { followers: currentFollowers, snapshots: trimmed.length });
    }
  }

  // 2) Candidates: replies/posts not yet finalized and aged >= 24h
  const all = loadAllSent();
  const now = Date.now();
  const candidates = all.filter((s) => {
    if (s.finalized && !flagForce) return false;
    if (s.action_type === "like") return false;
    const ageHours = (now - new Date(s.sent_at).getTime()) / 3600000;
    if (!flagForce && ageHours < AGE_MIN_HOURS) return false;
    return true;
  });

  console.log(`[track] candidates=${candidates.length}`);
  if (candidates.length === 0) {
    log("track_done", { finalized: 0, skipped: 0, errors: 0 });
    return;
  }

  const snapshots = loadSnapshots();
  let finalized = 0;
  let errors = 0;

  for (const item of candidates) {
    if (flagDryRun) {
      console.log(`[dry-run] would finalize ${item.id} tweet=${item.tweet_id}`);
      continue;
    }
    const res = await getTweetMetrics(item.tweet_id);
    if (!res.ok || !res.body?.data?.public_metrics) {
      errors += 1;
      log("track_metric_fail", { sent_id: item.id, status: res.status }, "error");
      continue;
    }
    const pm = res.body.data.public_metrics;
    const metrics = {
      like_count: pm.like_count ?? 0,
      reply_count: pm.reply_count ?? 0,
      quote_count: pm.quote_count ?? 0,
      impression_count: pm.impression_count,
    };

    // Compute follow_delta — current followers minus baseline at send-time
    const sentTime = new Date(item.sent_at).getTime();
    const baseline = baselineFollowerCountAt(sentTime, snapshots);
    const followDelta = baseline !== null && currentFollowers !== null
      ? currentFollowers - baseline
      : 0;

    const composite = computeRawComposite(metrics, followDelta);

    const patch: Partial<SentItem> = {
      finalized: true,
      finalized_at: new Date().toISOString(),
      public_metrics: metrics,
      follow_delta: followDelta,
      composite_score: composite,
    };
    updateSent(item.id, patch);
    finalized += 1;
    log("track_finalized", {
      sent_id: item.id,
      tweet_id: item.tweet_id,
      metrics,
      follow_delta: followDelta,
      composite: composite,
    });
  }

  console.log(`[track] done finalized=${finalized} errors=${errors}`);
  log("track_done", { finalized, errors });
}

main().catch((e) => {
  console.error("[track] crashed:", e);
  log("track_crash", { error: String(e) }, "error");
  process.exit(1);
});

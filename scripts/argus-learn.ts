#!/usr/bin/env bun
/**
 * argus-learn.ts — Karpathy-style daily learning loop.
 *
 * Karpathy autoresearch core: hypothesis → fixed-window experiment → metric
 * eval → keep/discard → iterate. Argus version:
 *
 *   1) Load 7-day window of finalized sent[] items
 *   2) Group by feature dimensions: template, sentiment, watch_category,
 *      author, posted_hour, draft_length_bucket, had_url
 *   3) Within each dimension, find winners (>1σ above pop mean) and losers
 *      (<-1σ below). Each becomes a "verdict".
 *   4) Translate verdicts → patches (watchlist diff + persona addendum)
 *   5) Safety filter: drop anything touching hard_ceilings, auto_post_rules,
 *      hostile sentiment, or exclude_url_replies=false
 *   6) Apply: merge into config/argus-watchlist.json (with .bak backup) +
 *      append addendum to ~/.hermes/pantheon/personas/argus.yaml
 *   7) Write digest to ~/.hermes/argus/rules-patches/{YYYY-MM-DD}.md
 *   8) Telegram push (best-effort; bot may be idle)
 *
 * Flags:
 *   --dry-run            do everything except apply (default = apply)
 *   --window-days <N>    default 7
 *   --min-sample <N>     min items per group (default 3)
 *
 * argus-program.md (read first cycle) defines hard constraints on what the
 * learner is allowed to change. See ~/.hermes/argus/argus-program.md.
 */
import {
  loadAllSent,
  log,
  ARGUS_DIR,
} from "./lib/argus-state";
import {
  computeNormalizedComposite,
  findVerdicts,
  proposePatches,
  mergePatch,
  finalizedLastNDays,
  type Dimension,
  type Verdict,
  type RulePatch,
} from "./lib/argus-metrics";
import { loadWatchlist, WATCHLIST_PATH } from "./lib/argus-watchlist";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flagDryRun = args.includes("--dry-run");
const windowIdx = args.indexOf("--window-days");
const minSampleIdx = args.indexOf("--min-sample");
const windowDays = windowIdx >= 0 ? parseInt(args[windowIdx + 1]!, 10) : 7;
const minSample = minSampleIdx >= 0 ? parseInt(args[minSampleIdx + 1]!, 10) : 3;

const PROGRAM_PATH = join(ARGUS_DIR, "argus-program.md");
const PATCHES_DIR = join(ARGUS_DIR, "rules-patches");
const PERSONA_PATH = join(homedir(), ".hermes", "pantheon", "personas", "argus.yaml");

const DIMENSIONS: Dimension[] = [
  "template",
  "sentiment",
  "watch_category",
  "author",
  "posted_hour",
  "draft_length_bucket",
  "had_url",
];

function readProgram(): string {
  if (!existsSync(PROGRAM_PATH)) return "(no argus-program.md found — learner running with default safety filter only)";
  return readFileSync(PROGRAM_PATH, "utf-8");
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtVerdict(v: Verdict): string {
  const lines: string[] = [];
  lines.push(`### Dimension: \`${v.dimension}\``);
  lines.push(`Population mean composite: ${v.population_mean.toFixed(2)} · σ: ${v.population_std.toFixed(2)}`);
  if (v.winners.length > 0) {
    lines.push(`**Winners (>+1σ):**`);
    for (const w of v.winners) {
      lines.push(`- \`${w.key}\` — n=${w.count}, avg=${w.avg_composite.toFixed(2)} (likes ${w.avg_likes.toFixed(1)}, replies ${w.avg_replies.toFixed(1)}, Δfollow ${w.avg_follow_delta.toFixed(1)})`);
    }
  }
  if (v.losers.length > 0) {
    lines.push(`**Losers (<-1σ):**`);
    for (const l of v.losers) {
      lines.push(`- \`${l.key}\` — n=${l.count}, avg=${l.avg_composite.toFixed(2)}`);
    }
  }
  if (v.winners.length === 0 && v.losers.length === 0) {
    lines.push(`_No outliers — population homogeneous._`);
  }
  return lines.join("\n");
}

function fmtPatch(p: RulePatch, i: number): string {
  const lines: string[] = [];
  lines.push(`### Patch ${i + 1}`);
  lines.push(`**Reason:** ${p.reason}`);
  if (Object.keys(p.watchlist_diff).length > 0) {
    lines.push("**Watchlist diff:**");
    lines.push("```json");
    lines.push(JSON.stringify(p.watchlist_diff, null, 2));
    lines.push("```");
  }
  if (p.persona_addendum.trim()) {
    lines.push("**Persona addendum:**");
    lines.push("```markdown");
    lines.push(p.persona_addendum.trim());
    lines.push("```");
  }
  return lines.join("\n");
}

function buildDigest(
  sampleSize: number,
  finalizedCount: number,
  verdicts: Verdict[],
  patches: RulePatch[],
): string {
  const blocks: string[] = [];
  blocks.push(`# Argus Learn — ${todayStr()}`);
  blocks.push("");
  blocks.push(`- Window: last ${windowDays} days`);
  blocks.push(`- Sent items in window: ${sampleSize}`);
  blocks.push(`- Finalized (24h+ tracked): ${finalizedCount}`);
  blocks.push(`- Verdicts produced: ${verdicts.length}`);
  blocks.push(`- Patches (post-safety): ${patches.length}`);
  blocks.push(`- Apply mode: ${flagDryRun ? "DRY-RUN" : "APPLY"}`);
  blocks.push("");
  blocks.push("## Verdicts");
  for (const v of verdicts) {
    blocks.push(fmtVerdict(v));
    blocks.push("");
  }
  blocks.push("## Patches");
  if (patches.length === 0) {
    blocks.push("_No patches passed safety filter — no changes applied._");
  } else {
    patches.forEach((p, i) => {
      blocks.push(fmtPatch(p, i));
      blocks.push("");
    });
  }
  return blocks.join("\n");
}

function applyPatchesToWatchlist(patches: RulePatch[]) {
  // Backup
  const backup = WATCHLIST_PATH + ".bak";
  copyFileSync(WATCHLIST_PATH, backup);
  const current = JSON.parse(readFileSync(WATCHLIST_PATH, "utf-8"));
  let next = current;
  for (const p of patches) {
    if (Object.keys(p.watchlist_diff).length === 0) continue;
    next = mergePatch(next, p.watchlist_diff);
  }
  next.updated_at = new Date().toISOString();
  writeFileSync(WATCHLIST_PATH, JSON.stringify(next, null, 2) + "\n");
  log("learn_watchlist_patched", { backup, patches: patches.length });
}

function applyPatchesToPersona(patches: RulePatch[]) {
  if (!existsSync(PERSONA_PATH)) {
    log("learn_persona_missing", { path: PERSONA_PATH }, "warn");
    return;
  }
  const stamp = `\n# === Learning patch ${todayStr()} ===\n`;
  let block = stamp;
  for (const p of patches) {
    if (p.persona_addendum.trim()) {
      block += "# " + p.persona_addendum.trim().split("\n").join("\n# ") + "\n";
    }
  }
  block += `# === /Learning patch ${todayStr()} ===\n`;
  if (block.trim() === stamp.trim() + `# === /Learning patch ${todayStr()} ===`.trim()) return;
  appendFileSync(PERSONA_PATH, block);
  log("learn_persona_appended", { path: PERSONA_PATH });
}

async function pushTelegramSummary(digest: string) {
  // Best-effort — fire-and-forget HTTP to bot, but if env not set, skip.
  const token = process.env.ARGUS_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ARGUS_TELEGRAM_USER_ID;
  if (!token || !chatId) return;
  const summary = digest.split("\n").slice(0, 20).join("\n");
  const body = {
    chat_id: chatId,
    text: `🧠 *Argus learn — ${todayStr()}*\n\n${summary.replace(/[*_`[]/g, "")}`,
    parse_mode: "Markdown",
  };
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    log("learn_telegram_push_fail", { error: String(e) }, "warn");
  }
}

async function main() {
  log("learn_start", { window_days: windowDays, min_sample: minSample, dry_run: flagDryRun });
  console.log(`[learn] reading argus-program.md...`);
  const program = readProgram();
  console.log(`[learn] program loaded (${program.length} chars)`);

  const all = loadAllSent();
  const finalized = finalizedLastNDays(all, windowDays);
  console.log(`[learn] sent total=${all.length} finalized_window=${finalized.length}`);

  if (finalized.length < minSample * 2) {
    console.log(`[learn] not enough data yet (need ${minSample * 2} finalized, have ${finalized.length}). Exiting cleanly.`);
    log("learn_skip", { reason: "insufficient_data", finalized: finalized.length });
    return;
  }

  // Z-normalize composites across the population so cross-day comparisons are fair
  const normalized = computeNormalizedComposite(finalized);

  // Verdicts per dimension
  const verdicts: Verdict[] = [];
  for (const dim of DIMENSIONS) {
    const v = findVerdicts(normalized, dim, minSample);
    if (v.winners.length > 0 || v.losers.length > 0) {
      verdicts.push(v);
    }
  }
  console.log(`[learn] verdicts with outliers: ${verdicts.length}`);

  // Propose patches (proposePatches itself runs the safety filter)
  const patches = proposePatches(verdicts);
  console.log(`[learn] patches after safety filter: ${patches.length}`);

  // Compose digest
  const digest = buildDigest(finalized.length, finalized.length, verdicts, patches);

  // Write digest
  if (!existsSync(PATCHES_DIR)) mkdirSync(PATCHES_DIR, { recursive: true });
  const digestPath = join(PATCHES_DIR, `${todayStr()}.md`);
  writeFileSync(digestPath, digest);
  console.log(`[learn] digest → ${digestPath}`);

  // Apply
  if (!flagDryRun && patches.length > 0) {
    applyPatchesToWatchlist(patches);
    applyPatchesToPersona(patches);
    console.log(`[learn] applied ${patches.length} patches`);
  } else {
    console.log(`[learn] dry-run or no patches — nothing applied`);
  }

  await pushTelegramSummary(digest);

  log("learn_done", {
    verdicts: verdicts.length,
    patches: patches.length,
    applied: !flagDryRun && patches.length > 0,
    digest: digestPath,
  });
}

main().catch((e) => {
  console.error("[learn] crashed:", e);
  log("learn_crash", { error: String(e) }, "error");
  process.exit(1);
});

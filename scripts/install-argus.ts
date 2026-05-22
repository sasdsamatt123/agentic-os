#!/usr/bin/env bun
/**
 * install-argus.ts — interactive setup wizard for the Argus 24/7 X engagement agent.
 *
 * Flow:
 *   1. Pick sector (ai-builder / indie-hacker / community-mgr / blank)
 *   2. Your X handle(s) — fills mentions
 *   3. Active hours (default 07:00-23:00)
 *   4. Telegram bot token + user ID (optional)
 *   5. Show sector defaults for hashtags/accounts/keywords → confirm or edit
 *   6. Dry-run summary → confirm
 *   7. Write config/argus-watchlist.json, ~/.hermes/argus/argus-program.md,
 *      ~/.hermes/pantheon/personas/argus.yaml, ~/.hermes/.env entries
 *   8. Call install-argus-cron.ts to lay down 5 launchd jobs
 *   9. Print next-steps (xurl + X Developer setup is opt-in for engage)
 *
 * Re-runnable: existing files are overwritten only after explicit confirmation.
 *
 * Usage:
 *   bun run install-argus           # interactive
 *   bun run install-argus --dry-run # show what would happen, write nothing
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const HOME = homedir();
const REPO_ROOT = resolve(import.meta.dir, "..");
const ARGUS_DIR = join(HOME, ".hermes", "argus");
const PERSONAS_DIR = join(HOME, ".hermes", "pantheon", "personas");
const HERMES_ENV = join(HOME, ".hermes", ".env");
const WATCHLIST_OUT = join(REPO_ROOT, "config", "argus-watchlist.json");
const PROGRAM_OUT = join(ARGUS_DIR, "argus-program.md");
const PERSONA_OUT = join(PERSONAS_DIR, "argus.yaml");

const SECTORS = ["ai-builder", "indie-hacker", "community-mgr", "blank"] as const;
type Sector = (typeof SECTORS)[number];

const DRY_RUN = process.argv.includes("--dry-run");

const rl = createInterface({ input: stdin, output: stdout });

async function prompt(q: string, defaultVal?: string): Promise<string> {
  const tag = defaultVal !== undefined ? ` [${defaultVal}]` : "";
  const answer = (await rl.question(`${q}${tag} `)).trim();
  return answer || defaultVal || "";
}

async function promptYesNo(q: string, defaultYes = false): Promise<boolean> {
  const tag = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await rl.question(`${q} ${tag} `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer.startsWith("y");
}

function splitList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function header(text: string) {
  console.log("");
  console.log(`\x1b[1;36m${text}\x1b[0m`);
  console.log("─".repeat(Math.min(72, text.length + 4)));
}

function loadSectorWatchlist(sector: Sector): any {
  if (sector === "blank") {
    return {
      version: 1,
      _meta: { sector: "blank", isExample: false },
      mentions: [],
      hashtags: [],
      accounts: [],
      keywords: [],
      exclude_keywords: ["airdrop", "shitcoin", "DM me"],
      auto_rules: {
        auto_like_rules: {
          enabled: false,
          max_per_day: 50,
          conditions: { sentiment: ["friendly", "neutral"], is_mention: true, follower_count_min: 10 },
        },
        auto_reply_rules: {
          enabled: false,
          max_per_day: 10,
          max_per_hour: 3,
          active_hours: "07:00-23:00",
          conditions: {
            sentiment: ["question", "friendly"],
            relevance_score_min: 75,
            tweet_age_max_minutes: 60,
            thread_depth_max: 2,
            must_match_any_pattern: [],
            exclude_url_replies: true,
          },
          templates: ["concrete_answer", "warm_value_first"],
        },
        auto_post_rules: { enabled: false, comment: "Never enable — replies + likes only." },
        hard_ceilings: {
          daily_total_actions: 60,
          after_ceiling: "queue_for_manual_review",
          emergency_kill_switch: "pause_via_telegram",
        },
      },
      polling: { interval_minutes: 30, max_results_per_query: 25, scan_categories: ["mentions", "hashtags", "accounts", "keywords"] },
    };
  }
  const path = join(REPO_ROOT, "config", `argus-watchlist.${sector}.example.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadSectorProgram(sector: Sector): string {
  if (sector === "blank") return loadSectorProgram("ai-builder");
  const path = join(REPO_ROOT, "templates", "argus", `argus-program.${sector}.example.md`);
  return readFileSync(path, "utf-8");
}

function loadPersonaTemplate(): string {
  const path = join(REPO_ROOT, "templates", "argus", "argus-persona.example.yaml");
  return readFileSync(path, "utf-8");
}

function ensureDir(d: string) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function writeIfApproved(label: string, path: string, content: string, alreadyApproved: boolean) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would write ${label}: ${path} (${content.length} bytes)`);
    return;
  }
  ensureDir(resolve(path, ".."));
  if (existsSync(path) && !alreadyApproved) {
    console.warn(`  [skipped] ${path} already exists. Re-run with explicit overwrite to replace.`);
    return;
  }
  writeFileSync(path, content);
  console.log(`  ✓ wrote ${label}: ${path}`);
}

async function main() {
  console.log("");
  console.log("\x1b[1m🦅  Argus setup wizard\x1b[0m");
  console.log("24/7 X engagement agent · monitor → engage → track → learn");
  if (DRY_RUN) console.log("\x1b[33m(DRY-RUN — nothing will be written)\x1b[0m");
  console.log("");
  console.log("This will configure:");
  console.log(`  • ${WATCHLIST_OUT}`);
  console.log(`  • ${PROGRAM_OUT}`);
  console.log(`  • ${PERSONA_OUT}`);
  console.log(`  • 5 launchd jobs in ~/Library/LaunchAgents/com.argus.*`);
  console.log("");

  // 1. Sector
  header("1/6 — Pick a sector preset");
  console.log("  1) ai-builder    — AI/agent builders, MCP, Claude Code");
  console.log("  2) indie-hacker  — solo founders, indie SaaS");
  console.log("  3) community-mgr — brand / support voice");
  console.log("  4) blank         — start empty, edit watchlist by hand");
  const choice = await prompt("  Choice", "1");
  const sectorIdx = Math.max(1, Math.min(4, parseInt(choice, 10) || 1)) - 1;
  const sector = SECTORS[sectorIdx];
  console.log(`  → ${sector}`);

  const wl = loadSectorWatchlist(sector);

  // 2. X handle(s)
  header("2/6 — Your X handle(s) for mentions");
  console.log("  Comma-separated. Argus will watch for tweets mentioning these.");
  const handlesRaw = await prompt(
    "  X handles (e.g. @yourhandle,@yourbrand)",
    sector === "community-mgr" ? "@your_brand_handle" : "@your_handle",
  );
  wl.mentions = splitList(handlesRaw).map((h) => (h.startsWith("@") ? h : `@${h}`));

  // 3. Active hours
  header("3/6 — Reply active hours");
  console.log("  Auto-replies only fire inside this window. Format HH:MM-HH:MM.");
  const activeHours = await prompt(
    "  Active hours",
    sector === "community-mgr" ? "08:00-20:00" : "07:00-23:00",
  );
  wl.auto_rules.auto_reply_rules.active_hours = activeHours;

  // 4. Telegram (optional)
  header("4/6 — Telegram bot (optional, for approval UI)");
  console.log("  Skip with empty Enter — Argus runs in draft-only mode without it.");
  console.log("  Create one via @BotFather, paste the HTTP API token here.");
  const tgToken = await prompt("  Bot token (paste or skip)", "");
  let tgUserId = "";
  if (tgToken) {
    tgUserId = await prompt("  Your Telegram user ID (numeric, from @userinfobot)", "");
  }

  // 5. Defaults review
  header("5/6 — Review default watchlist (from preset)");
  console.log(`  hashtags: ${wl.hashtags.join(", ") || "(none)"}`);
  console.log(`  accounts: ${wl.accounts.join(", ") || "(none)"}`);
  console.log(`  keywords: ${wl.keywords.join(", ") || "(none)"}`);
  const editDefaults = await promptYesNo("  Edit these now?", false);
  if (editDefaults) {
    const newHash = await prompt("  Hashtags (comma-separated)", wl.hashtags.join(", "));
    wl.hashtags = splitList(newHash);
    const newAccts = await prompt("  Accounts (comma-separated, no @)", wl.accounts.join(", "));
    wl.accounts = splitList(newAccts).map((a) => a.replace(/^@/, ""));
    const newKws = await prompt("  Keywords (comma-separated)", wl.keywords.join(", "));
    wl.keywords = splitList(newKws);
  }

  // Clear example flag for the live config
  delete wl._meta?.isExample;
  if (wl._meta) wl._meta.installed_at = new Date().toISOString();

  // 6. Summary + confirm
  header("6/6 — Ready to write");
  console.log(`  Sector:        ${sector}`);
  console.log(`  Mentions:      ${wl.mentions.join(", ")}`);
  console.log(`  Hashtags:      ${wl.hashtags.length}`);
  console.log(`  Accounts:      ${wl.accounts.length}`);
  console.log(`  Keywords:      ${wl.keywords.length}`);
  console.log(`  Active hours:  ${activeHours}`);
  console.log(`  Telegram bot:  ${tgToken ? "configured" : "skipped (draft-only mode)"}`);
  console.log("");
  console.log("  Files to write:");
  console.log(`    ${WATCHLIST_OUT}  ${existsSync(WATCHLIST_OUT) ? "(EXISTS, will overwrite)" : ""}`);
  console.log(`    ${PROGRAM_OUT}    ${existsSync(PROGRAM_OUT) ? "(EXISTS, will overwrite)" : ""}`);
  console.log(`    ${PERSONA_OUT}    ${existsSync(PERSONA_OUT) ? "(EXISTS, will overwrite)" : ""}`);
  if (tgToken) console.log(`    ${HERMES_ENV} (append ARGUS_TELEGRAM_*)`);
  console.log("");
  const confirm = await promptYesNo("  Proceed?", true);
  if (!confirm) {
    console.log("Aborted. No files changed.");
    rl.close();
    return;
  }

  // Write files
  console.log("");
  console.log("Writing files...");

  // Watchlist
  writeIfApproved("watchlist", WATCHLIST_OUT, JSON.stringify(wl, null, 2) + "\n", true);

  // Program — inject the first handle into "Operator" section
  let program = loadSectorProgram(sector);
  if (wl.mentions[0]) {
    program = program.replace(/`@your_handle`/g, `\`${wl.mentions[0]}\``);
    program = program.replace(/`@your_brand_handle`/g, `\`${wl.mentions[0]}\``);
  }
  writeIfApproved("program.md", PROGRAM_OUT, program, true);

  // Persona
  const persona = loadPersonaTemplate();
  writeIfApproved("persona.yaml", PERSONA_OUT, persona, true);

  // .env additions (append, never overwrite the whole file)
  if (tgToken && !DRY_RUN) {
    ensureDir(resolve(HERMES_ENV, ".."));
    const lines = [
      `ARGUS_TELEGRAM_BOT_TOKEN=${tgToken}`,
      tgUserId ? `ARGUS_TELEGRAM_USER_ID=${tgUserId}` : null,
    ].filter(Boolean) as string[];
    const existing = existsSync(HERMES_ENV) ? readFileSync(HERMES_ENV, "utf-8") : "";
    const newLines = lines.filter((l) => !existing.includes(l.split("=")[0]!));
    if (newLines.length > 0) {
      appendFileSync(HERMES_ENV, "\n" + newLines.join("\n") + "\n");
      console.log(`  ✓ appended ${newLines.length} var(s) to ${HERMES_ENV}`);
    } else {
      console.log(`  • ${HERMES_ENV} already contains ARGUS_TELEGRAM_* — skipped`);
    }
  }

  // Cron
  console.log("");
  console.log("Installing launchd jobs...");
  if (!DRY_RUN) {
    const r = spawnSync(
      "bun",
      ["run", join(REPO_ROOT, "scripts/install-argus-cron.ts")],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      console.warn("  ⚠ install-argus-cron.ts exited non-zero. You can re-run it manually.");
    }
  } else {
    console.log("  [dry-run] would call: bun run scripts/install-argus-cron.ts");
  }

  // Next steps
  header("Next steps");
  console.log("Argus is now running in DRAFT-ONLY mode (no xurl auth).");
  console.log("");
  console.log("To enable auto-fire (replies + likes via the X API):");
  console.log("  1. Create an X Developer app at https://developer.x.com");
  console.log("     OAuth 2.0 PKCE, callback http://127.0.0.1:8080/callback");
  console.log("     scopes: tweet.read tweet.write users.read like.write offline.access");
  console.log("  2. curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash");
  console.log("  3. xurl auth oauth2 --app argus --client-id=<CID> --client-secret=<CSEC>");
  console.log("");
  console.log("Check pipeline status:");
  console.log("  launchctl list | grep argus     # 5 jobs expected");
  console.log("  tail -f ~/.hermes/argus/log.jsonl");
  console.log("  bun run dev → http://localhost:8081/argus");
  console.log("");
  console.log("Edit your voice + watchlist any time:");
  console.log(`  ${PROGRAM_OUT}`);
  console.log(`  ${WATCHLIST_OUT}`);
  console.log("");

  rl.close();
}

main().catch((e) => {
  console.error("install-argus crashed:", e);
  rl.close();
  process.exit(1);
});

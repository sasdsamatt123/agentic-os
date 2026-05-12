#!/usr/bin/env bun
/**
 * install-dream-cron.ts
 *
 * Installs (or removes) the daily Dream cron on macOS via launchd.
 *
 * macOS:
 *   - Writes ~/Library/LaunchAgents/com.claude-os.dream.plist
 *   - Loads it with `launchctl` so it fires daily at the configured time
 *     (default 07:00) and runs `claude -p "/dream"` headless. Output is
 *     written to ~/.claude-os/dream-cron.log.
 *
 * Linux / other:
 *   - Prints a clean message + a `crontab` snippet the user can install by
 *     hand. We don't try to write to /etc or invoke `crontab -e` for them.
 *
 * Usage:
 *   bun run scripts/install-dream-cron.ts                # install at 07:00
 *   bun run scripts/install-dream-cron.ts --time 23:30   # custom time
 *   bun run scripts/install-dream-cron.ts --uninstall    # remove
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HOME = homedir();
const PLIST_LABEL = "com.claude-os.dream";
const PLIST_PATH = join(HOME, "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);
const DREAM_DIR = join(HOME, ".claude-os", "dreams");
const STATE_DIR = join(HOME, ".claude-os");
const LOG_PATH = join(HOME, ".claude-os", "dream-cron.log");
// Absolute path to the cloned repo — captured at install time so the plist
// keeps working even if the user later moves their shell elsewhere.
const REPO_ROOT = resolve(import.meta.dir, "..");
// Resolve bun's actual install path so the plist doesn't depend on launchd
// inheriting the user's interactive PATH (it doesn't). Falls back to common
// locations if `which bun` doesn't return.
const BUN_BIN = (() => {
  const tries = [
    spawnSync("which", ["bun"], { encoding: "utf-8" }).stdout?.trim(),
    join(HOME, ".bun", "bin", "bun"),
    "/opt/homebrew/bin/bun",
    "/usr/local/bin/bun",
  ].filter(Boolean) as string[];
  for (const p of tries) if (existsSync(p)) return p;
  return "bun"; // final fallback — relies on PATH below
})();

type Args = {
  uninstall: boolean;
  hour: number;
  minute: number;
  rawTime: string;
};

function parseArgs(argv: string[]): Args {
  let uninstall = false;
  let rawTime = "07:00";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--uninstall" || a === "-u") {
      uninstall = true;
    } else if (a === "--time" || a === "-t") {
      const next = argv[i + 1];
      if (!next) {
        console.error(`[install-dream-cron] --time requires a HH:MM argument`);
        process.exit(2);
      }
      rawTime = next;
      i++;
    } else if (a === "--help" || a === "-h") {
      printUsageAndExit(0);
    }
  }
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(rawTime);
  if (!m) {
    console.error(`[install-dream-cron] invalid --time "${rawTime}". Use HH:MM (24-hour).`);
    process.exit(2);
  }
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23) {
    console.error(`[install-dream-cron] invalid hour "${hour}" — must be 0-23.`);
    process.exit(2);
  }
  return { uninstall, hour, minute, rawTime };
}

function printUsageAndExit(code: number) {
  console.log(
    [
      "Usage: bun run scripts/install-dream-cron.ts [options]",
      "",
      "Options:",
      "  --time HH:MM      Daily trigger time, 24-hour. Default: 07:00",
      "  --uninstall       Unload and delete the launchd plist",
      "  --help            Show this message",
    ].join("\n"),
  );
  process.exit(code);
}

// Escape a string for safe inclusion as XML character data (text node or
// attribute value). Required because REPO_ROOT and BUN_BIN are interpolated
// into the plist; any `&`, `<`, `>`, `"`, or `'` would otherwise break
// `plutil` parsing or, worse, smuggle additional XML elements.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Wrap an arbitrary string for safe use inside a /bin/sh -c command. We use
// single-quotes which neutralise everything in POSIX sh except the closing
// quote itself; embedded `'` is escaped via the standard close/open dance.
function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

function buildPlistXml(hour: number, minute: number): string {
  // Use a single ${HOME}-aware PATH so `claude` resolves whether installed
  // via Homebrew (Apple Silicon: /opt/homebrew/bin), Intel Homebrew
  // (/usr/local/bin), or a system path. launchd does not source the user's
  // shell, so PATH must be set explicitly here.
  // Run the aggregator first so live-data.json is fresh, then fire /dream.
  // The aggregator gives Dream up-to-date metrics to base its prescriptions
  // on; the dashboard also sees the refreshed numbers without the user
  // hitting the Refresh button. Using `;` (not `&&`) so a flaky aggregator
  // run doesn't block the daily Dream review.
  const cdPart = `cd ${shellSingleQuote(REPO_ROOT)}`;
  const bunPart = `${shellSingleQuote(BUN_BIN)} run scripts/aggregate.ts`;
  const dreamPart = `claude -p "/dream"`;
  const command = xmlEscape(`${cdPart} && ${bunPart} ; ${dreamPart}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>${command}</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>

  <key>RunAtLoad</key>
  <false/>

  <key>WorkingDirectory</key>
  <string>${xmlEscape(HOME)}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xmlEscape(`${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`)}</string>
    <key>HOME</key>
    <string>${xmlEscape(HOME)}</string>
  </dict>

  <key>StandardOutPath</key>
  <string>${xmlEscape(LOG_PATH)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(LOG_PATH)}</string>
</dict>
</plist>
`;
}

function ensureDirs() {
  for (const d of [STATE_DIR, DREAM_DIR, join(HOME, "Library", "LaunchAgents")]) {
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true });
    }
  }
  if (!existsSync(LOG_PATH)) {
    writeFileSync(LOG_PATH, "", { flag: "a" });
  }
}

function runLaunchctl(args: string[], { ignoreFailure = false }: { ignoreFailure?: boolean } = {}) {
  const r = spawnSync("launchctl", args, { stdio: "pipe", encoding: "utf-8" });
  if (r.status !== 0 && !ignoreFailure) {
    const cmd = ["launchctl", ...args].join(" ");
    console.error(`[install-dream-cron] command failed: ${cmd}`);
    if (r.stderr) console.error(r.stderr.trim());
    return false;
  }
  return true;
}

function warnIfDreamSkillMissing() {
  // The cron will fire `claude -p "/dream"` at the configured time. If the user
  // hasn't actually copied the bundled skill into ~/.claude/skills/dream/, the
  // slash command is unknown, the cron silently does nothing, and the dashboard
  // shows samples forever. Warn loudly but don't block — the user might have
  // a custom skill location.
  const skillPath = join(HOME, ".claude", "skills", "dream", "SKILL.md");
  if (!existsSync(skillPath)) {
    console.warn("");
    console.warn(`[install-dream] WARNING: ~/.claude/skills/dream/SKILL.md not found.`);
    console.warn(
      `[install-dream] The cron will fire at the configured time but Claude won't know /dream.`,
    );
    console.warn(`[install-dream] Install the skill first:`);
    console.warn(
      `[install-dream]   mkdir -p ~/.claude/skills && cp -r skills/dream ~/.claude/skills/dream`,
    );
    console.warn(`[install-dream] Then re-run: bun run install-dream`);
    console.warn("");
  }
}

function installMac(hour: number, minute: number, rawTime: string) {
  ensureDirs();
  warnIfDreamSkillMissing();

  const xml = buildPlistXml(hour, minute);
  writeFileSync(PLIST_PATH, xml, "utf-8");
  console.log(`[install-dream-cron] wrote plist: ${PLIST_PATH}`);

  // Best-effort unload first (idempotent re-install). Ignore failures —
  // launchctl prints a non-zero status when the job isn't loaded yet.
  runLaunchctl(["unload", "-w", PLIST_PATH], { ignoreFailure: true });

  const ok = runLaunchctl(["load", "-w", PLIST_PATH]);
  if (!ok) {
    console.error("");
    console.error("[install-dream-cron] launchctl load failed.");
    console.error(`  Try manually:  launchctl load -w ${PLIST_PATH}`);
    process.exit(1);
  }

  console.log("");
  console.log(`Dream cron installed. Next run: tomorrow ${rawTime}.`);
  console.log(`At each run: refreshes the dashboard's live-data.json, then`);
  console.log(`fires /dream so prescriptions are based on up-to-date metrics.`);
  console.log(`Logs: ${LOG_PATH}`);
  console.log(`Plist: ${PLIST_PATH}`);
  console.log("");
  console.log("To trigger an on-demand run right now:");
  console.log(`  cd ${REPO_ROOT} && bun run scripts/aggregate.ts && claude -p "/dream"`);
  console.log("");
  console.log("To remove:");
  console.log("  bun run uninstall-dream");
}

function uninstallMac() {
  if (existsSync(PLIST_PATH)) {
    runLaunchctl(["unload", "-w", PLIST_PATH], { ignoreFailure: true });
    try {
      unlinkSync(PLIST_PATH);
      console.log(`[install-dream-cron] removed plist: ${PLIST_PATH}`);
    } catch (err) {
      console.warn(`[install-dream-cron] could not remove ${PLIST_PATH}:`, err);
    }
  } else {
    console.log(`[install-dream-cron] no plist at ${PLIST_PATH} — nothing to do.`);
  }
  console.log(
    `Dream cron uninstalled. Log file kept at ${LOG_PATH} (delete manually if you want).`,
  );
}

function printLinuxFallback(hour: number, minute: number, rawTime: string) {
  const cron = `${minute} ${hour} * * *  /bin/sh -lc 'claude -p "/dream" >> ${LOG_PATH} 2>&1'`;
  console.log("[install-dream-cron] Only macOS is auto-installable (launchd plist).");
  console.log("");
  console.log(`Detected platform: ${process.platform}`);
  console.log("");
  console.log(`To install the Dream cron manually on Linux at ${rawTime} daily:`);
  console.log("");
  console.log("  1. Make sure ~/.claude-os/dreams exists:");
  console.log(`       mkdir -p ${DREAM_DIR}`);
  console.log("");
  console.log("  2. Add this line to your crontab (run `crontab -e`):");
  console.log("");
  console.log(`       ${cron}`);
  console.log("");
  console.log("  3. Confirm `claude` resolves on your $PATH (cron has a minimal env).");
  console.log("");
  console.log('Windows: use Task Scheduler to run `claude -p "/dream"` daily.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.platform !== "darwin") {
    if (args.uninstall) {
      console.log("[install-dream-cron] --uninstall is macOS-only. On Linux, edit your crontab.");
      process.exit(0);
    }
    warnIfDreamSkillMissing();
    printLinuxFallback(args.hour, args.minute, args.rawTime);
    process.exit(0);
  }

  if (args.uninstall) {
    uninstallMac();
    return;
  }

  installMac(args.hour, args.minute, args.rawTime);
}

main();

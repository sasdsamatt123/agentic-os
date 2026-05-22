#!/usr/bin/env bun
/**
 * install-argus-cron.ts
 *
 * Installs (or removes) the 5 Argus launchd jobs on macOS:
 *   - com.argus.monitor   (every 30 min) — search + draft pipeline
 *   - com.argus.engage    (every 30 min) — drain pending_auto via xurl
 *   - com.argus.track     (hourly)       — finalize 24h+ posts with metrics
 *   - com.argus.learn     (daily 06:00)  — autoresearch loop / patches
 *   - com.argus.telegram  (KeepAlive)    — long-poll Telegram bot daemon
 *
 * All paths are resolved at install time:
 *   REPO_ROOT — absolute path to this checkout (so plist works after `cd`)
 *   BUN_BIN   — actual bun binary (launchd does NOT inherit shell PATH)
 *   HOME      — for state + log dirs under ~/.hermes/argus/
 *
 * Usage:
 *   bun run scripts/install-argus-cron.ts                # install all
 *   bun run scripts/install-argus-cron.ts --uninstall    # remove all
 *   bun run scripts/install-argus-cron.ts --only monitor # install just one
 *
 * Linux: prints crontab snippets the user can install by hand.
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HOME = homedir();
const REPO_ROOT = resolve(import.meta.dir, "..");
const ARGUS_DIR = join(HOME, ".hermes", "argus");

const BUN_BIN = (() => {
  const tries = [
    spawnSync("which", ["bun"], { encoding: "utf-8" }).stdout?.trim(),
    join(HOME, ".bun", "bin", "bun"),
    "/opt/homebrew/bin/bun",
    "/usr/local/bin/bun",
  ].filter(Boolean) as string[];
  for (const p of tries) if (existsSync(p)) return p;
  return "bun";
})();

type JobKey = "monitor" | "engage" | "track" | "learn" | "telegram";

interface JobSpec {
  label: string;
  script: string;
  schedule: { interval?: number; calendar?: { hour: number; minute: number } };
  keepAlive?: boolean;
  logName: string;
}

const JOBS: Record<JobKey, JobSpec> = {
  monitor: {
    label: "com.argus.monitor",
    script: "scripts/argus-monitor.ts",
    schedule: { interval: 1800 }, // 30 min
    logName: "monitor-cron.log",
  },
  engage: {
    label: "com.argus.engage",
    script: "scripts/argus-engage.ts --batch",
    schedule: { interval: 1800 },
    logName: "engage-cron.log",
  },
  track: {
    label: "com.argus.track",
    script: "scripts/argus-track.ts",
    schedule: { interval: 3600 }, // hourly
    logName: "track-cron.log",
  },
  learn: {
    label: "com.argus.learn",
    script: "scripts/argus-learn.ts",
    schedule: { calendar: { hour: 6, minute: 0 } }, // daily 06:00
    logName: "learn-cron.log",
  },
  telegram: {
    label: "com.argus.telegram",
    script: "scripts/argus-telegram-bot.ts",
    schedule: { interval: 0 }, // daemon — KeepAlive controls life
    keepAlive: true,
    logName: "telegram-cron.log",
  },
};

function parseArgs(argv: string[]): { uninstall: boolean; only: JobKey | null } {
  let uninstall = false;
  let only: JobKey | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--uninstall" || a === "-u") uninstall = true;
    else if (a === "--only") {
      const next = argv[i + 1] as JobKey;
      if (!next || !(next in JOBS)) {
        console.error(`[install-argus-cron] --only requires one of: ${Object.keys(JOBS).join(", ")}`);
        process.exit(2);
      }
      only = next;
      i++;
    } else if (a === "--help" || a === "-h") {
      printUsageAndExit(0);
    }
  }
  return { uninstall, only };
}

function printUsageAndExit(code: number) {
  console.log(
    [
      "Usage: bun run scripts/install-argus-cron.ts [options]",
      "",
      "Options:",
      "  --uninstall          Unload + delete all Argus plists",
      "  --only <job>         Install just one job (monitor|engage|track|learn|telegram)",
      "  --help               Show this message",
    ].join("\n"),
  );
  process.exit(code);
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

function plistPath(label: string): string {
  return join(HOME, "Library", "LaunchAgents", `${label}.plist`);
}

function buildPlistXml(job: JobSpec): string {
  const cdPart = `cd ${shellSingleQuote(REPO_ROOT)}`;
  const runPart = `${shellSingleQuote(BUN_BIN)} run ${job.script}`;
  const command = xmlEscape(`${cdPart} && ${runPart}`);
  const logPath = join(ARGUS_DIR, job.logName);

  let scheduleXml = "";
  if (job.schedule.interval !== undefined && job.schedule.interval > 0) {
    scheduleXml = `  <key>StartInterval</key>\n  <integer>${job.schedule.interval}</integer>\n`;
  } else if (job.schedule.calendar) {
    scheduleXml =
      `  <key>StartCalendarInterval</key>\n  <dict>\n` +
      `    <key>Hour</key>\n    <integer>${job.schedule.calendar.hour}</integer>\n` +
      `    <key>Minute</key>\n    <integer>${job.schedule.calendar.minute}</integer>\n` +
      `  </dict>\n`;
  }

  const keepAliveXml = job.keepAlive
    ? `  <key>KeepAlive</key>\n  <true/>\n  <key>RunAtLoad</key>\n  <true/>\n`
    : `  <key>RunAtLoad</key>\n  <false/>\n`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${job.label}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>${command}</string>
  </array>

${scheduleXml}${keepAliveXml}
  <key>WorkingDirectory</key>
  <string>${xmlEscape(REPO_ROOT)}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xmlEscape(`${HOME}/.bun/bin:${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`)}</string>
    <key>HOME</key>
    <string>${xmlEscape(HOME)}</string>
  </dict>

  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function ensureDirs() {
  for (const d of [ARGUS_DIR, join(HOME, "Library", "LaunchAgents")]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function runLaunchctl(args: string[], { ignoreFailure = false }: { ignoreFailure?: boolean } = {}) {
  const r = spawnSync("launchctl", args, { stdio: "pipe", encoding: "utf-8" });
  if (r.status !== 0 && !ignoreFailure) {
    console.error(`[install-argus-cron] launchctl ${args.join(" ")} failed`);
    if (r.stderr) console.error(r.stderr.trim());
    return false;
  }
  return true;
}

function installJob(key: JobKey) {
  const job = JOBS[key];
  const path = plistPath(job.label);
  const xml = buildPlistXml(job);
  writeFileSync(path, xml, "utf-8");
  // Best-effort unload first (idempotent re-install)
  runLaunchctl(["unload", "-w", path], { ignoreFailure: true });
  const ok = runLaunchctl(["load", "-w", path]);
  if (ok) {
    console.log(`[install-argus-cron] loaded ${job.label}`);
  } else {
    console.error(`[install-argus-cron] FAILED to load ${job.label}. Try manually:`);
    console.error(`  launchctl load -w ${path}`);
  }
}

function uninstallJob(key: JobKey) {
  const job = JOBS[key];
  const path = plistPath(job.label);
  if (existsSync(path)) {
    runLaunchctl(["unload", "-w", path], { ignoreFailure: true });
    try {
      unlinkSync(path);
      console.log(`[install-argus-cron] removed ${job.label}`);
    } catch (err) {
      console.warn(`[install-argus-cron] could not remove ${path}:`, err);
    }
  } else {
    console.log(`[install-argus-cron] no plist at ${path} — nothing to do.`);
  }
}

function printLinuxFallback() {
  console.log("[install-argus-cron] Only macOS is auto-installable (launchd plist).");
  console.log("");
  console.log(`Detected platform: ${process.platform}`);
  console.log("");
  console.log("Equivalent crontab lines (Linux):");
  console.log("");
  console.log(`  */30 * * * * cd ${REPO_ROOT} && ${BUN_BIN} run scripts/argus-monitor.ts >> ${ARGUS_DIR}/monitor-cron.log 2>&1`);
  console.log(`  */30 * * * * cd ${REPO_ROOT} && ${BUN_BIN} run scripts/argus-engage.ts --batch >> ${ARGUS_DIR}/engage-cron.log 2>&1`);
  console.log(`  0 * * * *    cd ${REPO_ROOT} && ${BUN_BIN} run scripts/argus-track.ts >> ${ARGUS_DIR}/track-cron.log 2>&1`);
  console.log(`  0 6 * * *    cd ${REPO_ROOT} && ${BUN_BIN} run scripts/argus-learn.ts >> ${ARGUS_DIR}/learn-cron.log 2>&1`);
  console.log("");
  console.log("Telegram bot daemon (run under a process supervisor like systemd):");
  console.log(`  ${BUN_BIN} run ${join(REPO_ROOT, "scripts/argus-telegram-bot.ts")}`);
}

function main() {
  const { uninstall, only } = parseArgs(process.argv.slice(2));

  if (process.platform !== "darwin") {
    if (!uninstall) printLinuxFallback();
    process.exit(0);
  }

  ensureDirs();
  const keys: JobKey[] = only ? [only] : (Object.keys(JOBS) as JobKey[]);
  for (const k of keys) {
    if (uninstall) uninstallJob(k);
    else installJob(k);
  }
  console.log("");
  if (uninstall) {
    console.log("Argus cron jobs uninstalled.");
  } else {
    console.log("Argus cron jobs installed. Logs under ~/.hermes/argus/*.log");
    console.log("To verify:   launchctl list | grep argus");
    console.log("To remove:   bun run scripts/install-argus-cron.ts --uninstall");
  }
}

main();

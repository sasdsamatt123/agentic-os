#!/usr/bin/env bun
/**
 * install-session-backup.ts — install (or remove) a daily launchd job that
 * snapshots ~/.claude/projects via backup-sessions.ts at 03:00.
 *
 * Usage:
 *   bun run scripts/install-session-backup.ts            # install
 *   bun run scripts/install-session-backup.ts --uninstall
 *
 * Linux: prints a crontab snippet.
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HOME = homedir();
const REPO_ROOT = resolve(import.meta.dir, "..");
const LABEL = "com.claude-os.session-backup";
const PLIST = join(HOME, "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG = join(HOME, ".claude-session-backups", "backup-cron.log");

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

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function shq(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

if (process.argv.includes("--uninstall") || process.argv.includes("-u")) {
  if (existsSync(PLIST)) {
    spawnSync("launchctl", ["unload", "-w", PLIST], { stdio: "pipe" });
    try { unlinkSync(PLIST); } catch {}
    console.log(`[session-backup] removed ${LABEL}`);
  } else {
    console.log(`[session-backup] no plist for ${LABEL}`);
  }
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.log("[session-backup] macOS-only auto-install. Linux crontab:");
  console.log(`  0 3 * * * cd ${REPO_ROOT} && ${BUN_BIN} run scripts/backup-sessions.ts >> ${LOG} 2>&1`);
  process.exit(0);
}

mkdirSync(join(HOME, ".claude-session-backups"), { recursive: true });
mkdirSync(join(HOME, "Library", "LaunchAgents"), { recursive: true });

const cmd = xmlEscape(`cd ${shq(REPO_ROOT)} && ${shq(BUN_BIN)} run scripts/backup-sessions.ts`);
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>${cmd}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>3</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(REPO_ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xmlEscape(`${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`)}</string>
    <key>HOME</key>
    <string>${xmlEscape(HOME)}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(LOG)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(LOG)}</string>
</dict>
</plist>
`;
writeFileSync(PLIST, plist, "utf-8");
spawnSync("launchctl", ["unload", "-w", PLIST], { stdio: "pipe" });
const r = spawnSync("launchctl", ["load", "-w", PLIST], { stdio: "pipe", encoding: "utf-8" });
if (r.status === 0) {
  console.log(`[session-backup] ✓ loaded ${LABEL} (günlük 03:00)`);
  console.log(`  yedekler: ~/.claude-session-backups/  ·  log: ${LOG}`);
} else {
  console.error(`[session-backup] launchctl load failed: ${r.stderr?.trim()}`);
  console.error(`  manuel: launchctl load -w ${PLIST}`);
}

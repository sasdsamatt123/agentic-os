#!/usr/bin/env bun
/**
 * backup-sessions.ts — daily snapshot of Claude Code session transcripts.
 *
 * Insurance ON TOP of cleanupPeriodDays=3650 (which stops Claude Code from
 * auto-deleting old sessions). This guards against disk loss / accidental
 * deletion: a compressed point-in-time snapshot of ~/.claude/projects/ is
 * written to ~/.claude-session-backups/ and the last KEEP snapshots are kept.
 *
 * Read-only on the source — it only COPIES ~/.claude/projects, never modifies it.
 *
 * Usage:
 *   bun run scripts/backup-sessions.ts          # take a snapshot now
 *   bun run scripts/backup-sessions.ts --list   # list existing snapshots
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const HOME = homedir();
const SRC_DIR = join(HOME, ".claude");
const SRC = join(SRC_DIR, "projects");
const DEST = join(HOME, ".claude-session-backups");
const KEEP = 14;

function listSnapshots(): string[] {
  if (!existsSync(DEST)) return [];
  return readdirSync(DEST)
    .filter((f) => f.startsWith("sessions-") && f.endsWith(".tar.gz"))
    .sort();
}

function human(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

if (process.argv.includes("--list")) {
  const snaps = listSnapshots();
  console.log(`[backup-sessions] ${snaps.length} snapshot @ ${DEST}`);
  for (const s of snaps) {
    const sz = statSync(join(DEST, s)).size;
    console.log(`  ${s}  ${human(sz)}`);
  }
  process.exit(0);
}

if (!existsSync(SRC)) {
  console.error("[backup-sessions] ~/.claude/projects yok — atlanıyor");
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const out = join(DEST, `sessions-${stamp}.tar.gz`);

// Compressed snapshot of the projects dir (session transcripts live here).
const r = spawnSync("tar", ["czf", out, "-C", SRC_DIR, "projects"], { stdio: "pipe", encoding: "utf-8" });
if (r.status !== 0) {
  console.error("[backup-sessions] tar failed:", r.stderr?.trim());
  process.exit(1);
}
const size = existsSync(out) ? statSync(out).size : 0;
console.log(`[backup-sessions] ✓ ${out} (${human(size)})`);

// Prune — keep the last KEEP snapshots.
const all = listSnapshots();
const excess = all.slice(0, Math.max(0, all.length - KEEP));
for (const f of excess) {
  try { unlinkSync(join(DEST, f)); console.log(`[backup-sessions] pruned ${f}`); } catch {}
}
console.log(`[backup-sessions] ${listSnapshots().length}/${KEEP} snapshot tutuluyor`);

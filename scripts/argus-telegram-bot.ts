#!/usr/bin/env bun
/**
 * argus-telegram-bot.ts — long-poll Telegram bot for Argus approval UI.
 *
 * Phase 1 commands (no posting yet):
 *   /pending  — list current pending_review.json (top 10)
 *   /stats    — today's cost + queue + sent counts
 *   /pause    — launchctl unload com.argus.monitor
 *   /resume   — launchctl load com.argus.monitor
 *   /help     — list commands
 *
 * Phase 2 will add /approve, /edit, /skip.
 *
 * Token resolution order:
 *   1. process.env.ARGUS_TELEGRAM_BOT_TOKEN
 *   2. line in ~/.hermes/.env "ARGUS_TELEGRAM_BOT_TOKEN=..."
 *
 * If no token → idle sleep (don't spam logs). Operator sets token + relaunches.
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  loadPendingReview,
  loadPendingAuto,
  loadCost,
  loadSent,
  log,
  removeFromPending,
  appendPendingAuto,
  PENDING_REVIEW_PATH,
} from "./lib/argus-state";
import { writeFileSync, readFileSync as fsReadFile } from "node:fs";

const HERMES_ENV = join(homedir(), ".hermes", ".env");
const LAUNCHD_LABEL = "com.argus.monitor";
const LAUNCHD_PLIST = join(homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);

function readEnvLine(name: string): string | null {
  if (process.env[name]) return process.env[name]!;
  if (!existsSync(HERMES_ENV)) return null;
  const raw = readFileSync(HERMES_ENV, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    if (k !== name) continue;
    let v = trimmed.slice(idx + 1).trim();
    // strip optional quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return null;
}

const TOKEN = readEnvLine("ARGUS_TELEGRAM_BOT_TOKEN");
const ALLOWED_USER_ID = readEnvLine("ARGUS_TELEGRAM_USER_ID");

if (!TOKEN) {
  console.log("[argus-bot] no ARGUS_TELEGRAM_BOT_TOKEN configured.");
  console.log("[argus-bot] Set it in ~/.hermes/.env then relaunch the daemon.");
  console.log("[argus-bot] Sleeping...");
  log("bot_no_token", {}, "warn");
  // Sleep forever — launchd will restart on token change if KeepAlive is set
  await new Promise(() => {});
}

if (!ALLOWED_USER_ID) {
  console.error("[argus-bot] ARGUS_TELEGRAM_USER_ID missing — bot will accept ALL users (unsafe).");
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function sendMessage(chatId: number | string, text: string, opts: Record<string, unknown> = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...opts,
  });
}

function isAllowed(userId: number | string): boolean {
  if (!ALLOWED_USER_ID) return true;
  return String(userId) === String(ALLOWED_USER_ID);
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(3)}`;
}

// ── Command handlers ─────────────────────────────────────────────────
async function cmdPending(chatId: number) {
  const review = loadPendingReview();
  const auto = loadPendingAuto();
  if (review.length === 0 && auto.length === 0) {
    await sendMessage(chatId, "*Pending kuyrukları boş.* Bir sonraki cron tick'ini bekle (15 dk).");
    return;
  }
  const lines: string[] = [];
  lines.push(`📋 *Pending review:* ${review.length}`);
  lines.push(`🤖 *Pending auto:* ${auto.length}`);
  lines.push("");
  const top = review.slice(0, 10);
  for (const item of top) {
    const txt = item.tweet.text.replace(/[*_`[\]]/g, "").slice(0, 100);
    lines.push(`*${item.id}* · @${item.tweet.author} · score=${item.scoring.relevance_score} · ${item.scoring.sentiment}`);
    lines.push(`> ${txt}`);
    lines.push(`[link](${item.tweet.url})`);
    lines.push("");
  }
  if (review.length > 10) lines.push(`_+${review.length - 10} more…_`);
  await sendMessage(chatId, lines.join("\n"));
}

async function cmdStats(chatId: number) {
  const cost = loadCost();
  const today = new Date().toISOString().slice(0, 10);
  const todayCost = cost.daily[today];
  const review = loadPendingReview();
  const auto = loadPendingAuto();
  const sent = loadSent(1000);
  const todaySent = sent.filter((s) => s.sent_at.startsWith(today));
  const lines = [
    `📊 *Argus stats — ${today}*`,
    "",
    `Sent today: *${todaySent.length}* actions`,
    `  · likes: ${todaySent.filter((s) => s.action_type === "like").length}`,
    `  · replies: ${todaySent.filter((s) => s.action_type === "reply").length}`,
    "",
    `Pending review: *${review.length}*`,
    `Pending auto:   *${auto.length}*`,
    "",
    `Cost today: ${fmtMoney(todayCost?.total_usd ?? 0)}`,
    `  · x_search: ${todayCost?.x_search_calls ?? 0} calls · ${fmtMoney(todayCost?.x_search_cost_usd ?? 0)}`,
    `  · writes: ${todayCost?.writes ?? 0} · ${fmtMoney(todayCost?.write_cost_usd ?? 0)}`,
    "",
    `Cost this month: *${fmtMoney(cost.monthly_total_usd)}*`,
  ];
  await sendMessage(chatId, lines.join("\n"));
}

async function cmdPause(chatId: number) {
  try {
    execSync(`launchctl unload "${LAUNCHD_PLIST}"`, { stdio: "pipe" });
    await sendMessage(chatId, "⏸️ Argus monitor paused. `/resume` ile aç.");
    log("bot_pause", { user: chatId });
  } catch (e: any) {
    await sendMessage(chatId, `Failed to pause: \`${e?.message ?? e}\``);
  }
}

async function cmdResume(chatId: number) {
  try {
    execSync(`launchctl load "${LAUNCHD_PLIST}"`, { stdio: "pipe" });
    await sendMessage(chatId, "▶️ Argus monitor resumed (every 15 min).");
    log("bot_resume", { user: chatId });
  } catch (e: any) {
    await sendMessage(chatId, `Failed to resume: \`${e?.message ?? e}\``);
  }
}

async function cmdHelp(chatId: number) {
  await sendMessage(
    chatId,
    [
      "*Argus bot commands:*",
      "/pending — pending review kuyruğu",
      "/stats — günlük cost + queue + sent",
      "/cost — bugünkü + aylık fatura",
      "",
      "*Engage:*",
      "/approve <id> — review draft'ı engage et",
      "/edit <id> <new text> — draft güncelle, sonra approve",
      "/skip <id> — review'dan kaldır",
      "/auto-fire — pending_auto kuyruğunu hemen fire et",
      "",
      "*Learn:*",
      "/learn-status — son patch + kural değişiklikleri",
      "",
      "*Control:*",
      "/pause — monitor cron'u durdur",
      "/resume — monitor cron'u başlat",
      "/help — bu menü",
    ].join("\n"),
  );
}

async function cmdCost(chatId: number) {
  const cost = loadCost();
  const today = new Date().toISOString().slice(0, 10);
  const todayCost = cost.daily[today];
  // Last 7 days
  const last7 = Object.entries(cost.daily)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7);
  const lines = [
    `💰 *Argus cost*`,
    "",
    `Today: ${fmtMoney(todayCost?.total_usd ?? 0)}`,
    `  · x_search: ${fmtMoney(todayCost?.x_search_cost_usd ?? 0)} (${todayCost?.x_search_calls ?? 0} calls)`,
    `  · writes: ${fmtMoney(todayCost?.write_cost_usd ?? 0)} (${todayCost?.writes ?? 0})`,
    "",
    `*Last 7 days:*`,
  ];
  for (const [date, day] of last7) {
    lines.push(`  ${date}: ${fmtMoney(day.total_usd)}`);
  }
  lines.push("");
  lines.push(`Month-to-date: *${fmtMoney(cost.monthly_total_usd)}*`);
  await sendMessage(chatId, lines.join("\n"));
}

async function cmdApprove(chatId: number, args: string[]) {
  const id = args[0];
  if (!id) {
    await sendMessage(chatId, "Kullanım: `/approve <pending_id>`");
    return;
  }
  // Move from review → auto
  const review = loadPendingReview();
  const target = review.find((p) => p.id === id);
  if (!target) {
    await sendMessage(chatId, `Bulunamadı: \`${id}\``);
    return;
  }
  removeFromPending(id, "review");
  appendPendingAuto(target);
  await sendMessage(chatId, `✅ \`${id}\` → auto kuyruğuna geçti. Sıradaki cron tick'inde fire edilecek (veya \`/auto-fire\`).`);
  log("bot_approve", { user: chatId, id });
}

async function cmdEdit(chatId: number, args: string[]) {
  const id = args[0];
  const newText = args.slice(1).join(" ").trim();
  if (!id || !newText) {
    await sendMessage(chatId, "Kullanım: `/edit <pending_id> <new draft text>`");
    return;
  }
  const review = loadPendingReview();
  const idx = review.findIndex((p) => p.id === id);
  if (idx === -1) {
    await sendMessage(chatId, `Bulunamadı: \`${id}\``);
    return;
  }
  review[idx].draft_text = newText;
  writeFileSync(PENDING_REVIEW_PATH, JSON.stringify(review, null, 2) + "\n");
  log("bot_edit", { user: chatId, id });
  await sendMessage(chatId, `✏️ \`${id}\` güncellendi:\n> ${newText.slice(0, 200)}\n\nApprove etmek için: \`/approve ${id}\``);
}

async function cmdSkip(chatId: number, args: string[]) {
  const id = args[0];
  if (!id) {
    await sendMessage(chatId, "Kullanım: `/skip <pending_id>`");
    return;
  }
  removeFromPending(id, "review");
  removeFromPending(id, "auto");
  log("bot_skip", { user: chatId, id });
  await sendMessage(chatId, `🗑️ \`${id}\` kuyruktan kaldırıldı.`);
}

async function cmdAutoFire(chatId: number) {
  await sendMessage(chatId, "🚀 Auto-fire başlatılıyor...");
  try {
    const out = execSync(
      `cd /Users/macpro/code/claude-os && /Users/macpro/.bun/bin/bun run scripts/argus-engage.ts --batch 2>&1`,
      { encoding: "utf-8", timeout: 60_000 },
    );
    const tail = out.split("\n").slice(-15).join("\n");
    await sendMessage(chatId, `\`\`\`\n${tail}\n\`\`\``);
    log("bot_auto_fire", { user: chatId });
  } catch (e: any) {
    await sendMessage(chatId, `Auto-fire failed:\n\`\`\`\n${(e?.stdout ?? e?.message ?? e).toString().slice(-500)}\n\`\`\``);
  }
}

async function cmdLearnStatus(chatId: number) {
  const patchesDir = join(homedir(), ".hermes", "argus", "rules-patches");
  try {
    const files = (execSync(`ls -1t "${patchesDir}" 2>/dev/null || true`, { encoding: "utf-8" }))
      .split("\n")
      .filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      await sendMessage(chatId, "🧠 Henüz learn cycle çalışmadı. İlk run: yarın 06:00.");
      return;
    }
    const latest = files[0]!;
    const body = fsReadFile(join(patchesDir, latest), "utf-8");
    const head = body.split("\n").slice(0, 30).join("\n");
    await sendMessage(chatId, `🧠 *Son learn patch — ${latest}*\n\n\`\`\`\n${head.slice(0, 1800)}\n\`\`\``);
  } catch (e: any) {
    await sendMessage(chatId, `learn-status failed: ${e?.message}`);
  }
}

async function handleCommand(msg: any) {
  const userId = msg.from?.id;
  const chatId = msg.chat?.id;
  const text: string = (msg.text ?? "").trim();
  if (!chatId) return;
  if (!isAllowed(userId)) {
    log("bot_unauthorized", { user_id: userId, chat_id: chatId }, "warn");
    return; // silent ignore
  }

  const parts = text.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const cmdArgs = parts.slice(1);
  log("bot_cmd", { user_id: userId, cmd });

  switch (cmd) {
    case "/start":
    case "/help":
      await cmdHelp(chatId);
      break;
    case "/pending":
      await cmdPending(chatId);
      break;
    case "/stats":
      await cmdStats(chatId);
      break;
    case "/cost":
      await cmdCost(chatId);
      break;
    case "/approve":
      await cmdApprove(chatId, cmdArgs);
      break;
    case "/edit":
      await cmdEdit(chatId, cmdArgs);
      break;
    case "/skip":
      await cmdSkip(chatId, cmdArgs);
      break;
    case "/auto-fire":
    case "/autofire":
      await cmdAutoFire(chatId);
      break;
    case "/learn-status":
    case "/learnstatus":
      await cmdLearnStatus(chatId);
      break;
    case "/pause":
      await cmdPause(chatId);
      break;
    case "/resume":
      await cmdResume(chatId);
      break;
    default:
      await sendMessage(chatId, "Bilinmeyen komut. `/help` yaz.");
  }
}

// ── Long-poll loop ──────────────────────────────────────────────────
let lastUpdateId = 0;

async function pollOnce(): Promise<void> {
  const url = `${API}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const data: any = await res.json();
    if (!data?.ok) {
      log("bot_poll_err", { description: data?.description }, "error");
      await new Promise((r) => setTimeout(r, 5000));
      return;
    }
    for (const update of data.result ?? []) {
      lastUpdateId = update.update_id;
      if (update.message) {
        try {
          await handleCommand(update.message);
        } catch (e: any) {
          log("bot_handler_err", { error: e?.message }, "error");
        }
      }
    }
  } catch (e: any) {
    log("bot_fetch_err", { error: e?.message }, "warn");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

console.log(`[argus-bot] ready · allowed_user_id=${ALLOWED_USER_ID ?? "(any)"}`);
log("bot_start", { allowed_user_id: ALLOWED_USER_ID });

// Send a startup ping to ALLOWED_USER_ID if provided
if (ALLOWED_USER_ID) {
  try {
    await sendMessage(ALLOWED_USER_ID, "🤖 Argus bot online. `/help` ile başla.");
  } catch (e) {
    // Bot might not be allowed to DM until user has /start'd
  }
}

while (true) {
  await pollOnce();
}

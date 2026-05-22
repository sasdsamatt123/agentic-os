# Agentic OS

> The operator console for your AI agent stack. Local. Read-only. Dark.

A one-page dashboard that reads what's already on disk — Claude Code sessions, installed skills, memory files, vector indexes, scheduled tasks, subscriptions — and renders one scrollable view with token spend, skills ROI, a 3D memory graph, and a daily **Dream** review that prescribes the four highest-impact things to fix today.

Built for one operator. No accounts. No telemetry. No phone-home.

---

## What it shows

- **KPI strip** — Spent on AI (7d), Skills saved (invocations × minutes × hourly rate), Net ROI, plus an Operator Score pill.
- **Currently in** — the project the operator most recently worked in.
- **Subscriptions** — Claude · ChatGPT · OpenRouter · OpenClaw tiles with the ROI multiplier on each.
- **Usage panel** — 5h Claude window, ChatGPT window, live OpenRouter balance, model split (Opus / Sonnet / Haiku).
- **Skills + recommender** — most-used skills, last activation, recommendations for new skills based on repeated manual sequences.
- **Memory graph** — 3D force-graph across Obsidian, `~/.claude/projects/*/memory/`, and Pinecone indexes.
- **Integrations + vector indexes** — installed plugins, MCP servers, Pinecone indexes.
- **Automations** — scheduled Claude Code tasks (`~/.claude/tasks/`), launchd plists.
- **Agents** — JARVIS launcher (the voice + tool agent that lives inside [AgencyOS](https://github.com/sasdsamatt123/agencyos) at `localhost:3091`).
- **Dream panel** — four prescription cards (memory · cost · skills · workflow) with a runnable command on each.

The **Dream prescription engine** is the headline. Everything else is context.

---

## What it scans (all local)

| Source | Path / API |
|---|---|
| Session usage | `~/.claude/projects/**/*.jsonl` |
| Installed skills | `~/.claude/skills/*/SKILL.md` · `~/.claude/plugins/**/skills/*/SKILL.md` |
| Memory files | `~/.claude/CLAUDE.md` · project `CLAUDE.md` files · `~/.claude/projects/*/memory/` |
| Scheduled tasks | `~/.claude/tasks/` |
| Subscriptions | `~/.claude/credentials.json` + macOS Keychain · `~/.codex/auth.json` (JWT) · OPENROUTER env |
| MCP servers | `~/.claude.json` → `mcpServers` |
| Codex automations | `~/.codex/automations/*/automation.toml` |
| Cowork tasks | `~/Library/Application Support/Claude/local-agent-mode-sessions/.../scheduled-tasks.json` |
| Obsidian vaults | `~/Obsidian`, `~/Documents/Obsidian Vault`, `~/Documents/Obsidian`, `~/Desktop/Obsidian` (or `$OBSIDIAN_VAULT_PATH`) |
| Pinecone | `PINECONE_API_KEY` → `api.pinecone.io/indexes` |
| OpenRouter | `OPENROUTER_API_KEY` → live balance |

Only `scripts/aggregate.ts` reads source data. It writes to `src/data/live-data.json` (gitignored). The browser dashboard never touches `~/.claude/` directly.

---

## Quick start

```bash
bun install
bun run setup     # one-time: scan + install /dream skill + install launchd cron
bun run dev       # opens http://localhost:8081 with the wizard
```

`bun run setup` does:

1. Runs `scripts/aggregate.ts` against your disk
2. Copies `skills/dream/` → `~/.claude/skills/dream/`
3. Writes the launchd plist `~/Library/LaunchAgents/com.claude-os.dream.plist` (daily 07:00)
4. Drops `~/.claude-os/show-wizard` so the wizard auto-pops on first open
5. Reports which optional API keys would unlock more

If macOS asks for a Keychain password, that's macOS, not the app.

---

## Optional keys

Drop any of these into `.env.local` to unlock more:

| Key | Unlocks |
|---|---|
| `PINECONE_API_KEY` | Vector index counts + Pinecone nodes in the memory graph |
| `OPENROUTER_API_KEY` | Live OpenRouter PAYG balance + per-call burn rate |
| `ANTHROPIC_API_KEY` | Raw API mode (skip if using Claude Code OAuth) |
| `KIE_API_KEY` | OG card image generation (`scripts/gen-image.ts`) |
| `OBSIDIAN_VAULT_PATH` | Point at a non-default Obsidian vault |

Then re-run `bun run aggregate`. The dashboard's Refresh button picks it up live.

---

## JARVIS (AgencyOS bridge)

The `/agents/jarvis` route is a launcher for [JARVIS](https://github.com/sasdsamatt123/agencyos) — a Gemini Live voice agent with 96 MCP tools (lead scraping, CRM pipeline, project workspaces, automations, ops briefings). It lives inside the AgencyOS Vite app at `http://localhost:3091/#map`. The Agentic OS page shows status + a launch button — the agent itself runs in its own app.

---

## Dream

Every morning at 07:00, the launchd cron runs:

```
cd ~/code/claude-os && bun run aggregate ; claude -p "/dream"
```

The `/dream` skill (installed by setup at `~/.claude/skills/dream/SKILL.md`) reads the last 24h of activity across eight signal buckets:

1. Conversation mining — manual task repeated 3+ times → suggest a skill
2. Cost intelligence — Opus prices for Haiku-grade work, cache-miss rates
3. Skill performance — stale skills, missing skills
4. Memory health — stale files, missing workspaces, conflicting type frontmatter
5. Session hygiene — context rot, repeated prompts
6. Workflow patterns — tool-call sequences that should be one keystroke
7. External opportunity — new tools/models that fit the operator
8. Business outcomes — Skills × time-saved × hourly rate vs. token spend

It writes the four highest-impact prescriptions to `~/.claude-os/dreams/dream-{date}.json`. The dashboard's Dream panel renders them as cards with a "Run this fix →" button.

Cost: roughly $1.50–$3.00 per Dream run (Claude Code subscription, not a separate API key).

To trigger an on-demand Dream right now:

```bash
cd ~/code/claude-os && bun run aggregate && claude -p "/dream"
```

To remove the cron:

```bash
bun run uninstall-dream
```

---

## Argus (optional, 24/7 X engagement agent)

A self-tuning agent that watches X for mentions / hashtags / accounts /
keywords you care about, drafts replies in your voice, and (when you opt
in) fires them via the X API. Runs every 30 min, tracks engagement over
24h windows, auto-tunes its rules using a Karpathy-style autoresearch
loop.

```bash
bun run install-argus
```

The wizard asks 5 questions (sector preset, your X handle, active hours,
optional Telegram bot, watchlist), then installs 5 launchd jobs and a
dashboard panel at `/argus`.

Default mode is **draft-only** (~$14/mo for `x_search`). Auto-fire needs
an X Developer app + xurl (~$20–30/mo total). Full guide:
[`docs/ARGUS.md`](docs/ARGUS.md).

---

## Daily commands

```bash
bun run dev               # dashboard at http://localhost:8081
bun run aggregate         # re-scan and refresh live-data.json
bun run build             # production build
bun run install-dream     # install daily Dream cron
bun run uninstall-dream   # remove cron
bun run install-argus     # install 24/7 X engagement agent
bun run uninstall-argus   # remove all 5 Argus cron jobs
```

---

## Privacy

- `live-data.json` is gitignored. It never leaves the machine.
- Anonymization is on by default (`CLAUDE_OS_ANONYMIZE=1`) — the macOS username is rewritten to "operator" and emails are redacted in the rendered data. To see raw, set `CLAUDE_OS_ANONYMIZE=0`.
- The aggregator only calls Pinecone / OpenRouter / api.openai.com/auth if their respective keys are set. Nothing else phones home.
- Dream LLM calls go through Claude Code's existing OAuth — no new credentials needed.

---

## Stack

TanStack Start · Vite · React 19 · Tailwind v4 (OKLCH, CSS-first) · shadcn/ui (new-york, slate) · Geist Sans + Geist Mono Variable · react-force-graph-3d · Recharts · canvas-confetti · Bun runtime.

# Argus — 24/7 X engagement agent

Argus is an optional Agentic OS subsystem: a self-tuning agent that watches X
(Twitter) for mentions / hashtags / accounts / keywords you care about,
drafts replies in your voice, and (when you opt in) fires them via the X
API. It runs every 30 min on your machine, tracks engagement over 24h
windows, and auto-tunes its own rules using a Karpathy-style autoresearch
loop.

## TL;DR

```
bun run install-argus
```

The wizard asks you 5 questions (sector preset, X handle, active hours,
optional Telegram bot, watchlist), writes config to `config/` and
`~/.hermes/argus/`, and installs 5 launchd jobs.

Default mode is **draft-only**: Argus drafts replies into a queue you can
review on the `/argus` dashboard. To enable auto-fire, set up an X
Developer app + xurl (steps below).

---

## Architecture

```
~/.hermes/argus/  ← state, logs, learning patches
       ▲
       │
   ┌───┴───┐     ┌───────┐     ┌───────┐    ┌───────┐
   │monitor│ ──▶ │engage │ ──▶ │ track │ ──▶│ learn │
   │  30m  │     │  30m  │     │  1h   │    │ daily │
   └───┬───┘     └───────┘     └───────┘    └───┬───┘
       │                                        │
       ▼                                        ▼
  pending_review.json                  rules-patches/{date}.md
  pending_auto.json                    (audit log)
  sent.json
```

| Cron | What it does |
|---|---|
| **monitor** (30 min) | Grok-4.20 + `x_search` → relevance score + sentiment + draft reply. Drafts → pending_review or pending_auto per rules. |
| **engage** (30 min) | Drains `pending_auto.json` via xurl. Hard ceiling + active hours + rate limit. Tags each fired action with an `experiment_id`. |
| **track** (hourly) | For sent items 24h+ old: fetch public_metrics + follow_delta, compute composite score, mark `finalized=true`. |
| **learn** (daily 06:00) | 7-day window of finalized items → group + score by template/hour/author/sentiment → propose patches → apply safe ones → audit log. |
| **telegram** (daemon) | Long-poll Telegram bot for `/pending`, `/approve`, `/cost`, `/learn-status`, `/pause`. |

---

## Three modes

| Mode | What works | What you need | Approx cost/month |
|---|---|---|---|
| **Draft-only** | monitor + dashboard + telegram. No xurl, no auto-fire. | xAI account (X Premium gives you Grok subscription quota; `x_search` is metered separately at $5/1000 calls) | ~$14 |
| **Auto-fire** | + engage + track + learn close the loop | X Developer app + xurl OAuth + pay-per-use credit | +$5–15 |
| **No-go** | (always disabled by Argus) Original posts. `auto_post_rules.enabled=false` is locked. | — | — |

---

## Setup

### Prerequisites

- macOS (Linux is supported but you wire up cron by hand — see
  `scripts/install-argus-cron.ts --help`)
- [Bun](https://bun.sh)
- An xAI / X Premium account for Grok access (or `hermes auth add xai-oauth`)
- Optional: X Developer app + xurl (for auto-fire mode only)
- Optional: a dedicated Telegram bot (for approval UI)

### Run the wizard

```
bun run install-argus
```

Pick:

1. **Sector preset** — ai-builder / indie-hacker / community-mgr / blank
2. **Your X handle(s)** — comma-separated; auto-prefixed with `@`
3. **Active hours** — replies only fire inside this window
4. **Telegram bot** — paste token + user ID, or skip
5. **Review defaults** — accept the sector preset's hashtags/accounts/keywords,
   or edit them now (you can also edit `config/argus-watchlist.json`
   later)

The wizard writes:

- `config/argus-watchlist.json` (gitignored)
- `~/.hermes/argus/argus-program.md` — your voice + hard constraints
- `~/.hermes/pantheon/personas/argus.yaml`
- `~/.hermes/.env` — Telegram vars (if provided)
- 5 plists in `~/Library/LaunchAgents/com.argus.*`

### Enable auto-fire (optional)

```
# 1. X Developer app (one-time)
#    developer.x.com → Create app "Argus Engagement"
#    OAuth 2.0 PKCE, callback http://127.0.0.1:8080/callback
#    scopes: tweet.read tweet.write users.read like.write offline.access
#    Generate Client ID + Secret, add $5 pay-per-use credit

# 2. Install xurl
curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash

# 3. OAuth flow
xurl auth oauth2 --app argus --client-id=<CID> --client-secret=<CSEC>

# 4. Flip auto rules on (edit config/argus-watchlist.json)
#    auto_like_rules.enabled: true
#    auto_reply_rules.enabled: true
```

---

## The autoresearch loop

Argus' learning cycle is patterned after [Karpathy's autoresearch
loop](https://github.com/karpathy/autoresearch): hypothesis → fixed-window
experiment → metric eval → keep/discard → iterate.

Every reply Argus fires is tagged with an `experiment_id` capturing its
features:

- `template` (which reply pattern)
- `posted_hour`
- `author` of the source tweet
- `sentiment` of the source
- `watch_category` (mention vs hashtag vs account vs keyword)
- `draft_length`
- `had_url`

24h later, `argus-track.ts` finalizes the post with `public_metrics +
follow_delta`, computing the composite:

```
composite = like × 0.3 + reply × 0.4 + follow_delta × 0.3
```

Each night at 06:00, `argus-learn.ts`:

1. Loads the last 7 days of finalized items
2. Z-normalizes composites (so a great Tuesday doesn't dominate a slow Sunday)
3. Groups by each feature dimension; finds winners (>+1σ) and losers (<−1σ)
4. Translates verdicts into patches: tighter `active_hours`, promoted
   templates, narrowed sentiment whitelist, etc.
5. Applies safe patches to `config/argus-watchlist.json` and appends a
   "Learning patch" block to your `argus.yaml` persona
6. Writes the digest to `~/.hermes/argus/rules-patches/{YYYY-MM-DD}.md` —
   your audit log

### Safety net: what the learner can't do

`~/.hermes/argus/argus-program.md` is the **first** thing every learn
cycle reads. It defines hard constraints the safety filter enforces:

- `auto_post_rules.enabled` stays `false`. Argus never originates posts.
- `hard_ceilings.daily_total_actions` can only be lowered, never raised.
- Hostile / spam sentiment cannot enter any reply whitelist.
- `exclude_url_replies` cannot become `false` (URL replies are 13× more
  expensive — you decide manually when to spend).
- `active_hours` cannot exceed `07:00-23:00` (community-mgr defaults to
  tighter).
- No reply to threads >2 deep.

Edit `argus-program.md` to add/remove constraints. The learner re-reads
it every cycle.

---

## Cost transparency

Default settings (30 min polling, ai-builder preset):

| Bucket | Per call | Calls/day | $/month |
|---|---|---|---|
| `x_search` (monitor) | $0.005 | ~250 | ~$14 |
| `tweets.write` (engage, text-only) | $0.015 | up to 60 | up to $27 |
| `tweets.write` (engage, with URL) | **$0.20** | blocked by default | $0 |
| `users/likes` | $0.015 | up to 50 | up to $22 |
| Owned reads (track) | $0.001 | ~60 | ~$2 |

Track cost in real-time:
- Dashboard `/argus` → Cost Today card
- Telegram: `/cost`
- File: `~/.hermes/argus/cost.json`

Cap your spend with `auto_rules.hard_ceilings.daily_total_actions`. The
learner cannot raise it.

---

## Troubleshooting

### "xurl not authenticated" on engage cron

You're in draft-only mode. Either set up xurl (see "Enable auto-fire"), or
ignore — engage will silently `exit(2)` and the rest of the pipeline keeps
running.

### `launchctl list | grep argus` shows only some jobs

```
bun run scripts/install-argus-cron.ts --only monitor   # reinstall one
bun run uninstall-argus && bun run install-argus       # nuke + reinstall all
```

### Cron isn't firing

Check the log:
```
tail -f ~/.hermes/argus/monitor-cron.log
tail -f ~/.hermes/argus/log.jsonl   # structured event log
```

### Telegram bot doesn't respond

The bot sleeps if `ARGUS_TELEGRAM_BOT_TOKEN` is missing in `~/.hermes/.env`.
Append the token + reload:
```
launchctl unload ~/Library/LaunchAgents/com.argus.telegram.plist
launchctl load   ~/Library/LaunchAgents/com.argus.telegram.plist
```

### Rule patches feel wrong

```
ls ~/.hermes/argus/rules-patches/
# Each file is the day's audit log. To undo the last apply:
cp config/argus-watchlist.json.bak config/argus-watchlist.json
```

Then revisit `argus-program.md` to tighten what the learner is allowed to
touch.

---

## What Argus doesn't do

- **Original posts.** Never. (Hard constraint.)
- **Browser automation.** API-only. No Playwright.
- **DMs.** Not in scope yet.
- **Cross-account scaling.** One Argus instance = one X identity. To run
  it for multiple accounts, repeat the wizard with different
  `ARGUS_XURL_APP=<label>` (advanced).

---

## File map

```
scripts/argus.ts                  xAI x_search wrapper (reads ~/.hermes/auth.json)
scripts/argus-monitor.ts          read pipeline (cron)
scripts/argus-engage.ts           write pipeline via xurl (cron)
scripts/argus-track.ts            24h metric collector (cron)
scripts/argus-learn.ts            daily autoresearch loop (cron)
scripts/argus-telegram-bot.ts     long-poll approval UI (daemon)
scripts/install-argus.ts          interactive setup wizard
scripts/install-argus-cron.ts     plist generator
scripts/lib/argus-state.ts        state file helpers
scripts/lib/argus-watchlist.ts    config loader
scripts/lib/argus-rules.ts        rule engine
scripts/lib/argus-metrics.ts      composite scoring + autoresearch verdicts
scripts/lib/xurl-client.ts        X API v2 subprocess wrapper
src/routes/argus.tsx              dashboard panel
config/argus-watchlist.*.example.json   sector presets
templates/argus/argus-program.*.example.md
templates/argus/argus-persona.example.yaml
~/.hermes/argus/                  state, logs, rules-patches (your machine)
~/Library/LaunchAgents/com.argus.* 5 launchd jobs (your machine)
```

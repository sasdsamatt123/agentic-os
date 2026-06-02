# Changelog

## V2.3 port — Documents Gallery + Mission Control — 2 Jun 2026

Ported from **Jack Roberts' ClaudeOS [Hermes] V2.3**. Credit to Jack — these
two features and their server middleware are his design; we adapted them onto
this fork. (See LICENSE / NOTICE for attribution terms.)

### Added

- **Documents Gallery** (`src/components/hermes-documents-gallery.tsx`) — a
  live, file-system-backed view of `~/Documents/Hermes/` on the Hermes page,
  between Skills and the CLI cheatsheet. Type filtering, search, recency
  grouping, in-dashboard preview modal, soft-delete to `.trash/` with Undo,
  trash restore, and an "Install Prompt" modal that teaches Hermes to save
  artefacts here with proper metadata. 10 engraved file-type placeholder cards.
  Backend: `/__hermes_documents` vite middleware (list / file-stream / delete /
  restore / trash) with a **symlink-escape guard** (`realpathSync`/`lstatSync`),
  `createReadStream` streaming, a 1000-entry cap, and a `parseDocMeta` cache.

- **Mission Control** (`src/components/hermes-mission-control.tsx`) — long-term
  goal planning on the home page: give a mid-term goal, Hermes breaks it into
  4–10 sequenced mini-goals you complete. Backend: `/__hermes_missions` vite
  middleware persisting to `~/.hermes/missions.json` (`GET` active mission,
  `POST /optimize` shelling `hermes chat`, `POST /create`, `/tick`, `/clear`).

### Fixed

- **DreamCarousel clipping on long prescriptions** — `md:h-[440px]` →
  `md:min-h-[440px]` so the bottom controls stay reachable.
- **Hardcoded "7am daily" copy** — replaced with "on your configured cron
  schedule" so the Dream status text is accurate.

### Not ported (diverged source)

- V2.3's pricing-via-OAuth (`/api/oauth/usage` + Keychain), sessions cap
  20→200, and daily-activity-real-counts fixes target V2.3's `scripts/
  aggregate.ts`, which has diverged substantially in this fork (different auth
  detection + emit shape). Skipped to avoid breaking the fork's aggregator;
  can be revisited as a dedicated change.

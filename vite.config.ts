import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// Per-run secret used to gate /__refresh_data. The dev server writes it once
// at boot, the dashboard reads it via /__token, and includes it as a header
// on the refresh POST. A drive-by request from a malicious browser tab or
// extension cannot guess it. Rotated every dev-server start.
const REFRESH_TOKEN = randomBytes(32).toString("hex");
// Write the token to a tmp file so the same-origin browser fetch can read it
// only once at app boot (the file is short-lived, mode 0600).
const TOKEN_DIR = join(homedir(), ".claude-os");
const TOKEN_FILE = join(TOKEN_DIR, "dev-token");
try {
  if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, REFRESH_TOKEN, { mode: 0o600 });
} catch {
  /* non-fatal — the endpoint just won't accept refreshes */
}

// Reject any socket whose remote isn't 127.0.0.1 / ::1. Belt-and-braces
// alongside server.host = "127.0.0.1" — even if a future config change
// re-exposes the dev server, the privileged endpoints stay loopback-only.
function isLoopback(req: { socket?: { remoteAddress?: string | null } }): boolean {
  const a = req.socket?.remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
//
// Port 8081 is hardcoded in scripts/server.ts CORS allowlist and the README — if a fresh
// user lands on the preset's default 8080, the sidecar refuses CORS and "Activate now" /
// "Run this fix" silently fail. Override here, with strictPort so a port collision fails
// loudly instead of drifting to 8082.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "claude-os-live-data",
        configureServer(server) {
          // GET /__live-data — serves live-data.json fresh from disk on every
          // request.  This replaces the static `import liveData from "…"`
          // pattern so the browser always gets the latest aggregator output
          // without a server restart.
          server.middlewares.use("/__live-data", (req, res, next) => {
            if (req.method !== "GET") return next();
            try {
              const filePath = resolve(__dirname, "src/data/live-data.json");
              const raw = readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(raw);
            } catch {
              // Fall back to example file on fresh clones
              try {
                const fallback = resolve(__dirname, "src/data/live-data.example.json");
                const raw = readFileSync(fallback, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(raw);
              } catch {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "No live-data.json found" }));
              }
            }
          });

          // GET /__just-installed — true the first time after `bun run setup`,
          // false thereafter. Setup writes ~/.claude-os/show-wizard; this
          // endpoint reads + deletes it so the dashboard force-opens the
          // wizard once even if the browser has stale claude-os-config from
          // a prior install.
          server.middlewares.use("/__just-installed", (req, res, next) => {
            if (req.method !== "GET") return next();
            const marker = join(homedir(), ".claude-os", "show-wizard");
            let justInstalled = false;
            try {
              if (existsSync(marker)) {
                justInstalled = true;
                unlinkSync(marker);
              }
            } catch {
              /* ignore */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ justInstalled }));
          });

          // GET /__token — hands the per-run refresh token to the dashboard
          // so it can authenticate /__refresh_data. Loopback-only and must
          // match the local file's contents (which only the user account
          // can read), so a browser extension on another origin can't get
          // it. Rotated every dev-server boot.
          server.middlewares.use("/__token", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ token: REFRESH_TOKEN }));
          });

          // POST /__refresh_data — re-runs the aggregator. Locked down to
          // (a) loopback origin only, and (b) a per-run token in the
          // X-Claude-OS-Token header. Any drive-by request from another
          // origin or extension is rejected with 403. Without this, every
          // tab on localhost:8081 could trigger a full machine scan that
          // reads ~/.claude/, decodes JWTs, and runs `security
          // dump-keychain`.
          server.middlewares.use("/__refresh_data", (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method not allowed");
              return;
            }
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            const provided = req.headers["x-claude-os-token"];
            if (provided !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "invalid token" }));
              return;
            }
            try {
              const root = resolve(__dirname);
              execSync("bun run scripts/aggregate.ts", {
                cwd: root,
                stdio: "pipe",
                timeout: 30000,
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
        },
      },
    ],
    server: {
      // Bind to loopback only. The dev server scans private user data
      // (~/.claude/, keychain, JWTs) so it must never be reachable from
      // another machine on the LAN. 127.0.0.1 forces same-host only.
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
      // Exclude live-data.json from the file watcher. The aggregator writes
      // this file during the wizard (Steps 2 and 7). Without this exclusion,
      // Vite triggers HMR on every write, which re-mounts route components,
      // destroys React state, and creates infinite scan/activate loops.
      // The app reads the file at import time; hot-reloading it mid-wizard
      // is actively harmful.
      watch: { ignored: ["**/src/data/live-data.json"] },
    },
  },
});

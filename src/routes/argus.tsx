import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  Activity,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Hash,
  AtSign,
  User,
  Search,
  Pause,
  Play,
  Brain,
  TrendingUp,
  Award,
} from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/argus")({
  component: ArgusPage,
});

const ACTION_TONE: Record<string, string> = {
  auto_like: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  auto_reply: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  draft_only: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const SENTIMENT_TONE: Record<string, string> = {
  friendly: "text-emerald-400",
  question: "text-cyan-400",
  opportunity: "text-amber-400",
  neutral: "text-zinc-400",
  hostile: "text-red-400",
  spam: "text-red-500",
};

function formatRelative(ts: string | undefined): string {
  if (!ts) return "—";
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const dt = Date.now() - t;
  if (dt < 60_000) return `${Math.round(dt / 1000)}s ago`;
  if (dt < 3600_000) return `${Math.round(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.round(dt / 3600_000)}h ago`;
  return `${Math.round(dt / 86_400_000)}d ago`;
}

function fmtMoney(n: number | undefined | null): string {
  if (n === undefined || n === null) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function ArgusPage() {
  const data = useLiveData();
  const argus = data?.argus;

  if (!argus || !argus.enabled) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="Argus" description="24/7 X engagement agent — not yet running." />
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {argus?.reason ? (
            <p>
              Argus state not found:{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{argus.reason}</code>
            </p>
          ) : (
            <p>
              Argus monitor hasn't run yet.{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bun run scripts/argus-monitor.ts
              </code>{" "}
              ile başlat.
            </p>
          )}
        </div>
      </div>
    );
  }

  const counts = argus.counts ?? {};
  const cost = argus.cost ?? {};
  const wl = argus.watchlist;
  const topReview = Array.isArray(argus.top_review) ? argus.top_review : [];
  const recentSent = Array.isArray(argus.recent_sent) ? argus.recent_sent : [];
  const learning = argus.learning ?? { patches: [], latest_digest: null };
  const leaderboards = argus.leaderboards ?? { templates: [], best_hours: [], top_authors: [] };
  const cronJobs = argus.cron_jobs ?? {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Argus"
        description={
          <span>
            24/7 X engagement agent · Grok-4.20 via xai-oauth ·{" "}
            <span className={argus.cron_loaded ? "text-emerald-400" : "text-amber-400"}>
              cron {argus.cron_loaded ? "running" : "paused"}
            </span>
            {argus.last_run_at && (
              <>
                {" · last run "}
                <span className="tabular-nums">{formatRelative(argus.last_run_at)}</span>
              </>
            )}
          </span>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Pending Review"
          value={counts.review ?? 0}
          hint="manuel onay bekliyor"
          icon={Eye}
          tone="warn"
        />
        <StatCard
          label="Auto Queue"
          value={counts.auto ?? 0}
          hint="Faz 2: xurl fire"
          icon={Activity}
          tone="good"
        />
        <StatCard
          label="Sent Today"
          value={counts.sent_today ?? 0}
          hint={`${counts.sent_total ?? 0} total · ${wl?.hard_ceiling ?? 60} ceiling`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Cost Today"
          value={fmtMoney(cost.today?.total_usd)}
          hint={`${cost.today?.x_search_calls ?? 0} x_search · ay ${fmtMoney(cost.month_total_usd)}`}
          icon={DollarSign}
        />
      </div>

      {/* Watchlist Summary */}
      {wl && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Search className="h-4 w-4" /> Watchlist
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              every {wl.polling_minutes}m · {argus.batches_seen ?? 0} batches seen
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AtSign className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-muted-foreground">Mentions:</span>
              <span className="font-medium tabular-nums">{wl.mentions}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-muted-foreground">Hashtags:</span>
              <span className="font-medium tabular-nums">{wl.hashtags}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-muted-foreground">Accounts:</span>
              <span className="font-medium tabular-nums">{wl.accounts}</span>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-muted-foreground">Keywords:</span>
              <span className="font-medium tabular-nums">{wl.keywords}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              {wl.auto_like_enabled ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <Pause className="h-3 w-3 text-zinc-500" />
              )}
              auto-like {wl.auto_like_enabled ? "on" : "off"}
            </span>
            <span className="flex items-center gap-1">
              {wl.auto_reply_enabled ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <Pause className="h-3 w-3 text-zinc-500" />
              )}
              auto-reply {wl.auto_reply_enabled ? "on" : "off"}
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-400" />
              hard ceiling {wl.hard_ceiling}/day
            </span>
          </div>
        </div>
      )}

      {/* Autoresearch — Learning + Leaderboards */}
      {(learning.latest_digest || (leaderboards.templates?.length ?? 0) > 0) && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Latest learn digest */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Brain className="h-4 w-4 text-cyan-400" /> Learning
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {learning.patches?.length ?? 0} patch(es) on disk
              </span>
            </div>
            {learning.latest_digest ? (
              <>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Latest cycle: <span className="font-mono">{learning.latest_digest.date}</span>
                </div>
                <pre className="text-[10.5px] leading-snug whitespace-pre-wrap text-muted-foreground/90 font-mono bg-muted/30 rounded p-2 max-h-72 overflow-y-auto">
                  {learning.latest_digest.excerpt}
                </pre>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Henüz learn cycle çalışmadı. Daily 06:00 cron · ilk run için ≥6 finalized post gerekli.
              </p>
            )}
          </div>

          {/* Leaderboards */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Leaderboards
              </h2>
              <span className="text-[11px] text-muted-foreground">
                composite = like×0.3 + reply×0.4 + Δfollow×0.3
              </span>
            </div>
            {(leaderboards.templates?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Yeterli finalized data yok. Track cron (saatlik) 24h+ post için metrik toplar.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Award className="h-3 w-3" /> Templates
                  </div>
                  <ul className="text-xs space-y-1">
                    {leaderboards.templates.slice(0, 5).map((t: any) => (
                      <li key={t.key} className="flex items-center justify-between">
                        <code className="font-mono text-[11px]">{t.key}</code>
                        <span className="tabular-nums text-muted-foreground">
                          {t.avg_composite.toFixed(2)} · n={t.n}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {(leaderboards.best_hours?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Best hours (UTC)
                    </div>
                    <ul className="text-xs space-y-1">
                      {leaderboards.best_hours.slice(0, 5).map((h: any) => (
                        <li key={h.key} className="flex items-center justify-between">
                          <span className="font-mono">{h.key}:00</span>
                          <span className="tabular-nums text-muted-foreground">
                            {h.avg_composite.toFixed(2)} · n={h.n}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(leaderboards.top_authors?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Top ROI authors
                    </div>
                    <ul className="text-xs space-y-1">
                      {leaderboards.top_authors.slice(0, 5).map((a: any) => (
                        <li key={a.key} className="flex items-center justify-between">
                          <span>@{a.key}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {a.avg_composite.toFixed(2)} · n={a.n}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cron job grid */}
      {Object.keys(cronJobs).length > 0 && (
        <div className="mt-4 rounded-lg border border-border/60 bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Cron jobs
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
            {Object.entries(cronJobs).map(([label, on]) => (
              <div key={label} className="flex items-center gap-1.5">
                {on ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Pause className="h-3 w-3 text-zinc-500" />
                )}
                <code className="font-mono text-muted-foreground">{label.replace("com.argus.", "")}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Review Drafts */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Eye className="h-4 w-4" /> Top Drafts (review queue)
          </h2>
          <span className="text-xs text-muted-foreground">
            top 12 of {counts.review ?? 0}
          </span>
        </div>
        {topReview.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground text-center">
            Review kuyruğu boş — sıradaki cron tick'i bekle.
          </div>
        ) : (
          <div className="space-y-3">
            {topReview.map((d: any) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border tabular-nums",
                        ACTION_TONE[d.action] ?? "bg-muted",
                      )}
                    >
                      {d.scoring?.relevance_score ?? "?"}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] uppercase tracking-wider",
                        SENTIMENT_TONE[d.scoring?.sentiment] ?? "text-muted-foreground",
                      )}
                    >
                      {d.scoring?.sentiment}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {d.action}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatRelative(d.tweet?.created_at)}
                  </div>
                </div>

                <div className="text-sm mb-2">
                  <a
                    href={d.tweet?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground hover:text-cyan-400 inline-flex items-center gap-1"
                  >
                    @{d.tweet?.author}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-xs text-muted-foreground italic mb-2 line-clamp-3">
                  {d.tweet?.text}
                </div>

                {d.draft_text && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
                      Argus draft
                    </div>
                    <div className="text-xs text-foreground/90 leading-relaxed">
                      {d.draft_text}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {d.watch_id} · {d.reason}
                  </span>
                  <span className="text-muted-foreground/60">
                    id: <code className="font-mono">{d.id}</code>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sent */}
      {recentSent.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Recent Sent
            </h2>
            <span className="text-xs text-muted-foreground">{counts.sent_total ?? 0} total</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <ul className="divide-y divide-border/60 text-xs">
              {recentSent.map((s: any, i: number) => (
                <li key={s.id ?? i} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider",
                        s.action_type === "like" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400",
                      )}
                    >
                      {s.action_type}
                    </span>
                    <a
                      href={s.reply_url ?? `https://x.com/i/web/status/${s.tweet_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-cyan-400 inline-flex items-center gap-1 font-mono text-[11px]"
                    >
                      {s.tweet_id?.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="tabular-nums">{fmtMoney(s.cost_usd)}</span>
                    <span>{formatRelative(s.sent_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Footer status */}
      <div className="mt-6 text-[11px] text-muted-foreground text-center space-y-1">
        <div>
          Argus state: <code>~/.hermes/argus/</code> · Cron:{" "}
          {argus.cron_loaded ? (
            <span className="text-emerald-400">
              <Play className="h-3 w-3 inline" /> loaded
            </span>
          ) : (
            <span className="text-amber-400">
              <Pause className="h-3 w-3 inline" /> not loaded
            </span>
          )}{" "}
          · {wl?.polling_minutes ?? 30}m interval
        </div>
        <div>
          Faz 2+3 ready: engage + track + learn cron'ları yüklü. xurl auth + Telegram bot token bekliyor.
        </div>
      </div>
    </div>
  );
}

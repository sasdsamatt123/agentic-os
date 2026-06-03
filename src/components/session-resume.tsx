import { useMemo, useState, type ReactNode } from "react";
import { useLiveData } from "@/lib/use-live-data";
import { Copy, Check, ChevronDown, ChevronRight, FolderGit2, Terminal, FileText, GitCommit, SquareTerminal, MessageSquare } from "lucide-react";

/**
 * SessionResume — "Devam Et" panel. Every past Claude Code session, grouped by
 * project, with a rich summary (what was asked, what was done, where it left
 * off) and a copy button for `claude --resume <id>` so you continue it in
 * whatever terminal you're already in.
 *
 * Data (from the aggregator): runs[].{sessionId, projKey, summary, lastUserPrompt,
 * lastStage, files, commandsRun, gitCommits, messages, model, duration, started}.
 */
export function SessionResume() {
  const ld = useLiveData() as any;
  const runs: any[] = Array.isArray(ld?.runs) ? ld.runs : [];
  const projects: any[] = Array.isArray(ld?.recentProjects) ? ld.recentProjects : [];

  const { ordered, nameByKey } = useMemo(() => {
    const nameByKey = new Map<string, string>();
    for (const p of projects) if (p?.key) nameByKey.set(p.key, p.displayName || p.key);
    const groups = new Map<string, any[]>();
    for (const r of runs) {
      const k = r.projKey || "?";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const ordered = [...groups.entries()].sort(
      (a, b) => (b[1][0]?.startedAt || "").localeCompare(a[1][0]?.startedAt || ""),
    );
    return { ordered, nameByKey };
  }, [runs, projects]);

  if (runs.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card mb-6">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-tight">Devam Et — geçmiş session'lar</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">{runs.length} son session</span>
      </div>
      <div className="divide-y divide-border/60">
        {ordered.map(([key, sessions]) => (
          <ProjectGroup key={key} name={nameByKey.get(key) ?? key} sessions={sessions} />
        ))}
      </div>
      <div className="px-5 py-2.5 text-[10.5px] text-muted-foreground border-t border-border/60">
        Komutu kopyala → çalıştığın terminale yapıştır (Cursor, Terminal, neredeysen). Session'lar artık silinmiyor (3650 gün) + günlük yedekleniyor.
      </div>
    </section>
  );
}

function ProjectGroup({ name, sessions }: { name: string; sessions: any[] }) {
  const [open, setOpen] = useState(sessions.length <= 4);
  const folder = name.split("/").filter(Boolean).pop() || name;
  return (
    <div className="px-5 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left group">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FolderGit2 className="h-3.5 w-3.5 text-amber-400/80" />
        <span className="text-[13px] font-medium group-hover:text-foreground">{folder}</span>
        <span className="text-[10.5px] text-muted-foreground truncate">{name}</span>
        <span className="ml-auto text-[10.5px] text-muted-foreground tabular-nums">{sessions.length}</span>
      </button>
      {open && (
        <ul className="mt-2.5 ml-1 space-y-2.5">
          {sessions.map((s) => (
            <SessionCard key={s.sessionId} session={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: any }) {
  const [copied, setCopied] = useState(false);
  const [showStage, setShowStage] = useState(false);
  const id: string = session.sessionId;
  const ask: string =
    session.summary && session.summary !== "(no prompt captured)"
      ? cleanPrompt(session.summary)
      : session.slashCommand || "(başlıksız session)";
  const lastStage: string = (session.lastStage || "").trim();
  const lastAsk: string = cleanPrompt(session.lastUserPrompt || "");
  const files: string[] = Array.isArray(session.files) ? session.files : [];

  function copy() {
    navigator.clipboard?.writeText(`claude --resume ${id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <li className="rounded-md border border-border/70 bg-background/40 p-3">
      {/* Ask + copy */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-foreground/90 leading-snug line-clamp-2">{ask}</div>
        </div>
        <button
          onClick={copy}
          title="claude --resume komutunu kopyala"
          className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 text-[10.5px] border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "kopyalandı" : "Komutu kopyala"}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
        <span className="tabular-nums">{session.started}</span>
        {session.duration && session.duration !== "—" && <span>· {session.duration}</span>}
        {session.model && <span className="text-muted-foreground/80">· {shortModel(session.model)}</span>}
        {!!session.messages && <Stat icon={<MessageSquare className="h-3 w-3" />} n={session.messages} />}
        {!!session.filesTouched && <Stat icon={<FileText className="h-3 w-3" />} n={session.filesTouched} />}
        {!!session.commandsRun && <Stat icon={<SquareTerminal className="h-3 w-3" />} n={session.commandsRun} />}
        {!!session.gitCommits && <Stat icon={<GitCommit className="h-3 w-3" />} n={session.gitCommits} />}
      </div>

      {/* Last stage — where it left off */}
      {lastStage && (
        <div className="mt-2 rounded border border-border/60 bg-card/60 p-2">
          <div className="text-[9.5px] uppercase tracking-wider text-amber-400/80 mb-1">Son aşama — kaldığı yer</div>
          <div className={`text-[11.5px] text-muted-foreground leading-relaxed ${showStage ? "" : "line-clamp-3"}`}>
            {lastStage}
          </div>
          {lastStage.length > 180 && (
            <button onClick={() => setShowStage((v) => !v)} className="mt-1 text-[10px] text-amber-400/70 hover:text-amber-300">
              {showStage ? "daha az" : "devamını gör"}
            </button>
          )}
        </div>
      )}

      {/* Last instruction */}
      {lastAsk && lastAsk !== ask && (
        <div className="mt-1.5 text-[11px] text-muted-foreground/80">
          <span className="text-muted-foreground/60">son komut:</span> {lastAsk.slice(0, 120)}
        </div>
      )}

      {/* Files touched */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {files.slice(0, 8).map((f) => (
            <span key={f} className="inline-flex items-center rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              {basename(f)}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function Stat({ icon, n }: { icon: ReactNode; n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      {icon}
      {n}
    </span>
  );
}

function cleanPrompt(s: string): string {
  // Strip Claude Code's command wrapper tags for a readable line.
  return (s || "")
    .replace(/<command-(name|message|args)>[^<]*<\/command-\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() || p;
}
function shortModel(m: string): string {
  if (/opus/i.test(m)) return "Opus";
  if (/sonnet/i.test(m)) return "Sonnet";
  if (/haiku/i.test(m)) return "Haiku";
  return m.split("-").slice(0, 2).join("-");
}

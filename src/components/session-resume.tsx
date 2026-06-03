import { useMemo, useState } from "react";
import { useLiveData } from "@/lib/use-live-data";
import { Play, Copy, Check, ChevronDown, ChevronRight, FolderGit2, Terminal } from "lucide-react";

/**
 * SessionResume — "Devam Et" panel. Lists past Claude Code sessions grouped by
 * project so you can reopen any of them. "Devam et" POSTs to /__resume_session
 * (the dev-server middleware de-anonymises the cwd and opens a Terminal running
 * `claude --resume <id>`). "Kopyala" copies the command to run yourself.
 *
 * Data: ld.runs (recent sessions: sessionId, projKey, summary, started) +
 * ld.recentProjects (key → displayName + real cwd).
 */
export function SessionResume() {
  const ld = useLiveData() as any;
  const runs: any[] = Array.isArray(ld?.runs) ? ld.runs : [];
  const projects: any[] = Array.isArray(ld?.recentProjects) ? ld.recentProjects : [];

  const { ordered, cwdByKey, nameByKey } = useMemo(() => {
    const cwdByKey = new Map<string, string>();
    const nameByKey = new Map<string, string>();
    for (const p of projects) {
      if (!p?.key) continue;
      cwdByKey.set(p.key, p.cwd || "");
      nameByKey.set(p.key, p.displayName || p.key);
    }
    const groups = new Map<string, any[]>();
    for (const r of runs) {
      const k = r.projKey || "?";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const ordered = [...groups.entries()].sort(
      (a, b) => (b[1][0]?.startedAt || "").localeCompare(a[1][0]?.startedAt || ""),
    );
    return { ordered, cwdByKey, nameByKey };
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
          <ProjectGroup
            key={key}
            name={nameByKey.get(key) ?? key}
            cwd={cwdByKey.get(key) ?? ""}
            sessions={sessions}
          />
        ))}
      </div>
      <div className="px-5 py-2.5 text-[10.5px] text-muted-foreground border-t border-border/60">
        "Devam et" Terminal'i proje klasöründe açıp <code>claude --resume</code> çalıştırır · session'lar artık silinmiyor (cleanupPeriodDays 3650) + günlük yedekleniyor
      </div>
    </section>
  );
}

function ProjectGroup({ name, cwd, sessions }: { name: string; cwd: string; sessions: any[] }) {
  const [open, setOpen] = useState(sessions.length <= 3);
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
        <ul className="mt-2 ml-5 space-y-1.5">
          {sessions.map((s) => (
            <SessionRow key={s.sessionId} session={s} cwd={cwd} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({ session, cwd }: { session: any; cwd: string }) {
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const id: string = session.sessionId;
  const summary: string = session.summary && session.summary !== "(no prompt captured)" ? session.summary : "(başlıksız session)";

  async function resume() {
    try {
      const r = await fetch("/__resume_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cwd }),
      });
      if (r.ok) {
        setOpened(true);
        setTimeout(() => setOpened(false), 2500);
      }
    } catch {
      /* dev-server only */
    }
  }

  function copy() {
    navigator.clipboard?.writeText(`claude --resume ${id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <li className="flex items-center gap-2 group">
      <span className="flex-1 min-w-0 text-[12px] text-muted-foreground truncate group-hover:text-foreground/90">
        {summary}
      </span>
      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{session.started}</span>
      <button
        onClick={resume}
        title="Terminal'de aç + devam et"
        className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
      >
        {opened ? <Check className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {opened ? "açıldı" : "Devam et"}
      </button>
      <button
        onClick={copy}
        title="claude --resume komutunu kopyala"
        className="shrink-0 inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </li>
  );
}

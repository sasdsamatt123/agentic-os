import { useEffect, useMemo, useState } from "react";
import { useLiveData } from "@/lib/use-live-data";
import { Play, Copy, Check, ChevronDown, ChevronRight, FolderGit2, Terminal } from "lucide-react";

/**
 * SessionResume — "Devam Et" panel. Lists past Claude Code sessions grouped by
 * project so you can reopen any of them, into the target you actually work in:
 *   - Cursor  → opens the folder in Cursor + copies `claude --resume <id>` so
 *               you paste it into Cursor's integrated terminal (no foreign window)
 *   - Terminal/iTerm → opens that app and runs the command
 *   - Kopyala → just copies the command
 * Backend: /__resume_session + /__resume_targets (dev-server middleware).
 */
const TARGET_KEY = "claude-os.resume-target.v1";
const TARGET_LABEL: Record<string, string> = {
  cursor: "Cursor",
  terminal: "Terminal",
  iterm: "iTerm",
  copy: "Kopyala",
};

export function SessionResume() {
  const ld = useLiveData() as any;
  const runs: any[] = Array.isArray(ld?.runs) ? ld.runs : [];
  const projects: any[] = Array.isArray(ld?.recentProjects) ? ld.recentProjects : [];

  const [targets, setTargets] = useState<string[]>(["copy", "terminal"]);
  const [target, setTarget] = useState<string>("terminal");

  useEffect(() => {
    fetch("/__resume_targets")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.targets) return;
        setTargets(j.targets);
        const saved = (() => { try { return localStorage.getItem(TARGET_KEY); } catch { return null; } })();
        const pref = saved && j.targets.includes(saved) ? saved : j.targets.includes("cursor") ? "cursor" : "terminal";
        setTarget(pref);
      })
      .catch(() => {});
  }, []);

  function pickTarget(t: string) {
    setTarget(t);
    try { localStorage.setItem(TARGET_KEY, t); } catch {}
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-tight">Devam Et — geçmiş session'lar</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Aç:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {targets.map((t) => (
              <button
                key={t}
                onClick={() => pickTarget(t)}
                className={`px-2.5 py-1 text-[11px] transition-colors ${
                  target === t ? "bg-amber-500/15 text-amber-300" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TARGET_LABEL[t] ?? t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {ordered.map(([key, sessions]) => (
          <ProjectGroup key={key} name={nameByKey.get(key) ?? key} cwd={cwdByKey.get(key) ?? ""} sessions={sessions} target={target} />
        ))}
      </div>
      <div className="px-5 py-2.5 text-[10.5px] text-muted-foreground border-t border-border/60">
        {target === "cursor"
          ? "Cursor'da klasör açılır + komut kopyalanır — entegre terminale Cmd+V yapıştır."
          : target === "copy"
            ? "claude --resume komutu panoya kopyalanır — istediğin terminale yapıştır."
            : `${TARGET_LABEL[target] ?? target} açılıp claude --resume otomatik çalışır.`}{" "}
        Session'lar artık silinmiyor (3650 gün) + günlük yedekleniyor.
      </div>
    </section>
  );
}

function ProjectGroup({ name, cwd, sessions, target }: { name: string; cwd: string; sessions: any[]; target: string }) {
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
            <SessionRow key={s.sessionId} session={s} cwd={cwd} target={target} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({ session, cwd, target }: { session: any; cwd: string; target: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const id: string = session.sessionId;
  const summary: string =
    session.summary && session.summary !== "(no prompt captured)" ? session.summary : "(başlıksız session)";

  async function resume() {
    try {
      const r = await fetch("/__resume_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cwd, target }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.copy && j?.cmd) {
        try { await navigator.clipboard.writeText(j.cmd); } catch {}
      }
      setFeedback(
        j?.opened === "cursor" ? "Cursor + kopyalandı" : j?.opened ? "açıldı" : j?.copy ? "kopyalandı" : "ok",
      );
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      // dev-server only — fall back to copying
      try { await navigator.clipboard.writeText(`claude --resume ${id}`); setFeedback("kopyalandı"); setTimeout(() => setFeedback(null), 2000); } catch {}
    }
  }

  return (
    <li className="flex items-center gap-2 group">
      <span className="flex-1 min-w-0 text-[12px] text-muted-foreground truncate group-hover:text-foreground/90">{summary}</span>
      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{session.started}</span>
      <button
        onClick={resume}
        title={`${id} → ${TARGET_LABEL[target] ?? target}`}
        className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
      >
        {feedback ? <Check className="h-3 w-3" /> : target === "copy" ? <Copy className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {feedback ?? "Devam et"}
      </button>
    </li>
  );
}

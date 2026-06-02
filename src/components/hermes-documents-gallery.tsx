/**
 * HermesDocumentsGallery — visual gallery of artefacts produced through
 * the Hermes stack (invoices, HTML overviews, images, markdown drops,
 * exported PDFs, video clips). Source folder: ~/Documents/Hermes/.
 *
 * Backend: GET /__hermes_documents (list), GET /__hermes_documents/file
 * (stream one for preview), DELETE /__hermes_documents (remove from
 * disk). All loopback-only, defined in vite.config.ts.
 *
 * Visual language: matches the Hermes-page system exactly — sharp 0px
 * borders, deep teal background, cream foreground, mono labels in
 * Courier Prime with `▎` glyph kicker, Fraunces serif for the section
 * head, amber halo on the active filter chip.
 *
 * Live updates: polls every 5 seconds so anything dropped into the
 * folder appears in the gallery without a manual refresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileCode2,
  Trash2,
  X,
  Folder,
  RefreshCw,
  Film,
  Music,
  Archive as ArchiveIcon,
  FileJson,
  FileType2,
  File as FileGeneric,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Hermes-style placeholder art — one per non-image file type. Generated
// by scripts/gen-hermes-file-type-art.ts via kie.ai (nano-banana-2),
// 19th-century engraving aesthetic matching the Pantheon series.
// PNGs are 6-9MB; the webps shipped here are ~60-120KB each.
import artPdf from "@/assets/hermes-art/file-types/pdf.webp";
import artHtml from "@/assets/hermes-art/file-types/html.webp";
import artMarkdown from "@/assets/hermes-art/file-types/markdown.webp";
import artText from "@/assets/hermes-art/file-types/text.webp";
import artData from "@/assets/hermes-art/file-types/data.webp";
import artVideo from "@/assets/hermes-art/file-types/video.webp";
import artAudio from "@/assets/hermes-art/file-types/audio.webp";
import artArchive from "@/assets/hermes-art/file-types/archive.webp";
import artCode from "@/assets/hermes-art/file-types/code.webp";
import artOther from "@/assets/hermes-art/file-types/other.webp";

// type-key → Hermes engraving placeholder. Images get real thumbs from
// disk so they don't need one; every other type has a matching engraving.
const TYPE_PLACEHOLDER: Record<string, string | undefined> = {
  pdf: artPdf,
  html: artHtml,
  markdown: artMarkdown,
  text: artText,
  data: artData,
  video: artVideo,
  audio: artAudio,
  archive: artArchive,
  code: artCode,
  other: artOther,
};

interface Doc {
  name: string;
  type: string; // image | pdf | html | markdown | text | data | video | audio | archive | code | other
  ext: string;
  sizeBytes: number;
  modifiedMs: number;
  // Title + description are populated by the backend metadata parser
  // (see parseDocMeta in vite.config.ts). Either may be null when the
  // file doesn't embed them — the card falls back to a humanized
  // filename + a generic per-type blurb in that case.
  title: string | null;
  description: string | null;
}

interface DocsResponse {
  folder: string;
  items: Doc[];
  // Count of items in ~/Documents/Hermes/.trash/ — populated by the
  // backend so the frontend can conditionally render the Trash link
  // without an extra round trip.
  trashCount: number;
}

// One entry in the trash modal. trashId is the on-disk filename inside
// .trash/ ({timestamp}__{originalName}), used for restore/purge.
interface TrashItem {
  trashId: string;
  originalName: string;
  deletedMs: number;
  sizeBytes: number;
}

interface TrashResponse {
  items: TrashItem[];
}

const CREAM = "#FFE6CB";

// Module-level stacking counter for body scroll lock. Three modals can
// be open simultaneously (preview + trash + install-prompt would be
// pathological but possible); per-modal snapshot/restore races if they
// close out of order — the second-to-close restores an "unlocked"
// snapshot taken before the first one mounted, leaving the page locked
// forever. A single counter keyed on mounts makes the lock idempotent:
// first mount locks, last unmount restores.
let __scrollLockCount = 0;
let __scrollLockPrevOverflow = "";
let __scrollLockPrevPadding = "";

function lockBodyScroll(): void {
  if (__scrollLockCount === 0) {
    __scrollLockPrevOverflow = document.body.style.overflow;
    __scrollLockPrevPadding = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  __scrollLockCount += 1;
}

function unlockBodyScroll(): void {
  __scrollLockCount = Math.max(0, __scrollLockCount - 1);
  if (__scrollLockCount === 0) {
    document.body.style.overflow = __scrollLockPrevOverflow;
    document.body.style.paddingRight = __scrollLockPrevPadding;
  }
}

// Hook wrapper so the three modals each have one line for scroll lock.
function useBodyScrollLock(): void {
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);
}

// Default visible-card cap. Anything beyond this collapses behind a
// "Show all N" toggle so a 24-file gallery doesn't blow out the page.
// Picked to fit cleanly on the grid breakpoints (3 cols × 4 rows on lg,
// 4 cols × 3 rows on xl).
const DEFAULT_VISIBLE = 12;

// The exact prompt a new operator pastes into their Hermes agent so it
// starts writing every artefact into ~/Documents/Hermes/. Lives in the
// component (not a separate doc) so the gallery itself is the onboarding
// surface — install Hermes, open the gallery, copy this, paste it.
const HERMES_GALLERY_PROMPT = `From now on, save artefacts you generate FOR ME into ~/Documents/Hermes/ so they show up in my Documents gallery.

WHEN TO SAVE HERE
  ✓ HTML overviews, decks, reports, invoices
  ✓ PDFs (generated or downloaded for me to read)
  ✓ Markdown notes, digests, summaries
  ✓ Generated images — charts, diagrams, portraits, exports
  ✓ Audio/video clips you produced or recorded
  ✓ JSON/CSV/YAML exports of structured data I asked you to surface
  ✓ Anything I'd want to see, share, preview, or revisit later

WHEN NOT TO SAVE HERE
  ✗ Files that belong inside a project — if you're working in a GitHub repo or codebase, write to that repo's directory, NOT here
  ✗ Build artifacts, dist/, node_modules/, generated lockfiles
  ✗ Temp/scratch/working copies — keep those in /tmp or alongside the source
  ✗ Logs, dumps, traces, telemetry — those go in ~/.hermes/log/
  ✗ System files (.DS_Store, .env, anything starting with a dot)
  ✗ Source code for an active project — that goes in the project's own folder

The litmus test: "would I want to see this in my Documents gallery?" Yes → save here. It's plumbing or in-progress project work? → save in the project's own folder.

NAMING
Descriptive kebab-case filenames with the client or topic and an ISO date when relevant. Examples:
  invoice-2026-005-acme-studio.html
  weekly-notes-2026-w22.md
  hermes-architecture-overview.html

Every file must embed two pieces of metadata so my gallery can display it cleanly:
  • title — five words MAX, the human name of the document
  • description — fifteen words MAX, one sentence of what it is

Embed them per file type as follows. This is non-negotiable, the gallery reads these:

HTML  →  inside <head>, add:
           <meta name="hermes-title" content="Acme Studio Invoice 005" />
           <meta name="hermes-description" content="May retainer invoice for Acme Studio covering Hermes deployment and skill development work." />

Markdown  →  YAML frontmatter as the first thing in the file:
           ---
           title: Weekly Notes W22
           description: Friday snapshot of what shipped, open threads, and memory candidates for next week.
           ---

JSON  →  add a top-level "_hermes" block (preserve all your real keys alongside it):
           {
             "_hermes": {
               "title": "Acme Studio Config",
               "description": "Routing rules, billing terms, and Hermes preferences for the Acme Studio retainer."
             },
             "client": "Acme Studio Ltd.",
             ...
           }

Plain text  →  first line is the title, second line is the description, then a blank line, then the body.

Code files (.ts, .py, etc.)  →  first comment line is the title, second is the description.

Why: this folder powers my Documents gallery in Claude OS. Files appear there within 5 seconds of you writing them. Without the title + description fields the cards fall back to filenames, which is ugly.

Never write outside ~/Documents/Hermes/ unless I explicitly ask. Never delete files in there without confirming.`;

// Type → icon + accent colour. Same palette family as the rest of the
// Hermes page (cream + amber for primary, cool blues for code/data,
// soft greens for media). Keeps the gallery feeling like it belongs.
const TYPE_META: Record<string, { Icon: typeof FileText; tint: string; label: string }> = {
  image: { Icon: ImageIcon, tint: "#FFD21E", label: "Image" },
  pdf: { Icon: FileType2, tint: "#FF8C5A", label: "PDF" },
  html: { Icon: FileCode2, tint: "#86efac", label: "HTML" },
  markdown: { Icon: FileText, tint: "#FFD21E", label: "Markdown" },
  text: { Icon: FileText, tint: "rgba(255,230,203,0.75)", label: "Text" },
  data: { Icon: FileJson, tint: "#60a5fa", label: "Data" },
  video: { Icon: Film, tint: "#f472b6", label: "Video" },
  audio: { Icon: Music, tint: "#a78bfa", label: "Audio" },
  archive: { Icon: ArchiveIcon, tint: "#fbbf24", label: "Archive" },
  code: { Icon: FileCode2, tint: "#34d399", label: "Code" },
  other: { Icon: FileGeneric, tint: "rgba(255,230,203,0.5)", label: "File" },
};

function metaFor(type: string) {
  return TYPE_META[type] ?? TYPE_META.other;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fmtAgo(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return "just now";
  if (delta < 3600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3600_000)}h ago`;
  if (delta < 7 * 86_400_000) return `${Math.round(delta / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Strip the extension + transform kebab/snake to title case. Used only
// when the file didn't embed a hermes-title — better than showing the
// raw filename, but a real embedded title always wins.
function humanizeFilename(name: string): string {
  const noExt = name.replace(/\.[^.]+$/, "");
  const words = noExt
    .replace(/[-_]+/g, " ")
    .replace(/\b(\d{4})(\d{2})(\d{2})\b/g, "$1-$2-$3") // re-hyphenate dates
    .split(" ")
    .filter(Boolean);
  return words
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Per-type fallback description, used when the file didn't embed one.
// Kept generic and short — it's strictly worse than a real description
// but better than empty space under the title.
const TYPE_FALLBACK_DESC: Record<string, string> = {
  image: "An image saved to your Hermes documents folder.",
  pdf: "A PDF document — preview to view, arrow to open externally.",
  html: "An HTML document — preview to render inside the dashboard.",
  markdown: "A markdown note — preview to read inline.",
  text: "A plain text file — preview to read inline.",
  data: "A structured data file (JSON, YAML, CSV).",
  video: "A video clip — preview to play inline.",
  audio: "An audio clip — preview to play inline.",
  archive: "A compressed archive — open externally to extract.",
  code: "A source code file — preview to read.",
  other: "A file saved to your Hermes documents folder.",
};

// Bucket a timestamp into one of four labels used by the recency grouping.
function recencyBucket(ms: number): "today" | "yesterday" | "thisWeek" | "earlier" {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfThisWeek = startOfToday - 6 * 86_400_000;
  if (ms >= startOfToday) return "today";
  if (ms >= startOfYesterday) return "yesterday";
  if (ms >= startOfThisWeek) return "thisWeek";
  return "earlier";
}

const RECENCY_LABEL: Record<ReturnType<typeof recencyBucket>, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  earlier: "Earlier",
};

// Group items by recency in the canonical order. Used only when there
// are enough items to warrant the structure (>6).
function groupByRecency(items: Doc[]): Array<{ key: ReturnType<typeof recencyBucket>; label: string; items: Doc[] }> {
  const buckets: Record<ReturnType<typeof recencyBucket>, Doc[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };
  for (const it of items) buckets[recencyBucket(it.modifiedMs)].push(it);
  return (Object.keys(buckets) as Array<keyof typeof buckets>)
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, label: RECENCY_LABEL[k], items: buckets[k] }));
}

function useHermesDocuments() {
  return useQuery<DocsResponse>({
    queryKey: ["hermes-documents"],
    queryFn: async () => {
      const r = await fetch("/__hermes_documents");
      if (!r.ok) throw new Error(`status ${r.status}`);
      return (await r.json()) as DocsResponse;
    },
    // Live updates — polls every 5s. Cheap (single readdir + stats),
    // matches the cadence of the rest of the Hermes-page panels.
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

export function HermesDocumentsGallery() {
  const { data, isLoading, error, refetch } = useHermesDocuments();
  const queryClient = useQueryClient();
  const items = data?.items ?? [];
  const folder = data?.folder ?? "~/Documents/Hermes";
  const trashCount = data?.trashCount ?? 0;

  // Filter state: "all" or one of the type keys. Only show chips for
  // types actually present in the current gallery — no dead filters.
  const [filter, setFilter] = useState<string>("all");
  const presentTypes = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.type);
    return Array.from(set).sort();
  }, [items]);

  // Live search — filters across title, description, filename, type,
  // and extension. Empty query = no search filter applied.
  const [search, setSearch] = useState("");
  const searchActive = search.trim().length > 0;

  const visible = useMemo(() => {
    let list = filter === "all" ? items : items.filter((d) => d.type === filter);
    if (searchActive) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => {
        const hay = [
          d.name,
          d.type,
          d.ext,
          d.title ?? "",
          d.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [items, filter, search, searchActive]);

  // Preview overlay state.
  const [previewing, setPreviewing] = useState<Doc | null>(null);

  // Show all cards vs cap at DEFAULT_VISIBLE. Reset whenever the filter
  // or search changes so the cap behaviour is predictable.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [filter, search]);

  // Install-prompt modal. Opt-in via the header chip — no longer pops
  // up automatically. The empty state still nudges installers toward
  // it ("Click 'Install prompt' above to teach Hermes").
  const [promptOpen, setPromptOpen] = useState(false);

  // Trash modal. Opens via the "Trash · N" chip, only shown when
  // trashCount > 0. Operator can restore or permanently delete from
  // there; auto-closes when the trash is emptied.
  const [trashOpen, setTrashOpen] = useState(false);

  // Manual refresh button — invalidates the query immediately so the
  // 5s polling cadence doesn't keep the operator waiting after they
  // drop a file in.
  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["hermes-documents"] });
  };

  // Undo-toast state. Holds the most-recently-soft-deleted file and
  // the trashId the backend returned, so the toast's Undo button knows
  // which trash entry to restore. Null = no toast showing.
  const [undoToast, setUndoToast] = useState<
    { doc: Doc; trashId: string } | null
  >(null);

  // Delete flow: no confirm dialog — the file is soft-deleted (moved
  // to .trash/) so the operator can always recover via the Undo toast
  // within the window, or directly from .trash/ after. Optimistic UI
  // removes the card before the server replies; rollback on failure.
  const handleDelete = async (doc: Doc) => {
    queryClient.setQueryData<DocsResponse | undefined>(
      ["hermes-documents"],
      (cur) => (cur ? { ...cur, items: cur.items.filter((d) => d.name !== doc.name) } : cur),
    );
    if (previewing?.name === doc.name) setPreviewing(null);
    try {
      const r = await fetch(
        `/__hermes_documents?name=${encodeURIComponent(doc.name)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error(`status ${r.status}`);
      const body = (await r.json()) as { ok: boolean; trashId?: string };
      if (body.trashId) {
        // Replace any prior toast — keeping only the most recent
        // undoable action avoids stacking and matches the Linear/Gmail
        // pattern operators already know.
        setUndoToast({ doc, trashId: body.trashId });
      }
    } catch {
      // Rollback by refetching real state.
      void refetch();
      alert(`Could not delete "${doc.name}". The file may be locked or the disk is read-only.`);
    }
  };

  // Undo handler — calls the restore endpoint, dismisses the toast,
  // and refetches so the (possibly renamed) restored file appears in
  // the gallery. Tolerates double-clicks by no-op'ing without a toast.
  // useCallback so the identity is stable — UndoDeleteToast depends
  // on this in a useEffect and a re-created closure would tear down
  // and rebuild its setInterval on every parent render (~10×/s),
  // resetting the countdown's closed-over `start`.
  const handleUndo = useCallback(async () => {
    if (!undoToast) return;
    const { trashId } = undoToast;
    setUndoToast(null); // optimistic — assume restore succeeds
    try {
      const r = await fetch(
        `/__hermes_documents/restore?trashId=${encodeURIComponent(trashId)}`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(`status ${r.status}`);
      void refetch();
    } catch {
      alert(
        `Could not restore the file. You can recover it manually from ~/Documents/Hermes/.trash/`,
      );
    }
  }, [undoToast, refetch]);

  // Stable identity for the toast's onDismiss prop — same reason as
  // handleUndo above. Without useCallback this is a new arrow per
  // render, which thrashes the toast's countdown interval.
  const dismissUndoToast = useCallback(() => setUndoToast(null), []);

  return (
    <section className="mb-12">
      {/* Section header — mirrors the rest of the Hermes page exactly. */}
      <div
        className="px-1 pb-3 mb-4 flex items-end justify-between border-b gap-4"
        style={{ borderColor: "rgba(255,230,203,0.55)" }}
      >
        <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
          <h2
            className="hermes-display leading-none"
            style={{ color: CREAM, fontSize: "26px", letterSpacing: "0.01em" }}
          >
            Documents
          </h2>
          <span
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5"
            style={{ color: "rgba(255,230,203,0.6)" }}
          >
            <Folder className="h-3 w-3" />
            <code style={{ fontFamily: "inherit", background: "none", padding: 0 }}>
              {folder.replace(/^\/Users\/[^/]+/, "~")}
            </code>
            <span style={{ color: "rgba(255,230,203,0.35)" }}>·</span>
            <span>
              {items.length} {items.length === 1 ? "file" : "files"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Install Prompt — discreet chip. Opens a centered modal
              with the full prompt + extension rules. Replaces the
              previous gargantuan top block. */}
          <button
            type="button"
            onClick={() => setPromptOpen(true)}
            className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
            style={{
              background: "transparent",
              color: "#FFB347",
              borderColor: "rgba(255,179,71,0.45)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#FFB347";
              e.currentTarget.style.background = "rgba(255,179,71,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,179,71,0.45)";
              e.currentTarget.style.background = "transparent";
            }}
            title="Show the prompt to paste into your Hermes agent"
          >
            Install prompt
          </button>
          {trashCount > 0 && (
            <button
              type="button"
              onClick={() => setTrashOpen(true)}
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,230,203,0.65)",
                borderColor: "rgba(255,230,203,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fca5a5";
                e.currentTarget.style.borderColor = "rgba(252,165,165,0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,230,203,0.65)";
                e.currentTarget.style.borderColor = "rgba(255,230,203,0.3)";
              }}
              title="Open the trash to restore or permanently delete"
            >
              <Trash2 className="h-3 w-3" /> Trash · {trashCount}
            </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
            style={{
              background: "transparent",
              color: "rgba(255,230,203,0.65)",
              borderColor: "rgba(255,230,203,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = CREAM;
              e.currentTarget.style.borderColor = "rgba(255,230,203,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,230,203,0.65)";
              e.currentTarget.style.borderColor = "rgba(255,230,203,0.3)";
            }}
            title="Re-scan the folder now"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats strip — live answer to "what am I producing?". When the
          gallery is empty, fall back to the original explanatory blurb
          so first-time installers still get the orientation. */}
      <GalleryStatsStrip items={items} />

      {/* Filter row — type chips on the left, search input on the
          right. The chips are tooltipped with their extension list
          so '.txt vs .md' is never a mystery. */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {presentTypes.length > 1 && (
            <>
              <FilterChip
                label={`All · ${items.length}`}
                active={filter === "all"}
                onClick={() => setFilter("all")}
                tint={CREAM}
                title="Show every file regardless of type"
              />
              {presentTypes.map((t) => {
                const count = items.filter((d) => d.type === t).length;
                const meta = metaFor(t);
                const exts = extsForType(t);
                const tip = exts.length
                  ? `${meta.label} · ${exts.map((e) => `.${e}`).join(" ")}`
                  : meta.label;
                return (
                  <FilterChip
                    key={t}
                    label={`${meta.label} · ${count}`}
                    active={filter === t}
                    onClick={() => setFilter(t)}
                    tint={meta.tint}
                    title={tip}
                  />
                );
              })}
            </>
          )}
          {/* Search — flex-grow pushes the input to fill the rest of
              the row. Matches the filter-chip border treatment so it
              feels like part of the same control group. */}
          <div
            className="ml-auto flex items-center gap-1.5 border px-2 py-1 min-w-[220px] flex-grow max-w-md transition-colors"
            style={{
              background: "rgba(0,0,0,0.32)",
              borderColor: searchActive
                ? "rgba(255,179,71,0.55)"
                : "rgba(255,230,203,0.25)",
            }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{
                color: searchActive ? "#FFB347" : "rgba(255,230,203,0.55)",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, filename…"
              className="hermes-mono flex-1 bg-transparent outline-none text-[11px] tracking-[0.04em]"
              style={{
                color: CREAM,
                fontFamily: '"Courier Prime", "Courier New", monospace',
              }}
              aria-label="Search documents"
            />
            {searchActive && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 flex items-center justify-center h-5 w-5 transition-colors"
                style={{ color: "rgba(255,230,203,0.65)" }}
                aria-label="Clear search"
                title="Clear search"
                onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,230,203,0.65)")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body — grid of cards. Empty / loading / error states are
          handled inline so the section never collapses to nothing. */}
      {isLoading ? (
        <GalleryEmpty
          title="Reading the folder…"
          body="One moment."
        />
      ) : error ? (
        <GalleryEmpty
          title="Couldn't read the folder"
          body="The /__hermes_documents endpoint didn't respond. Restart the dev server if needed."
          tone="warn"
        />
      ) : visible.length === 0 ? (
        items.length === 0 ? (
          <GalleryEmpty
            title="Nothing here yet"
            body={`Drop a file into ${folder} and it'll appear within 5 seconds. To teach Hermes to write here automatically, hit "Install prompt" above.`}
          />
        ) : (
          <GalleryEmpty
            title="No files match this filter"
            body="Switch back to All, or pick a different type."
          />
        )
      ) : (
        (() => {
          // Responsive multi-row grid (1/2/3/4/5 cols by breakpoint).
          // Layers:
          //   1. cap visible cards at DEFAULT_VISIBLE; reveal the rest
          //      behind a "Show all N" button
          //   2. when >6 items and no active search, render under
          //      recency-bucket headers (Today / Yesterday / This week
          //      / Earlier) so the wall of cards becomes a story
          //   3. when search is active, force flat — categories stop
          //      helping once the operator is looking for one file
          const totalShown = expanded
            ? visible.length
            : Math.min(visible.length, DEFAULT_VISIBLE);
          const sliced = visible.slice(0, totalShown);
          const overflow = visible.length - DEFAULT_VISIBLE;
          const useGroups = !searchActive && visible.length > 6;
          const groups = useGroups ? groupByRecency(sliced) : null;

          return (
            <>
              {groups ? (
                <div className="flex flex-col gap-6">
                  {groups.map((g) => (
                    <RecencyGroup
                      key={g.key}
                      label={g.label}
                      items={g.items}
                      onPreview={setPreviewing}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ) : (
                <DocGrid
                  items={sliced}
                  onPreview={setPreviewing}
                  onDelete={handleDelete}
                />
              )}
              {overflow > 0 && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="hermes-mono inline-flex items-center gap-2 px-4 py-2 border text-[10.5px] uppercase tracking-[0.2em] transition-colors"
                    style={{
                      background: "rgba(0,0,0,0.32)",
                      color: CREAM,
                      borderColor: "rgba(255,230,203,0.45)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = CREAM;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,230,203,0.45)";
                    }}
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Collapse · show {DEFAULT_VISIBLE} of {visible.length}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Show all {visible.length} · {overflow} more
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          );
        })()
      )}

      {previewing && (
        <PreviewOverlay
          doc={previewing}
          onClose={() => setPreviewing(null)}
          onDelete={() => handleDelete(previewing)}
        />
      )}

      {promptOpen && (
        <InstallPromptModal onClose={() => setPromptOpen(false)} />
      )}

      {trashOpen && (
        <TrashModal
          onClose={() => setTrashOpen(false)}
          onChange={() => {
            // Restore + permanent-delete actions inside the modal
            // mutate the underlying folder state — invalidate the
            // main list so the gallery + trashCount stay in sync.
            void queryClient.invalidateQueries({ queryKey: ["hermes-documents"] });
          }}
        />
      )}

      {undoToast && (
        <UndoDeleteToast
          key={undoToast.trashId}
          doc={undoToast.doc}
          onUndo={handleUndo}
          onDismiss={dismissUndoToast}
        />
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Subcomponents

/**
 * Stats strip — one line summarising what's in the folder. Live-computed
 * from the items list so it stays accurate as files come and go. When
 * empty, falls back to the explanatory blurb so first-time installers
 * get the orientation.
 */
function GalleryStatsStrip({ items }: { items: Doc[] }) {
  if (items.length === 0) {
    return (
      <div
        className="text-[14px] leading-relaxed mt-1 mb-5 max-w-3xl"
        style={{ color: "rgba(255,230,203,0.82)", fontFamily: '"Fraunces", serif' }}
      >
        Anything saved to{" "}
        <span className="hermes-mono" style={{ color: CREAM, fontSize: "12.5px" }}>
          ~/Documents/Hermes/
        </span>{" "}
        appears here within 5 seconds. Click any card to preview inside the
        dashboard, hit the arrow to open in a new tab, or hover and click
        the trash icon to delete.
      </div>
    );
  }

  const totalBytes = items.reduce((s, i) => s + i.sizeBytes, 0);
  // Per-type counts, ordered by count desc so the most-produced types
  // come first. Falls back to alpha when counts tie.
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  const breakdown = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, n]) => `${n} ${metaFor(type).label}${n === 1 ? "" : "s"}`);

  return (
    <div
      className="hermes-mono text-[11.5px] mt-1 mb-5 flex flex-wrap items-center gap-x-2 gap-y-1"
      style={{ color: "rgba(255,230,203,0.78)", letterSpacing: "0.05em" }}
    >
      <span style={{ color: CREAM }}>
        {items.length} {items.length === 1 ? "file" : "files"}
      </span>
      <span style={{ color: "rgba(255,230,203,0.3)" }}>·</span>
      <span>{fmtBytes(totalBytes)} total</span>
      {breakdown.length > 0 && (
        <>
          <span style={{ color: "rgba(255,230,203,0.3)" }}>·</span>
          {breakdown.map((label, idx) => (
            <span key={label}>
              {label}
              {idx < breakdown.length - 1 && (
                <span style={{ color: "rgba(255,230,203,0.3)" }}>, </span>
              )}
            </span>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Undo-delete toast. Bottom-centre, auto-dismisses after 8 seconds.
 * Pauses the countdown on hover so the operator has time to read +
 * decide. Pressing Undo restores the file via the /restore endpoint.
 * Pressing × commits (the file stays in .trash/ — still recoverable
 * manually from Finder, just not via the in-app button).
 */
const UNDO_TOAST_MS = 8000;

function UndoDeleteToast({
  doc,
  onUndo,
  onDismiss,
}: {
  doc: Doc;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(UNDO_TOAST_MS);
  const [paused, setPaused] = useState(false);
  // Refs so the single setInterval below can read the latest paused
  // state and call the latest onDismiss without ever needing to be
  // re-created. This is the fix for the bug where the previous
  // implementation tore down + rebuilt the interval whenever paused
  // toggled or onDismiss got a fresh closure identity (~10×/s during
  // a parent re-render storm).
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Countdown tick — one interval, lives for the toast's lifetime.
  // Decrement is driven by wall-clock elapsed so the bar drains at
  // a real-time rate; pauses freeze the bar by not advancing
  // `startTickMs` while paused.
  useEffect(() => {
    let startTickMs = Date.now();
    let leftover = UNDO_TOAST_MS;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (pausedRef.current) {
        // While paused, slide the start forward so elapsed stays 0.
        startTickMs = now;
        return;
      }
      const elapsed = now - startTickMs;
      startTickMs = now;
      leftover = Math.max(0, leftover - elapsed);
      setRemaining(leftover);
      if (leftover <= 0) {
        window.clearInterval(id);
        onDismissRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
    // Empty deps — interval is mounted once and reads refs for the
    // latest pause state + dismiss handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.max(0, Math.min(100, (remaining / UNDO_TOAST_MS) * 100));

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2"
      style={{ bottom: "32px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="border min-w-[360px] max-w-[520px] flex items-center gap-3 px-4 py-3 relative overflow-hidden"
        style={{
          background: "rgba(7,29,28,0.96)",
          borderColor: "rgba(255,179,71,0.55)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7)",
        }}
      >
        {/* Countdown bar at the bottom of the toast */}
        <div
          className="absolute bottom-0 left-0 h-[2px] transition-all"
          style={{
            width: `${pct}%`,
            background: "#FFB347",
            transitionDuration: paused ? "0ms" : "100ms",
          }}
        />
        <Trash2 className="h-4 w-4 shrink-0" style={{ color: "#fca5a5" }} />
        <div className="min-w-0 flex-1">
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "rgba(255,230,203,0.6)" }}
          >
            Deleted
          </div>
          <div
            className="text-[13.5px] truncate"
            style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
            title={doc.name}
          >
            {doc.title ?? doc.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors shrink-0"
          style={{
            background: "transparent",
            color: "#FFB347",
            borderColor: "rgba(255,179,71,0.55)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,179,71,0.12)";
            e.currentTarget.style.borderColor = "#FFB347";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(255,179,71,0.55)";
          }}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-7 w-7 flex items-center justify-center border transition-colors shrink-0"
          style={{
            background: "transparent",
            color: "rgba(255,230,203,0.6)",
            borderColor: "rgba(255,230,203,0.25)",
          }}
          aria-label="Dismiss"
          title="Dismiss (file stays in .trash/ — recover from Finder)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Canonical type → extensions map. The mirror of classifyDoc() in
// vite.config.ts — kept here for tooltips + the rules table in the
// Install Prompt modal. If this drifts from the backend, the filter
// chip tooltips will lie, so keep them in sync.
const TYPE_RULES: Array<{ type: string; label: string; exts: string[]; note: string }> = [
  { type: "image", label: "Image", exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"], note: "Rendered as a real thumbnail." },
  { type: "pdf", label: "PDF", exts: ["pdf"], note: "Previewed inline in an iframe." },
  { type: "html", label: "HTML", exts: ["html", "htm"], note: "Rendered inline. Embed <meta name='hermes-title'> + <meta name='hermes-description'>." },
  { type: "markdown", label: "Markdown", exts: ["md", "markdown", "mdx"], note: "Use YAML frontmatter with title + description." },
  { type: "text", label: "Text", exts: ["txt", "log"], note: "First line = title, second line = description." },
  { type: "data", label: "Data", exts: ["json", "yaml", "yml", "toml", "csv", "tsv"], note: "JSON: add a top-level _hermes block. YAML/TOML: leading title:/description: keys." },
  { type: "video", label: "Video", exts: ["mp4", "mov", "webm", "mkv", "avi"], note: "Previewed inline with native controls." },
  { type: "audio", label: "Audio", exts: ["mp3", "wav", "ogg", "m4a", "flac"], note: "Previewed inline with native audio player." },
  { type: "archive", label: "Archive", exts: ["zip", "tar", "gz", "tgz", "7z", "rar"], note: "Open externally to extract." },
  { type: "code", label: "Code", exts: ["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "c", "cpp", "sh"], note: "First two comment lines = title + description." },
  { type: "other", label: "Other", exts: ["(anything else)"], note: "Falls back to the generic placeholder." },
];

function extsForType(type: string): string[] {
  return TYPE_RULES.find((r) => r.type === type)?.exts ?? [];
}

/**
 * Install Prompt modal. Replaces the old gargantuan inline block. Opens
 * from the "Install prompt" chip in the section header. Contains the
 * full prompt (with Copy) + the per-type extension rules table.
 */

/**
 * Trash modal — lists every file in ~/Documents/Hermes/.trash/ with
 * Restore + Permanently delete actions per row, plus an Empty-trash
 * button at the bottom. Soft-deletes from this modal are NOT
 * recoverable via the Undo toast — they're truly gone.
 *
 * Auto-closes when the trash is emptied so the operator doesn't have
 * to dismiss an empty modal. onChange() is called after every mutation
 * so the parent can invalidate the main list query and keep the
 * "Trash · N" chip in sync.
 */
function TrashModal({
  onClose,
  onChange,
}: {
  onClose: () => void;
  onChange: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch + a small helper to refresh after each action.
  const refresh = async () => {
    try {
      const r = await fetch("/__hermes_documents/trash");
      if (!r.ok) throw new Error(`status ${r.status}`);
      const body = (await r.json()) as TrashResponse;
      setItems(body.items);
      onChange();
      // Close ourselves if the trash is empty — no point showing an
      // empty modal once the operator's cleaned everything up.
      if (body.items.length === 0) onClose();
    } catch (e: any) {
      setError(e?.message ?? "could not load trash");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes + lock body scroll (same pattern as the other modals).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Body scroll lock — uses the module-level stacking counter so two
  // modals stacked + closed out-of-order can't leave the page locked.
  useBodyScrollLock();

  const handleRestore = async (item: TrashItem) => {
    setBusy(item.trashId);
    setError(null);
    try {
      const r = await fetch(
        `/__hermes_documents/restore?trashId=${encodeURIComponent(item.trashId)}`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(`status ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(`Could not restore "${item.originalName}": ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const handlePurge = async (item: TrashItem) => {
    if (
      !confirm(
        `Permanently delete "${item.originalName}"?\n\nThis cannot be undone — the file is removed from disk entirely.`,
      )
    ) {
      return;
    }
    setBusy(item.trashId);
    setError(null);
    try {
      const r = await fetch(
        `/__hermes_documents/trash?trashId=${encodeURIComponent(item.trashId)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error(`status ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(`Could not delete "${item.originalName}": ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleEmptyAll = async () => {
    if (!items || items.length === 0) return;
    if (
      !confirm(
        `Permanently delete all ${items.length} item${items.length === 1 ? "" : "s"} in the trash?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy("all");
    setError(null);
    try {
      const r = await fetch("/__hermes_documents/trash", { method: "DELETE" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(`Could not empty trash: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,12,12,0.82)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] flex flex-col border"
        style={{
          background: "rgba(7,29,28,0.96)",
          borderColor: "rgba(252,165,165,0.55)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(255,230,203,0.25)" }}
        >
          <div className="min-w-0">
            <div
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: "#fca5a5" }}
            >
              <span style={{ color: "#fca5a5" }}>▎</span> Trash
            </div>
            <div
              className="text-[15px] leading-snug mt-0.5"
              style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
            >
              {items === null
                ? "Loading…"
                : items.length === 0
                  ? "Trash is empty"
                  : `${items.length} deleted file${items.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center border transition-colors shrink-0"
            style={{
              background: "transparent",
              color: "rgba(255,230,203,0.7)",
              borderColor: "rgba(255,230,203,0.3)",
            }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {error && (
            <div
              className="border px-3 py-2 mb-3 text-[12.5px]"
              style={{
                color: "#fca5a5",
                borderColor: "rgba(252,165,165,0.45)",
                background: "rgba(252,165,165,0.08)",
                fontFamily: '"Fraunces", serif',
              }}
            >
              {error}
            </div>
          )}
          {items === null ? (
            <div
              className="py-8 text-center text-[13px]"
              style={{ color: "rgba(255,230,203,0.55)", fontFamily: '"Fraunces", serif' }}
            >
              Reading the trash folder…
            </div>
          ) : items.length === 0 ? (
            <div
              className="py-8 text-center"
              style={{ color: "rgba(255,230,203,0.7)", fontFamily: '"Fraunces", serif' }}
            >
              <div className="text-[15px] mb-1">Nothing to recover</div>
              <div className="text-[12.5px]" style={{ color: "rgba(255,230,203,0.55)" }}>
                Deleted files appear here. Restore puts them back in your gallery,
                permanently delete removes them from disk for good.
              </div>
            </div>
          ) : (
            <div
              className="border overflow-hidden"
              style={{ borderColor: "rgba(255,230,203,0.18)" }}
            >
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr
                    className="hermes-mono text-[9.5px] uppercase tracking-[0.18em]"
                    style={{ color: "rgba(255,230,203,0.55)" }}
                  >
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>File</th>
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>Deleted</th>
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>Size</th>
                    <th className="text-right px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.trashId}
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.18)",
                        opacity: busy === item.trashId ? 0.5 : 1,
                      }}
                    >
                      <td
                        className="px-3 py-2 align-middle"
                        style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
                        title={item.trashId}
                      >
                        <div className="truncate max-w-[280px]">{item.originalName}</div>
                      </td>
                      <td
                        className="hermes-mono px-3 py-2 align-middle text-[11px]"
                        style={{ color: "rgba(255,230,203,0.7)" }}
                      >
                        {fmtAgo(item.deletedMs)}
                      </td>
                      <td
                        className="hermes-mono px-3 py-2 align-middle text-[11px]"
                        style={{ color: "rgba(255,230,203,0.7)" }}
                      >
                        {fmtBytes(item.sizeBytes)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => handleRestore(item)}
                            className="hermes-mono inline-flex items-center gap-1 px-2 py-1 border text-[9.5px] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed"
                            style={{
                              background: "transparent",
                              color: "#FFB347",
                              borderColor: "rgba(255,179,71,0.5)",
                            }}
                            title="Restore to ~/Documents/Hermes/"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => handlePurge(item)}
                            className="hermes-mono inline-flex items-center gap-1 px-2 py-1 border text-[9.5px] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed"
                            style={{
                              background: "transparent",
                              color: "#fca5a5",
                              borderColor: "rgba(252,165,165,0.5)",
                            }}
                            title="Permanently delete from disk"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer — Empty all */}
        {items && items.length > 0 && (
          <div
            className="px-5 py-3 border-t flex items-center justify-between"
            style={{ borderColor: "rgba(255,230,203,0.18)" }}
          >
            <div
              className="text-[11.5px]"
              style={{
                color: "rgba(255,230,203,0.55)",
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
              }}
            >
              Restored files keep their original name (with a suffix if a
              new file already took it).
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleEmptyAll}
              className="hermes-mono inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed"
              style={{
                background: "transparent",
                color: "#fca5a5",
                borderColor: "rgba(252,165,165,0.55)",
              }}
            >
              <Trash2 className="h-3 w-3" /> Empty trash · {items.length}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InstallPromptModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(HERMES_GALLERY_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = HERMES_GALLERY_PROMPT;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        /* operator can select manually */
      }
      document.body.removeChild(ta);
    }
  };

  // Close on Esc + backdrop click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Body scroll lock — module-level stacking counter handles
  // out-of-order close races across the three modals.
  useBodyScrollLock();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,12,12,0.82)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] flex flex-col border"
        style={{
          background: "rgba(7,29,28,0.96)",
          borderColor: "rgba(255,179,71,0.55)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(255,230,203,0.25)" }}
        >
          <div className="min-w-0">
            <div
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: "#FFB347" }}
            >
              <span style={{ color: "#FFB347" }}>▎</span> Install prompt
            </div>
            <div
              className="text-[15px] leading-snug mt-0.5"
              style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
            >
              Teach Hermes to save artefacts here
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center border transition-colors shrink-0"
            style={{
              background: "transparent",
              color: "rgba(255,230,203,0.7)",
              borderColor: "rgba(255,230,203,0.3)",
            }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {/* Save / Don't-save rules — visual two-column panel before
              the prompt so the operator sees the boundary at a glance. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div
              className="border p-3"
              style={{
                borderColor: "rgba(134,239,172,0.4)",
                background: "rgba(134,239,172,0.06)",
              }}
            >
              <div
                className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                style={{ color: "#86efac" }}
              >
                <span>▎</span> Save here
              </div>
              <ul
                className="text-[12.5px] leading-relaxed space-y-1"
                style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
              >
                <li>✓ HTML, PDFs, decks, invoices, reports</li>
                <li>✓ Markdown notes, digests, summaries</li>
                <li>✓ Generated images, charts, diagrams</li>
                <li>✓ Audio/video clips you produced</li>
                <li>✓ JSON/CSV/YAML exports for me</li>
                <li>✓ Anything I'd preview, share, or revisit</li>
              </ul>
            </div>
            <div
              className="border p-3"
              style={{
                borderColor: "rgba(252,165,165,0.4)",
                background: "rgba(252,165,165,0.06)",
              }}
            >
              <div
                className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                style={{ color: "#fca5a5" }}
              >
                <span>▎</span> Don't save here
              </div>
              <ul
                className="text-[12.5px] leading-relaxed space-y-1"
                style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
              >
                <li>✗ Files inside an active GitHub repo or project</li>
                <li>✗ Build artifacts, dist/, node_modules/</li>
                <li>✗ Temp/scratch/working copies</li>
                <li>✗ Logs, dumps, traces, telemetry</li>
                <li>✗ Dotfiles (.DS_Store, .env, .git)</li>
                <li>✗ Source code for an active project</li>
              </ul>
            </div>
          </div>
          <div
            className="text-[11.5px] mb-5 leading-relaxed -mt-2"
            style={{
              color: "rgba(255,230,203,0.6)",
              fontFamily: '"Fraunces", serif',
              fontStyle: "italic",
            }}
          >
            Litmus test: <span style={{ color: CREAM }}>"would I want to see this in my Documents gallery?"</span> Yes → save here. It's plumbing or in-progress project work? → save in the project's own folder.
          </div>

          {/* Prompt block */}
          <div className="flex items-center justify-between mb-2">
            <div
              className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              <span style={{ color: "#FFB347" }}>▎</span> Prompt to paste
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: copied ? "rgba(134,239,172,0.12)" : "transparent",
                color: copied ? "#86efac" : CREAM,
                borderColor: copied
                  ? "rgba(134,239,172,0.55)"
                  : "rgba(255,230,203,0.45)",
              }}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy prompt
                </>
              )}
            </button>
          </div>
          <pre
            className="hermes-mono whitespace-pre-wrap break-words text-[12px] leading-relaxed px-3 py-3 border max-h-[40vh] overflow-auto"
            style={{
              color: CREAM,
              background: "rgba(0,0,0,0.32)",
              borderColor: "rgba(255,230,203,0.18)",
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}
          >
            {HERMES_GALLERY_PROMPT}
          </pre>

          {/* Type rules table */}
          <div className="mt-5">
            <div
              className="hermes-mono text-[10px] uppercase tracking-[0.22em] mb-2"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              <span style={{ color: "#FFB347" }}>▎</span> What classifies as what
            </div>
            <div
              className="text-[12.5px] mb-3"
              style={{
                color: "rgba(255,230,203,0.65)",
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
              }}
            >
              Files are classified by extension. Each type has its own
              engraved placeholder, preview behaviour, and metadata format.
            </div>
            <div
              className="border overflow-hidden"
              style={{ borderColor: "rgba(255,230,203,0.18)" }}
            >
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    className="hermes-mono text-[9.5px] uppercase tracking-[0.18em]"
                    style={{ color: "rgba(255,230,203,0.55)" }}
                  >
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>Type</th>
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>Extensions</th>
                    <th className="text-left px-3 py-2 font-normal" style={{ background: "rgba(0,0,0,0.32)" }}>Behaviour</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPE_RULES.map((r, idx) => {
                    const m = metaFor(r.type);
                    return (
                      <tr
                        key={r.type}
                        style={{
                          background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.18)",
                        }}
                      >
                        <td className="px-3 py-2 align-top">
                          <span
                            className="hermes-mono text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 border inline-block"
                            style={{
                              color: m.tint,
                              borderColor: `${m.tint}66`,
                              background: `${m.tint}10`,
                            }}
                          >
                            {r.label}
                          </span>
                        </td>
                        <td
                          className="hermes-mono px-3 py-2 align-top text-[11px]"
                          style={{ color: "rgba(255,230,203,0.85)" }}
                        >
                          {r.exts.map((e) => `.${e.replace(/^\(/, "(")}`).join(" ")}
                        </td>
                        <td
                          className="px-3 py-2 align-top"
                          style={{
                            color: "rgba(255,230,203,0.75)",
                            fontFamily: '"Fraunces", serif',
                          }}
                        >
                          {r.note}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="text-[11.5px] mt-4 leading-relaxed"
            style={{
              color: "rgba(255,230,203,0.55)",
              fontFamily: '"Fraunces", serif',
              fontStyle: "italic",
            }}
          >
            Paste the prompt once into a fresh Hermes session — it persists
            in the session's system context. For a permanent install, drop
            it into your agent's system prompt or skill file.
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tint,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tint: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="hermes-mono px-2.5 py-1 border text-[10px] uppercase tracking-[0.16em] transition-colors"
      style={{
        background: active ? `${tint}1f` : "rgba(0,0,0,0.32)",
        color: active ? tint : "rgba(255,230,203,0.65)",
        borderColor: active ? tint : "rgba(255,230,203,0.25)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Responsive multi-row grid — the canonical card layout. Used both as
 * the flat view (when item count ≤ 6 or search is active) and inside
 * each recency group when grouping is active.
 */
function DocGrid({
  items,
  onPreview,
  onDelete,
}: {
  items: Doc[];
  onPreview: (d: Doc) => void;
  onDelete: (d: Doc) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {items.map((doc) => (
        <DocCard
          key={doc.name}
          doc={doc}
          onPreview={() => onPreview(doc)}
          onDelete={() => onDelete(doc)}
        />
      ))}
    </div>
  );
}

/**
 * One recency bucket — label header + a DocGrid of its items.
 */
function RecencyGroup({
  label,
  items,
  onPreview,
  onDelete,
}: {
  label: string;
  items: Doc[];
  onPreview: (d: Doc) => void;
  onDelete: (d: Doc) => void;
}) {
  return (
    <div>
      <div
        className="hermes-mono text-[10px] uppercase tracking-[0.24em] mb-2.5 pb-1 border-b inline-flex items-center gap-2"
        style={{
          color: "rgba(255,230,203,0.7)",
          borderColor: "rgba(255,230,203,0.18)",
        }}
      >
        <span style={{ color: "#FFB347" }}>▎</span>
        {label}
        <span
          className="px-1.5 py-0.5 border"
          style={{
            color: "rgba(255,230,203,0.6)",
            borderColor: "rgba(255,230,203,0.25)",
            fontSize: "9px",
          }}
        >
          {items.length}
        </span>
      </div>
      <DocGrid items={items} onPreview={onPreview} onDelete={onDelete} />
    </div>
  );
}

function DocCard({
  doc,
  onPreview,
  onDelete,
}: {
  doc: Doc;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const meta = metaFor(doc.type);
  const Icon = meta.Icon;
  // Three rendering tiers for the card thumbnail:
  //   1. image type → real thumbnail from disk
  //   2. any other type with a Hermes engraving in TYPE_PLACEHOLDER →
  //      show that as the card background (the beautiful path)
  //   3. fallback (e.g. 'other' while its art is still generating) →
  //      lucide icon swatch
  const isImage = doc.type === "image";
  const fileUrl = `/__hermes_documents/file?name=${encodeURIComponent(doc.name)}`;
  const realThumb = isImage ? fileUrl : null;
  const placeholder = !isImage ? TYPE_PLACEHOLDER[doc.type] : null;
  const bgSrc = realThumb ?? placeholder ?? null;

  // Title + description with graceful fallbacks. The embedded values win;
  // we humanize the filename when no title is embedded, and pick a
  // per-type blurb when no description is embedded.
  const titleText = doc.title ?? humanizeFilename(doc.name);
  const descriptionText =
    doc.description ?? TYPE_FALLBACK_DESC[doc.type] ?? TYPE_FALLBACK_DESC.other;

  return (
    <div
      className="group relative border flex flex-col overflow-hidden transition-colors cursor-pointer"
      style={{
        background: "rgba(0,0,0,0.32)",
        borderColor: "rgba(255,230,203,0.3)",
      }}
      onClick={onPreview}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = meta.tint;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,230,203,0.3)";
      }}
    >
      {/* Thumbnail block — fixed 5:3-ish aspect so cards align */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "5/3", background: `${meta.tint}10` }}
      >
        {bgSrc ? (
          <img
            src={bgSrc}
            alt={doc.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // Final fallback — should be unreachable in practice now that
          // every known type has a placeholder, but keeps the card from
          // collapsing if an unmapped type ever shows up.
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-10 w-10" style={{ color: meta.tint, opacity: 0.85 }} />
          </div>
        )}
        {/* Type chip — top-left */}
        <span
          className="hermes-mono absolute top-2 left-2 text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 border"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: meta.tint,
            borderColor: `${meta.tint}66`,
          }}
        >
          {meta.label}
        </span>
        {/* Action cluster — top-right. Open-in-new-tab is the secondary
            "I want this full-screen in the browser" action; delete is
            destructive and lives furthest right. Both are always shown
            at low opacity, brightening on card hover, so the operator
            can spot them without exploring. */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 flex items-center justify-center border transition-colors"
            style={{
              background: "rgba(0,0,0,0.6)",
              borderColor: "rgba(255,230,203,0.45)",
              color: CREAM,
            }}
            title="Open in a new browser tab"
            aria-label={`Open ${doc.name} in a new tab`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 flex items-center justify-center border transition-colors"
            style={{
              background: "rgba(0,0,0,0.6)",
              borderColor: "rgba(252,165,165,0.55)",
              color: "#fca5a5",
            }}
            title="Delete this file from disk"
            aria-label={`Delete ${doc.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card footer — three-tier hierarchy:
            (1) title (Fraunces, prominent) — Hermes-embedded if present,
                humanized filename otherwise
            (2) description (Fraunces italic, muted) — Hermes-embedded
                or per-type fallback
            (3) filename + meta (mono, smallest) — always visible so
                you never lose the actual filesystem identity */}
      <div className="px-3 py-2.5 flex flex-col gap-1">
        <div
          className="text-[13.5px] font-medium leading-snug line-clamp-1"
          style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
          title={titleText}
        >
          {titleText}
        </div>
        <div
          className="text-[11.5px] leading-snug line-clamp-2"
          style={{
            color: "rgba(255,230,203,0.7)",
            fontFamily: '"Fraunces", serif',
            fontStyle: "italic",
          }}
          title={descriptionText}
        >
          {descriptionText}
        </div>
        <div
          className="hermes-mono text-[10px] flex items-center gap-1.5 mt-1 pt-1.5 border-t truncate"
          style={{
            color: "rgba(255,230,203,0.5)",
            borderColor: "rgba(255,230,203,0.12)",
          }}
        >
          <span className="truncate" title={doc.name}>{doc.name}</span>
          <span style={{ color: "rgba(255,230,203,0.25)" }}>·</span>
          <span className="shrink-0">{fmtAgo(doc.modifiedMs)}</span>
          <span style={{ color: "rgba(255,230,203,0.25)" }}>·</span>
          <span className="shrink-0">{fmtBytes(doc.sizeBytes)}</span>
        </div>
      </div>
    </div>
  );
}

function GalleryEmpty({
  title,
  body,
  tone = "info",
}: {
  title: string;
  body: string;
  tone?: "info" | "warn";
}) {
  const accent = tone === "warn" ? "#fbbf24" : "rgba(255,230,203,0.4)";
  return (
    <div
      className="border p-8 flex flex-col items-center gap-2 text-center"
      style={{
        background: "rgba(0,0,0,0.28)",
        borderColor: accent,
        borderStyle: "dashed",
      }}
    >
      <div
        className="text-[16px]"
        style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
      >
        {title}
      </div>
      <div
        className="text-[12px] max-w-md"
        style={{ color: "rgba(255,230,203,0.7)" }}
      >
        {body}
      </div>
    </div>
  );
}

function PreviewOverlay({
  doc,
  onClose,
  onDelete,
}: {
  doc: Doc;
  onClose: () => void;
  onDelete: () => void;
}) {
  const url = `/__hermes_documents/file?name=${encodeURIComponent(doc.name)}`;
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Text-ish formats get fetched + rendered as <pre> for legibility.
  const [textBody, setTextBody] = useState<string | null>(null);
  const isText = ["markdown", "text", "data", "code"].includes(doc.type);

  useEffect(() => {
    if (!isText) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        const t = await r.text();
        if (!cancelled) setTextBody(t);
      } catch {
        /* ignore — fallback renders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, isText]);

  // Close on Esc + on backdrop click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Body scroll lock — uses the shared stacking counter so this and
  // the other modals can coexist without one's cleanup unlocking
  // another's lock.
  useBodyScrollLock();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,12,12,0.82)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] flex flex-col border"
        style={{
          background: "rgba(7,29,28,0.96)",
          borderColor: "rgba(255,230,203,0.45)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,230,203,0.25)" }}
        >
          <div className="min-w-0 flex items-center gap-3">
            <div
              className="hermes-display text-[18px] truncate"
              style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
            >
              {doc.name}
            </div>
            <span
              className="hermes-mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 border shrink-0"
              style={{
                color: metaFor(doc.type).tint,
                borderColor: `${metaFor(doc.type).tint}66`,
                background: `${metaFor(doc.type).tint}10`,
              }}
            >
              {metaFor(doc.type).label}
            </span>
            <span
              className="hermes-mono text-[10px] tracking-[0.16em] shrink-0"
              style={{ color: "rgba(255,230,203,0.5)" }}
            >
              {fmtBytes(doc.sizeBytes)} · {fmtAgo(doc.modifiedMs)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={url}
              target="_blank"
              rel="noopener"
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,230,203,0.7)",
                borderColor: "rgba(255,230,203,0.3)",
              }}
              title="Open in a new tab"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </a>
            <button
              type="button"
              onClick={onDelete}
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "transparent",
                color: "#fca5a5",
                borderColor: "rgba(252,165,165,0.5)",
              }}
              title="Delete from disk"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center border transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,230,203,0.7)",
                borderColor: "rgba(255,230,203,0.3)",
              }}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — rendering depends on type. */}
        <div className="flex-1 overflow-auto" style={{ background: "rgba(0,0,0,0.45)" }}>
          {doc.type === "image" ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={doc.name}
                className="max-w-full max-h-[78vh] object-contain"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>
          ) : doc.type === "pdf" || doc.type === "html" ? (
            <iframe
              src={url}
              title={doc.name}
              className="w-full h-[78vh] border-0"
              style={{ background: doc.type === "html" ? "#fff" : "transparent" }}
            />
          ) : doc.type === "video" ? (
            <div className="w-full p-4 flex items-center justify-center">
              <video
                src={url}
                controls
                className="max-w-full max-h-[78vh]"
                style={{ background: "#000" }}
              />
            </div>
          ) : doc.type === "audio" ? (
            <div className="w-full p-8 flex items-center justify-center">
              <audio src={url} controls className="w-full max-w-xl" />
            </div>
          ) : isText ? (
            <pre
              className="hermes-mono whitespace-pre-wrap break-words px-5 py-4 text-[12.5px] leading-relaxed"
              style={{ color: CREAM, fontSize: "12.5px" }}
            >
              {textBody ?? "Loading…"}
            </pre>
          ) : (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <FileGeneric
                className="h-12 w-12"
                style={{ color: "rgba(255,230,203,0.4)" }}
              />
              <div
                className="text-[14px]"
                style={{ color: CREAM, fontFamily: '"Fraunces", serif' }}
              >
                Preview not available for .{doc.ext}
              </div>
              <div className="text-[12px]" style={{ color: "rgba(255,230,203,0.6)" }}>
                Hit{" "}
                <span className="hermes-mono" style={{ color: CREAM }}>
                  Open
                </span>{" "}
                above to download it.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

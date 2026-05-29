import { useEffect, useState } from "react";

/**
 * SectionOverlay — production-only screen-recording aid.
 *
 * When the URL has `?section=N&title=X` (e.g. while filming a video),
 * renders a small bottom-right pill displaying `§N · Title` so viewers
 * know which chapter of the senaryo they are seeing on screen.
 *
 * Invisible to normal dashboard users — only appears when the operator
 * intentionally appends the query params. Updates live as the URL changes
 * during a recording session (no full reload required).
 */
export function SectionOverlay() {
  const [params, setParams] = useState<{ section: string; title: string } | null>(null);

  useEffect(() => {
    const read = () => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      const section = sp.get("section");
      const title = sp.get("title");
      if (section) {
        setParams({ section, title: title ?? "" });
      } else {
        setParams(null);
      }
    };
    read();
    // TanStack Router updates history without firing popstate, so we poll
    // location.search at a low frequency. 250ms is invisible to the eye
    // during recording but cheap enough to not affect performance.
    const iv = window.setInterval(read, 250);
    window.addEventListener("popstate", read);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("popstate", read);
    };
  }, []);

  if (!params) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] pointer-events-none select-none"
      aria-hidden="true"
    >
      <div
        className="flex items-baseline gap-2 rounded-md px-3 py-1.5 backdrop-blur-md"
        style={{
          background: "rgba(15, 12, 8, 0.78)",
          border: "1px solid rgba(255, 230, 203, 0.35)",
          fontFamily: '"Courier Prime", ui-monospace, monospace',
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255, 230, 203, 0.92)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5)",
        }}
      >
        <span style={{ color: "rgba(255, 230, 203, 0.55)" }}>§{params.section}</span>
        {params.title && (
          <>
            <span style={{ color: "rgba(255, 230, 203, 0.35)" }}>·</span>
            <span>{params.title}</span>
          </>
        )}
      </div>
    </div>
  );
}

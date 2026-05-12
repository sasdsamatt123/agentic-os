import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

/**
 * An inline-editable price display. Shows "$200 / month" by default;
 * click the pencil to edit. Saves on blur or Enter.
 */
export function EditablePrice({
  value,
  onChange,
  accent = "#fbbf24",
}: {
  value: number | null;
  onChange: (newPrice: number) => void;
  accent?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value ?? ""));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, value]);

  const commit = () => {
    const parsed = parseInt(draft.replace(/[^0-9]/g, ""), 10);
    if (parsed > 0 && Number.isFinite(parsed)) {
      onChange(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="text-base font-semibold" style={{ color: accent }}>
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-16 bg-transparent border-b border-foreground/30 text-base font-semibold tabular-nums outline-none text-foreground"
          style={{ caretColor: accent }}
        />
        <span className="text-[10px] text-muted-foreground tabular-nums">/ month</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-1 group/price cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-base font-semibold tabular-nums">
        {value !== null ? `$${value}` : "—"}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {value !== null ? "/ month" : "credit"}
      </span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/price:opacity-100 transition-opacity ml-1" />
    </span>
  );
}

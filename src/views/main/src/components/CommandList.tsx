import { useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";

export interface CommandListItem {
  id: string;
  searchText: string;
  content: ReactNode;
  onSelect: () => void;
}

export interface CommandListSection {
  label?: string;
  items: CommandListItem[];
}

interface CommandListProps {
  placeholder: string;
  sections: CommandListSection[];
  emptyText: string;
  onClose: () => void;
}

export function CommandList(props: CommandListProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];

  const filtered: CommandListSection[] = props.sections
    .map((section) => ({
      label: section.label,
      items: terms.length
        ? section.items.filter((item) => {
            const hay = item.searchText.toLowerCase();
            return terms.every((t) => hay.includes(t));
          })
        : section.items,
    }))
    .filter((section) => section.items.length > 0);

  const flat = filtered.flatMap((s) => s.items);

  function scrollToHighlight(index: number) {
    const el = listRef.current?.querySelector(`[data-idx="${index}"]`);
    // jsdom hat kein scrollIntoView — Guard, damit Tests nicht crashen.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = flat.length === 0 ? 0 : (highlight + 1) % flat.length;
      setHighlight(next);
      scrollToHighlight(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = flat.length === 0 ? 0 : (highlight - 1 + flat.length) % flat.length;
      setHighlight(next);
      scrollToHighlight(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[highlight]?.onSelect();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  let idx = 0;

  return (
    <div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder}
          className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
        {filtered.map((section) => (
          <div key={section.label ?? "__default"}>
            {section.label ? (
              <p className="px-3 pb-0.5 pt-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const here = idx++;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-idx={here}
                  onMouseEnter={() => setHighlight(here)}
                  onClick={() => item.onSelect()}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm",
                    here === highlight ? "bg-muted" : "",
                  )}
                >
                  {item.content}
                </button>
              );
            })}
          </div>
        ))}
        {flat.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{props.emptyText}</p>
        ) : null}
      </div>
    </div>
  );
}

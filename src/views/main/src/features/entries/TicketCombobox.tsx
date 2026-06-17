import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import type { Project, Ticket } from "../../../../../shared/types";
import { cn } from "../../lib/utils";

interface TicketComboboxProps {
  tickets: Ticket[]; // auswählbare (aktive) Tickets
  projects: Project[]; // für Projektnamen/Gruppierung
  recent: Ticket[]; // zuletzt verwendete Tickets (ohne Suche oben gezeigt)
  value: number | null; // ausgewählte ticketId
  onChange: (id: number | null) => void;
}

interface Group {
  label: string; // fullPath des Projekts (disambiguiert die IID)
  sortKey: string;
  tickets: Ticket[];
}

function groupByProject(tickets: Ticket[], byId: Map<number, Project>): Group[] {
  const map = new Map<number, Ticket[]>();
  for (const t of tickets) {
    const list = map.get(t.projectId) ?? [];
    list.push(t);
    map.set(t.projectId, list);
  }
  const groups = [...map.entries()].map(([pid, ts]) => ({
    label: byId.get(pid)?.fullPath ?? `Projekt ${pid}`,
    sortKey: byId.get(pid)?.fullPath ?? `~${pid}`,
    tickets: [...ts].sort((a, b) => a.gitlabIid - b.gitlabIid),
  }));
  groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return groups;
}

export function TicketCombobox(props: TicketComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = new Map(props.projects.map((p) => [p.id, p]));
  const selected =
    props.value === null ? null : (props.tickets.find((t) => t.id === props.value) ?? null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pathOf(id: number): string {
    return byId.get(id)?.fullPath ?? "";
  }
  function nameOf(id: number): string {
    return byId.get(id)?.name ?? `Projekt ${id}`;
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? props.tickets.filter((t) => {
        const hay = `#${t.gitlabIid} ${t.title} ${pathOf(t.projectId)}`.toLowerCase();
        return q.split(/\s+/).every((term) => hay.includes(term));
      })
    : props.tickets;

  // Sektionen: ohne Suche zuerst „Zuletzt verwendet", dann alle nach Projekt gruppiert.
  const sections: Array<{ key: string; label: string | null; tickets: Ticket[] }> = [];
  if (!q && props.recent.length > 0) {
    sections.push({ key: "recent", label: "Zuletzt verwendet", tickets: props.recent });
  }
  for (const g of groupByProject(filtered, byId)) {
    sections.push({ key: `p:${g.label}`, label: g.label, tickets: g.tickets });
  }

  // Flache Liste für die Tastaturnavigation (Index 0 = „kein Ticket").
  const flat: Array<number | null> = [null];
  for (const s of sections) for (const t of s.tickets) flat.push(t.id);

  function commit(id: number | null) {
    props.onChange(id);
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(flat[highlight] ?? null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  let idx = 0; // läuft synchron zu `flat` mit, um den Highlight-Zustand zu treffen.
  function row(id: number | null, content: React.ReactNode) {
    const here = idx++;
    const active = here === highlight;
    const isSelected = id === props.value;
    return (
      <button
        key={id === null ? "none" : `${id}`}
        type="button"
        onMouseEnter={() => setHighlight(here)}
        onClick={() => commit(id)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
          active ? "bg-slate-100" : "",
          isSelected ? "font-medium text-slate-900" : "text-slate-700",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <span className={selected ? "truncate text-slate-900" : "truncate text-slate-400"}>
          {selected
            ? `#${selected.gitlabIid} ${selected.title} · ${nameOf(selected.projectId)}`
            : "– kein Ticket –"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Suchen: #IID, Titel oder Projekt…"
              className="h-8 w-full rounded border border-slate-300 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {row(
              null,
              <span className="flex items-center gap-1 text-slate-500">
                <X className="h-3.5 w-3.5" /> kein Ticket
              </span>,
            )}
            {sections.map((s) => (
              <div key={s.key}>
                {s.label ? (
                  <p className="px-3 pb-0.5 pt-2 font-mono text-[11px] uppercase tracking-wide text-slate-400">
                    {s.label}
                  </p>
                ) : null}
                {s.tickets.map((t) =>
                  row(
                    t.id,
                    <>
                      <span className="truncate">
                        <span className="font-mono text-slate-400">#{t.gitlabIid}</span> {t.title}
                      </span>
                    </>,
                  ),
                )}
              </div>
            ))}
            {flat.length === 1 ? (
              <p className="px-3 py-3 text-center text-sm text-slate-400">Kein Treffer.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

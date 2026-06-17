import { useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import type { Project, Ticket } from "../../../../../shared/types";
import { cn } from "../../lib/utils";

interface TicketPickerProps {
  tickets: Ticket[]; // auswählbare (aktive) Tickets
  projects: Project[]; // für Projektnamen/Gruppierung
  recent: Ticket[]; // zuletzt verwendete Tickets (ohne Suche oben gezeigt)
  value: number | null; // aktuell ausgewählte ticketId
  onSelect: (id: number | null) => void; // wählt und kehrt zum Formular zurück
  onCancel: () => void; // zurück ohne Änderung
}

interface Group {
  label: string; // fullPath des Projekts (disambiguiert die IID)
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
    tickets: [...ts].sort((a, b) => a.gitlabIid - b.gitlabIid),
  }));
  groups.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
}

/**
 * Vollflächige Ticket-Auswahl, die im Modal die Formularansicht ersetzt (kein
 * Overlay-Dropdown → kein verschachteltes Scrollen). Suche + Gruppierung nach
 * Projekt + „zuletzt verwendet". Tastatur: Pfeiltasten navigieren, Enter wählt,
 * Esc zurück.
 */
export function TicketPicker(props: TicketPickerProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const byId = new Map(props.projects.map((p) => [p.id, p]));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? props.tickets.filter((t) => {
        const path = byId.get(t.projectId)?.fullPath ?? "";
        const hay = `#${t.gitlabIid} ${t.title} ${path}`.toLowerCase();
        return q.split(/\s+/).every((term) => hay.includes(term));
      })
    : props.tickets;

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

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      props.onSelect(flat[highlight] ?? null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
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
        onClick={() => props.onSelect(id)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm",
          active ? "bg-slate-100" : "",
          isSelected ? "font-medium text-slate-900" : "text-slate-700",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Zurück"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">Ticket wählen</h3>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Suchen: #IID, Titel oder Projekt…"
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        />
      </div>

      <div className="max-h-[55vh] overflow-y-auto">
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
                <span className="truncate">
                  <span className="font-mono text-slate-400">#{t.gitlabIid}</span> {t.title}
                </span>,
              ),
            )}
          </div>
        ))}
        {flat.length === 1 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">Kein Treffer.</p>
        ) : null}
      </div>
    </div>
  );
}

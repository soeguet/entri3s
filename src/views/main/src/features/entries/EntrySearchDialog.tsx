import { useMemo, useRef } from "react";
import type { Entry, Ticket } from "../../../../../shared/types";
import { formatDate, formatDuration, formatWeekday, formatTime } from "../../lib/dates";
import { Dialog } from "../../components/ui/dialog";
import { CommandList, type CommandListSection } from "../../components/CommandList";

interface EntrySearchDialogProps {
  open: boolean;
  onClose: () => void;
  entries: Entry[];
  ticketsById: Map<number, Ticket>;
  onPick: (entry: Entry) => void;
}

// Bewusst createdAt DESC statt date DESC: Schnellsuche soll die zuletzt
// ANGELEGTEN Entries zuerst zeigen, nicht die mit dem jüngsten Arbeitsdatum.
// Cap auf 100 Einträge, damit das DOM bei sehr vielen Entries klein bleibt —
// die Suche filtert nur innerhalb dieser 100 (akzeptabel für eine Schnellsuche).
const MAX_ENTRIES = 100;

function buildSearchText(entry: Entry, ticketsById: Map<number, Ticket>): string {
  const parts: string[] = [];
  if (entry.notes) parts.push(entry.notes);
  parts.push(formatDate(entry.date));
  for (const tid of entry.ticketIds) {
    const t = ticketsById.get(tid);
    if (t) parts.push(`#${t.gitlabIid} ${t.title}`);
  }
  return parts.join(" ");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export function EntrySearchDialog(props: EntrySearchDialogProps) {
  const onPickRef = useRef(props.onPick);
  onPickRef.current = props.onPick;

  const sections: CommandListSection[] = useMemo(() => {
    if (!props.open) return [];

    const sorted = [...props.entries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_ENTRIES);

    return [
      {
        label: "Zuletzt angelegt",
        items: sorted.map((entry) => {
          const ticket =
            entry.ticketIds.length > 0 ? props.ticketsById.get(entry.ticketIds[0]) : undefined;

          return {
            id: String(entry.id),
            searchText: buildSearchText(entry, props.ticketsById),
            content: (
              <div className="flex w-full items-center gap-3 text-sm">
                <span className="shrink-0 text-muted-foreground">
                  {formatWeekday(entry.date)} {formatDate(entry.date)} {formatTime(entry.date)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDuration(entry.durationMinutes)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {entry.notes ? truncate(entry.notes, 60) : "—"}
                </span>
                {ticket ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    #{ticket.gitlabIid}
                  </span>
                ) : null}
              </div>
            ),
            onSelect: () => onPickRef.current(entry),
          };
        }),
      },
    ];
  }, [props.open, props.entries, props.ticketsById]);

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Entry suchen" size="lg">
      <CommandList
        placeholder="Notiz, Datum oder Ticket suchen…"
        sections={sections}
        emptyText="Keine Entries gefunden."
        onClose={props.onClose}
      />
    </Dialog>
  );
}

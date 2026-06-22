import { useMemo, useRef } from "react";
import type { Project, Ticket } from "../../../../../shared/types";
import { Dialog } from "../../components/ui/dialog";
import { CommandList, type CommandListSection } from "../../components/CommandList";

interface TicketSearchDialogProps {
  open: boolean;
  onClose: () => void;
  tickets: Ticket[];
  projects: Project[];
  onPick: (ticket: Ticket) => void;
}

export function TicketSearchDialog(props: TicketSearchDialogProps) {
  const onPickRef = useRef(props.onPick);
  onPickRef.current = props.onPick;

  const sections: CommandListSection[] = useMemo(() => {
    if (!props.open) return [];

    // Projekt-Pfad-Auflösung über eine Map projectId → fullPath.
    const pathById = new Map(props.projects.map((p) => [p.id, p.fullPath]));

    // Status-Filterung erfolgt bewusst NICHT hier: der Aufrufer liefert bereits
    // nur aktive Tickets (TicketFilter status:"active"). Doppelt filtern wäre
    // redundant und würde die Verantwortung verschleiern.
    // KEIN künstlicher Cap (anders als EntrySearchDialog): bei der Ticket-Suche
    // ist Vollständigkeit der Treffer wichtiger als eine DOM-Mikrooptimierung —
    // ein gesuchtes Ticket darf nie durch einen Cap unsichtbar werden.
    const sorted = [...props.tickets].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.gitlabIid - b.gitlabIid;
    });

    return [
      {
        label: "Tickets",
        items: sorted.map((ticket) => {
          const path = pathById.get(ticket.projectId) ?? "";
          return {
            id: String(ticket.id),
            searchText: `#${ticket.gitlabIid} ${ticket.title} ${path}`,
            content: (
              <div className="flex w-full items-center gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  #{ticket.gitlabIid}
                </span>
                <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{path}</span>
              </div>
            ),
            onSelect: () => onPickRef.current(ticket),
          };
        }),
      },
    ];
  }, [props.open, props.tickets, props.projects]);

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Ticket suchen" size="lg">
      <CommandList
        placeholder="#IID, Titel oder Projekt suchen…"
        sections={sections}
        emptyText="Keine Tickets gefunden."
        onClose={props.onClose}
      />
    </Dialog>
  );
}

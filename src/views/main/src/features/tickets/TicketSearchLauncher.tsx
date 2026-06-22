import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { Ticket, TicketFilter } from "../../../../../shared/types";
import { getTickets, getProjects } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { useHotkey } from "../../lib/useHotkey";
import { useCommands } from "../../lib/useCommand";
import { TicketSearchDialog } from "./TicketSearchDialog";

// Nur aktive Tickets durchsuchen. Konstante außerhalb der Komponente, damit der
// queryKey stabil bleibt.
const FILTER: TicketFilter = { status: "active" };

export function TicketSearchLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Auf /entries hat die Entries-Suche Vorrang auf mod+shift+f; dort tritt der
  // globale Ticket-Launcher zurück (disabled), sonst feuert er überall.
  useHotkey("mod+shift+f", () => setOpen((o) => !o), {
    scope: "global",
    enabled: pathname !== "/entries",
  });

  useCommands(
    useMemo(
      () => [
        {
          id: "tickets:search",
          label: "Ticket suchen",
          keywords: "find suche issue ticket",
          section: "Tickets",
          run: () => setOpen(true),
        },
      ],
      [],
    ),
  );

  // enabled:open — solange die Suche zu ist, wird nichts gefetcht.
  const tickets = useQuery({
    queryKey: keys.tickets(FILTER),
    queryFn: async () => unwrap(await getTickets(FILTER)),
    enabled: open,
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
    enabled: open,
  });

  const onPick = (ticket: Ticket) => {
    setOpen(false);
    navigate({ to: "/tickets/$ticketId", params: { ticketId: String(ticket.id) } });
  };

  return (
    <TicketSearchDialog
      open={open}
      onClose={() => setOpen(false)}
      tickets={tickets.data ?? []}
      projects={projects.data ?? []}
      onPick={onPick}
    />
  );
}

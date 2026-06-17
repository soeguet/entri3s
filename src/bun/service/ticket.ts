import type { Ticket, TicketFilter } from "../../shared/types";
import type { Repository } from "../repository";

export function createTicketService(repo: Repository) {
  return {
    getAll(filter: TicketFilter = {}): Ticket[] {
      return repo.tickets.list(filter);
    },

    /** Aktive Tickets, sortiert nach jüngster Verwendung (für die Schnellauswahl). */
    getRecent(limit: number): Ticket[] {
      return repo.tickets.listRecent(limit);
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;

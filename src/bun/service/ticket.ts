import type { Ticket, TicketFilter } from "../../shared/types";
import type { Repository } from "../repository";

export function createTicketService(repo: Repository) {
  return {
    getAll(filter: TicketFilter = {}): Ticket[] {
      if (filter.assignedToMe) {
        const userId = repo.settings.getCurrentUser()?.id;
        // Kein Current User bekannt → es gibt kein „mir": leere Liste statt aller
        // Tickets (bewusste Wahl, damit der Filter nie versehentlich alles zeigt).
        if (userId === undefined) return [];
        return repo.tickets.list(filter, userId);
      }
      return repo.tickets.list(filter);
    },

    /** Aktive Tickets, sortiert nach jüngster Verwendung (für die Schnellauswahl). */
    getRecent(limit: number): Ticket[] {
      return repo.tickets.listRecent(limit);
    },

    pin(ticketId: number): void {
      repo.tickets.pin(ticketId);
    },

    unpin(ticketId: number): void {
      repo.tickets.unpin(ticketId);
    },

    getPinned(): Ticket[] {
      return repo.tickets.listPinned();
    },

    getById(ticketId: number): Ticket | null {
      return repo.tickets.getById(ticketId);
    },

    markRead(ticketId: number): void {
      repo.tickets.markRead(ticketId);
    },
    markAllRead(filter: TicketFilter = {}): void {
      // currentUserId genau wie getAll() ermitteln, damit assignedToMe identisch
      // gefiltert wird (Single Source: settings.getCurrentUser).
      if (filter.assignedToMe) {
        const userId = repo.settings.getCurrentUser()?.id;
        if (userId === undefined) return;
        repo.tickets.markAllRead(filter, userId);
        return;
      }
      repo.tickets.markAllRead(filter);
    },
    getUnreadCount(): number {
      return repo.tickets.countUnread();
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;

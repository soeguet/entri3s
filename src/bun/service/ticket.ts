import type { Ticket, TicketFilter } from "../../shared/types";
import type { Repository } from "../repository";

export function createTicketService(repo: Repository) {
  return {
    getAll(filter: TicketFilter = {}): Ticket[] {
      return repo.tickets.list(filter);
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;

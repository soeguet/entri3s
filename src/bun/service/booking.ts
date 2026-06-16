import type { Repository } from "../repository";
import { appError } from "../lib/app-error";

export interface BookingPayload {
  entryId: number;
  projectId: number;
  ticketIid: number;
  durationMinutes: number;
  note: string;
}

export function createBookingService(repo: Repository) {
  return {
    /** Buchung in die Outbox legen; Worker führt sie asynchron gegen GitLab aus. */
    bookEntry(entryId: number): void {
      const entry = repo.entries.getById(entryId);
      if (!entry) throw appError("NOT_FOUND", `Entry ${entryId} nicht gefunden`, false);

      const ticket = repo.tickets.getForEntry(entryId);
      if (!ticket) {
        throw appError("NO_TICKET", "Entry hat kein zugewiesenes Ticket", false);
      }

      const payload: BookingPayload = {
        entryId,
        projectId: ticket.projectId,
        ticketIid: ticket.gitlabIid,
        durationMinutes: entry.durationMinutes,
        note: entry.title,
      };
      repo.eventQueue.enqueue("booking", payload);
      repo.entries.updateStatus(entryId, "pending_booking");
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;

import type { Repository } from "../repository";
import type { Booking } from "../../shared/types";
import { appError } from "../lib/app-error";

export interface BookingPayload {
  entryId: number;
  ticketId: number; // lokale Ticket-ID für die bookings-Tabelle
  projectId: number;
  ticketIid: number;
  durationMinutes: number;
  spentAt: string; // ISO-Date (YYYY-MM-DD), aus dem Entry-Datum abgeleitet
  note: string; // Entry-Text, der als Notiz in der Buchung erscheint
}

/** Entry-Titel + optionale Notizen zu einem Buchungstext zusammenfassen. */
function bookingNote(title: string, notes: string | null): string {
  return notes && notes.trim() ? `${title}\n${notes.trim()}` : title;
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
        ticketId: ticket.id,
        projectId: ticket.projectId,
        ticketIid: ticket.gitlabIid,
        durationMinutes: entry.durationMinutes,
        spentAt: entry.date.slice(0, 10), // Entry-Datum (UTC) → reines ISO-Date
        note: bookingNote(entry.title, entry.notes),
      };
      repo.eventQueue.enqueue("booking", payload);
      repo.entries.updateStatus(entryId, "pending_booking");
    },

    /** Buchungshistorie eines Entries (für RPC getBookingsForEntry). */
    listForEntry(entryId: number): Booking[] {
      return repo.bookings.listByEntry(entryId);
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;

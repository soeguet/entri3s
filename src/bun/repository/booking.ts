import type { Database } from "bun:sqlite";
import type { Booking, BookingInsert } from "../../shared/types";

interface BookingRow {
  id: number;
  entry_id: number;
  ticket_id: number;
  gitlab_note_id: number;
  project_id: number;
  issue_iid: number;
  duration_minutes: number;
  note: string;
  spent_at: string;
  booked_at: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    entryId: row.entry_id,
    ticketId: row.ticket_id,
    gitlabNoteId: row.gitlab_note_id,
    projectId: row.project_id,
    issueIid: row.issue_iid,
    durationMinutes: row.duration_minutes,
    note: row.note,
    spentAt: row.spent_at,
    bookedAt: row.booked_at,
  };
}

export function createBookingRepository(db: Database) {
  return {
    create(input: BookingInsert): number {
      const row = db
        .query<{ id: number }, [number, number, number, number, number, number, string, string]>(
          `INSERT INTO bookings
             (entry_id, ticket_id, gitlab_note_id, project_id, issue_iid, duration_minutes, note, spent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .get(
          input.entryId,
          input.ticketId,
          input.gitlabNoteId,
          input.projectId,
          input.issueIid,
          input.durationMinutes,
          input.note,
          input.spentAt,
        )!;
      return row.id;
    },

    listByEntry(entryId: number): Booking[] {
      return db
        .query<BookingRow, [number]>(
          "SELECT * FROM bookings WHERE entry_id = ? ORDER BY booked_at DESC",
        )
        .all(entryId)
        .map(toBooking);
    },

    listByDateRange(from: string, to: string): Booking[] {
      return db
        .query<BookingRow, [string, string]>(
          "SELECT * FROM bookings WHERE spent_at >= ? AND spent_at <= ? ORDER BY spent_at DESC",
        )
        .all(from, to)
        .map(toBooking);
    },

    getByNoteId(noteId: number, projectId: number): Booking | null {
      const row = db
        .query<BookingRow, [number, number]>(
          "SELECT * FROM bookings WHERE gitlab_note_id = ? AND project_id = ?",
        )
        .get(noteId, projectId);
      return row ? toBooking(row) : null;
    },
  };
}

export type BookingRepository = ReturnType<typeof createBookingRepository>;

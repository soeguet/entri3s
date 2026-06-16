import type { Entry, EntryFilter } from "../../shared/types";
import type { Repository } from "../repository";
import type { EntryInput } from "../repository/entry";
import { appError } from "../lib/app-error";

function startEnd(date: string, durationMinutes: number): [number, number] {
  const start = new Date(date).getTime();
  return [start, start + durationMinutes * 60_000];
}

/** Überschneidung: startA < endB && endA > startB (Berührung an den Rändern ist ok). */
function overlaps(a: Entry, bDate: string, bDuration: number): boolean {
  const [startA, endA] = startEnd(a.date, a.durationMinutes);
  const [startB, endB] = startEnd(bDate, bDuration);
  return startA < endB && endA > startB;
}

export function createEntryService(repo: Repository) {
  function assertNoOverlap(date: string, durationMinutes: number, ignoreId?: number): void {
    const existing = repo.entries.list();
    for (const e of existing) {
      if (e.id === ignoreId) continue;
      if (overlaps(e, date, durationMinutes)) {
        throw appError("OVERLAP", `Überschneidung mit Entry "${e.title}"`, false);
      }
    }
  }

  return {
    getAll(filter: EntryFilter = {}): Entry[] {
      return repo.entries.list(filter);
    },

    getById(id: number): Entry {
      const entry = repo.entries.getById(id);
      if (!entry) throw appError("NOT_FOUND", `Entry ${id} nicht gefunden`, false);
      return entry;
    },

    create(input: EntryInput): number {
      assertNoOverlap(input.date, input.durationMinutes);
      return repo.entries.create(input);
    },

    update(entry: Entry): void {
      if (!repo.entries.getById(entry.id)) {
        throw appError("NOT_FOUND", `Entry ${entry.id} nicht gefunden`, false);
      }
      assertNoOverlap(entry.date, entry.durationMinutes, entry.id);
      repo.entries.update(entry);
    },

    delete(id: number): void {
      repo.entries.delete(id);
    },

    assignTicket(entryId: number, ticketId: number): void {
      if (!repo.entries.getById(entryId)) {
        throw appError("NOT_FOUND", `Entry ${entryId} nicht gefunden`, false);
      }
      repo.entries.assignTicket(entryId, ticketId);
    },

    removeTicket(entryId: number, ticketId: number): void {
      repo.entries.removeTicket(entryId, ticketId);
    },
  };
}

export type EntryService = ReturnType<typeof createEntryService>;

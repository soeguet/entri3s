import type { Entry, EntryFilter } from "../../shared/types";
import type { Repository } from "../repository";
import type { EntryInput } from "../repository/entry";
import { appError } from "../lib/app-error";

// Zeitliche Überschneidungen zwischen Entries sind bewusst erlaubt: parallele
// Tätigkeiten (z.B. Meeting während eines laufenden Tasks) sollen nicht blockiert
// werden. Daher gibt es hier keine Overlap-Prüfung mehr.

export function createEntryService(repo: Repository) {
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
      return repo.entries.create(input);
    },

    update(entry: Entry): void {
      if (!repo.entries.getById(entry.id)) {
        throw appError("NOT_FOUND", `Entry ${entry.id} nicht gefunden`, false);
      }
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

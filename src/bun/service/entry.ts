import type { Entry, EntryFilter, EntryStart } from "../../shared/types";
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

    getRunning(): Entry | null {
      return repo.entries.getRunning();
    },

    // Startet einen laufenden Entry. `date` = Startzeitpunkt, Dauer bleibt 0
    // bis zum Stop. Höchstens ein laufender Entry gleichzeitig.
    start(input: EntryStart): number {
      if (repo.entries.getRunning()) {
        throw appError("ALREADY_RUNNING", "Es läuft bereits ein Timer.", false);
      }
      return repo.entries.create({
        notes: input.notes,
        durationMinutes: 0,
        date: input.startAt ?? new Date().toISOString(),
        status: "running",
        tagIds: [],
        ticketIds: input.ticketId === null ? [] : [input.ticketId],
      });
    },

    // Stoppt den laufenden Entry: friert die Dauer ein (mind. 1 Minute) und
    // setzt den Status auf 'draft' — ab da ein normaler, buchbarer Entry.
    stop(id: number): void {
      const entry = repo.entries.getById(id);
      if (!entry) throw appError("NOT_FOUND", `Entry ${id} nicht gefunden`, false);
      if (entry.status !== "running") {
        throw appError("NOT_RUNNING", `Entry ${id} läuft nicht.`, false);
      }
      const elapsedMs = Date.now() - new Date(entry.date).getTime();
      const durationMinutes = Math.max(1, Math.round(elapsedMs / 60_000));
      repo.entries.update({ ...entry, durationMinutes, status: "draft" });
    },

    // Schreibt nur die Notiz (für laufendes Autosave) — rührt Dauer, Datum und
    // Relationen bewusst nicht an.
    setNotes(id: number, notes: string | null): void {
      if (!repo.entries.getById(id)) {
        throw appError("NOT_FOUND", `Entry ${id} nicht gefunden`, false);
      }
      repo.entries.updateNotes(id, notes);
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

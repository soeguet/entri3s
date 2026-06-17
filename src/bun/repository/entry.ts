import type { Database } from "bun:sqlite";
import type { Entry, EntryFilter, EntryStatus } from "../../shared/types";

interface EntryRow {
  id: number;
  notes: string | null;
  duration: number;
  date: string;
  status: EntryStatus;
  created_at: string;
  updated_at: string;
}

export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt">;

export function createEntryRepository(db: Database) {
  function relationIds(table: string, column: string, entryId: number): number[] {
    return db
      .query<{ id: number }, [number]>(`SELECT ${column} AS id FROM ${table} WHERE entry_id = ?`)
      .all(entryId)
      .map((r) => r.id);
  }

  function toEntry(row: EntryRow): Entry {
    return {
      id: row.id,
      notes: row.notes,
      durationMinutes: row.duration,
      date: row.date,
      status: row.status,
      tagIds: relationIds("entry_tags", "tag_id", row.id),
      ticketIds: relationIds("entry_tickets", "ticket_id", row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function replaceRelations(entryId: number, tagIds: number[], ticketIds: number[]): void {
    db.run("DELETE FROM entry_tags WHERE entry_id = ?", [entryId]);
    db.run("DELETE FROM entry_tickets WHERE entry_id = ?", [entryId]);
    for (const tagId of tagIds) {
      db.run("INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)", [entryId, tagId]);
    }
    for (const ticketId of ticketIds) {
      db.run("INSERT INTO entry_tickets (entry_id, ticket_id) VALUES (?, ?)", [entryId, ticketId]);
    }
  }

  return {
    getById(id: number): Entry | null {
      const row = db.query<EntryRow, [number]>("SELECT * FROM entries WHERE id = ?").get(id);
      return row ? toEntry(row) : null;
    },

    list(filter: EntryFilter = {}): Entry[] {
      const where: string[] = [];
      const params: (string | number)[] = [];
      if (filter.dateFrom) {
        where.push("date >= ?");
        params.push(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.push("date <= ?");
        params.push(filter.dateTo);
      }
      if (filter.status) {
        where.push("status = ?");
        params.push(filter.status);
      }
      if (filter.tagIds && filter.tagIds.length > 0) {
        const placeholders = filter.tagIds.map(() => "?").join(", ");
        where.push(`id IN (SELECT entry_id FROM entry_tags WHERE tag_id IN (${placeholders}))`);
        params.push(...filter.tagIds);
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const rows = db
        .query<EntryRow, (string | number)[]>(`SELECT * FROM entries ${clause} ORDER BY date DESC`)
        .all(...params);
      return rows.map(toEntry);
    },

    create(input: EntryInput): number {
      const now = new Date().toISOString();
      const row = db
        .query<{ id: number }, [string | null, number, string, string, string, string]>(
          `INSERT INTO entries (notes, duration, date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .get(input.notes, input.durationMinutes, input.date, input.status, now, now)!;
      replaceRelations(row.id, input.tagIds, input.ticketIds);
      return row.id;
    },

    update(entry: Entry): void {
      db.run(
        `UPDATE entries SET notes = ?, duration = ?, date = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          entry.notes,
          entry.durationMinutes,
          entry.date,
          entry.status,
          new Date().toISOString(),
          entry.id,
        ],
      );
      replaceRelations(entry.id, entry.tagIds, entry.ticketIds);
    },

    updateStatus(id: number, status: EntryStatus): void {
      db.run("UPDATE entries SET status = ?, updated_at = ? WHERE id = ?", [
        status,
        new Date().toISOString(),
        id,
      ]);
    },

    delete(id: number): void {
      db.run("DELETE FROM entries WHERE id = ?", [id]);
    },

    assignTicket(entryId: number, ticketId: number): void {
      db.run("INSERT OR IGNORE INTO entry_tickets (entry_id, ticket_id) VALUES (?, ?)", [
        entryId,
        ticketId,
      ]);
    },

    removeTicket(entryId: number, ticketId: number): void {
      db.run("DELETE FROM entry_tickets WHERE entry_id = ? AND ticket_id = ?", [entryId, ticketId]);
    },
  };
}

export type EntryRepository = ReturnType<typeof createEntryRepository>;

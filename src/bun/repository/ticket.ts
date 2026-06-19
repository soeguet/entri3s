import type { Database } from "bun:sqlite";
import type {
  Ticket,
  TicketAssignee,
  TicketFilter,
  TicketState,
  TicketStatus,
} from "../../shared/types";

interface TicketRow {
  id: number;
  gitlab_iid: number;
  gitlab_global_id: number | null;
  project_id: number;
  title: string;
  state: TicketState;
  status: TicketStatus;
  time_estimate: number | null;
  time_spent: number | null;
  web_url: string | null;
  notes_count: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AssigneeRow {
  ticket_id: number;
  gitlab_user_id: number;
  username: string;
  name: string;
}

export interface TicketUpsert {
  gitlabIid: number;
  gitlabGlobalId: number | null;
  projectId: number;
  title: string;
  state: TicketState;
  timeEstimate: number | null;
  timeSpent: number | null;
  webUrl: string | null;
  notesCount: number;
}

function toTicket(row: TicketRow, assignees: TicketAssignee[], pinned: boolean): Ticket {
  return {
    id: row.id,
    gitlabIid: row.gitlab_iid,
    gitlabGlobalId: row.gitlab_global_id,
    projectId: row.project_id,
    title: row.title,
    state: row.state,
    status: row.status,
    timeEstimate: row.time_estimate,
    timeSpent: row.time_spent,
    webUrl: row.web_url,
    notesCount: row.notes_count,
    assignees,
    pinned,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketRepository(db: Database) {
  /**
   * Lädt Assignees für mehrere Tickets GEBÜNDELT (eine Query, dann in JS nach
   * ticket_id gruppieren) — kein N+1 über die Ergebnisliste.
   */
  function loadAssignees(ticketIds: number[]): Map<number, TicketAssignee[]> {
    const grouped = new Map<number, TicketAssignee[]>();
    if (ticketIds.length === 0) return grouped;
    const placeholders = ticketIds.map(() => "?").join(", ");
    const rows = db
      .query<AssigneeRow, number[]>(
        `SELECT ticket_id, gitlab_user_id, username, name
         FROM ticket_assignees WHERE ticket_id IN (${placeholders})
         ORDER BY name`,
      )
      .all(...ticketIds);
    for (const r of rows) {
      const list = grouped.get(r.ticket_id) ?? [];
      list.push({ gitlabUserId: r.gitlab_user_id, username: r.username, name: r.name });
      grouped.set(r.ticket_id, list);
    }
    return grouped;
  }

  /**
   * Lädt die gepinnten ticket_ids für mehrere Tickets GEBÜNDELT (eine Query) —
   * analog zu loadAssignees, kein N+1 über die Ergebnisliste.
   */
  function loadPinned(ticketIds: number[]): Set<number> {
    const pinned = new Set<number>();
    if (ticketIds.length === 0) return pinned;
    const placeholders = ticketIds.map(() => "?").join(", ");
    const rows = db
      .query<{ ticket_id: number }, number[]>(
        `SELECT ticket_id FROM ticket_pins WHERE ticket_id IN (${placeholders})`,
      )
      .all(...ticketIds);
    for (const r of rows) pinned.add(r.ticket_id);
    return pinned;
  }

  function mapRows(rows: TicketRow[]): Ticket[] {
    const byTicket = loadAssignees(rows.map((r) => r.id));
    const pinned = loadPinned(rows.map((r) => r.id));
    return rows.map((row) => toTicket(row, byTicket.get(row.id) ?? [], pinned.has(row.id)));
  }

  function mapRow(row: TicketRow | null): Ticket | null {
    if (!row) return null;
    const pinned = loadPinned([row.id]);
    return toTicket(row, loadAssignees([row.id]).get(row.id) ?? [], pinned.has(row.id));
  }

  return {
    getById(id: number): Ticket | null {
      return mapRow(db.query<TicketRow, [number]>("SELECT * FROM tickets WHERE id = ?").get(id));
    },

    /** Erstes einem Entry zugewiesenes Ticket (für Buchungen). */
    getForEntry(entryId: number): Ticket | null {
      const row = db
        .query<TicketRow, [number]>(
          `SELECT t.* FROM tickets t
           JOIN entry_tickets et ON et.ticket_id = t.id
           WHERE et.entry_id = ? ORDER BY t.id LIMIT 1`,
        )
        .get(entryId);
      return mapRow(row);
    },

    getByGitLabIid(gitlabIid: number, projectId: number): Ticket | null {
      const row = db
        .query<TicketRow, [number, number]>(
          "SELECT * FROM tickets WHERE gitlab_iid = ? AND project_id = ?",
        )
        .get(gitlabIid, projectId);
      return mapRow(row);
    },

    /**
     * `currentUserId` ist optional und ergänzt `filter.assignedToMe`: nur wenn beide
     * vorliegen, wird auf Tickets mit diesem Assignee eingeschränkt (EXISTS-Subquery).
     * Der Filter-Typ bleibt sauber (keine assigneeId im shared TicketFilter).
     */
    list(filter: TicketFilter = {}, currentUserId?: number): Ticket[] {
      const where: string[] = [];
      const params: (string | number)[] = [];
      if (filter.status) {
        where.push("status = ?");
        params.push(filter.status);
      }
      if (filter.state) {
        where.push("state = ?");
        params.push(filter.state);
      }
      if (filter.assignedToMe && currentUserId !== undefined) {
        where.push(
          "EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = tickets.id AND ta.gitlab_user_id = ?)",
        );
        params.push(currentUserId);
      }
      if (filter.pinned) {
        where.push("EXISTS (SELECT 1 FROM ticket_pins tp WHERE tp.ticket_id = tickets.id)");
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const rows = db
        .query<TicketRow, (string | number)[]>(
          `SELECT * FROM tickets ${clause} ORDER BY gitlab_iid DESC`,
        )
        .all(...params);
      return mapRows(rows);
    },

    /**
     * Aktive Tickets, sortiert nach jüngster Verwendung in Entries (zuletzt
     * gebuchte/bearbeitete zuerst). Speist die „zuletzt verwendet"-Sektion der
     * Ticket-Auswahl im EntryForm.
     */
    listRecent(limit: number): Ticket[] {
      const rows = db
        .query<TicketRow, [number]>(
          `SELECT t.* FROM tickets t
           JOIN entry_tickets et ON et.ticket_id = t.id
           JOIN entries e ON e.id = et.entry_id
           WHERE t.status = 'active'
           GROUP BY t.id
           ORDER BY MAX(e.updated_at) DESC
           LIMIT ?`,
        )
        .all(limit);
      return mapRows(rows);
    },

    /**
     * Ersetzt die Assignees eines Tickets vollständig (Replace-Strategie, da
     * GitLab pro Sync die komplette Liste liefert).
     */
    setAssignees(ticketId: number, assignees: TicketAssignee[]): void {
      db.run("DELETE FROM ticket_assignees WHERE ticket_id = ?", [ticketId]);
      for (const a of assignees) {
        db.run(
          "INSERT INTO ticket_assignees (ticket_id, gitlab_user_id, username, name) VALUES (?, ?, ?, ?)",
          [ticketId, a.gitlabUserId, a.username, a.name],
        );
      }
    },

    upsert(input: TicketUpsert): void {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO tickets
           (gitlab_iid, gitlab_global_id, project_id, title, state, status, time_estimate, time_spent, web_url, notes_count, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(gitlab_iid, project_id) DO UPDATE SET
           gitlab_global_id = excluded.gitlab_global_id,
           title = excluded.title,
           state = excluded.state,
           time_estimate = excluded.time_estimate,
           time_spent = excluded.time_spent,
           web_url = excluded.web_url,
           notes_count = excluded.notes_count,
           synced_at = excluded.synced_at,
           updated_at = excluded.updated_at`,
        [
          input.gitlabIid,
          input.gitlabGlobalId,
          input.projectId,
          input.title,
          input.state,
          input.timeEstimate,
          input.timeSpent,
          input.webUrl,
          input.notesCount,
          now,
          now,
          now,
        ],
      );
    },

    markOrphaned(gitlabIid: number, projectId: number): void {
      db.run(
        "UPDATE tickets SET status = 'orphaned', updated_at = ? WHERE gitlab_iid = ? AND project_id = ?",
        [new Date().toISOString(), gitlabIid, projectId],
      );
    },

    /** Wieder geöffnetes Ticket reaktivieren (status zurück auf 'active'). */
    markActive(gitlabIid: number, projectId: number): void {
      db.run(
        "UPDATE tickets SET status = 'active', updated_at = ? WHERE gitlab_iid = ? AND project_id = ?",
        [new Date().toISOString(), gitlabIid, projectId],
      );
    },

    setStatus(id: number, status: TicketStatus): void {
      db.run("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?", [
        status,
        new Date().toISOString(),
        id,
      ]);
    },

    pin(ticketId: number): void {
      db.run("INSERT OR IGNORE INTO ticket_pins (ticket_id) VALUES (?)", [ticketId]);
    },

    unpin(ticketId: number): void {
      db.run("DELETE FROM ticket_pins WHERE ticket_id = ?", [ticketId]);
    },

    /** Aktive gepinnte Tickets, jüngst gepinnte zuerst. */
    listPinned(): Ticket[] {
      const rows = db
        .query<TicketRow, []>(
          `SELECT t.* FROM tickets t JOIN ticket_pins p ON p.ticket_id = t.id
           WHERE t.status = 'active' ORDER BY p.pinned_at DESC`,
        )
        .all();
      return mapRows(rows);
    },
  };
}

export type TicketRepository = ReturnType<typeof createTicketRepository>;

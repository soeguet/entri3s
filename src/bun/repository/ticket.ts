import type { Database } from "bun:sqlite";
import type { Ticket, TicketFilter, TicketState, TicketStatus } from "../../shared/types";

interface TicketRow {
  id: number;
  gitlab_iid: number;
  project_id: number;
  title: string;
  state: TicketState;
  status: TicketStatus;
  time_estimate: number | null;
  time_spent: number | null;
  web_url: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketUpsert {
  gitlabIid: number;
  projectId: number;
  title: string;
  state: TicketState;
  timeEstimate: number | null;
  timeSpent: number | null;
  webUrl: string | null;
}

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    gitlabIid: row.gitlab_iid,
    projectId: row.project_id,
    title: row.title,
    state: row.state,
    status: row.status,
    timeEstimate: row.time_estimate,
    timeSpent: row.time_spent,
    webUrl: row.web_url,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketRepository(db: Database) {
  return {
    getById(id: number): Ticket | null {
      const row = db.query<TicketRow, [number]>("SELECT * FROM tickets WHERE id = ?").get(id);
      return row ? toTicket(row) : null;
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
      return row ? toTicket(row) : null;
    },

    getByGitLabIid(gitlabIid: number, projectId: number): Ticket | null {
      const row = db
        .query<TicketRow, [number, number]>(
          "SELECT * FROM tickets WHERE gitlab_iid = ? AND project_id = ?",
        )
        .get(gitlabIid, projectId);
      return row ? toTicket(row) : null;
    },

    list(filter: TicketFilter = {}): Ticket[] {
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
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      return db
        .query<TicketRow, (string | number)[]>(
          `SELECT * FROM tickets ${clause} ORDER BY gitlab_iid DESC`,
        )
        .all(...params)
        .map(toTicket);
    },

    upsert(input: TicketUpsert): void {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO tickets
           (gitlab_iid, project_id, title, state, status, time_estimate, time_spent, web_url, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
         ON CONFLICT(gitlab_iid, project_id) DO UPDATE SET
           title = excluded.title,
           state = excluded.state,
           time_estimate = excluded.time_estimate,
           time_spent = excluded.time_spent,
           web_url = excluded.web_url,
           synced_at = excluded.synced_at,
           updated_at = excluded.updated_at`,
        [
          input.gitlabIid,
          input.projectId,
          input.title,
          input.state,
          input.timeEstimate,
          input.timeSpent,
          input.webUrl,
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
  };
}

export type TicketRepository = ReturnType<typeof createTicketRepository>;

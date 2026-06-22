import type { Database } from "bun:sqlite";
import type {
  Ticket,
  TicketAssignee,
  TicketFilter,
  TicketLabel,
  TicketState,
  TicketStatus,
} from "../../shared/types";
import { loadAssignees, loadPinned, loadReadState } from "./ticket-relations";

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
  description: string | null;
  description_html: string | null;
  author_username: string | null;
  author_name: string | null;
  milestone_title: string | null;
  labels_json: string | null;
  due_date: string | null;
  issue_created_at: string | null;
  synced_at: string | null;
  // created_at/updated_at sind LOKALE Sync-Zeiten der tickets-Tabelle,
  // NICHT das GitLab-Erstelldatum (das liegt in issue_created_at).
  created_at: string;
  updated_at: string;
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
  description: string | null;
  descriptionHtml: string | null;
  authorUsername: string | null;
  authorName: string | null;
  milestoneTitle: string | null;
  labels: TicketLabel[];
  dueDate: string | null;
  issueCreatedAt: string | null;
}

/** Liest die als JSON gespeicherten Labels null-sicher zurück (defekt/null → []). */
function parseLabels(json: string | null): TicketLabel[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as TicketLabel[]) : [];
  } catch {
    return [];
  }
}

function toTicket(
  row: TicketRow,
  assignees: TicketAssignee[],
  pinned: boolean,
  unread: boolean,
  lastViewedAt: string | null,
): Ticket {
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
    description: row.description,
    descriptionHtml: row.description_html,
    labels: parseLabels(row.labels_json),
    author:
      row.author_username !== null && row.author_name !== null
        ? { username: row.author_username, name: row.author_name }
        : null,
    milestoneTitle: row.milestone_title,
    dueDate: row.due_date,
    issueCreatedAt: row.issue_created_at,
    pinned,
    unread,
    lastViewedAt,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketRepository(db: Database) {
  function mapRows(rows: TicketRow[]): Ticket[] {
    const byTicket = loadAssignees(
      db,
      rows.map((r) => r.id),
    );
    const pinned = loadPinned(
      db,
      rows.map((r) => r.id),
    );
    const readState = loadReadState(
      db,
      rows.map((r) => r.id),
    );
    return rows.map((row) => {
      const rs = readState.get(row.id);
      const unread = rs === undefined ? true : row.notes_count > rs.count;
      return toTicket(
        row,
        byTicket.get(row.id) ?? [],
        pinned.has(row.id),
        unread,
        rs?.viewedAt ?? null,
      );
    });
  }

  function mapRow(row: TicketRow | null): Ticket | null {
    if (!row) return null;
    const pinned = loadPinned(db, [row.id]);
    const rs = loadReadState(db, [row.id]).get(row.id);
    const unread = rs === undefined ? true : row.notes_count > rs.count;
    return toTicket(
      row,
      loadAssignees(db, [row.id]).get(row.id) ?? [],
      pinned.has(row.id),
      unread,
      rs?.viewedAt ?? null,
    );
  }

  /**
   * Baut die WHERE-Klausel für die Ticket-Filterung. Wird von list() UND
   * markAllRead() genutzt, damit beide garantiert identisch filtern.
   * `currentUserId` ergänzt `filter.assignedToMe` (siehe list()-Doc).
   */
  function buildFilterClause(
    filter: TicketFilter,
    currentUserId?: number,
  ): { clause: string; params: (string | number)[] } {
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
    if (filter.unread) {
      where.push(
        `(NOT EXISTS (SELECT 1 FROM ticket_read_state r WHERE r.ticket_id = tickets.id)
      OR tickets.notes_count > (SELECT last_comment_count FROM ticket_read_state r WHERE r.ticket_id = tickets.id))`,
      );
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return { clause, params };
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
      const { clause, params } = buildFilterClause(filter, currentUserId);
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
           (gitlab_iid, gitlab_global_id, project_id, title, state, status, time_estimate, time_spent, web_url, notes_count,
            description, description_html, author_username, author_name, milestone_title, labels_json, due_date, issue_created_at,
            synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(gitlab_iid, project_id) DO UPDATE SET
           gitlab_global_id = excluded.gitlab_global_id,
           title = excluded.title,
           state = excluded.state,
           time_estimate = excluded.time_estimate,
           time_spent = excluded.time_spent,
           web_url = excluded.web_url,
           notes_count = excluded.notes_count,
           description = excluded.description,
           description_html = excluded.description_html,
           author_username = excluded.author_username,
           author_name = excluded.author_name,
           milestone_title = excluded.milestone_title,
           labels_json = excluded.labels_json,
           due_date = excluded.due_date,
           issue_created_at = excluded.issue_created_at,
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
          input.description,
          input.descriptionHtml,
          input.authorUsername,
          input.authorName,
          input.milestoneTitle,
          JSON.stringify(input.labels),
          input.dueDate,
          input.issueCreatedAt,
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

    markRead(ticketId: number): void {
      db.run(
        `INSERT INTO ticket_read_state (ticket_id, last_viewed_at, last_comment_count)
         VALUES (?, ?, (SELECT notes_count FROM tickets WHERE id = ?))
         ON CONFLICT(ticket_id) DO UPDATE SET
           last_viewed_at = excluded.last_viewed_at,
           last_comment_count = excluded.last_comment_count`,
        [ticketId, new Date().toISOString(), ticketId],
      );
    },

    /**
     * Markiert NUR die zum Filter passenden Tickets als gelesen — dieselbe
     * WHERE-Logik wie list() (via buildFilterClause), damit "Alle als gelesen"
     * exakt den aktiven Filter respektiert.
     */
    markAllRead(filter: TicketFilter = {}, currentUserId?: number): void {
      const { clause, params } = buildFilterClause(filter, currentUserId);
      // Fallback "WHERE 1=1" bei leerem Filter: ohne ein Token zwischen
      // `FROM tickets` und `ON CONFLICT` deutet SQLite das ON als JOIN ("near DO").
      const whereClause = clause === "" ? "WHERE 1=1" : clause;
      db.run(
        `INSERT INTO ticket_read_state (ticket_id, last_viewed_at, last_comment_count)
         SELECT id, ?, notes_count FROM tickets ${whereClause}
         ON CONFLICT(ticket_id) DO UPDATE SET
           last_viewed_at = excluded.last_viewed_at,
           last_comment_count = excluded.last_comment_count`,
        [new Date().toISOString(), ...params],
      );
    },

    /**
     * GLOBALE Anzahl ungelesener aktiver Tickets (ungefiltert, echter
     * Gesamtstand für das Badge neben dem Sync-Button). "Ungelesen" exakt wie
     * der unread-Filter in list(): kein read-state ODER notes_count gewachsen.
     */
    countUnread(): number {
      const row = db
        .query<{ n: number }, []>(
          `SELECT COUNT(*) AS n FROM tickets
           WHERE status = 'active'
             AND (NOT EXISTS (SELECT 1 FROM ticket_read_state r WHERE r.ticket_id = tickets.id)
               OR tickets.notes_count > (SELECT last_comment_count FROM ticket_read_state r WHERE r.ticket_id = tickets.id))`,
        )
        .get();
      return row?.n ?? 0;
    },

    /**
     * Hash über den letzten Kommentar-Stand eines Tickets (interner Sync-Marker,
     * NICHT Teil des Ticket-Domain-Typs). Erlaubt dem Kommentar-Sync, einen
     * unveränderten Stand zu erkennen und einen DB-Schreibvorgang zu sparen.
     */
    getCommentsHash(ticketId: number): string | null {
      const row = db
        .query<{ comments_hash: string | null }, [number]>(
          "SELECT comments_hash FROM tickets WHERE id = ?",
        )
        .get(ticketId);
      return row?.comments_hash ?? null;
    },

    setCommentsHash(ticketId: number, hash: string): void {
      db.run("UPDATE tickets SET comments_hash = ? WHERE id = ?", [hash, ticketId]);
    },

    /** Distinct project_ids für eine Menge Ticket-IDs (Eingrenzung der Commit-Abfrage). */
    projectIdsForTickets(ticketIds: number[]): number[] {
      if (ticketIds.length === 0) return [];
      const placeholders = ticketIds.map(() => "?").join(", ");
      return db
        .query<{ project_id: number }, number[]>(
          `SELECT DISTINCT project_id FROM tickets WHERE id IN (${placeholders})`,
        )
        .all(...ticketIds)
        .map((r) => r.project_id);
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

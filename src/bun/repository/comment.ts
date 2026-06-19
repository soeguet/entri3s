import type { Database } from "bun:sqlite";
import type { TicketComment } from "../../shared/types";

interface CommentRow {
  id: number;
  ticket_id: number;
  gitlab_note_id: number;
  discussion_id: string | null;
  author_username: string;
  author_name: string;
  body: string;
  body_html: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

function toTicketComment(row: CommentRow): TicketComment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    gitlabNoteId: row.gitlab_note_id,
    discussionId: row.discussion_id ?? "",
    authorUsername: row.author_username,
    authorName: row.author_name,
    body: row.body,
    bodyHtml: row.body_html,
    isSystem: row.is_system === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCommentRepository(db: Database) {
  return {
    listForTicket(ticketId: number): TicketComment[] {
      return db
        .query<CommentRow, [number]>(
          "SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC",
        )
        .all(ticketId)
        .map(toTicketComment);
    },

    /**
     * Ersetzt die Kommentare eines Tickets vollständig (Replace-Strategie, da
     * GitLab pro Sync die komplette Notes-Liste liefert). In EINER Transaktion,
     * damit zwischen DELETE und INSERTs kein leerer Zwischenzustand sichtbar wird.
     */
    replaceForTicket(ticketId: number, comments: Omit<TicketComment, "id" | "ticketId">[]): void {
      const syncedAt = new Date().toISOString();
      db.transaction(() => {
        db.run("DELETE FROM ticket_comments WHERE ticket_id = ?", [ticketId]);
        for (const c of comments) {
          db.run(
            `INSERT INTO ticket_comments
               (ticket_id, gitlab_note_id, discussion_id, author_username, author_name, body, body_html, is_system, created_at, updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ticketId,
              c.gitlabNoteId,
              c.discussionId,
              c.authorUsername,
              c.authorName,
              c.body,
              c.bodyHtml,
              c.isSystem ? 1 : 0,
              c.createdAt,
              c.updatedAt,
              syncedAt,
            ],
          );
        }
      })();
    },
  };
}

export type CommentRepository = ReturnType<typeof createCommentRepository>;

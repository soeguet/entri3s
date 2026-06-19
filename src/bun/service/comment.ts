import { createHash } from "node:crypto";
import type { Repository } from "../repository";
import type { GitLabClient, GitLabComment } from "../gitlab/types";
import type { Ticket, TicketComment } from "../../shared/types";
import { createLogger } from "../lib/logger";

const log = createLogger("comment");

/**
 * Stabiler Hash über den Kommentar-Stand: jede Note als `noteId|updatedAt`,
 * nach noteId aufsteigend sortiert (reihenfolge-unabhängig), dann sha256.
 * Bleibt der Hash gleich, hat sich nichts geändert → kein DB-Schreibvorgang.
 */
function hashComments(raw: GitLabComment[]): string {
  const lines = [...raw]
    .sort((a, b) => a.noteId - b.noteId)
    .map((c) => `${c.noteId}|${c.updatedAt}`)
    .join("\n");
  return createHash("sha256").update(lines).digest("hex");
}

function toComment(c: GitLabComment): Omit<TicketComment, "id" | "ticketId"> {
  return {
    gitlabNoteId: c.noteId,
    discussionId: c.discussionId,
    authorUsername: c.authorUsername,
    authorName: c.authorName,
    body: c.body,
    bodyHtml: c.bodyHtml,
    isSystem: c.system,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function createCommentService(repo: Repository, gl: GitLabClient) {
  function getComments(ticketId: number): TicketComment[] {
    return repo.comments.listForTicket(ticketId);
  }

  async function syncComments(ticketId: number): Promise<void> {
    const ticket = repo.tickets.getById(ticketId);
    if (!ticket) {
      log.warn("syncComments: Ticket nicht gefunden", { ticketId });
      return;
    }
    const project = repo.projects.getById(ticket.projectId);
    if (!project) {
      log.warn("syncComments: Projekt nicht gefunden", { ticketId, projectId: ticket.projectId });
      return;
    }

    const raw = await gl.fetchTicketComments(project.fullPath, ticket.gitlabIid);
    const hash = hashComments(raw);
    // Unveränderter Stand → kein DB-Schreibvorgang.
    if (hash === repo.tickets.getCommentsHash(ticketId)) return;

    repo.comments.replaceForTicket(ticketId, raw.map(toComment));
    repo.tickets.setCommentsHash(ticketId, hash);
    log.info("Kommentare gesynct", { ticketId, count: raw.length });
  }

  async function syncPinnedAndAssigned(): Promise<void> {
    const byId = new Map<number, Ticket>();
    for (const t of repo.tickets.listPinned()) byId.set(t.id, t);

    const userId = repo.settings.getCurrentUser()?.id;
    if (userId !== undefined) {
      for (const t of repo.tickets.list({ status: "active", assignedToMe: true }, userId)) {
        byId.set(t.id, t);
      }
    }

    // Sequentiell — der gemeinsame Rate-Limiter im GitLab-Client drosselt ohnehin.
    for (const id of byId.keys()) await syncComments(id);
  }

  /**
   * Lädt ein GitLab-Upload-Bild über den Token-authentifizierten Proxy und gibt
   * es als Data-URL zurück, damit das Frontend es inline (ohne eigene Auth)
   * anzeigen kann.
   */
  async function getImage(src: string): Promise<string> {
    const { contentType, base64 } = await gl.fetchUpload(src);
    return `data:${contentType};base64,${base64}`;
  }

  return { getComments, syncComments, syncPinnedAndAssigned, getImage };
}

export type CommentService = ReturnType<typeof createCommentService>;

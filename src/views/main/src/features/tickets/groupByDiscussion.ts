import type { TicketComment } from "../../../../../shared/types";

/**
 * Eine Discussion (Reply-Thread): die erste Note ist der Ursprung (Top-Level),
 * weitere Notes sind Antworten darauf.
 */
export interface CommentDiscussion {
  discussionId: string;
  notes: TicketComment[];
}

/**
 * Gruppiert Kommentare nach discussionId zu Reply-Threads.
 * - Innerhalb einer Discussion: Notes chronologisch aufsteigend (createdAt).
 * - Discussions: chronologisch nach der frühesten createdAt ihrer Notes.
 * Mutiert das Eingangs-Array NICHT (arbeitet auf Kopien).
 */
export function groupByDiscussion(comments: TicketComment[]): CommentDiscussion[] {
  const byId = new Map<string, TicketComment[]>();
  // Kommentare ohne discussionId (Altbestand) bekommen je eine eigene Gruppe über
  // ihre Note-ID, damit sie nicht fälschlich unter dem leeren String verschmelzen.
  for (const c of comments) {
    const key = c.discussionId !== "" ? c.discussionId : `note:${c.gitlabNoteId}`;
    const existing = byId.get(key);
    if (existing) existing.push(c);
    else byId.set(key, [c]);
  }

  const groups: CommentDiscussion[] = [];
  for (const [discussionId, notes] of byId) {
    const sortedNotes = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    groups.push({ discussionId, notes: sortedNotes });
  }

  groups.sort((a, b) => a.notes[0].createdAt.localeCompare(b.notes[0].createdAt));
  return groups;
}

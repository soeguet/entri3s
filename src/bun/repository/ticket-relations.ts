import type { Database } from "bun:sqlite";
import type { TicketAssignee } from "../../shared/types";

interface AssigneeRow {
  ticket_id: number;
  gitlab_user_id: number;
  username: string;
  name: string;
}

/**
 * Lädt Assignees für mehrere Tickets GEBÜNDELT (eine Query, dann in JS nach
 * ticket_id gruppieren) — kein N+1 über die Ergebnisliste.
 */
export function loadAssignees(db: Database, ticketIds: number[]): Map<number, TicketAssignee[]> {
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
export function loadPinned(db: Database, ticketIds: number[]): Set<number> {
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

/**
 * Lädt den read-state (last_comment_count + last_viewed_at) für mehrere Tickets
 * GEBÜNDELT (eine Query) — analog zu loadPinned, kein N+1.
 */
export function loadReadState(
  db: Database,
  ticketIds: number[],
): Map<number, { count: number; viewedAt: string }> {
  const state = new Map<number, { count: number; viewedAt: string }>();
  if (ticketIds.length === 0) return state;
  const placeholders = ticketIds.map(() => "?").join(", ");
  const rows = db
    .query<{ ticket_id: number; last_comment_count: number; last_viewed_at: string }, number[]>(
      `SELECT ticket_id, last_comment_count, last_viewed_at FROM ticket_read_state WHERE ticket_id IN (${placeholders})`,
    )
    .all(...ticketIds);
  for (const r of rows)
    state.set(r.ticket_id, { count: r.last_comment_count, viewedAt: r.last_viewed_at });
  return state;
}

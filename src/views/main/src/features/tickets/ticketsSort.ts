import type { Ticket } from "../../../../../shared/types";

// Sortierbare Spalten der Tickets-Tabelle (Assignee bewusst nicht sortierbar).
// Als Tuple-Literal, damit z.enum() in ticketsSearch.ts die exakte String-Union
// ableitet statt nur `string`; der Typ leitet sich daraus ab (single source).
export const TICKET_SORT_BY = ["iid", "title", "status", "state", "estimate", "spent"] as const;
export type TicketSortBy = (typeof TICKET_SORT_BY)[number];
export type TicketSortDir = "asc" | "desc";

/** Numerischer Wert einer Spalte; null = „–" (timeEstimate/timeSpent können null sein). */
function numValue(t: Ticket, by: TicketSortBy): number | null {
  if (by === "iid") return t.gitlabIid;
  if (by === "estimate") return t.timeEstimate;
  if (by === "spent") return t.timeSpent;
  return null;
}

function strValue(t: Ticket, by: TicketSortBy): string {
  if (by === "title") return t.title;
  if (by === "status") return t.status;
  if (by === "state") return t.state;
  return "";
}

const NUMERIC: readonly TicketSortBy[] = ["iid", "estimate", "spent"];

/**
 * Vergleicht zwei Tickets: gepinnte zuerst, dann nach sortBy/sortDir.
 * null-Werte (–) landen stabil am Ende, unabhängig von der Richtung.
 * Deterministischer Tiebreak über gitlabIid (absteigend), damit gleiche
 * Sortierwerte eine stabile Reihenfolge behalten.
 */
export function compareTickets(a: Ticket, b: Ticket, by: TicketSortBy, dir: TicketSortDir): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

  const sign = dir === "asc" ? 1 : -1;
  let primary = 0;

  if (NUMERIC.includes(by)) {
    const av = numValue(a, by);
    const bv = numValue(b, by);
    if (av == null && bv == null) primary = 0;
    else if (av == null)
      return 1; // null immer ans Ende
    else if (bv == null) return -1;
    else primary = (av - bv) * sign;
  } else {
    primary = strValue(a, by).localeCompare(strValue(b, by)) * sign;
  }

  if (primary !== 0) return primary;
  return b.gitlabIid - a.gitlabIid;
}

/** Tickets einer Gruppe sortieren (pinned-first, dann sortBy/sortDir). */
export function sortTickets(tickets: Ticket[], by: TicketSortBy, dir: TicketSortDir): Ticket[] {
  return [...tickets].sort((a, b) => compareTickets(a, b, by, dir));
}

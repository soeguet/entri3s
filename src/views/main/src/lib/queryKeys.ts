import type { EntryFilter, TicketFilter } from "../../../../shared/types";

/** Query Keys als Konstanten — nie inline Strings in Komponenten. */
export const keys = {
  // Ohne Filter der reine Prefix ["entries"], damit invalidateQueries die
  // gefilterten Queries (["entries", {filter}]) per Prefix-Match trifft —
  // ["entries", undefined] täte das nicht.
  entries: (filter?: EntryFilter) =>
    (filter === undefined ? ["entries"] : ["entries", filter]) as readonly unknown[],
  entry: (id: number) => ["entry", id] as const,
  runningEntry: () => ["runningEntry"] as const,
  // Ohne entryId der reine Prefix, damit invalidateQueries die per-Entry-Queries
  // (["bookings", id]) tatsächlich trifft — ["bookings", undefined] täte das nicht.
  bookings: (entryId?: number) =>
    (entryId === undefined ? ["bookings"] : ["bookings", entryId]) as readonly unknown[],
  // Wie entries: ohne Filter der Prefix ["tickets"], damit Invalidierung greift.
  tickets: (filter?: TicketFilter) =>
    (filter === undefined ? ["tickets"] : ["tickets", filter]) as readonly unknown[],
  recentTickets: () => ["recentTickets"] as const,
  projects: () => ["projects"] as const,
  tags: () => ["tags"] as const,
  templates: () => ["templates"] as const,
  commits: (date: string) => ["commits", date] as const,
  deadEvents: () => ["deadEvents"] as const,
  settings: () => ["settings"] as const,
  // Letzter Sync-Status. triggerSync ist Fire-and-Forget — das Ergebnis kommt
  // asynchron über die syncCompleted/syncFailed-Events; hier zwischengespeichert,
  // damit die TicketsPage einen Sync-Fehler anzeigen kann.
  syncStatus: () => ["syncStatus"] as const,
};

/** Im Query-Cache abgelegter Sync-Status (siehe keys.syncStatus). */
export interface SyncStatus {
  error: string | null;
}

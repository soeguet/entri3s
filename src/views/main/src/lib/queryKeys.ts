import type { EntryFilter, TicketFilter } from "../../../../shared/types";

/** Query Keys als Konstanten — nie inline Strings in Komponenten. */
export const keys = {
  entries: (filter?: EntryFilter) => ["entries", filter] as const,
  entry: (id: number) => ["entry", id] as const,
  // Ohne entryId der reine Prefix, damit invalidateQueries die per-Entry-Queries
  // (["bookings", id]) tatsächlich trifft — ["bookings", undefined] täte das nicht.
  bookings: (entryId?: number) =>
    (entryId === undefined ? ["bookings"] : ["bookings", entryId]) as readonly unknown[],
  tickets: (filter?: TicketFilter) => ["tickets", filter] as const,
  tags: () => ["tags"] as const,
  templates: () => ["templates"] as const,
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

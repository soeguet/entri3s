import type { EntryFilter, TicketFilter } from "../../../../shared/types";

/** Query Keys als Konstanten — nie inline Strings in Komponenten. */
export const keys = {
  entries: (filter?: EntryFilter) => ["entries", filter] as const,
  entry: (id: number) => ["entry", id] as const,
  bookings: (entryId?: number) => ["bookings", entryId] as const,
  tickets: (filter?: TicketFilter) => ["tickets", filter] as const,
  tags: () => ["tags"] as const,
  templates: () => ["templates"] as const,
  deadEvents: () => ["deadEvents"] as const,
  settings: () => ["settings"] as const,
};

import { z } from "zod";
import { TICKET_SORT_BY } from "./ticketsSort";

// Filter/Suche/Auswahl/Sortierung leben in den URL-Search-Params, damit sie beim
// Zurücknavigieren aus der Ticket-Detailseite erhalten bleiben (sonst remountet
// TicketsPage und alles ginge verloren). TicketStatus/TicketState werden NICHT
// als Strings dupliziert, sondern decken hier nur die Filter-Werte inkl. "" ab.
export const ticketsSearchSchema = z.object({
  status: z.enum(["active", "orphaned", ""]).default("active"),
  state: z.enum(["opened", "closed", "locked", ""]).default(""),
  search: z.string().default(""),
  selectedPath: z.string().nullable().default(null),
  assignedToMe: z.boolean().default(false),
  pinnedOnly: z.boolean().default(false),
  unreadOnly: z.boolean().default(false),
  sortBy: z.enum(TICKET_SORT_BY).default("iid"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type TicketsSearch = z.infer<typeof ticketsSearchSchema>;

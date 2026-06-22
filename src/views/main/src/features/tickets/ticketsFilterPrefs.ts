// Cross-Navigation-Gedächtnis für den Tickets-Filter/Such-/Auswahl-/Sortier-State.
// Der Sidebar-`<Link to="/tickets">` und der BackLink der Detailseite tragen KEINE
// Search-Params, remounten TicketsPage also ohne Filter (Reset auf Schema-Defaults).
// Darum persistieren wir den Zustand zusätzlich in localStorage und stellen ihn beim
// Mount wieder her. Die URL-Search-Params bleiben die Live-Quelle der Wahrheit fürs
// gerenderte UI; localStorage ist nur das Gedächtnis über Navigationen hinweg.
// Muster nach filterPrefs.ts: try/catch-gekapselt, defensiv für Tests (kein localStorage).

import { ticketsSearchSchema, type TicketsSearch } from "./ticketsSearch";

const FILTER_KEY = "tickets.filters.state";

export function loadTicketsFilterState(): TicketsSearch | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Über das bestehende Schema re-validieren — kein Duplizieren der Feld-Logik.
    const result = ticketsSearchSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveTicketsFilterState(state: TicketsSearch): void {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(state));
  } catch {
    // localStorage nicht verfügbar (z.B. Tests) — kein Persistieren.
  }
}

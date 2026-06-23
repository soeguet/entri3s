import type { SmartView } from "./smartViewFilter";
import type { TodoFilter, TodoSort } from "./taskFilterSort";

// Gespeicherter Filter ("Saved Filter"/Favorit). Erfasst den kompletten
// Sichtbarkeits-Zustand: Smart-View ODER konkrete Liste, plus Facetten-Filter
// und Sortierung. Reiner FRONTEND-Typ (wie SmartView/TodoFilter) — das Backend
// persistiert die Liste nur als opaken JSON-String.
export interface SavedFilter {
  id: string;
  name: string;
  // view greift nur, wenn listId null ist (Smart-View-Modus).
  view: SmartView | null;
  listId: string | null;
  filter: TodoFilter;
  sort: TodoSort;
}

// Robust gegen leeren/ungültigen String sowie Nicht-Array-Inhalt: liefert dann [].
export function parseSavedFilters(json: string): SavedFilter[] {
  if (json.trim() === "") return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as SavedFilter[]) : [];
  } catch {
    return [];
  }
}

export function serializeSavedFilters(list: SavedFilter[]): string {
  return JSON.stringify(list);
}

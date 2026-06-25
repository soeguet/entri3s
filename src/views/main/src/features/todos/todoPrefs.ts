// Reine UI-Präferenz (View/Liste/Filter/Sort der /todos-Seite) → in localStorage,
// kein RPC. Muster wie features/entries/filterPrefs.ts: try/catch-gekapselt,
// defensiv für Tests (localStorage ggf. nicht verfügbar) und gegen kaputten/
// veralteten JSON-Inhalt. Orthogonal zu useSavedFilters (benannte Backend-Filter).

import { EMPTY_FILTER, type TodoFilter, type TodoSort } from "./taskFilterSort";
import type { SmartView } from "./smartViewFilter";

// Reiner FRONTEND-UI-Typ (kein Domain-/RPC-Typ), daher lokal (Präzedenz: SmartView).
export interface PersistedTodoUi {
  view: SmartView; // aktive Smart-View, wenn keine konkrete Liste gewählt ist
  selectedList: string | null;
  filter: TodoFilter;
  sort: TodoSort;
}

const KEY = "todos.ui.state";

const SMART_VIEWS: SmartView[] = ["today", "overdue", "upcoming", "all"];
const STATUSES: TodoFilter["status"][] = ["all", "open", "done"];
const SORTS: TodoSort[] = ["manual", "priority", "due", "alpha"];

// Defensiv: nimmt unbekannten JSON, prüft jede Facette, fällt sonst auf Default.
function validateFilter(raw: unknown): TodoFilter {
  if (!raw || typeof raw !== "object") return EMPTY_FILTER;
  const obj = raw as Record<string, unknown>;
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string")
    : [];
  const priorities = Array.isArray(obj.priorities)
    ? (obj.priorities.filter((p) => typeof p === "string") as TodoFilter["priorities"])
    : [];
  const status = STATUSES.includes(obj.status as TodoFilter["status"])
    ? (obj.status as TodoFilter["status"])
    : EMPTY_FILTER.status;
  return { tags, priorities, status };
}

export function loadTodoPrefs(): PersistedTodoUi | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const view = SMART_VIEWS.includes(parsed.view) ? (parsed.view as SmartView) : "today";
    const selectedList = typeof parsed.selectedList === "string" ? parsed.selectedList : null;
    const sort = SORTS.includes(parsed.sort) ? (parsed.sort as TodoSort) : "manual";
    return { view, selectedList, filter: validateFilter(parsed.filter), sort };
  } catch {
    return null;
  }
}

export function saveTodoPrefs(state: PersistedTodoUi): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage nicht verfügbar (z.B. Tests) — kein Persistieren.
  }
}

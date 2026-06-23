import type { TodoPriority, TodoTask } from "../../../../../shared/types";

// Reine, testbare Filter-/Sortier-Logik für die Todo-Listenansicht. Wie
// smartViewFilter.ts läuft alles clientseitig über die eine getTodoLists-Query.
// TodoSort/TodoFilter sind reine FRONTEND-UI-Typen (kein Domain-/RPC-Typ),
// daher hier lokal definiert (Präzedenz: SmartView in smartViewFilter.ts).
export type TodoSort = "manual" | "priority" | "due" | "alpha";

export interface TodoFilter {
  tags: string[];
  priorities: TodoPriority[];
  status: "all" | "open" | "done";
}

export const EMPTY_FILTER: TodoFilter = { tags: [], priorities: [], status: "all" };

// Feste Rangordnung highest>…>lowest für die "priority"-Sortierung. Kleinerer
// Rang = wichtiger = weiter oben.
const PRIORITY_RANK: Record<TodoPriority, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  normal: 3,
  low: 4,
  lowest: 5,
};

// true, sobald irgendeine Facette die Sicht einschränkt (für "Zurücksetzen"-UX).
export function isFilterActive(f: TodoFilter): boolean {
  return f.tags.length > 0 || f.priorities.length > 0 || f.status !== "all";
}

// Facetten-Filter: innerhalb einer Facette ODER, über Facetten UND.
function matchesFilter(task: TodoTask, filter: TodoFilter): boolean {
  if (filter.status === "open" && task.done) return false;
  if (filter.status === "done" && !task.done) return false;
  if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false;
  if (filter.tags.length > 0 && !filter.tags.some((tag) => task.tags.includes(tag))) return false;
  return true;
}

// Erst filtern, dann STABIL sortieren (Array.sort ist in modernen Engines stabil;
// "manual" lässt die Reihenfolge unverändert). due: null kommt ans Ende.
export function applyFilterSort(tasks: TodoTask[], filter: TodoFilter, sort: TodoSort): TodoTask[] {
  const filtered = tasks.filter((task) => matchesFilter(task, filter));
  if (sort === "manual") return filtered;
  const out = [...filtered];
  out.sort((a, b) => {
    if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (sort === "due") {
      if (a.due === b.due) return 0;
      if (a.due === null) return 1;
      if (b.due === null) return -1;
      return a.due < b.due ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
  return out;
}

// Sortierte, deduplizierte Tagliste aller Tasks — speist die Filter-UI.
export function allTagsOf(tasks: TodoTask[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b));
}

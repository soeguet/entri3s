import type { TodoTask } from "../../../../../shared/types";

// Smart-Views des Todo-Moduls. Eine einzige getTodoLists-Query liefert alle
// Tasks; die Auswahl welche davon sichtbar sind, passiert rein clientseitig
// über diese Funktionen — kein per-View-RPC.
export type SmartView = "today" | "overdue" | "upcoming" | "all";

// Reine Funktion: filtert flache Task-Liste gegen das heutige Berlin-Datum
// (today als yyyy-MM-dd, vom Aufrufer via todayBerlinYmd() geliefert, damit
// hier testbar ohne Zeitzonen-Abhängigkeit).
//
// - today:    fällig heute (due === today), nicht erledigt.
// - overdue:  fällig vor heute (due < today), nicht erledigt.
// - upcoming: fällig nach heute (due > today), nicht erledigt.
// - all:      alles, inkl. erledigter Tasks (Liste entscheidet selbst).
export function smartViewFilter(tasks: TodoTask[], view: SmartView, today: string): TodoTask[] {
  if (view === "all") return tasks;
  return tasks.filter((task) => {
    if (task.done) return false;
    if (task.due === null) return false;
    if (view === "today") return task.due === today;
    if (view === "overdue") return task.due < today;
    return task.due > today; // upcoming
  });
}

// Zähler pro Smart-View für die Sidebar-Badges. "all" zählt offene Tasks
// (erledigte sind für einen Badge wenig aussagekräftig).
export function smartViewCounts(tasks: TodoTask[], today: string): Record<SmartView, number> {
  return {
    today: smartViewFilter(tasks, "today", today).length,
    overdue: smartViewFilter(tasks, "overdue", today).length,
    upcoming: smartViewFilter(tasks, "upcoming", today).length,
    all: tasks.filter((task) => !task.done).length,
  };
}

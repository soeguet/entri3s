import type { TodoList, TodoTask } from "../../../../../shared/types";
import { applyFilterSort, type TodoFilter, type TodoSort } from "./taskFilterSort";

// Reine Aufbereitung für den kombinierten Modus (#7): aus allen Listen wird je
// Liste eine gefilterte/sortierte Task-Gruppe gemacht. smartViewFilter wird hier
// bewusst NICHT angewandt — der Kombi-Modus ist kein Datums-View, nur der globale
// Facetten-Filter/Sort (applyFilterSort) gilt pro Liste.
//
// Reihenfolge der Listen = Eingangsreihenfolge (getTodoLists liefert bereits
// alphabetisch, Inbox-Default zuerst). Leere Listen (nach Filter 0 Tasks) werden
// ausgelassen, damit die Übersicht nicht von leeren Headern aufgebläht wird.
export function combinedLists(
  lists: TodoList[],
  filter: TodoFilter,
  sort: TodoSort,
): Array<{ list: TodoList; tasks: TodoTask[] }> {
  const out: Array<{ list: TodoList; tasks: TodoTask[] }> = [];
  for (const list of lists) {
    const tasks = applyFilterSort(list.tasks, filter, sort);
    if (tasks.length === 0) continue;
    out.push({ list, tasks });
  }
  return out;
}

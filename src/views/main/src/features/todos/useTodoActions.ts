import type { TodoList, TodoTask, TodoTaskCreate } from "../../../../../shared/types";
import { isFilterActive, type TodoFilter, type TodoSort } from "./taskFilterSort";
import { shouldAutoDue } from "./quickAddList";
import { undoToggleOptions } from "./todoUndo";
import type { useTodoMutations } from "./useTodoMutations";
import type { useSavedFilters } from "./useSavedFilters";
import type { SavedFilter } from "./savedFilters";
import type { SmartView } from "./smartViewFilter";

// Bündelt die Task-/Listen-Handler der TodosPage. Ausgelagert, damit TodosPage
// nach der combined-Verzweigung (#7) unter dem LOC-Limit bleibt. Reines Wiring um
// useTodoMutations — kein eigener State, Verhalten unverändert.
interface TodoActionsDeps {
  mut: ReturnType<typeof useTodoMutations>;
  saved: ReturnType<typeof useSavedFilters>;
  lists: TodoList[];
  view: SmartView;
  selectedList: string | null;
  today: string;
  filter: TodoFilter;
  sort: TodoSort;
  setSelectedList: (list: string | null) => void;
  setView: (view: SmartView) => void;
  setCombined: (combined: boolean) => void;
  setFilterSort: (filter: TodoFilter, sort: TodoSort) => void;
}

export function useTodoActions(deps: TodoActionsDeps) {
  // In der Heute-Ansicht ohne Datum default auf heute, damit der neue Task sofort
  // sichtbar ist (sonst landet er ohne due außerhalb der "Heute"-Smart-View).
  // Explizites @datum (input.due gesetzt) ODER eine explizite Ziel-Liste via
  // &Liste (hadExplicitList) unterdrücken das Auto-due. shouldAutoDue kapselt
  // die Entscheidung als EINE testbare Stelle (#6/#2).
  function onAdd(input: TodoTaskCreate, hadExplicitList: boolean) {
    const autoToday =
      input.due == null && shouldAutoDue(deps.view, deps.selectedList, hadExplicitList);
    deps.mut.add.mutate(autoToday ? { ...input, due: deps.today } : input);
  }
  function onToggle(task: TodoTask) {
    // Undo-Toast-Logik (Recurrence + Variante A) in todoUndo.ts gekapselt.
    const onUndo = () => deps.mut.update.mutate({ id: task.id, listId: task.listId, done: false });
    const opts = undoToggleOptions(task, !task.done, deps.lists, onUndo);
    deps.mut.update.mutate({ id: task.id, listId: task.listId, done: !task.done }, opts);
  }
  function onRename(task: TodoTask, title: string) {
    deps.mut.update.mutate({ id: task.id, listId: task.listId, title });
  }
  function onReschedule(task: TodoTask, due: string | null) {
    deps.mut.update.mutate({ id: task.id, listId: task.listId, due });
  }
  // toSection wird weggelassen → Backend hängt den Task ans Ende der Ziel-Liste.
  function onMove(task: TodoTask, toList: string) {
    deps.mut.move.mutate({ id: task.id, fromList: task.listId, toList });
  }
  function onDelete(task: TodoTask) {
    deps.mut.remove.mutate({ id: task.id, listId: task.listId });
  }
  // DnD-Umsortieren nur in der konkreten Listenansicht (selectedList gesetzt),
  // nicht in Smart-Views/Kombi-Modus — dort gibt es keine stabile, listengebundene
  // Reihenfolge. Zusätzlich nur in der unveränderten ("pristine") manuellen Ansicht:
  // sobald gefiltert oder umsortiert wird, entspricht die sichtbare Reihenfolge nicht
  // mehr der Datei-Reihenfolge, ein Reorder wäre dann mehrdeutig.
  const reorderable =
    deps.selectedList !== null && deps.sort === "manual" && !isFilterActive(deps.filter);
  function onReorder(activeId: string, targetId: string, before: boolean) {
    if (deps.selectedList) {
      deps.mut.reorder.mutate({ listId: deps.selectedList, id: activeId, targetId, before });
    }
  }

  // Aktuellen Zustand (View/Liste + Filter + Sort) als benannten Filter sichern.
  function onSaveCurrent(name: string) {
    deps.saved.addFilter({
      id: crypto.randomUUID(),
      name,
      view: deps.selectedList ? null : deps.view,
      listId: deps.selectedList,
      filter: deps.filter,
      sort: deps.sort,
    });
  }
  // Gespeicherten Filter komplett anwenden: View/Liste setzen, dann Filter+Sort.
  // Kombi-Modus verlassen (ein Saved Filter zielt auf View/Liste).
  function onApplyFilter(sf: SavedFilter) {
    deps.setCombined(false);
    deps.setSelectedList(sf.listId);
    if (!sf.listId) deps.setView(sf.view ?? "today");
    deps.setFilterSort(sf.filter, sf.sort);
  }

  return {
    onAdd,
    onToggle,
    onRename,
    onReschedule,
    onMove,
    onDelete,
    reorderable,
    onReorder,
    onSaveCurrent,
    onApplyFilter,
  };
}

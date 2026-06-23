import { useEffect, useState } from "react";
import type { TodoTask } from "../../../../../shared/types";
import type { SmartView } from "./smartViewFilter";
import type { useTodoMutations } from "./useTodoMutations";

// Kapselt die Auswahl-/Bulk-Logik der TodosPage: Select-Mode, selektierte IDs und
// das Ausführen einer Bulk-Aktion. Verhalten 1:1 wie zuvor inline in TodosPage.
export function useTodoSelection(params: {
  allTasks: TodoTask[];
  view: SmartView;
  selectedList: string | null;
  bulk: ReturnType<typeof useTodoMutations>["bulk"];
}): {
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelectMode: () => void;
  onSelectBulk: (task: TodoTask) => void;
  selectedTasks: TodoTask[];
  runBulk: (op: Parameters<ReturnType<typeof useTodoMutations>["bulk"]["mutate"]>[0]) => void;
  clearSelection: () => void;
} {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auswahl leeren bei View-/Listenwechsel — die sichtbaren Tasks ändern sich,
  // eine listenübergreifende Auswahl wäre dann irreführend.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [params.view, params.selectedList]);

  function toggleSelectMode() {
    setSelectMode((on) => !on);
    setSelectedIds(new Set());
  }
  function onSelectBulk(task: TodoTask) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }
  // Selektierte Tasks aus ALLEN geladenen Listen (nicht nur den sichtbaren),
  // damit listId für die Bulk-RPCs verfügbar ist.
  const selectedTasks = params.allTasks.filter((t) => selectedIds.has(t.id));
  function runBulk(op: Parameters<typeof params.bulk.mutate>[0]) {
    params.bulk.mutate(op);
    setSelectedIds(new Set());
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  return {
    selectMode,
    selectedIds,
    toggleSelectMode,
    onSelectBulk,
    selectedTasks,
    runBulk,
    clearSelection,
  };
}
